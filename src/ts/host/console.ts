import { Game, adjacencyRelation } from './game';
import { ConsoleManager, inline, style, MenuItemDescriptor, BACK, s } from '@common/console';
import Server from './server';
import { Entity } from './gamestate/gamestate';
import { gaurd, nullike } from '@/util/gaurd';
import { Accessor, ReadonlyFlag } from './gamestate/accessor';
import { form } from '@/util/form';
import { ServerModule } from './server-module';

export default class ModuleServerConsole extends ServerModule {
    public name = 'Console';

    public get game() {
        return this.server.game;
    }
    public console: ConsoleManager;
    public server: Server;

    public load(server: Server) {
        this.console = server.console;
        this.server = server;
        server.loaded.once(async () => {
            this.server.divider();
            this.server.log(style('MiniMUD server', s.title));
            this.server.log(style('Press "C" to copy the link to this lobby. Share this link to invite your friends.'));
            this.server.log(style('Press "J" to join in a new tab.'));
            this.server.log(style('Press "S" to download a save.'));
            this.server.log(style('Press "L" to load a save.'));
            this.server.divider();

            while (true) {
                await this.mainMenu();
            }
        });
    }

    private async mainMenu() {
        await this.menu(
            'Commands',
            {
                text: 'Join',
                value: async () => window.open(this.server.url(), '_blank', 'noopener=true'),
            },
            {
                text: 'Copy Link',
                value: async () => {
                    const url = this.server.url();
                    this.server.log('Copied:', style(this.server.url(), ['fst-italic']), 'to clipboard');
                    navigator.clipboard.writeText(url);
                },
                keybind: 'c',
            },
            {
                text: 'Save',
                value: async () => await this.server.saveState(),
            },
            {
                text: 'Editor',
                value: async () =>
                    await this.submenu(
                        'Editor',
                        {
                            text: 'File',
                            value: this.file,
                        },
                        {
                            text: 'Edit',
                            value: this.edit,
                        },
                        {
                            text: 'View',
                            value: this.view,
                        }
                    ),
            }
        );
    }

    private file = async () =>
        await this.submenu(
            'File',
            {
                text: 'Export',
                value: async () => await this.server.exportLevel(),
            },
            {
                text: 'New',
                value: async () => await this.confirm('Delete Everything?', () => this.server.load()),
            }
        );

    private rooms = async () =>
        this.submenu(
            'Edit Rooms',
            {
                text: 'Create',
                value: async () =>
                    gaurd(
                        await form({
                            name: () => this.getEntityName('Create Room', 'Name', 'name'),
                            description: () => this.ask('Create Room', 'Description', 'description'),
                        }),
                        (res) => this.game.createRoom(res.name, res.description)
                    ),
            },
            {
                text: 'Link',
                value: async () => await this.link(),
            },
            {
                text: 'Unlink',
                value: async () => await this.unlink(),
            },
            {
                text: 'Show List',
                value: async () => {
                    this.server.divider();
                    this.listArchetype('Rooms:', this.game.room);
                    this.server.divider();
                },
            }
        );

    public objects = async () =>
        await this.menu(
            'Objects',
            {
                text: 'Create',
                value: async () =>
                    gaurd(
                        await form({
                            type: () =>
                                this.pick(
                                    'Object Type',
                                    { text: 'Prop', value: 'prop' },
                                    { text: 'Item', value: 'item' },
                                    { text: 'Chest', value: 'chest' },
                                    { text: 'Backpack', value: 'backpack' },
                                    BACK
                                ),
                            name: () => this.getEntityName('Create Object', 'Name', 'name'),
                            description: () => this.ask('Create Object', 'Description', 'description'),
                        }),
                        (res) => {
                            switch (res.type) {
                                case 'prop':
                                    this.game.command(this.game.createProp, res.name, res.description);
                                    break;
                                case 'item':
                                    this.game.command(this.game.createItem, res.name, res.description);
                                    break;
                                case 'chest':
                                    this.game.command(this.game.createChest, res.name, res.description);
                                    break;
                                case 'backpack':
                                    this.game.command(this.game.createBackpack, res.name, res.description);
                                    break;
                            }
                        }
                    ),
            },
            {
                text: 'Move',
                value: this.move,
            },
            {
                text: 'Show List',
                value: async () => {
                    this.server.divider();
                    this.listArchetype('Props:', this.game.prop);
                    this.listArchetype('Items:', this.game.item);
                    this.listArchetype('Chest:', this.game.chest);
                    this.listArchetype('Backpack:', this.game.backpack);
                    this.server.divider();
                },
            }
        );

