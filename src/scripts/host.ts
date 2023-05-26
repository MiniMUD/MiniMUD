import Server from '@/host';

const consoleElement = document.getElementById('console');
const server = new Server({
    consoleElement,
    load: require('@assets/level.minimud').default,
    motd: 'Welcome!',
});

server.script((ctx)=>{
    const butler = ctx.npc('Butler');
    const hallway = ctx.room('Hallway');

    ctx.on.npc.greet(butler, (player) => {
        ctx.util.sequence(player, [
            [1, ()=>butler.say(`Welcome ${player.name}!`), true],
            [2, ()=>butler.whisper(player, `Move upstairs to "Hallway" when you're ready to start exploring.`), true],
            [2, ()=>butler.whisper(player, `Press "M" to open the move menu, and "H" to select hallway.`), true],
        ]);
    });

    let last = 0;
    ctx.on.player.enter(hallway, async (player)=>{
        if (await ctx.util.playerMovesInTheNextNSeconds(player, Math.random()*8)) return;
        if (Date.now() - last < 10000) return;
        last = Date.now();
        ctx.tell(hallway, `The floorboards creak as ${player.name} steps on them.`);
    });
});

Object.assign(window, {
    server,
});
