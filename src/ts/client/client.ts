import { ConsoleManager, ConsoleTextInput, style } from '@/common/console';
import { Connection } from '@/common/session/connection';
import { ConnectionBroker } from '@/common/session/connection-broker';
import { EventChannel } from '@/util/event-channel';
import mergeOptions from 'merge-options';
import { encode } from '@/util/hash';
import { Header, Method, RequestWriter, ResponseReader, Status } from '@/common/message';
import { CONTENT_TYPE, menuField, textInputField } from '@/common/message/content-type';
import { form } from '@/util/form';
import { nullike } from '@/util/gaurd';

export interface ClientOptions {
    consoleElement?: HTMLElement;
    server?: string;
}

export default class Client {
    public options = Client.defaultOptions();

    private _error = new EventChannel((...args: unknown[]) => {});
    private _warn = new EventChannel((...args: unknown[]) => {});
    private _info = new EventChannel((...args: unknown[]) => {});
    private _log = new EventChannel((...args: unknown[]) => {});
    private _debug = new EventChannel((...args: unknown[]) => {});
    public console?: ConsoleManager;

    public connections = new ConnectionBroker();
    public api = this.connections.api;
    public connection?: Connection;

    public ready = new EventChannel(() => {});

    constructor(options?: Partial<ClientOptions>) {
        if (options) this.options = mergeOptions(this.options, options);
        this.setupConsole();
        this.connections.ready.on(() => {
            this.ready.emit();
            if (this.options.server) this.connect(this.options.server);
        });
        this.api.post('/session_start', async ({ req, res }) => {
            const token = req.header.token;
            const path = req.header.home;

            const header = { token };

            const next = async () => {
                try {
                    const res = await this.get(path, header);
                    await this.present(res, header);
                } catch (err) {
                    console.error(err);
                }
                if (res.status === Status.OK) setTimeout(next, 0);
            };
            next();
        });
        this.api.post('/write', async ({ req, res }) => {
            await req.textContent(async (content) => {
                for (const line of content) {
                    this.console.write(line);
                }
            });
            await req.catch(() => {
                throw new Error(JSON.stringify(req));
            });
        });
        this.api.post('/interrupt', async ({ req, res }) => {
            this.console.interuptInput();
            const token = req.header.token;
            const header = { token };
            const start = async () => {
                await req.sequence(async (redirect) => {
                    const res = await this.get(redirect, header);
                    await this.present(res, header);
                });
                await req.catch((errs) => {
                    console.error(req.header[CONTENT_TYPE]);
                });
            };
            start();
        });
    }

    private setupConsole() {
        if (this.options.consoleElement) {
            this.console = new ConsoleManager(this.options.consoleElement);

            this._error.on((...args) => this.console.error(...args));
            this._warn.on((...args) => this.console.warn(...args));
            this._info.on((...args) => this.console.info(...args));
            this._log.on((...args) => this.console.log(...args));
            this._debug.on((...args) => this.console.debug(...args));
        }
    }

    public start() {
        this.connections.start();
    }

    public stop() {
        this.connections.stop();
    }

    public async connect(id: string) {
        this.start();
        this.stop(); // stop accepting new connections
        this.debug('Connecting...');
        this.connection = await this.connections.connect(id);
        this.debug('Connection established');
        this.load('/');
        this.connection.close.on(() => {
            this.log(style('Lost connection to server.', ['text-danger']));
            this.console.hideInput();
        });
    }

    private async getToken(prompt: string, server_id: string, username: string) {
        const textInput = new ConsoleTextInput({
            title: prompt,
            label: 'Password',
            placeholder: 'password',
        });
        textInput.password = true;
        const password = await textInput.display(this.console);
        return encode(server_id + username, password);
    }

    private async load(path: string, header?: Header) {
        await this.present(await this.get(path, header), header);
    }

    private get(path: string, header?: Header) {
        return this.connection.get(path, header);
    }

    private request(request: RequestWriter<Method.GET | Method.POST>) {
        return this.connection.request(request.build());
    }

    private async present(res: ResponseReader, header: Header = {}) {
        if (res.header['clear-console'] === 'true') this.console.clear();
        if (res.header.token) header = { ...header, token: res.header.token };

        await res.textContent((content) => {
            for (const line of content) {
                this.console.write(line);
            }
        });
        await res.sequence(async (path) => {
            await this.load(path, header);
        });
        await res.redirectMenu(async (content) => {
            const value = await this.console.menu(content.title, ...content.items);
            if (nullike(value)) return;
            await this.load(value, header);
        });
        await res.formContent(async (content) => {
            const literals = Object.fromEntries(
                Object.entries(content).filter(([key, value]) => typeof value === 'string')
            );
            const questions = Object.fromEntries(
                Object.entries(content).filter(([key, value]) => typeof value !== 'string')
            );
            const obj = await form(
                Object.fromEntries(
                    Object.entries(questions).map(([key, value]) => {
                        if (textInputField.is(value)) {
                            if (value.token) {
                                return [
                                    key,
                                    (obj) =>
                                        this.getToken(
                                            value.title,
                                            res.header['server-id'],
                                            res.header['username'] || obj.username
                                        ),
                                ];
                            } else {
                                return [key, () => this.console.ask(value.title, value.label, value.placeholder)];
                            }
                        } else if (menuField.is(value)) {
                            return [key, () => this.console.menu(value.title, ...value.items)];
                        } else {
                            return [key, value];
                        }
                    })
                )
            );
            if (nullike(obj)) return;
            const path = res.header['form-submit'];
            const req = new RequestWriter(Method.POST, { ...header, path });
            req.formDataContent({ ...obj, ...literals });
            await this.present(await this.request(req));
        });
        await res.catch(async (errors) => {
            for (const err of errors) this.console.error(err);
            this.console.warn(`unable to present: [content-type: ${res.content_type}]`);
        });
    }

    public static defaultOptions = (): ClientOptions => ({});

    public error(...args: unknown[]) {
        this._error.emit(...args);
    }

    public warn(...args: unknown[]) {
        this._warn.emit(...args);
    }

    public info(...args: unknown[]) {
        this._info.emit(...args);
    }

    public log(...args: unknown[]) {
        this._log.emit(...args);
    }

    public debug(...args: unknown[]) {
        this._debug.emit(...args);
    }

    public divider() {
        this.log(style('%==', []));
    }
}
