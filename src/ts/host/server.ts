import { default as mergeOptions } from 'merge-options';

import { Game, GameOptions } from './game';
import { ConsoleManager, style } from '../common/console';
import { EventManager } from './event-manager/event-manager';

import { ServerModule } from './server-module';
import ModuleServerConsole from './console';
import ModuleApi from './api';
import { getID } from '@/util/id';
import JSZip from 'jszip';
import { t } from '@/common/runtime-types';
import { saveAs } from 'file-saver';
import ModuleClient from './client';
import { ScriptError, ScriptingContext } from './script';

export interface ServerOptions extends GameOptions {
    consoleElement?: HTMLElement;
    load?: string;

    logErrorsToBuiltinConsole: boolean;
    logToBuiltinConsole: boolean;

    logConnections: boolean;

    motd: string;
}

export default class Server {
    public options = Server.defaultOptions();

    public game: Game;
    public events = new EventManager();
    public api = new ModuleApi();
    public id = getID();

    // console
    public error = this.events.error;
    public warn = this.events.warn;
    public info = this.events.info;
    public log = this.events.log;
    public debug = this.events.debug;
    public divider = () => this.log(style('%==', []));
    public console?: ConsoleManager;

    // events
    public loaded = this.events.channel('loaded', () => {});
    public ready = this.events.channel('ready', () => {});

    private scriptingContext: ScriptingContext;

    public constructor(options?: Partial<ServerOptions>) {
        if (options) this.options = mergeOptions(this.options, options);
        this.setupConsole();
        this.module(this.api);
        this.module(new ModuleClient());
        this.api.start();
        this.load(this.options.load);
    }

    private setupConsole() {
        if (this.options.consoleElement) {
            this.console = new ConsoleManager(this.options.consoleElement);

            this.error.on((...args) => this.console.error(...args));
            this.warn.on((...args) => this.console.warn(...args));
            this.info.on((...args) => this.console.info(...args));
            this.log.on((...args) => this.console.log(...args));
            this.debug.on((...args) => this.console.debug(...args));

            this.module(new ModuleServerConsole());
        }

        if (this.options.logErrorsToBuiltinConsole) this.events.logErrorsToBuiltinConsole();
        if (this.options.logToBuiltinConsole) this.events.logToBuiltinConsole();
    }

    public url() {
        return this.api.connections.url('client', 'server_id');
    }

    private writeState(zip: JSZip) {
        zip.file('gamestate.json', this.game.state.save());
    }

    private async readState(zip: JSZip) {
        const file = zip.file('gamestate.json');
        if (file === null) return;
        this.game.state.load(await file.async('string'));
    }

    private writeSession(zip: JSZip) {
        zip.file('session.json', JSON.stringify(this.id));
    }

    private async readSession(zip: JSZip) {
        const file = zip.file('session.json');
        if (file === null) return;
        const data = JSON.parse(await file.async('string'));
        if (t.string.is(data)) {
            this.id = data;
        }
    }

    private download(zip: JSZip, name: string) {
        zip.generateAsync({ type: 'blob' }).then(function (blob) {
            saveAs(blob, name);
        });
    }

    public saveState() {
        const zip = new JSZip();
        this.writeSession(zip);
        this.writeState(zip);
        this.download(zip, 'game-save.minimud');
    }

    public exportLevel() {
        const zip = new JSZip();
        this.writeState(zip);
        this.download(zip, 'level.minimud');
    }

    private ajax(url: string): Promise<Blob> {
        return new Promise((res, rej) => {
            var oReq = new XMLHttpRequest();
            oReq.open('GET', url, true);
            oReq.responseType = 'arraybuffer';

            oReq.onload = function (oEvent) {
                var blob = new Blob([oReq.response]);
                res(blob);
            };

            oReq.send();
        });
    }

    public async load(url?: string) {
        this.resetGamestate();

        if (url) {
            this.console.debug(`loading from ${url}`);
            try {
                const blob = await this.ajax(url);
                const zip = await JSZip.loadAsync(blob);
                await this.readSession(zip);
                await this.readState(zip);
            } catch (err) {
                console.error(err);
                this.console.warn(`failed to load ${url}: ${err.message}`);
            }
        }

        this.scriptingContext = new ScriptingContext(this);

        this.game.command(this.game.theVoid);
        this.loaded();
        this.ready();
    }

    public module(module: ServerModule) {
        module.load(this);
    }

    public attach(script: (game: Game, server: Server) => void) {
        this.loaded.on(() => {
            script(this.game, this);
        });
    }

    public script(script: (ctx: ScriptingContext) => void) {
        this.loaded.on(() => {
            try {
                script(this.scriptingContext);
            } catch (err) {
                if (err instanceof ScriptError) {
                    this.error(err);
                }
                throw err;
            }
        });
    }

    private resetGamestate() {
        this.divider();
        this.game = new Game(this.options);

        this.game.error.on((...args) => this.error(...args));
        this.game.warn.on((...args) => this.warn(...args));
        this.game.info.on((...args) => this.info(...args));
        this.game.log.on((...args) => this.log(...args));
        this.game.debug.on((...args) => this.debug(...args));
    }

    public static defaultOptions = (): ServerOptions =>
        Object.assign(Game.defaultOptions(), {
            logErrorsToBuiltinConsole: true,
            logToBuiltinConsole: false,
            consoleElement: undefined,
            motd: 'Welcome!',
            logConnections: false,
        });
}
