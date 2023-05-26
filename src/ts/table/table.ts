import { CompressedTable } from './compressed-table';

export type TableRecord<V> = Record<string, Record<string, V>>;

/**
 * A 2-dimensional Map
 * rows and columns are created automatically on access
 */
export class Table<R, C, V> {
    private cols: Set<C> = new Set();
    private rows: Map<R, Map<C, V>> = new Map();

    constructor(iterable?: Iterable<readonly [R, Iterable<readonly [C, V]>]>) {
        if (iterable) for (const [r, row] of iterable) for (const [c, v] of row) this.set(r, c, v);
    }

    public row(r: R) {
        return new TableRowView<R, C, V>(this, r);
    }

    public col(c: C) {
        return new TableColView<R, C, V>(this, c);
    }

    public cell(r: R, c: C) {
        return new TableCellView<R, C, V>(this, r, c);
    }

    /**
     * get the value of a cell
     */
    public get(r: R, c: C) {
        return this._row(r).get(c);
    }

    /**
     * set the value of a cell
     */
    public set(r: R, c: C, v: V): this {
        this.createColumn(c);
        this._row(r).set(c, v);
        return this;
    }

    /**
     * returns true if a value exists
     */
    public has(r: R, c: C) {
        if (!this.rows.has(r)) return false;
        return this.rows.get(r).has(c);
    }

    /**
     * Delete a cell
     */
    public delete(r: R, c: C): boolean {
        return this._row(r).delete(c);
    }

    /**
     * Delete a row
     */
    public deleteRow(r: R) {
        this.rows.delete(r);
    }

    public clear() {
        this.rows.clear();
        this.cols.clear();
    }

    public rowKeys() {
        return this.rows.keys();
    }

    public colKeys() {
        return this.cols.keys();
    }

    public hasRow(r: R) {
        return this.rows.has(r);
    }

    public entries() {
        return Array.from(this.rows.entries()).map(([r, row]) => [r, Array.from(row.entries())] as [R, Array<[C, V]>]);
    }

    /**
     * Creates an object representation of the table (for use with with console.table)
     */
    public toObject() {
        const obj: TableRecord<V> = {};

        this.forEach((v, r, c) => {
            const row = String(r);
            const col = String(c);
            (obj[row] = obj[row] ?? {})[col] = v;
        });

        return obj;
    }

    public forEach(callback: (value: V, row: R, col: C) => void) {
        for (const [r, cols] of this.rows)
            for (const c of this.cols) if (this.has(r, c)) callback(this.get(r, c), r, c);
    }

    public serialize() {
        return new CompressedTable<R, C, V>(this).serialize();
    }

    *[Symbol.iterator]() {
        for (const [r, row] of this.rows) yield [r, row.entries()] as [R, Iterable<[C, V]>];
    }

    private createColumn(c: C) {
        this.cols.add(c);
    }

    private createRow(r: R) {
        if (this.rows.has(r)) return;
        this.rows.set(r, new Map());
    }

    private _row(r: R) {
        this.createRow(r);
        return this.rows.get(r);
    }
}

export class TableRowView<R, C, V> {
    constructor(private table: Table<R, C, V>, private r: R) {
        this.table = table;
        this.r = r;
    }

    col(c: C) {
        return this.table.cell(this.r, c);
    }

    forEach(callback: (value: V, row: R, col: C) => void) {
        const r = this.r;
        for (const c of this.table.colKeys()) callback(this.table.get(r, c), r, c);
    }
}

export class TableColView<R, C, V> {
    constructor(private table: Table<R, C, V>, private c: C) {
        this.table = table;
        this.c = c;
    }

    row(r: R) {
        return this.table.cell(r, this.c);
    }

    forEach(callback: (value: V, row: R, col: C) => void) {
        const c = this.c;
        for (const r of this.table.rowKeys()) callback(this.table.get(r, c), r, c);
    }
}

export class TableCellView<R, C, V> {
    constructor(private table: Table<R, C, V>, private r: R, private c: C) {
        this.table = table;
        this.r = r;
        this.c = c;
    }

    value(): V {
        return this.table.get(this.r, this.c);
    }

    set(v: V): this {
        this.table.set(this.r, this.c, v);
        return this;
    }

    has(): boolean {
        return this.table.has(this.r, this.c);
    }
}
