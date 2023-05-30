import { Deferred } from '@/util/deferred';
import { MessageRequest, MessageResponse, messageResponse } from './message';
import { getID } from '@/util/id';
import { nullike } from '@/util/gaurd';

export class Dispatcher {
    public timeout_ms = 10000;

    private awaiting = new Map<string, Deferred<MessageResponse>>();

    public request(req: MessageRequest): Promise<MessageResponse> {
        const response = new Deferred<MessageResponse>();
        const id = req.header.id || getID();
        req.header.id = id;
        this.awaiting.set(id, response);
        response.timeout(this.timeout_ms, `${req.header.method} ${req.header.path} timeout`);
        return response.promise;
    }

    public write(data: unknown) {
        if (messageResponse.is(data)) {
            const id = data.header.for;
            if (nullike(id)) return;
            if (this.awaiting.has(id)) {
                this.awaiting.get(id).resolve(data);
                this.awaiting.delete(id);
            }
        }
    }
}
