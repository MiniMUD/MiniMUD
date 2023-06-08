import Server from '@/server';
import { load, script } from './level';
import { createElement } from '@/util/create-element';
import { Player } from '@/server/game';
import { SaveFile } from '@/server/savefile';

const urlParams = new URLSearchParams(window.location.search);
const server = new Server({
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

Object.assign(window, {
    server,
});
