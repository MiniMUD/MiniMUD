import { BACK, inline, s, style } from '@/common/console';
import Server from '@/host/server';
import { Game } from './game';
import { Method, RequestWriter, ResponseWriter } from '@/common/message';
import { Entity } from './gamestate/gamestate';
import { ElementDescriptor, block, center, divider, lines } from '@/common/console/element';
import { ServerModule } from './server-module';
import { MenuFieldItem } from '@/common/message/content-type';
export default class ModuleClient extends ServerModule {
    public name = 'Commands';

    public load(server: Server) {
        const api = server.api;

        function log(...args: any[]) {
            return style(inline(...args), s.subtle);
        }

        function printName(target: Entity, perspective?: Entity, you: string = 'You'): ElementDescriptor {
            if (perspective) if (target === perspective) return style(you, s.first_person);
            if (server.game.room.is(target)) return style(server.game.name.get(target), s.room);
            if (server.game.npc.is(target)) return style(server.game.name.get(target), s.npc);
            if (server.game.player.is(target)) return style(server.game.name.get(target), s.player);
            if (server.game.backpack.is(target)) return style(server.game.name.get(target), s.backpack);
            if (server.game.chest.is(target)) return style(server.game.name.get(target), s.chest);
            if (server.game.item.is(target)) return style(server.game.name.get(target), s.item);
            if (server.game.prop.is(target)) return style(server.game.name.get(target), s.prop);

            if (server.game.name.has(target)) return style(server.game.name.get(target), s.proper_noun);
            return style('unknown', s.subtle);
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
            const name = target === perspective ? 'Inventory' : game.name.get(target);
            const description = game.description.get(target);

            res.push(style(name, s.lead));
            if (description && description.length) res.push(style(description, s.italic));

            if (game.children.has(target)) {
                if (game.room.is(target)) {
                    const exits: ElementDescriptor[] = [];
                    for (const door of game.doors(target)) {
                        exits.push(
                            inline(
                                printName(game.reference.get(door)),
                                style(inline(' (', game.direction.get(door), ') '), s.subtle)
                            )
                        );
                    }
                    res.push(inline(style('Exits: ', s.subtle), ...exits));
                }

                const children = server.game.binEntities(
                    (game.children.get(target) || []).filter((e) => e !== perspective),
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

        function commandEmbed(res: ResponseWriter, command: string, callback: (res: ElementDescriptor[]) => void) {
            const text: ElementDescriptor[] = [];
            spacer(text);
            text.push(log(command));
            embed(text, (res) => {
                callback(res);
            });
            spacer(text);
            res.textContent(...text);
        }

        function lookCommand(res: ResponseWriter, command: string, target: Entity, player: Entity) {
            commandEmbed(res, command, (res) => look(res, target, player));
        }

        api.command('/describe/room', ({ req, res, options, player }) => {
            lookCommand(res, `look`, server.game.roomOf(player), player);
        });

        api.command('/describe/:target', ({ req, res, options, player }) => {
            if (
                server.game.sameRoom(options.target, player) &&
                (server.game.room.is(options.target) ||
                    server.game.object.is(options.target) ||
                    options.target === player)
            ) {
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
                server.game.children.get(options.context).some((x) => server.game.object.is(x))
            ) {
                items.push({ text: 'Look', value: `/commands/list_look/${options.context}` });
            }
            if (
                server.game.children.has(options.context) &&
                !server.game.player.is(options.context) &&
                server.game.children.get(options.context).some((x) => server.game.carryable.is(x))
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
            if (!server.game.room.is(options.context)) {
                items.push(BACK);
            }
            res.redirectMenu('Commands', items);
        });

        api.command('/commands/list_look/:target', ({ req, res, options, player }) => {
            const targets = server.game.children.get(options.target);
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
            console.log(doors);
            res.redirectMenu('Move', [
                ...doors.map((door) => ({
                    text: server.game.name.get(server.game.reference.get(door)),
                    value: `/commands/move/${server.game.direction.get(door)}`,
                })),
                BACK,
            ]);
        });

        api.command('/commands/move/:direction', ({ res, req, options, player }) => {
            server.game.movePlayerDirection(player, options.direction);
            lookCommand(res, `move ${options.direction}`, server.game.roomOf(player), player);
        });

        api.command('/commands/list_take/:context', ({ req, res, options, player }) => {
            const targets = server.game.children.get(options.context);
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
                server.game.sameRoom(options.target, player) &&
                server.game.placeable.is(server.game.parent.get(options.target))
            ) {
                server.game.command(server.game.take, options.target, player);
            } else {
                res.textContent('You cannot take that.');
            }
        });

        api.command('/commands/list_drop/', ({ req, res, options, player }) => {
            const targets = server.game.children.get(player);
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
                        ...server.game.filter(server.game.player).filter(x=>x!==player).map((e) => ({
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

            game.sessionStart.on((target) => {
                game.foreachPlayer((player) => {
                    if (target !== player) {
                        game.send(player, inline(printName(target, player), ' joined the game'));
                    }
                });
            });

            game.sessionEnd.on((target) => {
                game.foreachPlayer((player) => {
                    if (target !== player) game.send(player, inline(printName(target), ' left the game'));
                });
            });

            game.playerMove.on((target, from, to) => {
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
                game.send(target, inline(printName(target, target), ` teleported to ${game.about(to)}`));
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
