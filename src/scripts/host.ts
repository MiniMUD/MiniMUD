// window.open(popserver, '_blank', 'noopener=true,popup=true,width=400,height=800');
// setTimeout(() => {
//     window.location.replace(client);
// }, 1000);

import Server from '@/server';
import { load, script } from './level';
import { createElement } from '@/util/create-element';
import { Player } from '@/server/game';
import { SaveFile } from '@/server/savefile';
import { nullike } from '@/util/gaurd';
import { Accessor } from '@/server/gamestate/accessor';
import { t } from '@/common/runtime-types';

const urlParams = new URLSearchParams(window.location.search);
const server = new Server({
    consoleElement: document.getElementById('console'),
    load,
    motd: 'Welcome!',
    id: urlParams.get('id'),
    logErrorsToBuiltinConsole: true,
    logToBuiltinConsole: true,
});
script(server);

const renderPlayer = (player: Player) =>
    createElement('li', {
        text: player.name,
        classList: ['list-group-item', 'd-flex', 'flex-row', 'justify-content-between', 'fw-bold'],
        children: [
            createElement('div', {
                classList: ['btn-toolbar'],
                children: [
                    createElement('div', {
                        classList: ['btn-group', 'btn-group-sm', 'me-2'],
                        children: [
                            createElement('button', {
                                text: 'Reset Password',
                                classList: ['btn', 'btn-warning'],
                                onclick() {
                                    server.kickPlayer(player._id);
                                    server.resetPassword(player._id);
                                },
                            }),
                        ],
                    }),
                    createElement('div', {
                        classList: ['btn-group', 'btn-group-sm', 'me-2'],
                        children: [
                            createElement('button', {
                                text: 'Kick',
                                classList: ['btn', 'btn-danger'],
                                disabled: !server.api.isConnected(player.token),
                                onclick() {
                                    server.kickPlayer(player._id);
                                },
                            }),
                            createElement('button', {
                                text: 'Delete',
                                classList: ['btn', 'btn-danger'],
                                onclick() {
                                    server.deletePlayer(player._id);
                                },
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

const updatePlayerList = () => {
    const playerList = document.getElementById('playerlist');

    const children = server.players().sort((a, b) => {
        return +server.api.isConnected(b.token) - +server.api.isConnected(a.token);
    });
    if (children.length) {
        playerList.replaceChildren(
            createElement('div', {
                children: [
                    createElement('h6', { text: 'Online' }),
                    createElement('ul', {
                        classList: ['list-group', 'mb-2'],
                        children: children.filter((x) => server.api.isConnected(x.token)).map(renderPlayer),
                    }),
                    createElement('h6', { text: 'Offline' }),
                    createElement('ul', {
                        classList: ['list-group', 'mb-2'],
                        children: children.filter((x) => !server.api.isConnected(x.token)).map(renderPlayer),
                    }),
                ],
            })
        );
    } else {
        playerList.replaceChildren(
            createElement('span', {
                text: 'Waiting for players to join...',
                classList: ['fst-italic', 'text-subtle', 'ms-2'],
            })
        );
    }
};

server.playerListChange.on(updatePlayerList);

const renderSave = (save: SaveFile) => {
    return createElement('div', {
        classList: ['list-group-item', 'd-flex', 'flex-row', 'justify-content-between'],
        children: [
            createElement('div', {
                children: [
                    createElement('h6', {
                        classList: [],
                        text: save.name,
                    }),
                    createElement('div', {
                        classList: ['fst-italic', 'text-subtle'],
                        text: new Date(save.time).toLocaleString(),
                    }),
                ],
            }),
            createElement('div', {
                classList: ['btn-group', 'btn-group-sm'],
                children: [
                    createElement('button', {
                        text: 'Load',
                        classList: ['btn', 'btn-primary'],
                        onclick() {
                            server.load(save);
                        },
                    }),
                    createElement('button', {
                        text: 'Download',
                        classList: ['btn', 'btn-secondary'],
                        onclick() {
                            save.download();
                        },
                    }),
                    createElement('button', {
                        text: 'Delete',
                        classList: ['btn', 'btn-danger'],
                        onclick() {
                            server.store.delete(save);
                        },
                    }),
                ],
            }),
        ],
    });
};

const updateSavelist = () => {
    const saveList = document.getElementById('savelist');
    const saves = Array.from(server.store);
    saves.sort((a, b) => a.time - b.time);
    saveList.replaceChildren(
        createElement('div', {
            classList: ['list-group'],
            children: saves.map(renderSave),
        })
    );
};
server.store.change.on(updateSavelist);

server.loaded.once(() => {
    updatePlayerList();
    updateSavelist();
});

const dropzone = document.getElementById('dropzone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) =>
    dropzone.addEventListener(eventName, (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
    })
);

dropzone.addEventListener('drop', (ev: DragEvent) => {
    console.log('File(s) dropped');

    if (ev.dataTransfer.items) {
        // Use DataTransferItemList interface to access the file(s)
        [...ev.dataTransfer.items].forEach(async (item, i) => {
            // If dropped items aren't files, reject them
            if (item.kind === 'file') {
                const file = item.getAsFile();
                server.store.load(file);
            }
        });
    } else {
        // Use DataTransfer interface to access the file(s)
        [...ev.dataTransfer.files].forEach((file, i) => {
            console.log(`… file[${i}].name = ${file.name}`);
        });
    }
});

function componentEditorString(target: string, accessor: Accessor<string>) {
    const inp = createElement('input', { attributes: { type: 'text' }, classList: ['component-text'] });
    inp.value = accessor.get(target) || '';
    inp.oninput = () => {
        try {
            accessor.setSafe(target, inp.value);
            server.game.touch(50);
        } catch (err) {
            server.error(err);
        }
    };
    const label = createElement('div', { text: accessor.name });
    return createElement('div', {
        children: [label, inp],
    });
}

function section(title: string, callback: (arr: HTMLElement[]) => void) {
    const children: HTMLElement[] = [];
    callback(children);

    return createElement('div', {
        children: [
            createElement('h2', { text: title }),
            createElement('div', {
                classList: ['d-flex', 'flex-column', 'ps-2'],
                children: children.map((x) =>
                    createElement('div', {
                        classList: ['mb-2'],
                        children: [x],
                    })
                ),
            }),
        ],
    });
}

function buttonGroup(names: string[], arr: HTMLElement[]): HTMLButtonElement[] {
    const buttons = names.map((text) =>
        createElement('button', { text, attributes: { type: 'button' }, classList: ['btn', 'btn-outline-primary'] })
    );

    arr.push(
        createElement('div', {
            classList: ['btn-group'],
            children: buttons,
        })
    );

    return buttons;
}

const renderCreatePanel = () => {
    const el = document.getElementById('edit');
    const children: HTMLElement[] = [];

    children.push(
        section('Level', (children) => {
            const [rst, exp] = buttonGroup(['New Level', 'Export Level'], children);
            rst.onclick = () => server.reset();
            exp.onclick = () => server.downloadLevel('level');
        })
    );

    children.push(
        section('Create', (children) => {
            const [room] = buttonGroup(['Room'], children);
            room.onclick = () => {
                const e = server.game.createRoom('new room');
                server.game.touch();
                renderEditPanel(e);
            };

            const [prop, item, chest, backpack] = buttonGroup(['Prop', 'Item', 'Chest', 'Backpack'], children);
            prop.onclick = () => {
                const e = server.game.createProp('new prop');
                server.game.touch();
                renderEditPanel(e);
            };
            item.onclick = () => {
                const e = server.game.createItem('new item');
                server.game.touch();
                renderEditPanel(e);
            };
            chest.onclick = () => {
                const e = server.game.createChest('new chest');
                server.game.touch();
                renderEditPanel(e);
            };
            backpack.onclick = () => {
                const e = server.game.createBackpack('new backpack');
                server.game.touch();
                renderEditPanel(e);
            };
        })
    );

    el.replaceChildren(...children);
};

const renderEditPanel = (target: string) => {
    const el = document.getElementById('edit');
    if (nullike(target)) {
        renderCreatePanel();
        return;
    }

    const children: HTMLElement[] = [];

    const archetype = server.game.getArchetype(target);
    const name = server.game.about(target);
    children.push(createElement('h2', { text: name }));
    if (archetype) children.push(createElement('span', { text: archetype.name, classList: ['lead'] }));

    for (const accessor of [server.game.name, server.game.description])
        if (accessor.has(target)) children.push(componentEditorString(target, accessor));

    el.replaceChildren(...children);
};

window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') renderEditPanel(null);
});

server.ready.on(() => {
    const link = document.getElementById('copy-link');
    link.textContent = server.url();

    let tree: ReturnType<typeof server.tree>;
    server.attach((game) => {
        tree = server.tree();
        const treeEL = document.getElementById('tree');
        treeEL.replaceChildren(tree.list);

        let selection: string;
        game.change.on(() => tree.lazyUpdate());
        tree.select.on((target) => {
            selection = target;
        });

        treeEL.onclick = () => {
            setTimeout(() => {
                renderEditPanel(selection);
                selection = null;
            });
        };

        renderEditPanel(null);
    });

    setInterval(() => tree.lazyUpdate(), 5000);

    document.getElementById('copy-link-btn').onclick = () => {
        navigator.clipboard.writeText(server.url());
    };
});

Object.assign(window, {
    server,
});
