import { t } from '@/common/runtime-types';
import { SaveFile } from './savefile';
import Server from './server';
import { EventChannel } from '@/util/event-channel';
import { nullike } from '@/util/gaurd';
const strarr = t.array(t.string);

const VERSION: string = '1';

export class SaveManager {
    public change = new EventChannel(() => {});

    private files = new Map<string, SaveFile>();
    private store = window.sessionStorage;

    private localsaves: string[] = [];
    private quicksaves: string[] = [];
    private autosaves: string[] = [];

    private saves() {
        return [...this.localsaves, ...this.quicksaves, ...this.autosaves];
    }

    private storedSaves() {
        return [...this.indicies('localsaves'), ...this.indicies('quicksaves'), ...this.indicies('autosaves')];
    }

    public delete(id: string | SaveFile) {
        if (typeof id !== 'string') id = id.id;
        this.files.delete(id);
        remove(this.localsaves, id);
        remove(this.quicksaves, id);
        remove(this.autosaves, id);
        this.store.removeItem(SaveManager.entry(id));
        this.writeIndicies();
        this.change.emit();
    }

    public async read() {
        const v = this.store.getItem('store_version');
        if (v !== VERSION) {
            this.store.clear();
            this.store.setItem('store_version', VERSION);
        }

        this.localsaves = this.indicies('localsaves');
        this.quicksaves = this.indicies('quicksaves');
        this.autosaves = this.indicies('autosaves');
        for (const id of this.saves()) {
            const data = this.store.getItem(SaveManager.entry(id));
            const file = await SaveFile.fromBase64(data);
            this.files.set(id, file);
        }
        this.write();
        this.change.emit();
    }

    public async quicksave(server: Server, name?: string) {
        const file = new SaveFile();
        file.writeSave(server);
        file.writeMetadata(name || 'untitled', Date.now(), false);
        await this.writeFile('quicksaves', file);
    }

    public async autosave(server: Server) {
        const file = new SaveFile();
        file.writeSave(server);
        file.writeMetadata('autosave', Date.now(), true);
        await this.writeFile('autosaves', file);
    }

    public async load(file: File) {
        this.writeFile('localsaves', await SaveFile.fromBlob(file));
    }

    private async writeFile(key: 'quicksaves' | 'localsaves' | 'autosaves', file: SaveFile) {
        const id = file.id;
        this[key].push(id);
        this.files.set(id, file);
        this.indicies(key, this[key]);
        this.store.setItem(SaveManager.entry(id), await file.toBase64String());
        this.change.emit();
    }

    public async write() {
        const saves = this.saves();
        const storedSaves = this.storedSaves();

        const newSaves = this.saves().filter((x) => !storedSaves.includes(x));
        const deleteSaves = this.storedSaves().filter((x) => !saves.includes(x));

        for (const id of newSaves) this.store.setItem(SaveManager.entry(id), await this.files.get(id).toBase64String());
        for (const id of deleteSaves) this.store.deleteItem(SaveManager.entry(id));
        this.writeIndicies();
    }

    public [Symbol.iterator]() {
        return this.files.values();
    }

    private async writeIndicies() {
        this.indicies('localsaves', this.localsaves);
        this.indicies('quicksaves', this.quicksaves);
        this.indicies('autosaves', this.autosaves);
    }

    private indicies(key: string, value?: string[]) {
        if (value) {
            this.store.setItem(key, JSON.stringify(value));
            return value;
        }
        const str = this.store.getItem(key);
        if (nullike(str)) return [];
        return strarr.cast(JSON.parse(str));
    }

    private static entry(id: string) {
        return `${id}.minimud`;
    }
}

function remove(arr: string[], value: string) {
    for (let i = 0; i < 1000; i++) {
        const idx = arr.indexOf(value);
        if (idx < 0) break;
        arr.splice(idx, 1);
    }
    return arr;
}
