import { ConnectionBroker } from '@/common/session/connection-broker';
import Server from './server';
import { center, s, style } from '@/common/console';
import { Connection } from '@/common/session/connection';
import { HandlerContext, Method, RequestWriter, ResponseReader } from '@/common/message';
import { ServerModule } from './server-module';
import { MessageRequest, Status } from '@/common/message/message';
import { Entity } from './gamestate/gamestate';
import { CleanupIntersections } from '@/util/object';
import { alphanumeric_ext, includesCharacters, onlyusesCharacters } from '@/util/gaurd';
import { Api } from '@/common/session/api';

export type SessionContext = CleanupIntersections<HandlerContext & { player: Entity; data?: Record<string, string> }>;

export default class ModuleApi extends ServerModule {
    public name = 'API v1';

    public connections: ConnectionBroker;
    public sessions = new Map<string, Connection>();
    public public: Api;

    private server: Server;

    public load(server: Server) {
        this.connections = new ConnectionBroker(server.options.id);
        this.public = this.connections.api;
        this.server = server;
        this.public.reset();

        if (server.options.logConnections) {
            this.connections.connection.on((connection) => {
                server.debug('incoming connection');
                connection.data.on((data) => server.debug(JSON.stringify(data)));
            });
        }

        const api = this.public;

        api.sequence('/', '/clear', '/motd', '/login');

        api.get('/clear', ({ res }) => {
            res.header['clear-console'] = 'true';
        });

        api.static('/motd', s.chapter(server.options.motd));

        api.redirect('/login', '/login/username');
        api.form('/login/username', '/login/password', {
            username: {
                title: 'By what name do you wish to be known?',
                label: 'username',
                placeholder: 'username',
            },
        });

        api.static('/login/invalid_username', 'Invalid Username');
        api.submit('/login/password', ({ req, res }, data) => {
            const username = data.username;
            if (username.length < 3) {
                res.sequence('/login/invalid_username', '/login');
                return;
            }
            if (username.length > 20) {
                res.sequence('/login/invalid_username', '/login');
                return;
            }
            if (!onlyusesCharacters(username, alphanumeric_ext)) {
                res.sequence('/login/invalid_username', '/login');
                return;
            }
            const player = server.game.find(username);
            if (player && !server.game.player.is(player)) {
                res.sequence('/login/invalid_username', '/login');
                return;
            }
            res.header['server-id'] = this.server.id;
            res.header['username'] = username;
            if (player) {
                res.formContent(`/login/submit`, {
                    username: username,
                    token: { title: 'What is your password?', label: 'password', placeholder: 'password', token: true },
                });
            } else {
                res.formContent(`/login/submit`, {
                    username: username,
                    token: { title: 'Choose a password', label: 'password', placeholder: 'password', token: true },
                });
            }
        });

        api.submit('/login/submit', ({ req, res, connection }, data) => {
            const username = data.username;
            const token = data.token;

            if (server.game.find(username)) {
                if (!server.game.player.is(server.game.find(username))) {
                    res.sequence(`/login/incorrect_password/${username}`, '/login');
                    return;
                }
            } else {
                server.game.command(server.game.createPlayer, username);
            }

            if (server.game.command(server.game.authenticate, username, token)) {
                res.header['clear-console'] = 'true';
                res.header['token'] = token;
                this.startSession(token, connection);

                setTimeout(() => {
                    const req = new RequestWriter(Method.POST, { path: '/session_start' });
                    req.header['token'] = token;
                    req.header['home'] = '/commands';
                    connection.request(req);
                });
            } else {
                res.sequence(`/login/incorrect_password/${username}`, '/login');
            }
        });

        api.get('/login/incorrect_password/:username', ({ req, res, options }) => {
            res.textContent(`Incorrect password for ${options.username}`);
        });
    }

    public gaurdSession(ctx: HandlerContext, callback: (ctx: SessionContext) => void) {
        const token = ctx.req.header.token;
        const player = this.server.game.session(token);
        if (player) callback({ ...ctx, player });
        else {
            ctx.res.status = Status.FORBIDDEN;
            ctx.res.textContent('Invalid token');
        }
    }

    public command(path: string, callback: (ctx: SessionContext) => void) {
        this.public.get(path, (ctx) => {
            this.gaurdSession(ctx, callback);
        });
    }

    public submit(path: string, callback: (ctx: SessionContext) => void) {
        this.public.submit(path, (ctx, data) => {
            this.gaurdSession(ctx, (ctx) => callback({ ...ctx, data }));
        });
    }

    public isConnected(token: string) {
        return this.sessions.has(token);
    }

    public endSession(token: string) {
        const player = this.server.game.session(token);
        if (this.isConnected(token)) {
            this.sessions.get(token).end();
        }
        this.server.game.sessionEnd(player);
    }

    public startSession(token: string, connection: Connection) {
        const player = this.server.game.session(token);

        if (this.isConnected(token)) {
            this.endSession(token);
        }

        this.sessions.set(token, connection);

        connection.close.on(() => {
            if (this.sessions.get(token) !== connection) return;
            this.sessions.delete(token);
            this.server.game.sessionEnd(player);
        });
        this.server.game.sessionStart(player);
    }

    /**
     * request request by session token
     */
    public request(token: string, req: MessageRequest): Promise<ResponseReader> {
        const connection = this.sessions.get(token);
        if (connection === undefined) throw new Error('Unable to find session');
        return connection.request(req);
    }

    /**
     * GET request by session token
     */
    public get(token: string, path: string): Promise<ResponseReader> {
        const connection = this.sessions.get(token);
        if (connection === undefined) throw new Error('Unable to find session');
        return connection.get(path);
    }

    public start() {
        this.connections.start();
    }

    public stop() {
        this.connections.stop();
    }

    public get id() {
        return this.connections.id;
    }
}
