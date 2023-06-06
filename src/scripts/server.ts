import Server from '@/server';
import { load, script } from './level';

const consoleElement = document.getElementById('console');
const server = new Server({
    consoleElement,
    load,
    motd: 'Welcome!',
    // logConnections: true,
});
script(server);

Object.assign(window, {
    server,
});
