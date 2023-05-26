import { RuntimeType, t } from '@common/runtime-types';
import { hash } from '@/util/hash';

export class Component<T = unknown, N extends string = string> {
    public readonly name: N;
    public readonly hash: string;
    public t: RuntimeType<T>;

    constructor(name: N, tx: RuntimeType<T>, digest?: string) {
        this.name = name;
        this.hash = hash(digest || name);
        this.t = t.nullable(tx);
    }

    public static unknown = <N extends string>(name: N) => new Component<unknown, N>(name, t.unknown);
    public static string = <N extends string>(name: N) => new Component<string, N>(name, t.string);
    public static number = <N extends string>(name: N) => new Component<number, N>(name, t.number);
    public static boolean = <N extends string>(name: N) => new Component<boolean, N>(name, t.boolean);
    public static flag = <N extends string>(name: N) => new Component<true, N>(name, t.literal(true));
    public static array = <N extends string, T>(tx: RuntimeType<T>, name: N) =>
        new Component<T[], N>(name, t.array(tx));
    public static record = <N extends string, K extends string | number, V>(
        tx: RuntimeType<K>,
        ty: RuntimeType<V>,
        name: N
    ) => new Component<Record<K, V>, N>(name, t.record(tx, ty));

    public static digest = <N extends string>(name: N, digest: string) =>
        new Component<true, N>(name, t.literal(true), digest);
}
