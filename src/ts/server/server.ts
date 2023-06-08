import { default as mergeOptions } from 'merge-options';

import { Game, GameOptions, Player } from './game';
import { ConsoleManager, style } from '../common/console';
import { EventManager } from './event-manager/event-manager';

import { ServerModule } from './server-module';
import ModuleServerConsole from './console';
import ModuleApi from './api';
import ModuleClient from './client';
import { ScriptError, ScriptingContext } from './script';
import { Entity } from './gamestate/gamestate';
import { getID } from '@/util/id';
import { SaveManager } from './save-manager';
import { SaveFile } from './savefile';

export interface ServerOptions extends GameOptions {
    consoleElement?: HTMLElement;
    load?: string;

    logErrorsToBuiltinConsole: boolean;
    logToBuiltinConsole: boolean;

    logConnections: boolean;

    motd: string;

    id: string;

    keep_autosaves: number;
    autosave_interval_seconds: number;
}

export default class Server {
    public options = Server.defaultOptions();

    public game: Game;
    public events = new EventManager();
    public api = new ModuleApi();
    public id = getID();
    public store = new SaveManager();

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

    public playerJoin = this.events.channel('player-join', (player: Player) => {}).on(() => this.playerListChange());
    public playerLeave = this.events.channel('player-leave', (player: Player) => {}).on(() => this.playerListChange());
    public playerDeleted = this.events
        .channel('player-deleted', (name: string) => {})
        .on(() => this.playerListChange());
    public playerListChange = this.events.channel('player-list-change', () => {});

    private scriptingContext: ScriptingContext;

    public constructor(options?: Partial<ServerOptions>) {
        if (options) this.options = mergeOptions(this.options, options);
        this.setupConsole();
        this.module(this.api);
        this.module(new ModuleClient());
        this.api.start();
        this.store.read();
        this.load(this.options.load);

        this.attach((game) => {
            game.sessionStart.on((target) => this.playerJoin(game.player.cast(target)));
            game.sessionEnd.on((target) => this.playerLeave(game.player.cast(target)));
        });

        setInterval(() => this.autosave(), this.options.autosave_interval_seconds * 1000);
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

    public reset() {
        this.resetGamestate();
        this.game.command(this.game.theVoid);
        this.loaded();
    }

    public async load(file?: SaveFile | string) {
        this.resetGamestate();

        if (file) {
            try {
                if (typeof file === 'string') {
                    this.info(`loading: ${file}`);
                    file = await SaveFile.loadURL(file);
                } else {
                    this.info(`loading: ${file.name}`);
                }
                await file.load(this);
            } catch (err) {
                const name = typeof file === 'string' ? file : file.name;
                this.error(err);
                this.warn(`Failed to load ${name}`);
            }
        }

        this.scriptingContext = new ScriptingContext(this);
        this.game.command(this.game.theVoid);
        this.game.scrub();
        this.loaded();
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

    public players(): Player[] {
        return this.game
            .filter(this.game.player)
            .map((x) => this.game.player.cast(x))
            .filter((x) => !!x);
    }

    public kickPlayer(player: Entity) {
        this.game.assert('player', player, [this.game.player]);
        this.api.endSession(this.game.token.get(player));
    }

    public deletePlayer(player: Entity) {
        this.game.assert('player', player, [this.game.player]);
        const name = this.game.get(player);
        this.kickPlayer(player);
        this.game.destroyEntity(player);
        this.playerDeleted(name);
    }

    public resetPassword(player: Entity) {
        this.game.assert('player', player, [this.game.player]);
        this.game.token.set(player, undefined);
    }

    public quicksave(name: string) {
        this.store.quicksave(this, name);
    }

    public autosave() {
        this.store.autosave(this);
    }

    public downloadSave(name: string) {
        SaveFile.save(this, name).download(name);
    }

    public downloadLevel(name: string) {
        this.game.scrub();
        SaveFile.level(this).download(name);
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

    public startDebug() {
        this.api.startLogging();
    }

    public static defaultOptions = (): ServerOptions =>
        Object.assign(Game.defaultOptions(), {
            logErrorsToBuiltinConsole: true,
            logToBuiltinConsole: false,
            consoleElement: undefined,
            motd: 'Welcome!',
            logConnections: false,
            id: undefined,
            keep_autosaves: 10,
            autosave_interval_seconds: 60 * 5,
        });
}
