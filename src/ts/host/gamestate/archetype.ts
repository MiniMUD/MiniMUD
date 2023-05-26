import { Accessor, Flag, ReadonlyFlag } from './accessor';
import { Entity, Gamestate } from './gamestate';
import { Component } from './component';
import { cloneDeep } from 'lodash';
import { nullike } from '@/util/gaurd';
import { CleanupIntersections } from '@/util/object';

export class ArchetypeBuilder<Properties extends (Flag | Accessor)[] = []> {
    private gamestate: Gamestate;
    private name: string;
    private defaults = new Map<Accessor, unknown>();
    private inheritsFrom: Archetype<any>[] = [];

    public constructor(gamestate: Gamestate, name: string) {
        this.gamestate = gamestate;
        this.name = name;
    }

    public flag<N extends string, F extends Flag<N>>(flag: Flag<N>): ArchetypeBuilder<[...Properties, F]> {
        this.defaults.set(flag, true);
        return this as any;
    }

    public prop<T, N extends string, A extends Accessor<T, N>>(
        accessor: A,
        value?: T
    ): ArchetypeBuilder<[...Properties, A]> {
        this.defaults.set(accessor, value);
        return this as any;
    }

    public add<N extends string, F extends Flag<N>>(flag: F): ArchetypeBuilder<[...Properties, F]>;
    public add<T, N extends string, A extends Accessor<T, N>>(
        accessor: A,
        value?: T
    ): ArchetypeBuilder<[...Properties, A]>;
    public add<T, N extends string, A extends Accessor<T, N>>(accessor: A, value?: T) {
        if (accessor instanceof Flag) return this.flag(accessor);
        else return this.prop(accessor, value);
    }

    private digest(arr: Accessor[]) {
        return Component.digest(this.name, arr.map((accessor) => accessor.component.hash).join());
    }

    public extends<T extends Record<string, Accessor>>(
        archetype: Archetype<T>
    ): ArchetypeBuilder<[...Properties, T[keyof T]]> {
        for (const [accessor, value] of archetype.defaults) {
            this.defaults.set(accessor, value);
        }
        this.defaults.set(archetype.flag, true);
        this.inheritsFrom.push(archetype, ...archetype.inheritsFrom);
        return this as any;
    }

    public compile() {
        const flags: Flag[] = Array.from(this.defaults.keys()).filter(
            (accessor): accessor is Flag => accessor instanceof Flag
        );
        const props: Accessor[] = Array.from(this.defaults.keys()).filter((accessor) => !(accessor instanceof Flag));

        const accessors = Object.fromEntries(props.map((f) => [f.component.name, f])) as {
            [K in Properties[number] as K extends Accessor<any, infer N> ? N : never]: K;
        };

        const a = new Archetype(
            this.gamestate,
            this.name,
            this.gamestate.bindFlag(this.digest([...flags, ...props])),
            accessors,
            new Set(flags),
            new Set(props),
            this.defaults,
            this.inheritsFrom
        );

        this.gamestate.addArchetype(a);

        return a;
    }
}

export class ArchetypeCastError extends Error {}

export type GenericEntity = {
    _id: string;
}

export type InstanceProperties<Properties extends Record<string, Accessor>> = CleanupIntersections<{
    [k in keyof Properties]: Properties[k] extends Accessor<infer T> ? T : never;
} & {
    _id: string;
}>;

export type Instance<A extends Archetype<{}>> = A extends Archetype<infer Properties>
    ? InstanceProperties<Properties>
    : never;

export class Archetype<Properties extends Record<string, Accessor> = {}> implements ReadonlyFlag {
    private gamestate: Gamestate;
    public readonly name: string;
    public readonly flag: Flag;
    public readonly accessors: Properties;
    public readonly flags: Set<Flag>;
    public readonly props: Set<Accessor>;
    public readonly defaults: Map<Accessor, unknown>;
    public readonly inheritsFrom: Archetype<any>[];

    public constructor(
        gamestate: Gamestate,
        name: string,
        flag: Flag,
        accessors: Properties,
        flags: Set<Flag>,
        props: Set<Accessor>,
        defaults: Map<Accessor, unknown>,
        inheritsFrom: Archetype<any>[]
    ) {
        this.gamestate = gamestate;
        this.name = name;
        this.flag = flag;
        this.accessors = accessors;
        this.flags = flags;
        this.props = props;
        this.defaults = defaults;
        this.defaults.set(flag, true);
        this.inheritsFrom = inheritsFrom;
    }

    public get<N extends keyof Properties>(key: N) {
        return this.accessors[key];
    }

    private missing(target: Entity) {
        return [
            this.flag,
            ...Array.from(this.flags).filter((flag) => !flag.is(target)),
            ...Array.from(this.props).filter((prop) => !prop.has(target)),
        ].map((x) => x.component.name);
    }

    public isDeep(target: Entity) {
        for (const flag of this.flags) if (!flag.is(target)) return false;
        for (const props of this.props) if (!props.has(target)) return false;
        return true;
    }

    public is(target: Entity) {
        if (nullike(target)) return false;
        return this.flag.is(target);
    }

    public test(target: Entity) {
        return this.is(target);
    }

    private wrap(target: string): InstanceProperties<Properties> {
        const obj = {} as CleanupIntersections<{
            [k in keyof Properties]: Properties[k] extends Accessor<infer T> ? T : never;
        } & {
            _id: string;
        }>;

        for (const [key, accessor] of Object.entries(this.accessors)) {
            Object.defineProperty(obj, key, {
                get() {
                    return accessor.get(target);
                },
                set(value: Properties[typeof key]) {
                    accessor.set(target, value);
                },
            });
        }

        Object.defineProperty(obj, '_id', {
            get() {
                return target;
            },
        });
        
        return obj;
    }

    public validate(target: Entity) {
        if (this.flag.is(target)) {
            const missing = this.missing(target);
            if (missing.length)
                throw new Error(`${target} is not ${this.name} (missing components: ${missing.join(', ')})`);
        }
    }

    public cast(
        target: Entity,
        name?: string
    ): CleanupIntersections<{
        [k in keyof Properties]: Properties[k] extends Accessor<infer T> ? T : never;
    } & {_id: string}> {
        if (!this.flag.is(target))
            throw new ArchetypeCastError(
                `failed to cast ${name} to ${
                    this.name || this.gamestate.about(target)
                } (missing components: ${this.missing(target).join(', ')})`
            );
        return this.wrap(target);
    }

    public construct(target: Entity) {
        for (const [accessor, value] of this.defaults.entries()) {
            accessor.set(target, cloneDeep(value));
        }
        return this.cast(target, `[new ${this.name}]`);
    }

    public create() {
        const e = this.gamestate.entity();
        return this.construct(e);
    }
}