    public npc = async () =>
            this.submenu(
                'NPC',
                {
                    text: 'Create',
                    value: async () =>
                        gaurd(
                            await form({
                                name: () => this.getEntityName('Create NPC', 'Name', 'name'),
                            }),
                            (res) => this.game.createNPC(res.name),
                        ),
                }
            )

    private edit = async () =>
        this.submenu(
            'Edit',
            {
                text: 'Rooms',
                value: this.rooms,
            },
            {
                text: 'Objects',
                value: this.objects,
            },
            {
                text: 'NPCs',
                value: this.npc,
            },
            {
                text: 'Move',
                value: this.move,
            },
            {
                text: 'Rename',
                value: async () =>
                    await gaurd(
                        await form({
                            target: () => this.search('Rename', 'Target', 'target', [this.game.name]),
                            name: () => this.getEntityName('Rename', 'New Name', '...'),
                        }),
                        (res) => this.game.name.set(res.target, res.name)
                    ),
            },
            {
                text: 'Delete',
                value: async () =>
                    await gaurd(
                        await form({
                            target: () => this.search('Delete', 'Target', 'target'),
                        }),
                        (res) => this.game.destroyEntity(res.target)
                    ),
            }
        );

    private view = async () =>
        this.submenu(
            'View',
            {
                text: 'Inspect',
                value: async () => await this.inspect(await this.search()),
            },
            {
                text: 'List',
                value: async () => await this.listArchetype('Entities:'),
            }
        );

    private async search(
        title: string = 'Search',
        label: string = 'Entity Name:',
        placeholder: string = 'name',
        archetype: ReadonlyFlag[] = []
    ): Promise<string | null> {
        const pick = (targets: string[]) =>
            this.pick(
                title,

                ...targets.map((id) => ({
                    text: this.game.name.get(id),
                    value: id,
                })),
                BACK
            );

        // if there are less than 10 options dont bother asking for a name
        let result = this.game.filter(this.game.name, ...archetype);
        if (result.length < 10) return pick(result);

        const name = await this.ask(title, label, placeholder);
        if (nullike(name)) return null;

        const exact = this.game.find(name);
        if (exact) return exact;

        const selection = pick(this.game.search(name, archetype));
        if (selection === null) return await this.search();
        return selection;
    }

    private async move() {
        return await gaurd(
            await form({
                target: () => this.search('Move', 'Target', 'target', [this.game.parent]),
                container: () => this.search('Move', 'Container', 'container', [this.game.children]),
            }),
            (res) => this.game.command(this.game.move, res.target, res.container)
        )
    }

    private async getEntityName(title: string, label: string, placeholder: string) {
        let name = await this.ask(title, label, placeholder);
        if (nullike(name)) return null;

        while (this.game.find(name) !== undefined) {
            this.server.warn(`name ${name} is already in use`);

            name = await this.ask(title, label, placeholder);
            if (name === null) return null;
        }
        return name;
    }

