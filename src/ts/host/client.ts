import { BACK, inline, s, style } from '@/common/console';
import Server from '@/host/server';
import { Game } from './game';
import { Method, RequestWriter, ResponseWriter, Status } from '@/common/message';
import { Entity } from './gamestate/gamestate';
import { ElementDescriptor, block, center, divider, lines } from '@/common/console/element';
import { ServerModule } from './server-module';
import { MenuFieldItem } from '@/common/message/content-type';
import { hashNumbers } from '@/util/hash';
import { lowercase } from '@/util/gaurd';
import { charset } from '@/util/id';

export default class ModuleClient extends ServerModule {
    public name = 'Commands';

    public load(server: Server) {
        const api = server.api;

        function log(...args: any[]) {
            return style(inline(...args), s.subtle);
        }

        function encode(str: string) {
            return style(
                str
                    .split(' ')
                    .map((x) => charset(hashNumbers(x).slice(0, x.length), lowercase))
                    .join(' '),
                s.glitch
            );
        }

        function textName(target: Entity, perspective: Entity) {
            const name = server.game.name.get(target);
            if (!name) return style('unknown', s.subtle);
            if (!server.game.canRead(target, perspective)) return encode(name);
            return style(name);
        }

        function format(target: Entity, txt?: ElementDescriptor) {
            if (!txt) txt = style(server.game.name.get(target));

            if (server.game.room.is(target)) return style(txt, s.room);
            if (server.game.npc.is(target)) return style(txt, s.npc);
            if (server.game.player.is(target)) return style(txt, s.player);
            if (server.game.backpack.is(target)) return style(txt, s.backpack);
            if (server.game.chest.is(target)) return style(txt, s.chest);
            if (server.game.item.is(target)) return style(txt, s.item);
            if (server.game.prop.is(target)) return style(txt, s.prop);
            if (server.game.name.has(target)) return style(txt, s.proper_noun);
            return txt;
        }

        function printName(target: Entity, perspective: Entity, you: string = 'You'): ElementDescriptor {
            if (perspective) if (target === perspective) return style(you, s.first_person);
            return format(target, textName(target, perspective));
        }

        function embed(container: ElementDescriptor[], callback: (res: ElementDescriptor[]) => void) {
            const embed: ElementDescriptor[] = [];
            callback(embed);
            container.push(style(lines(...embed), s.embed));
        }

        function spacer(res: ElementDescriptor[]) {
            res.push(style(divider(), s.spacer));
        }

        function look(res: ElementDescriptor[], target: Entity, perspective: Entity) {
            const game = server.game;
            const name =
                target === perspective
                    ? 'Inventory'
                    : server.game.room.is(target)
                    ? textName(target, perspective)
                    : printName(target, perspective);
            const description = game.description.get(target);

            res.push(style(name, s.lead));
            if (description && description.length)
                res.push(style(server.game.canRead(target, perspective) ? description : encode(description), s.italic));

            if (game.children.has(target)) {
                if (game.room.is(target)) {
                    const exits: ElementDescriptor[] = [];
                    for (const door of game.doors(target)) {
                        exits.push(
                            inline(
                                printName(game.reference.get(door), perspective),
                                style(inline(' (', game.direction.get(door), ') '), s.subtle)
                            )
                        );
                    }
                    res.push(inline(style('Exits: ', s.subtle), ...exits));
                }

                const children = server.game.binEntities(
                    game.children.get(target)?.filter((e) => e !== perspective && game.inVision(e, perspective)) ?? [],
                    [game.player, game.npc, game.prop, game.item, game.chest, game.backpack, game.object]
                );

                if (children.length) {
                    res.push(style('You see:', s.subtle));
                    for (const child of children) {
                        res.push(inline(' • ', printName(child, perspective)));
                    }
                }
            }
        }

        function createCommandEmbed(command: string, callback: (res: ElementDescriptor[]) => void) {
            const text: ElementDescriptor[] = [];
            spacer(text);
            text.push(log(command));
            embed(text, (res) => {
                callback(res);
            });
            spacer(text);
            return text;
        }

        function commandEmbed(res: ResponseWriter, command: string, callback: (res: ElementDescriptor[]) => void) {
            res.textContent(...createCommandEmbed(command, callback));
        }

        function renderLookCommand(command: string, target: Entity, player: Entity) {
            return createCommandEmbed(command, (res) => look(res, target, player));
        }

        function lookCommand(res: ResponseWriter, command: string, target: Entity, player: Entity) {
            commandEmbed(res, command, (res) => look(res, target, player));
        }

        api.command('/describe/room', ({ req, res, options, player }) => {
            lookCommand(res, `look`, server.game.roomOf(player), player);
        });

        api.command('/describe/:target', ({ req, res, options, player }) => {
            if (server.game.inVision(options.target, player)) {
                lookCommand(res, `look ${server.game.name.get(options.target)}`, options.target, player);
            } else {
                res.textContent('You cannot see that.');
            }
        });

        api.command('/commands', ({ req, res, options, player }) => {
            res.redirect(`/list_commands/${server.game.roomOf(player)}`);
        });

        api.command('/list_commands/:context', ({ req, res, options, player }) => {
            const items: MenuFieldItem[] = [];
            if (server.game.room.is(options.context)) {
                items.push({ text: 'Move', value: '/commands/list_move' });
                if (server.game.children.get(player).length) {
                    items.push({ text: 'Inventory', value: `/commands/look/${player}` });
                }
            }
            if (
                server.game.children.has(options.context) &&
                server.game.readableChildObjects(options.context, player).some((x) => server.game.object.is(x))
            ) {
                items.push({ text: 'Look', value: `/commands/list_look/${options.context}` });
            }
            if (
                server.game.children.has(options.context) &&
                !server.game.player.is(options.context) &&
                server.game.readableChildObjects(options.context, player).some((x) => server.game.carryable.is(x))
            ) {
                items.push({ text: 'Take', value: `/commands/list_take/${options.context}` });
            }
            if (server.game.player.is(options.context) && server.game.children.get(player).length) {
                items.push({ text: 'Drop', value: `/commands/list_drop/` });
            }
            if (server.game.room.is(options.context)) {
                items.push({ text: 'Say', value: '/commands/say' });
                items.push({ text: 'Whisper', value: '/commands/whisper' });
            }
            if (!items.length) return;
            if (server.game.room.is(options.context)) {
                items.push({
                    text: 'Refresh',
                    value: '/commands/look/room',
                });
            } else {
                items.push(BACK);
            }
            res.redirectMenu('Commands', items);
        });

        api.command('/commands/list_look/:target', ({ req, res, options, player }) => {
            const targets = server.game.readableChildObjects(options.target, player);
            res.redirectMenu('Look', [
                ...server.game
                    .binEntities(targets, [server.game.prop, server.game.item, server.game.chest, server.game.backpack])
                    .map((obj) => ({
                        text: server.game.name.get(obj),
                        value: `/commands/look/${obj}`,
                    })),
                BACK,
            ]);
        });

        api.command('/commands/look/room', ({ req, res, options, player }) => {
            res.sequence(`/describe/room`, `/commands`);
        });

        api.command('/commands/look/:target', ({ req, res, options, player }) => {
            res.sequence(`/describe/${options.target}`, `/list_commands/${options.target}`);
        });

        api.command('/commands/list_move', ({ req, res, options, player }) => {
            const doors = server.game.doors(server.game.parent.get(player));
            res.redirectMenu('Move', [
                ...doors.map((door) => ({
                    text: server.game.canRead(server.game.reference.get(door), player)
                        ? server.game.name.get(server.game.reference.get(door))
                        : server.game.direction.get(door),
                    value: `/commands/move/${server.game.direction.get(door)}`,
                })),
                BACK,
            ]);
        });

        api.command('/commands/move/:direction', ({ res, req, options, player }) => {
            const door = server.game.getDoor(server.game.roomOf(player), options.direction);
            if (server.game.locked.get(door)) {
                res.textContent(`${server.game.about(server.game.reference.get(door))} is locked.`);
            } else {
                server.game.movePlayerDirection(player, options.direction);
                lookCommand(res, `move ${options.direction}`, server.game.roomOf(player), player);
            }
        });

        api.command('/commands/list_take/:context', ({ req, res, options, player }) => {
            const targets = server.game.readableChildObjects(options.context, player);
            res.redirectMenu('Take', [
                ...server.game
                    .binEntities(targets, [server.game.carryable, server.game.item, server.game.backpack])
                    .map((target) => ({
                        text: server.game.name.get(target),
                        value: `/commands/take/${target}`,
                    })),
                BACK,
            ]);
        });

        api.command('/commands/take/:target', ({ req, res, options, player }) => {
            if (
                server.game.inVision(options.target, player) &&
                server.game.placeable.is(server.game.parent.get(options.target))
            ) {
                server.game.command(server.game.take, options.target, player);
            } else {
                res.textContent('You cannot take that.');
            }
        });

        api.command('/commands/list_drop/', ({ req, res, options, player }) => {
            const targets = server.game.readableChildObjects(player, player);
            res.redirectMenu('Drop', [
                ...server.game
                    .binEntities(targets, [server.game.carryable, server.game.item, server.game.backpack])
                    .map((target) => ({
                        text: server.game.name.get(target),
                        value: `/commands/drop/${target}`,
                    })),
                BACK,
            ]);
        });

        api.command('/commands/drop/:target', ({ req, res, options, player }) => {
            if (server.game.isHolding(options.target, player)) {
                server.game.command(server.game.drop, options.target, player);
            } else {
                res.textContent('You cannot drop that which you do not have.');
            }
        });

        api.public.form('/commands/say/', '/commands/say', {
            message: { title: 'Message:', label: ' > ', placeholder: '...' },
        });

        api.submit('/commands/say', ({ req, res, options, player, data }) => {
            server.game.say(server.game.parent.get(player), player, data.message);
        });

        api.command('/commands/whisper', ({ req, res, options, player, data }) => {
            res.formContent('/commands/whisper', {
                target: {
                    title: 'Whisper',
                    items: [
                        ...server.game
                            .filter(server.game.player)
                            .filter((x) => x !== player)
                            .map((e) => ({
                                text: server.game.name.get(e),
                                value: e,
                            })),
                        BACK,
                    ],
                },
                message: { title: 'Message:', label: ' > ', placeholder: '...' },
            });
        });

        api.submit('/commands/whisper', ({ req, res, options, player, data }) => {
            server.game.whisper(data.target, player, data.message);
        });

        server.attach((game: Game) => {
            game.send.on((target, message) => {
                try {
                    const token = server.game.token.get(target);
                    if (api.isConnected(token)) {
                        const req = new RequestWriter(Method.POST, { path: '/write' });
                        req.textContent(message);
                        api.request(token, req);
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            game.interupt.on((target) => {
                try {
                    const token = server.game.token.get(target);
                    if (api.isConnected(token)) {
                        const req = new RequestWriter(Method.POST, { path: '/interrupt', token });
                        // req.sequence('/describe/room');
                        api.request(token, req);
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            game.sessionStart.on((target) => {
                game.foreachPlayer((player) => {
                    if (target !== player) {
                        game.send(player, inline(printName(target, player), ' joined the game'));
                    }
                });
            });

            game.sessionEnd.on((target) => {
                game.foreachPlayer((player) => {
                    if (target !== player) game.send(player, inline(printName(target, player), ' left the game'));
                });
            });

            game.playerMove.on((target, from, to) => {
                if (game.player.is(target)) game.interupt(target);
                game.foreachPlayerIn(from, (player) => {
                    if (target === player) return;
                    game.send(player, inline(printName(target, player), ' left the room'));
                });
                game.foreachPlayerIn(to, (player) => {
                    if (target === player) return;
                    game.send(player, inline(printName(target, player), ' entered the room'));
                });
            });

            game.playerTeleport.on((target, from, to) => {
                if (game.player.is(target)) {
                    game.interupt(target);
                    // game.send(target, inline(printName(target, target), ` teleported to ${game.about(to)}`));
                    setTimeout(() => {
                        game.send(target, lines(...renderLookCommand('look', game.roomOf(target), target)));
                    });
                }
                game.foreachPlayerIn(from, (player) => {
                    if (target === player) return;
                    game.send(player, inline(printName(target, player), ' vanished'));
                });
                game.foreachPlayerIn(to, (player) => {
                    if (target === player) return;
                    game.send(player, inline(printName(target, player), ' appeared'));
                });
            });

            game.objectDropped.on((object, byPlayer, toRoom) => {
                game.foreachPlayerIn(toRoom, (player) => {
                    game.send(player, inline(printName(byPlayer, player), ' dropped ', printName(object, player)));
                });
            });

            game.objectTaken.on((object, fromRoom, byPlayer) => {
                game.foreachPlayerIn(fromRoom, (player) => {
                    game.send(player, inline(printName(byPlayer, player), ' took ', printName(object, player)));
                });
            });

            game.objectTakenFrom.on((object, fromObject, byPlayer) => {
                game.foreachPlayerIn(game.parent.get(fromObject), (player) => {
                    game.send(
                        player,
                        inline(
                            printName(byPlayer, player),
                            ' took ',
                            printName(object, player),
                            ' from ',
                            printName(fromObject, player)
                        )
                    );
                });
            });

            game.objectPut.on((object, byPlayer, toObject) => {
                game.foreachPlayerIn(game.parent.get(byPlayer), (player) => {
                    game.send(
                        player,
                        inline(
                            printName(byPlayer, player),
                            ' put ',
                            printName(object, player),
                            ' into ',
                            printName(toObject, player)
                        )
                    );
                });
            });

            game.objectGiven.on((object, byPlayer, toPlayer) => {
                for (const player in [byPlayer, toPlayer]) {
                    game.send(
                        player,
                        inline(
                            printName(byPlayer, player),
                            ' gave ',
                            printName(object, player),
                            ' to ',
                            printName(toPlayer, player)
                        )
                    );
                }
            });

            game.objectTeleported.on((object, from, to) => {
                game.foreachPlayerIn(from, (player) => {
                    game.send(player, inline(printName(object, player), ' vanished'));
                });
                game.foreachPlayerIn(to, (player) => {
                    game.send(player, inline(printName(object, player), ' appeared'));
                });
            });

            game.whisper.on((target, src, msg) => {
                game.send(
                    target,
                    inline(
                        style('[', s.subtle),
                        printName(src, target),
                        ' tells ',
                        printName(target, target),
                        style(']: ', s.subtle),
                        msg
                    )
                );
                game.send(
                    src,
                    inline(
                        style('[', s.subtle),
                        printName(src, src),
                        ' tell ',
                        printName(target, src),
                        style(']: ', s.subtle),
                        msg
                    )
                );
            });

            game.say.on((target, src, msg) => {
                game.foreachPlayerIn(target, (player) => {
                    game.send(
                        player,
                        inline(style('[', s.subtle), printName(src, player), style(']: ', s.subtle), msg)
                    );
                });
            });
        });
    }
}
