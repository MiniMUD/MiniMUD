import { Connection } from './connection';
import { HandlerContext, Router } from '../message';
import { nullike } from '@/util/gaurd';
import { FormContent, FormDataContent, formDataContentType } from '../message/content-type';
import { ElementDescriptor } from '../console/element';

export class Api {
    private router = new Router();

    public listen(connection: Connection) {
        connection.data.on((data) => {
            const res = this.router.incoming(data, connection);
            if (!nullike(res)) {
                connection.send(res);
            }
        });
    }

    public reset() {
        this.router = new Router();
    }

    public get(path: string, handler: (ctx: HandlerContext) => void) {
        return this.router.get(path, handler);
    }

    public post(path: string, handler: (ctx: HandlerContext) => void) {
        return this.router.post(path, handler);
    }

    public form(path: string, submit: string, form: FormContent) {
        this.get(path, ({ res }) => {
            res.formContent(submit, form);
        });
    }

    public submit(path: string, callback: (ctx: HandlerContext, data: FormDataContent) => void) {
        this.post(path, async (ctx) => {
            await ctx.req.formDataContent((data) => callback(ctx, data));
            await ctx.req.catch((errors) => {
                console.warn(`expected ${formDataContentType} got ${ctx.req.content_type}`);
                for (const error of errors) console.error(error);
            });
        });
    }

    public static(path: string, ...text: (ElementDescriptor | string)[]) {
        this.get(path, ({ res }) => {
            res.textContent(...text);
        });
    }

    public sequence(path: string, ...paths: string[]) {
        this.get(path, ({ res }) => {
            res.sequence(...paths);
        });
    }

    public redirect(path: string, to: string) {
        this.get(path, ({ res }) => {
            res.redirect(to);
        });
    }
}
