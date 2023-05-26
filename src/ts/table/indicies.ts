export class Indicies<T> {
    private index = new Map<T, number>();
    private value = new Map<number, T>();
    private i: number;

    constructor(iterable?: Iterable<[T, number]>) {
        this.i = 0;
    }

    private add(item: T) {
        const next = this.i++;
        this.set(item, next);
        return next;
    }

    private has(item: T) {
        return this.index.has(item);
    }

    // value -> index
    public of(item: T): number {
        // if the item is already indexed, return its index
        if (this.has(item)) return this.index.get(item);
        return this.add(item);
    }

    // index -> value
    public get(idx: number): T {
        return this.value.get(idx);
    }

    // use for loading indicies
    public set(item: T, i: number) {
        this.index.set(item, i);
        this.value.set(i, item);
    }

    public serialize(): Array<[number, T]> {
        return Array.from(this.value.entries());
    }

    public deserialize(iterable: Iterable<readonly [number, T]>) {
        for (const [idx, item] of iterable) this.set(item, idx);
    }

    public object() {
        return Object.fromEntries(this.value);
    }

    *[Symbol.iterator]() {
        for (const [v, i] of this.index) yield [v, i] as [T, number];
    }
}
