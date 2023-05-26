import { Indicies } from './indicies';
import { SerializedTable } from './serialized-table';
import { Table } from './table';

export class CompressedTable<R, C, V> {
    private indicies: [Indicies<R>, Indicies<C>] = [new Indicies(), new Indicies()];
    private store = new Table<number, number, V>();

    public constructor(table?: Table<R, C, V>);
    public constructor(table?: SerializedTable<R, C, V>);
    public constructor(table?: Table<R, C, V> | SerializedTable<R, C, V>) {
        if (table) this.copy(table);
    }

    public copy(table: Table<R, C, V> | SerializedTable<R, C, V>): void {
        if (table instanceof Table) table.forEach((v, r, c) => this.set(r, c, v));
        else if (table instanceof SerializedTable) this.copySerialized(table);
    }

    private copySerialized(table: SerializedTable<R, C, V>) {
        this.indicies[0].deserialize(table.indicies[0]);
        this.indicies[1].deserialize(table.indicies[1]);
        table.forEach((v, r, c) => this.store.set(r, c, v));
    }

    public write(table: Table<R, C, V>) {
        for (const [r, ri] of this.indicies[0])
            for (const [c, ci] of this.indicies[1]) if (this.store.has(ri, ci)) table.set(r, c, this.store.get(ri, ci));
    }

    private set(r: R, c: C, v: V) {
        const ri = this.indicies[0].of(r);
        const ci = this.indicies[1].of(c);
        this.store.set(ri, ci, v);
    }

    private get(r: R, c: C) {
        const ri = this.indicies[0].of(r);
        const ci = this.indicies[1].of(c);
        return this.store.get(ri, ci);
    }

    public toObject() {
        return this.store.toObject();
    }

    public rows() {
        return this.indicies[0].object();
    }

    public cols() {
        return this.indicies[1].object();
    }

    public serialize() {
        return new SerializedTable<R, C, V>(
            [this.indicies[0].serialize(), this.indicies[1].serialize()],
            this.store.entries()
        );
    }
}
