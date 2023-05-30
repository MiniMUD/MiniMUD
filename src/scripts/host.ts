import Server from '@/host';

const consoleElement = document.getElementById('console');
const server = new Server({
    consoleElement,
    load: require('@assets/level.minimud').default,
    motd: 'Welcome!',
    logConnections: true,
});

server.script((ctx) => {
    const earth = ctx.room('earth');
    const containment = ctx.room('containment');

    ctx.on.player.enter(earth, (player) => {
        ctx.util.sequence(player, [
            [0.5, () => ctx.tell(player, 'You are blinded by a bright light')],
            [1, () => ctx.move(player, containment)],
        ]);
    });
});

Object.assign(window, {
    server,
});
