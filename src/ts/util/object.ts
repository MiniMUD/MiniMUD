import { UnionToIntersection } from 'type-fest';

export const typeSafeObjectEntries = <T extends Record<PropertyKey, unknown>>(
    obj: T
): { [K in keyof T]: [K, T[K]] }[keyof T][] => {
    return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
};

export const typeSafeObjectFromEntries = <const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
    entries: T
): { [K in T[number] as K[0]]: K[1] } => {
    return Object.fromEntries(entries) as { [K in T[number] as K[0]]: K[1] };
};

export const mapObject = <K extends string | number, V>(obj: Record<K, V>, mapfn: (x: [K, V]) => [K, V]) =>
    typeSafeObjectFromEntries(typeSafeObjectEntries(obj).map(mapfn));

export async function awaitObject<T extends Record<string, Promise<any>>>(obj: T) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = await value;
    }
    return result as { [k in keyof T]: Awaited<T[k]> };
}

export type CleanupIntersections<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;
