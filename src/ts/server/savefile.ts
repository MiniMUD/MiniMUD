import { hashHex } from '@/util/hash';
import JSZip from 'jszip';
import Server from './server';
import { Entity } from './gamestate/gamestate';
import { t } from '@/common/runtime-types';
import saveAs from 'file-saver';
import { alphanumericID } from '@/util/id';

const header = t.record(t.string, t.nullable(t.string));
const HEADER = 'header.json';

export class SaveFile {
    private zip = new JSZip();
    private header: Record<string, string> = { id: alphanumericID(32) };

    public get name() {
        return this.header.name;
    }

    public get time() {
        return parseInt(this.header.time);
    }

    public get autosave() {
        return this.header.autosave?.toLowerCase()?.trim() === 'true';
    }

    public get id() {
        return this.header.id;
    }

    public localeTimeString() {
        return new Date(this.header.time || Date.now()).toLocaleString();
    }

    private writeFile(type: string, ext: string, data: string) {
        let fname = `${hashHex(data)}.${type}`;
        if (ext && ext.length) fname += '.' + ext;
        this.zip.file(fname, data);
        return fname;
    }

    private async readHeader() {
        const file = this.zip.file(HEADER);
        if (file === null) {
            console.warn('unable to locate header file');
            return;
        }
        const str = await file.async('string');
        Object.assign(this.header, header.cast(JSON.parse(str)));
    }

    private writeHeader() {
        this.zip.file(HEADER, JSON.stringify(this.header));
    }

    private writeLevelData(server: Server) {
        const predicate = (target: Entity) => !!target && server.game.dynamic.some((flag) => !flag.test(target));
        this.writeFile('level', 'json', server.game.state.saveSubset(predicate));
    }

    private writeStateData(server: Server) {
        const predicate = (target: Entity) => !!target && server.game.dynamic.some((flag) => flag.test(target));
        this.writeFile('state', 'json', server.game.state.saveSubset(predicate));
    }

    private select(ending: string) {
        return this.zip.filter((path, file) => path.endsWith(ending));
    }

    public async load(server: Server) {
        for (const file of this.select('.level.json')) server.game.state.load(await file.async('string'));

        for (const file of this.select('.state.json')) server.game.state.load(await file.async('string'));

        for (const file of this.select('.server')) {
            const data = await file.async('string');
            if (t.string.is(data)) {
                server.id = data;
            }
        }
    }

    public writeMetadata(name?: string, time?: number, autosave: boolean = false) {
        this.header.name = name;
        this.header.time = String(time || Date.now());
        this.header.autosave = autosave ? 'true' : 'false';
        this.writeHeader();
    }

    public writeLevel(server: Server) {
        this.writeLevelData(server);
    }

    public writeSave(server: Server) {
        this.writeLevelData(server);
        this.writeStateData(server);
        this.writeFile('server', '', server.id);
    }

    public async fromBase64String(data: string) {
        await this.zip.loadAsync(data, {
            base64: true,
        });
        await this.readHeader();
    }

    public async fromBlob(data: Blob) {
        await this.zip.loadAsync(data);
        await this.readHeader();
    }

    public async loadURL(url: string) {
        try {
            const blob = await this.ajax(url);
            await this.zip.loadAsync(blob);
            await this.readHeader();
        } catch (err) {
            console.error(err);
        }
    }

    public download(name?: string) {
        this.zip.generateAsync({ type: 'blob' }).then((blob) => {
            saveAs(blob, (name || this.header.name || 'save') + '.minimud');
        });
    }

    public toBase64String() {
        return this.zip.generateAsync({ type: 'base64' });
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

    public static async fromBase64(data: string) {
        const file = new SaveFile();
        await file.fromBase64String(data);
        return file;
    }

    public static async fromBlob(data: Blob) {
        const file = new SaveFile();
        await file.fromBlob(data);
        return file;
    }

    public static async loadURL(url: string) {
        const file = new SaveFile();
        await file.loadURL(url);
        return file;
    }

    public static level(server: Server) {
        const file = new SaveFile();
        file.writeLevel(server);
        file.writeMetadata('level', Date.now());
        return file;
    }

    public static save(server: Server, name: string) {
        const file = new SaveFile();
        file.writeSave(server);
        file.writeMetadata(name, Date.now());
        return file;
    }
}
