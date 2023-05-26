import { nullike } from '@/util/gaurd';
import { MessageRequest, MessageResponse, Method, Status, messageRequest } from './message';
import { ResponseWriter } from './writer';
import { RequestReader } from './reader';
import { Connection } from '../session/connection';
import { style } from '../console';

export interface HandlerContext {
    req: RequestReader;
    res: ResponseWriter;
    connection?: Connection;
    options: Record<string, string>;
}

export class Router {
    private root = new RouteRoot();

    public notFound: (ctx: HandlerContext) => void = Router.notFound;
    public badRequest: (ctx: HandlerContext) => void = Router.badRequest;
    public serverError: (ctx: HandlerContext) => void = Router.serverError;

    private define(path: string) {
        return this.root.define(Router.parse(path));
    }

    public get(path: string, callback: (ctx: HandlerContext) => void) {
        this.define(path).gets = callback;
    }

    public post(path: string, callback: (ctx: HandlerContext) => void) {
        this.define(path).posts = callback;
    }

    public route(req: MessageRequest, connection?: Connection): MessageResponse {
        const path = req.header.path;
        const method = req.header.method;

        const ctx: HandlerContext = {
            req: new RequestReader(req),
            res: new ResponseWriter(req),
            connection,
            options: {},
        };

        const route = this.root.route(Router.parse(path), ctx.options);

        try {
            if (nullike(path)) {
                this.badRequest(ctx);
            } else if (route && method === Method.GET && route.gets) {
                ctx.res.status = Status.OK;
                route.gets(ctx);
            } else if (route && method === Method.POST && route.posts) {
                ctx.res.status = Status.OK;
                route.posts(ctx);
            } else {
                this.notFound(ctx);
            }
        } catch (err) {
            console.warn(`Error in response handler for ${req.header.path}`);
            console.error(err);
            this.serverError(ctx);
        }

        return ctx.res.build();
    }

    public incoming(data: unknown, connection: Connection) {
        if (messageRequest.is(data)) return this.route(data, connection);
        return undefined;
    }

    public debug() {
        return this.root.debug().join('\n');
    }

    public static notFound = (ctx: HandlerContext) => {
        ctx.res.status = Status.NOT_FOUND;
        ctx.res.textContent('Not Found: ' + ctx.req.path);
    };

    public static badRequest = (ctx: HandlerContext) => {
        ctx.res.status = Status.BAD_REQUEST;
        ctx.res.textContent('Bad Request');
    };

    public static serverError = (ctx: HandlerContext) => {
        ctx.res.status = Status.SERVER_ERROR;
        ctx.res.textContent('Server Error');
    };

    public static parse(path: string) {
        return path
            .split('/')
            .map((x) => x.trim())
            .filter((x) => x !== '' && x !== undefined);
    }

    public static format(path: string) {
        return Router.parse(path).join('/');
    }
}

abstract class Route {
    public part: string;

    public firstClass: boolean = false;

    public first: Route[] = []; // first priority routes (literals)
    public second: Route[] = []; // second prioroity routes (variable)

    /**
     * @param options is modified
     * @returns true if the route matches
     */
    public apply: (str: string, options: Record<string, string>) => boolean;

    public gets?: (ctx: HandlerContext) => void;
    public posts?: (ctx: HandlerContext) => void;

    public constructor(part: string) {
        this.part = part;
    }

    public push(route: Route) {
        if (route instanceof RouteLiteral) this.first.push(route);
        else this.second.push(route);
    }

    public *routes() {
        for (const route of this.first) yield route;
        for (const route of this.second) yield route;
    }

    public route(path: string[], options: Record<string, string>): Route {
        const part = path.shift();
        if (!part || part === '') return this;
        for (const route of this.routes()) {
            const opt = {};
            if (route.apply(part, opt)) {
                Object.assign(options, opt);
                return route.route(path, options);
            }
        }
        return undefined;
    }

    public define(path: string[]): Route {
        const part = path.shift();
        // try to get an existing route
        if (!part || part === '') return this;
        for (const route of this.routes()) {
            if (route.part === part) return route.define(path);
        }
        // create a new route
        const route = Route.from(part);
        this.push(route);
        return route.define(path);
    }

    public debug(base?: string): string[] {
        base = base === undefined ? this.part : base + '/' + this.part;
        const result: string[] = [];
        if (this.gets) result.push(`GET:  ${base}`);
        if (this.posts) result.push(`POST: ${base}`);
        for (const router of this.routes()) {
            result.push(...router.debug(base));
        }
        return result;
    }

    static from(str: string) {
        if (str[0] === ':') return new RouteVariable(str);
        else return new RouteLiteral(str);
    }
}

class RouteRoot extends Route {
    constructor() {
        super('<root>');
    }
}

class RouteLiteral extends Route {
    constructor(part: string) {
        super(part);
        this.apply = (str) => str === part;
        this.firstClass = true;
    }
}

class RouteVariable extends Route {
    constructor(part: string) {
        super(part);
        const key = part.slice(1);
        this.apply = (str, options) => {
            options[key] = str;
            return true;
        };
        this.firstClass = false;
    }
}
