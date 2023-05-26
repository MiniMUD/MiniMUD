export class TypedMap<A extends Record<string | number, any>> {
    private store: Map<string | number, any>;

    public constructor(from?: A) {
        this.store = new Map(from ? Object.entries(from) : []);
    }

    public set<K extends string | number>(k: K, v: A[K]) {
        this.store.set(k, v);
    }

    public get<K extends string | number>(k: K): A[K] {
        return this.store.get(k);
    }

    public add<K extends string | number, V>(k: K, v: V): TypedMap<A & Record<K, V>> {
        this.store.set(k, v);
        return this;
    }

    public entries(): [keyof A, A[keyof A]][] {
        return Array.from(this.store.entries());
    }

    public keys(): (keyof A)[] {
        return Array.from(this.store.keys());
    }

    public values(): A[keyof A][] {
        return Array.from(this.store.values());
    }

    public objectInterface() {
        const obj = {} as A;
        for (const key of this.store.keys()) {
            Object.defineProperty(obj, key, {
                get() {
                    return this.get(key);
                },
                set(value: A[typeof key]) {
                    this.set(key, value);
                },
            });
        }
        return obj;
    }

    static merge<T extends TypedMap<Record<string | number, any>>[]>(...maps: T) {
        const values = maps.map((map) => map.entries()).flat();
        return new TypedMap<{
            [K in T[number] as K extends TypedMap<Record<infer K, any>> ? K : never]: K extends TypedMap<
                Record<any, infer V>
            >
                ? V
                : never;
        }>(values as any);
    }
}
