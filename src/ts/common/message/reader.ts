import { Deferred } from '@/util/deferred';
import { RuntimeType, RuntimeTypeError } from '../runtime-types';
import {
    CONTENT_TYPE,
    FormContent,
    FormDataContent,
    RedirectMenuContent,
    TextContent,
    formContent,
    formContentType,
    formDataContent,
    formDataContentType,
    redirectMenuContent,
    redirectMenuContentType,
    sequenceContent,
    sequenceContentType,
    textContent,
    textContentType,
} from './content-type';
import { MessageAny, MessageRequest, MessageResponse, Method, Status } from './message';
import { nullike } from '@/util/gaurd';

export class MessageReader<T extends MessageAny> {
    public header: Record<string, string> & { method: Method };
    public content: unknown;

    public handled = false;
    public errors: Error[] = [];

    public constructor(message: T) {
        this.header = message.header;
        this.content = message.content;
    }

    public get content_type() {
        return this.header[CONTENT_TYPE];
    }

    public async readContent<T>(tstr: string, tx: RuntimeType<T>, callback: (content: T) => void) {
        if (this.header[CONTENT_TYPE] !== tstr) return false;
        let x: T;

        if (tx.is(this.content)) {
            await callback(this.content);
            this.handled = true;
            return true;
        } else {
            this.errors.push(new Error(tstr));
        }
    }

    public textContent(callback: (content: TextContent) => void): Promise<boolean> {
        return this.readContent(textContentType, textContent, callback);
    }

    public redirectMenu(callback: (content: RedirectMenuContent) => void): Promise<boolean> {
        return this.readContent(redirectMenuContentType, redirectMenuContent, callback);
    }

    public formContent(callback: (content: FormContent) => void): Promise<boolean> {
        return this.readContent(formContentType, formContent, callback);
    }

    public formDataContent(callback: (content: FormDataContent) => void): Promise<boolean> {
        return this.readContent(formDataContentType, formDataContent, callback);
    }

    public sequence(callback: (path: string) => void): Promise<boolean> {
        return this.readContent(sequenceContentType, sequenceContent, async (redirects) => {
            for (const redirect of redirects) await callback(redirect);
        });
    }

    public async catch(callback: (errors: Error[]) => void) {
        if (nullike(this.header[CONTENT_TYPE])) return;
        if (!this.handled) return await callback(this.errors);
        this.handled = true;
    }
}

export class ResponseReader extends MessageReader<MessageResponse> {
    public redirect() {
        if (this.header.status === Status.REDIRECT) {
            return this.header.path;
        }
        return false;
    }

    public get status() {
        return this.header.status;
    }
}

export class RequestReader extends MessageReader<MessageRequest> {
    public get path() {
        return this.header.path;
    }
}
