import { nullike } from './gaurd';

export class AccessorCache<K, V> {
    private cache = new Map<K, V>();

    private _get: (key: K) => V;
    private _validate: (key: K, value: V) => boolean;

    public constructor(get: (key: K) => V, validate: (key: K, value: V) => boolean) {
        this._get = get;
        this._validate = validate;
    }

    public get(key: K) {
        if (this.cache.has(key)) {
            const value = this.cache.get(key);
            if (this._validate(key, value)) return value;
        }

        const value = this._get(key);
        if (!this._validate(key, value)) return undefined;
        if (nullike(value)) return undefined;
        this.cache.set(key, value);
        return value;
    }

    public clear() {
        this.cache.clear();
    }
}
