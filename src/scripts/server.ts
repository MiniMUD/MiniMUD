import Server from '@/server';
import { load, script } from './level';

const server = new Server({
    consoleElement: document.getElementById('console'),
    load,
    motd: 'Welcome!',
    // logConnections: true,
});
script(server);

Object.assign(window, {
    server,
});
