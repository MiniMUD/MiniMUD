import { t } from '@common/runtime-types';
import { Table, TableLoader } from '@/table';
import { getID } from '@/util/id';
import { Accessor, Flag, ReadonlyFlag } from './accessor';
import { Component } from './component';
import { ValidationErrorTracker } from '@/common/runtime-types/error-tracker';
import { Archetype, ArchetypeBuilder } from './archetype';

export type Entity = string;

export class GamestateValidationError extends Error {
    public entity: Entity;
    public component: Component<any>;

    constructor(msg: string, entity: Entity, component: Component<any>) {
        super(`invalid data for [${entity},${component.name}]: ${msg}`);
        this.entity = entity;
        this.component = component;
    }
}

export class Gamestate {
    private components = new Set<Component<any>>();
    private _accessors = new Map<string, Accessor<any>>();
    private _archetypes = new Map<string, Archetype<any>>();
    private store = new Table<Entity, string, any>();

    public name = this.bind(Gamestate.Component.string('name'));

    public get accessors() {
        return this._accessors.values();
    }

    public get archetypes() {
        return this._archetypes.values();
    }

    public entity(): Entity {
        const id = getID(Gamestate.entityPrefix);
        if (new Set(this.store.rowKeys()).has(id)) return this.entity();
        return id;
    }

    public has(entity: Entity) {
        return this.store.hasRow(entity);
    }

    public delete(target: Entity) {
        this.store.deleteRow(target);
    }

    public bindFlag<N extends string>(component: Component<boolean, N>): Flag<N> {
        this.components.add(component);
        const accessor = new Flag<N>(this.store, component);
        this._accessors.set(component.hash, accessor);
        return accessor;
    }

    public bind<T, N extends string>(component: Component<T, N>): Accessor<T, N> {
        this.components.add(component);
        const accessor = new Accessor<T, N>(this.store, component);
        this._accessors.set(component.hash, accessor);
        return accessor;
    }

    public archetype(name: string) {
        return new ArchetypeBuilder(this, name);
    }

    public addArchetype(archetype: Archetype<any>) {
        this._archetypes.set(archetype.flag.component.hash, archetype);
    }

    public save() {
        return this.store.serialize().toJSON();
    }

    public load(data: string) {
        const state = Gamestate.loader.load(data);

        // validate the result
        const target = new Table<Entity, string, any>();
        state.write(target);
        Gamestate.validate(target, this.components);

        // load the data
        state.write(this.store);
    }

    public validate() {
        return Gamestate.validate(this.store, this.components);
    }

    private static validate(table: Table<Entity, string, any>, validateComponents: Iterable<Component<any>>) {
        const loc: {
            entity: Entity;
            component: Component<any>;
        } = {
            entity: undefined,
            component: undefined,
        };

        const components: Component<any>[] = Array.from(validateComponents);

        const tracker = new ValidationErrorTracker();
        let success = true;

        for (const component of components)
            for (const entity of table.rowKeys()) {
                loc.entity = entity;
                loc.component = component;
                if (table.has(entity, component.hash)) {
                    const v = table.get(entity, component.hash);
                    const ctx = tracker.writer(`${entity}/${component.name}`, v);
                    success = success && component.t.validate(v, ctx);
                }
            }
        if (!success) throw new Error(tracker.error());
    }

    public entities() {
        return this.store.rowKeys();
    }

    public flagComponents(): Flag[] {
        return Array.from(this.accessors)
            .map((c) => (c instanceof Flag ? c : undefined))
            .filter((c) => c);
    }

    public propertyComponents(): Accessor<unknown>[] {
        return Array.from(this.accessors)
            .map((c) => (c instanceof Flag ? undefined : c))
            .filter((c) => c);
    }

    public filter(callback: (e: Entity) => boolean) {
        return Array.from(this.entities()).filter(callback);
    }

    public inspect(entity: Entity) {
        const components: Record<string, unknown> = {};
        for (const component of this.components) {
            if (this.store.has(entity, component.hash))
                components[component.name] = this.store.get(entity, component.hash);
        }
        return components;
    }

    public reset() {
        this.store.clear();
    }

    public about(target: Entity) {
        return this.name.get(target) || target;
    }

    static loader = new TableLoader(t.string, t.string, t.unknown);

    static Component = Component;
    static Archetype = Archetype;

    static entityPrefix = '@';
}
