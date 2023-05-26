import { Deferred } from '@/util/deferred';
import { nullike } from '@/util/gaurd';
import { typeSafeObjectEntries } from '@/util/object';

export function form<T extends Record<string, (soFar: Record<string, any>) => Promise<any>>>(
    obj: T
): Promise<{ [k in keyof T]: Awaited<ReturnType<T[k]>> }> {
    type R = { [k in keyof T]: Awaited<ReturnType<T[k]>> };
    const res = new Deferred<R | null>();

    const result = {} as R;
    const entries = typeSafeObjectEntries(obj);

    async function present(x: number): Promise<void> {
        if (x >= entries.length) return res.resolve(result);
        if (x < 0) return res.resolve(null);
        const [key, question] = entries[x];
        const value = await question(result);
        if (nullike(value)) return present(x - 1);
        result[key] = value;
        present(x + 1);
    }

    present(0);

    return res.promise;
}