    private async inspect(target: Entity) {
        if (nullike(target)) return;
        let title = this.game.getTypeString(target);

        this.server.divider();
        this.server.log(
            style(inline(`${title}: `, style(this.game.name.get(target), ['fw-bold', 'fst-italic'])), ['fs-5'])
        );

        for (const [key, value] of Object.entries(this.game.state.inspect(target))) {
            if (value !== undefined) {
                this.server.log(` - ${key}:`, this.game.resolveArg(value));
            }
        }

        if (this.game.room.is(target)) {
            this.server.log(' - neighbors:');

            for (const door of this.game.doors(target)) {
                this.server.log(
                    `   - ${this.game.direction.get(door)}:`,
                    this.game.resolveArg(this.game.reference.get(door)),
                    ' ',
                    this.game.locked.get(door) ? '(locked)' : '(unlocked)'
                );
            }
        }
        this.server.divider();
    }

    private directions(left: string, right: string) {
        return [
            {
                text: `${left} north of ${right}`,
                value: adjacencyRelation.northof,
                keybind: 'n',
            },
            {
                text: `${left} south of ${right}`,
                value: adjacencyRelation.southof,
                keybind: 's',
            },
            {
                text: `${left} east of ${right}`,
                value: adjacencyRelation.eastof,
                keybind: 'e',
            },
            {
                text: `${left} west of ${right}`,
                value: adjacencyRelation.westof,
                keybind: 'w',
            },
            {
                text: `${left} above ${right}`,
                value: adjacencyRelation.above,
                keybind: 'a',
            },
            {
                text: `${left} below ${right}`,
                value: adjacencyRelation.below,
                keybind: 'b',
            },
        ]
    }

    private async link() {
        await gaurd(
            await form({
                left: () => this.search('Link - First', 'First', 'target', [this.server.game.room]),
                right: () => this.search('Link - Second', 'Second', 'target', [this.server.game.room]),
                relation: (has) => {
                    return this.pick(
                        'Relation',
                        ...this.directions(this.game.name.get(has.left), this.game.name.get(has.right)),
                        BACK
                    );
                },
                locked: () => this.pick('Locked', { text: 'Yes', value: true }, { text: 'No', value: false }, BACK),
            }),
            (res) => this.game.command(this.game.connectRooms, res.left, res.relation, res.right, res.locked)
        );
    }

    private async unlink() {
        await gaurd(
            await form({
                left: () => this.search('Unlink - First', 'First', 'target', [this.server.game.room]),
                right: () => this.search('Unink - Second', 'Second', 'target', [this.server.game.room]),
            }),
            (res) => this.game.command(this.game.disconnectRooms, res.left, res.right)
        );
    }

    // menu utility
    private async ask(title: string, label: string, placeholder?: string) {
        const result = await this.console.ask(title, label, placeholder);
        if (nullike(result)) return null;
        return result;
    }

    private pick<T>(title: string, ...items: MenuItemDescriptor<T>[]) {
        return this.console.menu(title, ...items);
    }

    private async menu(title: string, ...items: MenuItemDescriptor<() => Promise<any>>[]) {
        const result = await this.console.menu(title, ...items);
        if (nullike(result)) return;
        await result();
        return;
    }

    private async submenu(title: string, ...items: MenuItemDescriptor<() => Promise<any>>[]) {
        let back = false;
        while (!back)
            await this.menu(title, ...items, {
                text: 'Back',
                value: async () => {
                    back = true;
                },
                keybind: 'Escape',
                keyicon: 'ESC',
            });
    }

    private async confirm(title: string, callback: () => void) {
        return await gaurd(
            await form({
                confirm: () => this.pick(title, { text: 'Yes', value: true }, { text: 'No', value: false }),
            }),
            (res) => {
                if (res.confirm) callback();
            }
        );
    }

    private listArchetype(title: string, ...archetype: ReadonlyFlag[]) {
        this.server.log(title);
        this.game
            .filter(...archetype)
            .forEach((e) =>
                this.server.log(
                    ` - ${this.game.about(e)}`,
                    style(this.game.getTypeString(e), ['fst-italic', 'text-subtle'])
                )
            );
    }
}
