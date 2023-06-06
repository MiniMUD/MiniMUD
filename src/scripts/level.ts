import Server from '@/server';

export function script(server: Server) {
    server.script((ctx) => {
        const earth = ctx.room('earth');
        const containment = ctx.room('containment');
        const lab = ctx.room('lab');
        const control_room = ctx.room('control_room');
        const scientist = ctx.npc('scientist');
        const nowhere = ctx.room('nowhere');

        ctx.on.player.enter(earth, (trigger) => {
            ctx.util.sequence(trigger, [
                [0.1, () => ctx.tell(trigger, 'You are blinded by a bright light')],
                [
                    1,
                    () =>
                        ctx.forEachPlayer((player) => {
                            ctx.chapter(player, 'Chapter 1', 'You wake up in a dark containment cell');
                            ctx.move(player, containment);
                        }),
                ],
            ]);
        });

        ctx.on.player.enter(lab, (player) => {
            ctx.util.sequence(player, [
                [0.25, () => scientist.say('AAAAAAAAAAAAAAAAAAAAAAAAAAAHHHHH!!!!!!!')],
                [1, () => ctx.move(scientist, control_room)],
            ]);
        });
    });
}

export const load = require('@assets/level.minimud').default;
