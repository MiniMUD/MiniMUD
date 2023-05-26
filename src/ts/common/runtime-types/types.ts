import type { SetOptional, UnionToIntersection } from 'type-fest';
import * as _ from 'lodash';

import { CompileType, RuntimeObject, RuntimePrimitve, RuntimeType } from './runtime-type';
import { CleanupIntersections, typeSafeObjectEntries } from '@/util/object';

function primitive<T>(name: string): RuntimeType<T> {
    return new RuntimePrimitve(name, (x): x is T => typeof x === name);
}

export type MapToRuntimeType<T> = { [K in keyof T]: RuntimeType<T[K]> };

namespace _t {
    export const unknown = new RuntimePrimitve<unknown>('unknown', (x: unknown): x is unknown => true);

    export const string = primitive<string>('string');
    export const number = primitive<number>('number');
    export const boolean = primitive<boolean>('boolean');

    export function literal<T extends string | number | boolean>(t: T): RuntimeType<T>;
    export function literal<T extends null>(t: null): RuntimeType<null>;
    export function literal<T extends string | number | boolean>(t: T): RuntimeType<T> {
        return new RuntimePrimitve(JSON.stringify(t), (x): x is T => x === t);
    }

    export function union<A extends unknown[]>(...args: MapToRuntimeType<A>): RuntimeType<A[number]> {
        return new RuntimePrimitve(args.map((tx) => tx.name).join('|'), (x: unknown): x is A[number] =>
            args.some((tx) => tx.is(x))
        );
    }
    export const or = union;

    export type TupleToUnion<A extends any[]> = A extends [infer L, ...infer R]
        ? L | TupleToUnion<R>
        : A extends [infer T]
        ? T
        : never;

    export function oneof<T extends (string | number | boolean | null)[]>(...args: T): RuntimeType<TupleToUnion<T>> {
        return this.or(...args.map((x) => literal(x)));
    }

    export function merge<A extends unknown[]>(
        ...args: MapToRuntimeType<A>
    ): RuntimeType<UnionToIntersection<A[number]>> {
        return new RuntimePrimitve(
            args.map((tx) => tx.name).join('&'),
            (x: unknown): x is UnionToIntersection<A[number]> => args.every((tx) => tx.is(x))
        );
    }
    export const and = merge;

    export function array<T>(tx: RuntimeType<T>): RuntimeType<T[]> {
        return new RuntimePrimitve(
            `Array<${tx.name}>`,
            (x: unknown): x is T[] => Array.isArray(x) && x.every((v) => tx.is(v))
        );
    }

    export function tuple<A extends unknown[]>(...members: MapToRuntimeType<A>): RuntimeType<A> {
        return new RuntimePrimitve(`[${members.map((tx) => tx.name).join(', ')}]`, (x: unknown): x is A => {
            if (!Array.isArray(x)) return false;
            if (x.length !== members.length) return false;
            return _.zip(members, x as unknown[]).every(([t, v]) => t.is(v));
        });
    }

    export function record<K extends string | number, V>(
        tk: RuntimeType<K>,
        tv: RuntimeType<V>
    ): RuntimeType<Record<K, V>> {
        return new RuntimePrimitve(
            `Record<${tk.name}, ${tv.name}>`,
            (x: unknown): x is Record<K, V> =>
                typeof x === 'object' && x !== null && Object.entries(x).every(([k, v]) => tk.is(k) && tv.is(v))
        );
    }

    function property<K extends PropertyKey, V>(k: K, tv: RuntimeType<V>) {
        return new RuntimePrimitve(`"${String(k)}": ${tv.name}`, (x: unknown): x is Record<K, V> => tv.is(x[k]));
    }

    type Optional<K extends PropertyKey, V> = SetOptional<Record<K, V>, K>;
    function optionalProperty<K extends PropertyKey, V>(k: K, tv: RuntimeType<V>) {
        const otv = t.optional(tv);
        return new RuntimePrimitve(`"${String(k)}"?: ${tv.name}`, (x: unknown): x is Optional<K, V> => otv.is(x[k]));
    }

    type OptionalPropertyNames<T extends Record<PropertyKey, RuntimeType<unknown, boolean>>> = {
        [Key in keyof T]: T[Key] extends RuntimeType<any, infer Optional>
            ? Optional extends true
                ? Key
                : never
            : never;
    }[keyof T];
    type NonOptionalPropertyNames<T extends Record<PropertyKey, RuntimeType<unknown, boolean>>> = Exclude<
        keyof T,
        OptionalPropertyNames<T>
    >;
    type ExtractObjectType<T extends Record<PropertyKey, RuntimeType<unknown, boolean>>> = CleanupIntersections<
        {
            [K in NonOptionalPropertyNames<T>]: CompileType<T[K]>;
        } & {
            [K in OptionalPropertyNames<T>]?: CompileType<T[K]>;
        }
    >;

    export function object<T extends Record<PropertyKey, RuntimeType<unknown, boolean>>>(
        obj: T
    ): RuntimeType<ExtractObjectType<T>> {
        const entries = typeSafeObjectEntries(obj);
        const properties = entries.map(([k, tv]) => property(k, tv));
        return new RuntimeObject(
            '{' + properties.map((tx) => tx.name).join(', ') + '}',
            (x: unknown, tracker): x is ExtractObjectType<T> => {
                if (typeof x !== 'object') {
                    tracker.expected('object');
                    return false;
                }
                if (x === null) {
                    tracker.expected('object');
                    return false;
                }
                for (const [k, tv] of Object.entries(obj)) {
                    const v = (x as Record<string, unknown>)[k];
                    if (!tv.validate(v, tracker.enter(k, v))) return false;
                }
                return true;
            }
        );
    }

    export type Vector<T, N extends number> = N extends N ? (number extends N ? T[] : _TupleOf<T, N, []>) : never;
    type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

    export function vector<T, N extends number>(tx: RuntimeType<T>, n: N): RuntimeType<Vector<T, N>> {
        return new RuntimePrimitve(
            `Tuple<${tx.name}, ${n}>`,
            (x: unknown): x is Vector<T, N> => Array.isArray(x) && x.length === n && x.every((v) => tx.is(v))
        );
    }

    export type Matrix<T, Dim extends number[]> = Dim extends [infer N extends number]
        ? Vector<T, N>
        : Dim extends [...infer Rest extends number[], infer N extends number]
        ? Vector<Matrix<T, Rest>, N>
        : never;

    export function matrix<T, N extends number[]>(tx: RuntimeType<T>, ...dim: N): RuntimeType<Matrix<T, N>> {
        return (dim as any[]).reduce((txn, n) => vector(txn, n), tx);
    }

    export function pairings<K, V>(tk: RuntimeType<K>, tv: RuntimeType<V>) {
        return t.array(t.tuple(tk, tv));
    }
}

export declare const __optional: unique symbol;

const _undefined = primitive<undefined>('undefined');
const _null = _t.literal(null);

export const t = {
    ..._t,
    undefined: _undefined,
    null: _null,
    nullish: _t.or(_undefined, _null),
    nullable<T>(tx: RuntimeType<T>): RuntimeType<T | null | undefined, true> {
        return t.or(tx, _null, _undefined);
    },
    optional<T>(tx: RuntimeType<T>): RuntimeType<T | undefined, true> {
        return t.or(tx, _undefined);
    },
};
