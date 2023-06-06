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
import {
    QuicksaveEntry,
    autosave,
    createLevel,
    createSaveState,
    deleteQuicksave,
    download,
    downloadQuicksave,
    enumerateAutosaves,
    enumerateQuicksaves,
    purgeAutosaves,
    quicksave,
    readSave,
    storeFileAsQuicksave,
} from './save';
import JSZip from 'jszip';
import { getID } from '@/util/id';

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
    public playerJoin = this.events.channel('player-join', (player: Player) => {}).on(() => this.playerListChange());
    public playerLeave = this.events.channel('player-leave', (player: Player) => {}).on(() => this.playerListChange());
    public playerDeleted = this.events
        .channel('player-deleted', (name: string) => {})
        .on(() => this.playerListChange());
    public playerListChange = this.events.channel('player-list-change', () => {});
    public editQuicksaves = this.events.channel('edit-quicksaves', () => {});

    private scriptingContext: ScriptingContext;

    public constructor(options?: Partial<ServerOptions>) {
        if (options) this.options = mergeOptions(this.options, options);
        this.setupConsole();
        this.module(this.api);
        this.module(new ModuleClient());
        this.api.start();
        this.load(this.options.load);

        this.attach((game) => {
            game.sessionStart.on((target) => this.playerJoin(game.player.cast(target)));
            game.sessionEnd.on((target) => this.playerLeave(game.player.cast(target)));
        });

        setInterval(() => this.autosave, this.options.autosave_interval_seconds * 1000);
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

    public downloadSave() {
        download(createSaveState(this), 'game-save.minimud');
    }

    public exportLevel() {
        download(createLevel(this), 'level.minimud');
    }

    public async quicksave(name: string) {
        await quicksave(this, name);
        this.editQuicksaves();
    }

    public async autosave(name?: string) {
        await autosave(this, name);
        purgeAutosaves(this.options.keep_autosaves);
        this.editQuicksaves();
    }

    public enumerateAutosaves() {
        return enumerateAutosaves();
    }

    public enumerateQuicksaves() {
        return enumerateQuicksaves();
    }

    public deleteQuicksave(save: QuicksaveEntry) {
        deleteQuicksave(save);
        this.editQuicksaves();
    }

    public async downloadQuicksave(save: QuicksaveEntry) {
        await downloadQuicksave(save);
    }

    public async loadQuicksave(save: QuicksaveEntry) {
        const zip = await JSZip.loadAsync(save.data, {
            base64: true,
        });
        this._load(zip, save.name);
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

    private async _load(zip?: JSZip, name?: string) {
        this.resetGamestate();

        if (zip) {
            this.debug(`loading from ${name}`);
            await readSave(this, zip);
        }

        this.scriptingContext = new ScriptingContext(this);

        this.game.command(this.game.theVoid);
        this.loaded();
        this.ready();
    }

    public async load(url?: string) {
        try {
            const blob = await this.ajax(url);
            const zip = await JSZip.loadAsync(blob);
            await this._load(zip, url);
        } catch (err) {
            console.error(err);
            this.warn(`failed to load ${url}: ${err.message}`);
        }
    }

    public async loadSaveFileToQuicksaves(file: File) {
        await storeFileAsQuicksave(file);
        this.editQuicksaves();
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
            id: undefined,
            keep_autosaves: 10,
            autosave_interval_seconds: 60 * 5,
        });
}
