import { Table } from '@/table';
import { Component } from './component';
import { Entity } from './gamestate';
import { nullike } from '@/util/gaurd';

export class Accessor<T = unknown, N extends string = string> {
    public constructor(private store: Table<Entity, string, any>, public component: Component<T, N>) {
        this.store = store;
        this.component = component;
    }

    public getSafe(target: Entity): T {
        return this.component.t.cast(this.get(target));
    }

    public setSafe(target: Entity, value: T): this {
        this.component.t.assert(value);
        this.set(target, value);
        return this;
    }

    public get(target: Entity): T {
        if (nullike(target)) return undefined;
        return this.store.get(target, this.component.hash);
    }

    public set(target: Entity, value: T): this {
        if (nullike(target)) return this;
        this.store.set(target, this.component.hash, value);
        return this;
    }

    public has(target: Entity): boolean {
        if (nullike(target)) return false;
        return this.store.has(target, this.component.hash);
    }

    public delete(target: Entity): boolean {
        return this.store.delete(target, this.component.hash);
    }

    public ensure(target: Entity, defaultValue: T) {
        if (!this.has(target)) this.set(target, defaultValue);
        return this.get(target);
    }

    public test(target: string) {
        if (nullike(target)) return false;
        return this.has(target);
    }

    public get name() {
        return this.component.name;
    }
}

export class Flag<N extends string = string> extends Accessor<boolean, N> {
    enable(target: string) {
        this.set(target, true);
    }

    disable(target: string) {
        this.delete(target);
    }

    is(target: string) {
        return this.has(target) && this.get(target) === true;
    }

    test(target: string) {
        return this.is(target);
    }
}

export interface ReadonlyFlag {
    readonly name: string;
    test(target: string): boolean;
}
