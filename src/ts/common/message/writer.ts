import { getID } from '@/util/id';
import {
    CONTENT_TYPE,
    FormContent,
    FormDataContent,
    MenuFieldItem,
    TextContent,
    formContentType,
    formDataContentType,
    redirectMenuContentType,
    sequenceContentType,
    textContentType,
} from './content-type';
import { MessageRequest, Method, Status } from './message';
import { text } from '../console';
import { ElementDescriptor } from '../console/element';

export class MessageWriter<M extends Method> {
    public header: Record<string, string> & { method: M };
    public content: unknown = null;

    public constructor(method: M, header: Record<string, string> = {}) {
        this.header = { ...header, method };
    }

    public textContent(...content: (ElementDescriptor | string)[]) {
        this.header[CONTENT_TYPE] = textContentType;
        this.content = content.map((x) => (typeof x === 'string' ? text(x) : x));
    }

    public redirectMenu(title: string, items: MenuFieldItem[]) {
        this.header[CONTENT_TYPE] = redirectMenuContentType;
        this.content = {
            title,
            items,
        };
    }

    public formContent(submit: string, content: FormContent) {
        this.header['form-submit'] = submit;
        this.header[CONTENT_TYPE] = formContentType;
        this.content = content;
    }

    public formDataContent(content: FormDataContent) {
        this.header[CONTENT_TYPE] = formDataContentType;
        this.content = content;
    }

    public sequence(...paths: string[]) {
        this.header[CONTENT_TYPE] = sequenceContentType;
        this.content = paths;
    }

    public build() {
        return {
            header: this.header,
            content: this.content,
        };
    }
}

export class ResponseWriter extends MessageWriter<Method.RESPONSE> {
    public constructor(req: MessageRequest) {
        super(Method.RESPONSE);
        this.header.for = req.header.id;
    }

    public get status() {
        return this.header.status;
    }

    public set status(value: string) {
        this.header.status = value;
    }

    public redirect(path: string) {
        this.status = Status.REDIRECT;
        this.header.path = path;
    }

    public badRequest(reason?: string) {
        this.status = Status.BAD_REQUEST;
        if (reason) this.textContent(reason);
    }
}

export class RequestWriter<M extends Method.GET | Method.POST> extends MessageWriter<M> {
    public constructor(method: M, header?: Record<string, string>) {
        super(method, header);
        this.header.id = getID();
    }

    public get path() {
        return this.header.path;
    }

    public set path(value: string) {
        this.header.path = value;
    }

    public static mimic = <T extends MessageRequest>(req: T) => {
        const result = new RequestWriter(req.header.method, req.header);
        result.content = req.content ?? result.content;
        return result;
    };
}
