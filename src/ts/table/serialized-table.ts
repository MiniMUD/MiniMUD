import { CompressedTable } from './compressed-table';

export type Pairs<K, V> = Array<readonly [K, V]>;
export type Indexed<T> = Pairs<number, T>;

export class SerializedTable<R, C, V> {
    public constructor(public indicies: [Indexed<R>, Indexed<C>], public table: Indexed<Indexed<V>>) {
        this.indicies = indicies;
        this.table = table;
    }

    public export() {
        return {
            indicies: this.indicies,
            table: this.table,
        };
    }

    public toJSON() {
        return JSON.stringify(this.export());
    }

    public forEach(callback: (value: V, row: number, col: number) => void) {
        for (const [r, row] of this.table) for (const [c, v] of row) callback(v, r, c);
    }
}
