import Server from '@/host';

const consoleElement = document.getElementById('console');
const server = new Server({
    consoleElement,
    load: require('@assets/level.minimud').default,
    motd: 'Welcome!',
    // logConnections: true,
});

server.script((ctx) => {
    const earth = ctx.room('earth');
    const containment = ctx.room('containment');
    const lab = ctx.room('lab');
    const scientist = ctx.npc('scientist');
    const nowhere = ctx.room('nowhere');

    ctx.on.player.enter(earth, (trigger) => {
        ctx.util.sequence(trigger, [
            [0.25, () => ctx.tell(trigger, 'You are blinded by a bright light')],
            [
                1,
                () =>
                    ctx.forEachPlayer((player) => {
                        if (player === trigger) return;
                        ctx.chapter(player, 'Chapter 1', 'You wake up in a dark containment cell');
                        ctx.move(player, containment);
                    }),
            ],
        ]);
    });

    ctx.on.player.enter(lab, (player) => {
        ctx.util.sequence(player, [
            [0.25, () => scientist.say('AAAAAAAAAAAAAAAAAAAAAAAAAAAHHHHH!!!!!!!')],
            [1, () => ctx.move(scientist, nowhere)],
        ]);
    });
});

Object.assign(window, {
    server,
});
