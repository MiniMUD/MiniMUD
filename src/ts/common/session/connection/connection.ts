import { Dispatcher, RequestWriter, ResponseReader } from '@common/message';
import { EventChannel } from '@/util/event-channel';
import { MessageRequest, MessageResponse, Method, messageRequest } from '@/common/message/message';

export abstract class Connection {
    protected dispatcher = new Dispatcher();

    public close = new EventChannel(() => {});
    public error = new EventChannel((error: Error) => {});
    public data = new EventChannel((data: unknown) => {});

    public constructor() {
        this.data.on((data) => {
            this.dispatcher.write(data);
        });
    }

    public abstract send(data: unknown): void;
    public abstract end(): void;

    protected write(data: unknown) {
        this.data.emit(data);
    }

    public request(req: MessageRequest): Promise<ResponseReader> {
        if (!messageRequest.is(req)) {
            console.warn(req);
            throw new Error(`invalid request: ${JSON.stringify(req)}`);
        }
        return new Promise((resolve, reject) => {
            const response = this.dispatcher.request(req);
            response
                .then(async (data) => {
                    const res = new ResponseReader(data);
                    const redirect = res.redirect();
                    if (redirect) {
                        const writer = RequestWriter.mimic(req);
                        writer.path = redirect;
                        resolve(await this.request(writer.build()));
                    } else {
                        resolve(res);
                    }
                })
                .catch((reason) => reject(reason));
            this.send(req);
        });
    }

    public get(path: string, header?: Record<string, string>): Promise<ResponseReader> {
        const writer = new RequestWriter(Method.GET, { ...header, path });
        return this.request(writer.build());
    }

    public post(path: string, content: unknown, header?: Record<string, string>): Promise<ResponseReader> {
        const writer = new RequestWriter(Method.POST, { ...header, path });
        writer.content = content;
        return this.request(writer.build());
    }
}
