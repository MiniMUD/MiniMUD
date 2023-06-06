import { getID } from '@/util/id';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { CompileType, t } from '@/common/runtime-types';
import Server from './server';

const LOCALSTORAGE_QUICKSAVES = 'quicksaves';
const LOCALSTORAGE_AUTOSAVES = 'autosaves';
const quicksaveEntry = t.object({
    id: t.string,
    name: t.string,
    time: t.number,
    data: t.string,
    autosave: t.nullable(t.boolean),
});
const quicksaveStore = t.array(quicksaveEntry);
export type QuicksaveEntry = CompileType<typeof quicksaveEntry>;

function blobToBase64(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
}

function base64toBlob(base64Data: string) {
    const sliceSize = 1024;
    const byteCharacters = atob(base64Data);
    const bytesLength = byteCharacters.length;
    const slicesCount = Math.ceil(bytesLength / sliceSize);
    const byteArrays = new Array(slicesCount);

    for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
        const begin = sliceIndex * sliceSize;
        const end = Math.min(begin + sliceSize, bytesLength);

        const bytes = new Array(end - begin);
        for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
            bytes[i] = byteCharacters[offset].charCodeAt(0);
        }
        byteArrays[sliceIndex] = new Uint8Array(bytes);
    }
    return new Blob(byteArrays);
}

function writeState(server: Server, zip: JSZip) {
    zip.file('gamestate.json', server.game.state.save());
}

async function readState(server: Server, zip: JSZip) {
    const file = zip.file('gamestate.json');
    if (file === null) return;
    server.game.state.load(await file.async('string'));
}

function writeSession(server: Server, zip: JSZip) {
    zip.file('session.json', JSON.stringify(server.id));
}

async function readSession(server: Server, zip: JSZip) {
    const file = zip.file('session.json');
    if (file === null) return;
    const data = JSON.parse(await file.async('string'));
    if (t.string.is(data)) {
        server.id = data;
    }
}

export async function readSave(server: Server, zip: JSZip) {
    await readSession(server, zip);
    await readState(server, zip);
}

export function download(zip: JSZip, name: string) {
    zip.generateAsync({ type: 'blob' }).then(function (blob) {
        saveAs(blob, name);
    });
}

export async function downloadQuicksave(save: QuicksaveEntry) {
    saveAs(base64toBlob(save.data), `${save.name}.minimud`);
}

export function createSaveState(server: Server) {
    const zip = new JSZip();
    writeSession(server, zip);
    writeState(server, zip);
    return zip;
}

export function createLevel(server: Server) {
    const zip = new JSZip();
    writeState(server, zip);
    return zip;
}

async function createQuicksave(server: Server, name?: string, autosave: boolean = false): Promise<QuicksaveEntry> {
    if (!name) name = `Save at ${new Date().toLocaleString()}`;
    const id = getID();
    const time = Date.now();
    const data = await createSaveState(server).generateAsync({ type: 'base64' });
    return { name, time, data, id, autosave };
}

function storeQuicksave(save: QuicksaveEntry, key: string) {
    const record = enumerateQuicksaves(key);
    record.push(save);
    localStorage.setItem(key, JSON.stringify(record));
}

function deleteQuicksaveFrom(entry: QuicksaveEntry, key: string) {
    const record = enumerateQuicksaves(key);
    const idx = record.findIndex((x) => x.id === entry.id);
    if (idx > -1) {
        record.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(record));
    }
}

export function enumerateQuicksaves(key: string = LOCALSTORAGE_QUICKSAVES) {
    return quicksaveStore.cast(JSON.parse(localStorage.getItem(key) || '[]'));
}

export async function autosave(server: Server, name?: string) {
    storeQuicksave(
        await createQuicksave(server, name || `Autosave at ${new Date().toLocaleString()}`, true),
        LOCALSTORAGE_AUTOSAVES
    );
}

export async function quicksave(server: Server, name?: string) {
    storeQuicksave(await createQuicksave(server, name, false), LOCALSTORAGE_QUICKSAVES);
}

export function purgeAutosaves(limit: number) {
    const autosaves = new Set(enumerateQuicksaves(LOCALSTORAGE_AUTOSAVES));
    while (autosaves.size > limit) {
        const oldest = Array.from(autosaves).reduce((previous, current) =>
            previous.time < current.time ? previous : current
        );
        autosaves.delete(oldest);
    }
    localStorage.setItem(LOCALSTORAGE_AUTOSAVES, JSON.stringify(Array.from(autosaves.values())));
}

export function enumerateAutosaves() {
    return enumerateQuicksaves(LOCALSTORAGE_AUTOSAVES);
}

export function deleteQuicksave(entry: QuicksaveEntry) {
    deleteQuicksaveFrom(entry, LOCALSTORAGE_AUTOSAVES);
    deleteQuicksaveFrom(entry, LOCALSTORAGE_QUICKSAVES);
}

export async function storeFileAsQuicksave(file: File) {
    const obj = {
        name: file.name,
        id: getID(),
        time: file.lastModified,
        data: await blobToBase64(file),
        autosave: false,
    };

    storeQuicksave(obj, LOCALSTORAGE_QUICKSAVES);
}
