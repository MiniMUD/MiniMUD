import { ConnectionBroker } from '@/common/session/connection-broker';

const id = ConnectionBroker.GetID();
const popserver = `/popserver?id=${id}`;
const client = `/client?server_id=${id}`;

window.open(popserver, '_blank', 'noopener=true,popup=true,width=400,height=800');
setTimeout(() => {
    window.location.replace(client);
}, 1000);
