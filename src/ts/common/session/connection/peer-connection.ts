import { DataConnection } from 'peerjs';
import { Connection } from './connection';

export class PeerConnection extends Connection {
    private connection: DataConnection;

    constructor(connection: DataConnection) {
        super();

        this.connection = connection;

        connection.on('close', () => {
            this.close.emit();
        });

        connection.on('data', (data) => {
            if (typeof data === 'string') data = JSON.parse(data);
            this.write(data);
        });

        connection.on('error', (err) => {
            this.error.emit(err);
        });
    }

    public send(data: unknown): void {
        this.connection.send(data);
    }

    public end() {
        this.connection.close();
    }
}
