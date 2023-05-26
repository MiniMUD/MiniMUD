import Client from '@/client';

const consoleElement = document.getElementById('console');
const urlParams = new URLSearchParams(window.location.search);
const client = new Client({
    consoleElement,
    server: urlParams.get('server_id'),
});
client.start();

Object.assign(window, {
    client,
});
