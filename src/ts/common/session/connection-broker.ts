import { DataConnection, Peer } from 'peerjs';
import { EventChannel } from '@/util/event-channel';
import { Api } from './api';
import { Connection, PeerConnection } from './connection';
import { alphanumericID } from '@/util/id';

const prefix = 'WJSF9a8594h32';

export class ConnectionBroker {
    private peer: Peer;
    public readonly api = new Api();

    public discoveryID: string;
    public peerID: string;

    private _id: string;

    private accept: boolean = false;

    public connection = new EventChannel((connection: Connection) => {});
    public ready = new EventChannel(() => {});

    public constructor() {
        this.discoveryID = window.sessionStorage.getItem('discovery_id') ?? alphanumericID(16);
        window.sessionStorage.setItem('discovery_id', this.discoveryID);
        this.peerID = this.expand(this.discoveryID);
    }

    public expand(id: string) {
        return prefix + '_' + id;
    }

    private setup() {
        this.peer = new Peer(this.peerID);
        this.peer.on('connection', (connection) => this.incoming(connection));
        this.peer.on('open', (id) => {
            this._id = id;
            this.ready.emit();
        });
        this.peer.on('error', console.error);
        this.peer.on('close', console.error);
    }

    private incoming(dataConnection: DataConnection): void {
        if (!this.accept) return dataConnection.close();
        this.connection.emit(this.listen(dataConnection));
    }

    private listen(dataConnection: DataConnection): Connection {
        const connection = new PeerConnection(dataConnection);
        this.api.listen(connection);
        return connection;
    }

    public start() {
        if (!this.peer) this.setup();
        this.accept = true;
    }

    public stop() {
        this.accept = false;
    }

    public get id(): string {
        if (this._id) return this.discoveryID;
    }

    public url(path: string, query: string) {
        const origin = window.location.origin;
        return `${origin}/${path}?${query}=${this.discoveryID}`;
    }

    public connect(id: string): Promise<Connection> {
        return new Promise((resolve, reject) => {
            const dataConnection = this.peer.connect(this.expand(id));

            const errorCallback = (err: Error) => reject(err);

            dataConnection.on('open', () => {
                dataConnection.off('error', errorCallback);
                resolve(this.listen(dataConnection));
            });

            dataConnection.on('error', errorCallback);
        });
    }
}
