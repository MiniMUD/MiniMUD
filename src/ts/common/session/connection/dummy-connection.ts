import { EventChannel } from '@/util/event-channel';
import { Connection } from './connection';

export class DummyConnection extends Connection {
    public outgoing = new EventChannel((data: unknown) => {});
    public incoming = new EventChannel((data: unknown) => {});

    public constructor() {
        super();
        this.data.on((data) => this.incoming.emit(data));
    }

    public send(data: unknown): void {
        this.outgoing.emit(data);
    }

    public recive(data: unknown) {
        this.write(data);
    }

    public end() {}
}
