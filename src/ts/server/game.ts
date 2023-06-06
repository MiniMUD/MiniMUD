import { default as mergeOptions } from 'merge-options';

import { EventManager } from './event-manager/event-manager';
import { ReadonlyFlag } from './gamestate/accessor';
import { Entity, Gamestate } from './gamestate/gamestate';
import { inline, style } from '@common/console';
import { Named } from '@/util/named';
import { ElementDescriptor, text } from '@common/console/element';
import { t } from '@/common/runtime-types';
import { AccessorCache } from '@/util/accessor-cache';
import { stringSimilarity } from '@/util/string-similarity';
import { Archetype, ArchetypeCastError, Instance } from './gamestate/archetype';
import { nullike } from '@/util/gaurd';

export interface GameOptions {
    eventArgumentLength: number;
    logEvents: boolean;
}

export class Game {
    public options = Game.defaultOptions();

    public events = new EventManager();
    public state = new Gamestate();

    // components
    public name = this.state.bind(Gamestate.Component.string('name'));
    public description = this.state.bind(Gamestate.Component.string('description'));
    public children = this.state.bind(Gamestate.Component.array(t.string, 'children'));
    public parent = this.state.bind(Gamestate.Component.string('parent'));
    public reference = this.state.bind(Gamestate.Component.string('reference'));
    public token = this.state.bind(Gamestate.Component.string('token'));
    public direction = this.state.bind(Gamestate.Component.string('direction'));
    public locked = this.state.bind(Gamestate.Component.boolean('locked'));
    public tag = this.state.bind(Gamestate.Component.string('tag'));
    public encoded = this.state.bind(Gamestate.Component.string('encoded'));
    public decoder = this.state.bind(Gamestate.Component.string('decoder'));
    public mutation = this.state.bind(Gamestate.Component.record(t.string, t.string, 'mutation'));

    // flags
    public void = this.state.bindFlag(Gamestate.Component.flag('void')); // the default room

    // archetypes
    public container = this.state.archetype('container').add(this.children, []).compile();
    public child = this.state.archetype('child').add(this.parent, null).compile();
    public node = this.state.archetype('node').extends(this.container).extends(this.child).compile();
    public carryable = this.state.archetype('carryable').compile();
    public placeable = this.state.archetype('placeable').extends(this.container).compile();
    public player = this.state.archetype('player').extends(this.node).add(this.name).add(this.token).compile();
    public npc = this.state.archetype('npc').extends(this.node).add(this.name).compile();
    public room = this.state
        .archetype('room')
        .extends(this.container)
        .extends(this.placeable)
        .add(this.name)
        .add(this.description)
        .compile();
    public door = this.state
        .archetype('door')
        .extends(this.node)
        .add(this.direction)
        .add(this.locked)
        .add(this.reference)
        .compile();
    public object = this.state.archetype('object').extends(this.child).add(this.name).add(this.description).compile();
    public prop = this.state.archetype('prop').extends(this.object).compile();
    public item = this.state.archetype('item').extends(this.object).extends(this.carryable).compile();
    public chest = this.state.archetype('chest').extends(this.object).extends(this.placeable).compile();
    public backpack = this.state
        .archetype('backpack')
        .extends(this.object)
        .extends(this.placeable)
        .extends(this.carryable)
        .compile();

    // derivative events
    public playerMove = this.events.channel('player-move', (player: Entity, from: Entity, to: Entity) => {}, true);
    public playerTeleport = this.events.channel(
        'player-teleport',
        (player: Entity, from: Entity, to: Entity) => {},
        true
    );

    public objectTeleported = this.events.channel(
        'object-teleported',
        (object: Entity, from: Entity, toRoom: Entity) => {},
        true
    );
    public objectDropped = this.events.channel(
        'object-dropped',
        (object: Entity, byPlayer: Entity, toRoom: Entity) => {},
        true
    );
    public objectTaken = this.events.channel(
        'object-taken',
        (object: Entity, fromRoom: Entity, byPlayer: Entity) => {},
        true
    );
    public objectGiven = this.events.channel(
        'object-given',
        (object: Entity, byPlayer: Entity, toPlayer: Entity) => {},
        true
    );
    public objectPut = this.events.channel(
        'object-put',
        (object: Entity, byPlayer: Entity, toObject: Entity) => {},
        true
    );
    public objectTakenFrom = this.events.channel(
        'object-taken-from',
        (object: Entity, fromObject: Entity, byPlayer: Entity) => {},
        true
    );

    // events
    public eventEntityMove = this.events
        .channel('entity-move', (target: Entity, lastContainer: Entity, currentContainer: Entity) => {})
        .on((target, lastContainer, currentContainer) => {
            if (this.player.is(target) || this.npc.is(target)) {
                if (nullike(lastContainer) || nullike(currentContainer)) {
                    this.playerTeleport(target, lastContainer, currentContainer);
                } else {
                    const fromRoom = this.room.is(lastContainer);
                    const toRoom = this.room.is(currentContainer);
                    if (fromRoom && toRoom && this.areRoomsConnectedAndUnlocked(lastContainer, currentContainer)) {
                        this.playerMove(target, lastContainer, currentContainer);
                    } else {
                        this.playerTeleport(target, lastContainer, currentContainer);
                    }
                }
            } else if (this.object.is(target)) {
                const fromPlayer = this.player.is(lastContainer);
                const fromRoom = this.room.is(lastContainer);
                const fromObject = this.object.is(lastContainer);
                const toPlayer = this.player.is(currentContainer);
                const toRoom = this.room.is(currentContainer);
                const toObject = this.object.is(lastContainer);

                if (fromPlayer) {
                    if (toRoom) this.objectDropped(target, lastContainer, currentContainer);
                    else if (toPlayer) this.objectGiven(target, lastContainer, currentContainer);
                    else if (toObject) this.objectPut(target, lastContainer, currentContainer);
                } else if (fromRoom) {
                    if (toPlayer) this.objectTaken(target, lastContainer, currentContainer);
                    else if (toRoom) this.objectTeleported(target, lastContainer, currentContainer);
                } else if (fromObject) {
                    if (toPlayer) this.objectTakenFrom(target, lastContainer, currentContainer);
                } else if (toRoom) {
                    this.objectTeleported(target, lastContainer, currentContainer);
                }
            }
        });

    public eventRoomsLinked = this.events.channel(
        'rooms-linked',
        (target: Entity, relation: AdjacencyRelation, second: Entity, locked: boolean) => {}
    );
    public eventDoorUnlock = this.events.channel(
        'door-unlocked',
        (target: Entity, direction: string, second: Entity) => {}
    );
    public eventDoorLock = this.events.channel(
        'door-locked',
        (target: Entity, direction: string, second: Entity) => {}
    );

    public send = this.events.channel('send', (target: Entity, message: ElementDescriptor) => {}, true);
    public sessionStart = this.events.channel('session-start', (target: Entity) => {});
    public sessionEnd = this.events.channel('session-end', (target: Entity) => {});
    public whisper = this.events.channel('whisper', (target: Entity, src: Entity, msg: string) => {});
    public say = this.events.channel('say', (target: Entity, src: Entity, msg: string) => {});
    public interupt = this.events.channel('interupt', (target: Entity) => {});

    // caches
    private entityNameCache = new AccessorCache<string, Entity>(
        (name) => {
            for (const entity of this.state.entities()) if (this.name.get(entity) === name) return entity;
            return undefined;
        },
        (name, entity) => this.name.get(entity) === name
    );

    private entityTagCache = new AccessorCache<string, Entity>(
        (tag) => {
            for (const entity of this.state.entities()) if (this.tag.get(entity) === tag) return entity;
            return undefined;
        },
        (tag, entity) => this.tag.get(entity) === tag
    );

    private sessions = new AccessorCache<string, Entity>(
        (token) => {
            for (const entity of this.state.entities()) if (this.token.get(entity) === token) return entity;
        },
        (token, entity) => this.token.get(entity) === token
    );

    // console
    public error = this.events.error;
    public warn = this.events.warn;
    public info = this.events.info;
    public log = this.events.log;
    public debug = this.events.debug;

    public constructor(options?: Partial<GameOptions>) {
        if (options) this.options = mergeOptions(this.options, options);
        if (this.options.logEvents) this.logEvents();

        this.events.errorHandler = (err: Error) => {
            if (err instanceof RuntimeError) return this.error(err);
            throw err;
        };
    }

    /**
     * Delete all entities
     */
    public reset() {
        this.state.reset();
    }

    /**
     * Delete an entitiy and attempt to remove references to it
     */
    public destroyEntity(target: Entity) {
        if (target === undefined) return;
        if (this.parent.has(target)) this.unlinkFromParent(target);
        if (this.children.has(target)) this.unlinkFromChildren(target);
        this.state.delete(target);
        this.logCommand('destroy', [target], undefined);
    }

    /**
     * Create a player
     */
    public createPlayer(name: string) {
        const e = this.state.entity();
        const player = this.player.construct(e);
        player.name = name;
        this.logCommand('create-player', [name], e);
        this.moveToVoid(e);
        return e;
    }

    public createNPC(name: string) {
        const e = this.state.entity();
        const npc = this.npc.construct(e);
        npc.name = name;
        this.logCommand('create-npc', [name], e);
        this.moveToVoid(e);
        return e;
    }

    /**
     * Create a basic object
     */
    public createProp(name: string, description?: string) {
        const e = this.state.entity();
        const prop = this.prop.construct(e);
        prop.name = name;
        prop.description = description;
        this.logCommand('create-prop', [name, description], e);
        this.moveToVoid(e);
        return e;
    }

    /**
     * Create an object that can be picked up
     */
    public createItem(name: string, description?: string) {
        const e = this.state.entity();
        const item = this.item.construct(e);
        item.name = name;
        item.description = description;
        this.logCommand('create-item', [name, description], e);
        this.moveToVoid(e);
        return e;
    }

    /**
     * Create an object that can contain other objects
     */
    public createChest(name: string, description?: string) {
        const e = this.state.entity();
        const chest = this.chest.construct(e);
        chest.name = name;
        chest.description = description;
        this.logCommand('create-chest', [name, description], e);
        this.moveToVoid(e);
        return e;
    }

    /**
     * Create an object that can contain other objects and be picked up
     */
    public createBackpack(name: string, description?: string) {
        const e = this.state.entity();
        const backpack = this.backpack.construct(e);
        backpack.name = name;
        backpack.description = description;
        this.logCommand('create-backpack', [name, description], e);
        this.moveToVoid(e);
        return e;
    }

    /**
     * Create a room
     */
    public createRoom(name: string, description?: string) {
        const e = this.state.entity();
        const room = this.room.construct(e);
        room.name = name;
        room.description = description;
        this.logCommand('create-room', [name, description], e);
        return e;
    }

    /**
     * Constructs a new door entity. Doors should be editied with dedicated utilities.
     * @returns
     */
    private _constructDoor(room: Entity, direction: string, target: Entity, locked: boolean = false) {
        const e = this.state.entity();
        const door = this.door.construct(e);
        this.move(e, room);
        door.direction = direction;
        door.locked = locked;
        door.reference = target;
        return e;
    }

    /**
     * Unlink an entity from its parent the hierarchy
     */
    private unlinkFromParent(target: string) {
        this.assert('target', target, [this.parent]);
        const parent = this.parent.get(target);
        if (parent !== undefined) {
            // convert the children to a set
            const children = new Set(this.children.get(parent));
            // remove the target
            children.delete(target);
            // update the children
            this.children.set(parent, Array.from(children));
        }
        this.parent.set(target, undefined);
    }

    /**
     * Unlink an entity from its children in the hierarchy
     */
    public unlinkFromChildren(target: Entity) {
        this.assert('target', target, [this.children]);
        for (const child of this.children.get(target)) if (this.parent.has(child)) this.parent.set(child, undefined);
        this.children.set(target, []);
    }

    /**
     * Move an entity to a new container
     */
    public move(child: Entity, container: Entity) {
        if (child === container) {
            throw new RuntimeError(`Entity ${this.about(child)} cannot contain itself.`);
        }
        this.assert('child', child, [this.parent]);
        this.assert('container', container, [this.children]);

        const lastContainer = this.parent.get(child);

        this.unlinkFromParent(child);
        this.parent.set(child, container);
        this.children.get(container).push(child);

        if (lastContainer === container) return;
        this.eventEntityMove(child, lastContainer, container);
    }

    /**
     * Move all the children from one container to another
     * @param target the entity that will gain children
     * @param node ther entity that will have its chilren moved
     */
    public mergeContainers(target: Entity, node: Entity) {
        this.assert('target', target, [this.children]);
        this.assert('node', node, [this.children]);
        for (const child of this.children.get(node)) {
            this.move(child, target);
        }
    }

    /**
     * @returns true if the entities are in the same container. different than Game.sameRoom.
     */
    public areNeighbors(a: Entity, b: Entity) {
        return this.parent.get(a) === this.parent.get(b);
    }

    public roomOf(target: Entity): Entity {
        if (this.room.is(target)) return target;
        if (!this.parent.has(target)) return undefined;
        return this.roomOf(this.parent.get(target));
    }

    public playerOf(target: Entity): Entity {
        if (this.player.is(target)) return target;
        if (!this.parent.has(target)) return undefined;
        return this.playerOf(this.parent.get(target));
    }

    /**
     * Check if two rooms are equal. If either entity is not a room the room containing it will be checked instead.
     * @returns true if both entities are in the same room.
     */
    public sameRoom(a: Entity, b: Entity) {
        return this.roomOf(a) === this.roomOf(b);
    }

    /**
     * @returns an array of all the entities in the same container as the target
     */
    public neighbors(target: Entity) {
        this.assert('target', target, [this.parent]);
        const parent = this.parent.get(target);
        this.assert('target:parent', target, [this.children]);
        return this.children.get(parent).filter((e) => e !== target);
    }

    private setDoor(room: Entity, direction: string, target: Entity, locked: boolean = false) {
        const door = this.getDoor(room, direction) || this._constructDoor(room, direction, target, locked);
        this.reference.set(door, target);
        this.locked.set(door, locked);
        return door;
    }

    /**
     * Create/Edit a door from one room to another.
     */
    public editDoor(room: Entity, direction: string, target: Entity, locked: boolean = false) {
        const door = this.setDoor(room, direction, target, locked);
        this.logCommand('edit-door', [room, direction, target, locked], door);
        return door;
    }

    /**
     * Create/Edit doors between two rooms.
     */
    public connectRooms(left: Entity, relation: AdjacencyRelation, right: Entity, locked: boolean = false) {
        const r = [undefined, undefined] as [string, string];
        if (relation.forward) r[0] = this.setDoor(left, relation.forward, right, locked);
        if (relation.backward) r[1] = this.setDoor(right, relation.backward, left, locked);
        this.logCommand('connect-rooms', [left, relation, right, locked], r);
        return r;
    }

    /**
     * Delete doors between two rooms.
     */
    public disconnectRooms(left: Entity, right: Entity) {
        this.doors(left)
            .filter((x) => this.reference.get(x) === right)
            .forEach((door) => this.destroyEntity(door));
        this.doors(right)
            .filter((x) => this.reference.get(x) === left)
            .forEach((door) => this.destroyEntity(door));
        this.logCommand('disconnect-rooms', [left, right], undefined);
    }

    /**
     * Get a list of doors for a room
     */
    public doors(_room: Entity) {
        const room = this.room.cast(_room);
        return room.children.filter((x) => this.door.is(x));
    }

    public areRoomsConnectedAndUnlocked(left: Entity, right: Entity) {
        const left_to_right = this.doors(left).find((x) => this.reference.get(x) === right);
        const right_to_left = this.doors(right).find((x) => this.reference.get(x) === left);
        return left_to_right && right_to_left && !this.locked.get(left_to_right) && !this.locked.get(right_to_left);
    }

    public getDoor(room: Entity, direction: string) {
        direction = direction.toLowerCase();
        return this.doors(room).find((x) => this.direction.get(x).toLowerCase() === direction);
    }

    public getAdjacentRoom(room: Entity, direction: string) {
        return this.reference.get(this.getDoor(room, direction));
    }

    public isAdjacentRoomLocked(room: Entity, direction: string) {
        return this.locked.get(this.getDoor(room, direction));
    }

    public take(obj: Entity, player: Entity) {
        this.assert('obj', obj, [this.carryable]);
        this.assert('player', player, [this.player]);
        this.move(obj, player);
    }

    public isHolding(obj: Entity, player: Entity) {
        return this.children.get(player).includes(obj);
    }

    public drop(obj: Entity, player: Entity) {
        this.assert('obj', obj, [this.carryable]);
        this.assert('player', player, [this.player]);
        if (!this.isHolding(obj, player)) {
            throw new RuntimeError(`${this.about(player)} must be holding ${this.about(obj)} to drop it.`);
        }
        this.move(obj, this.roomOf(player));
    }

    /**
     * Lookup a room by relation to the current room, and move the player too it
     */
    public movePlayerDirection(player: Entity, direction: string) {
        this.assert('player', player, [this.player, this.parent]);

        const door = this.getDoor(this.parent.get(player), direction);
        const target = this.reference.get(door);
        const locked = this.locked.get(door);

        if (target === undefined) throw new RuntimeError(`${this.about(player)}: no target for ${direction}`);
        if (locked !== false) throw new RuntimeError();

        this.move(player, target);
    }

    /**
     * Confirms/sets the token for a username
     * @returns true if the token is correct for the username
     * @returns true if the username does not have a token
     * @returns false if the token is incorrect for the username
     */
    public authenticate(username: string, token: string) {
        const target = this.find(username);
        if (!target) return false;
        const exists = this.token.get(target);
        if (exists) return exists === token;
        this.token.set(target, token);
        return true;
    }

    public session(token: string): Entity | undefined {
        if (nullike(token)) return undefined;
        return this.sessions.get(token);
    }

    public canRead(target: Entity, player: Entity) {
        if (!this.encoded.has(target)) return true;
        const encoded = this.encoded.get(target);
        return this.findIn(player, (x) => this.decoder.get(x) === encoded);
    }

    public inVision(target: Entity, player: Entity) {
        if (target === player) return true;
        const targetPlayerContainer = this.playerOf(target);
        const targetRoomContainer = this.roomOf(target);
        const playerRoomContainer = this.roomOf(player);

        if (targetRoomContainer !== playerRoomContainer) return false;
        if (targetPlayerContainer && targetPlayerContainer !== player) return false;
        return true;
    }

    public readableChildObjects(target: Entity, perspective: Entity) {
        return this.children.get(target)?.filter((e) => this.object.is(e) && this.canRead(e, perspective)) ?? [];
    }

    /**
     * Find an entity by exact name
     */
    public find(name: string): Entity | undefined {
        return this.entityNameCache.get(name);
    }

    public findIn(container: Entity, predicate: (entity: Entity) => boolean): Entity {
        return this.children
            .get(container)
            ?.find((x) => predicate(x) || (this.children.has(x) ? this.findIn(container, predicate) : false));
    }

    /**
     * Find an entity by exact tag
     */
    public get(tag: string): Entity | undefined {
        return this.entityTagCache.get(tag);
    }

    /**
     * Set the tag for an entity
     */
    public setTag(entity: Entity, tag: string) {
        if (this.get(tag)) {
            throw new RuntimeError(`tag "${tag}" already in use`);
        }
        this.tag.set(entity, tag);
    }

    /**
     * Find all entities with a set of components
     */
    public filter(...accessors: ReadonlyFlag[]) {
        return this.state.filter((e) => accessors.every((accessor) => accessor.test(e)));
    }

    /**
     * Find all entities with similar names
     * @param name
     */
    public search(name: string, archetype: ReadonlyFlag[] = []) {
        const threshold = 0.25;
        return this.filter(this.name, ...archetype)
            .map((value) => ({
                value,
                score: stringSimilarity(this.name.get(value), name),
            }))
            .filter((x) => x.score > threshold)
            .sort((a, b) => a.score - b.score)
            .map((x) => x.value);
    }

    /**
     * @returns the Flag accessors defined for the target entity
     */
    public flags(target: Entity) {
        return this.state.flagComponents().filter((flag) => flag.is(target));
    }

    /**
     * @returns the non-Flag accessors defined for the target entity
     */
    public properties(target: Entity) {
        return this.state.propertyComponents().filter((c) => c.has(target));
    }

    /**
     * @returns the highest-order archetype matching the target entity
     */
    public getArchetype(target: Entity) {
        const types: Archetype<any>[] = [];
        for (const archetype of this.state.archetypes) {
            if (archetype.is(target)) types.push(archetype);
        }
        types.sort((a, b) => {
            if (a.inheritsFrom.includes(b)) return 1;
            if (b.inheritsFrom.includes(a)) return -1;
            return 0;
        });
        return types[types.length - 1];
    }

    /**
     * @returns the non-Flag accessors defined on this entity not from it's archetype
     */
    public getOwnProperties(target: Entity) {
        const archetype = this.getArchetype(target);
        return this.properties(target).filter((accessor) => !archetype.props.has(accessor));
    }

    public getTypeString(target: Entity) {
        const archetype = this.getArchetype(target);
        const properties = this.getOwnProperties(target);
        if (properties.length) return `${archetype.name}{${properties.map((x) => x.name).join(', ')}}`;
        else return archetype.name;
    }

    /**
     * Sort entities by flags
     */
    public binEntities(entities: Entity[], order: ReadonlyFlag[]): Entity[] {
        const bins = new Map(order.map((v) => [v, []] as [ReadonlyFlag, string[]]));
        for (const entity of entities) {
            for (const accessor of order) {
                if (accessor.test(entity)) {
                    bins.get(accessor).push(entity);
                    break;
                }
            }
        }
        return Array.from(bins.values()).flat();
    }

    /**
     * The default room. Some behaviors are not defined for entities not in rooms.
     */
    public theVoid() {
        const create = () => {
            const theVoid = this.createRoom('The Void', '');
            this.void.enable(theVoid);
            return theVoid;
        };

        const voids = this.filter(this.void, this.room);
        const theVoid = voids.shift() || create();
        while (voids.length) {
            const next = voids.shift();
            this.mergeContainers(theVoid, next);
            this.destroyEntity(next);
        }
        return theVoid;
    }

    /**
     * Move an entity to the default room
     */
    public moveToVoid(target: Entity) {
        this.move(target, this.theVoid());
    }

    /**
     * Iterate over all players
     */
    public foreachPlayer(callback: (player: Entity, index: number, players: string[]) => void) {
        this.filter(this.player).forEach(callback);
    }

    /**
     * Iterate over all players in a container
     */
    public foreachPlayerIn(container: Entity, callback: (player: Entity, index: number, players: string[]) => void) {
        if (nullike(container)) return;
        this.assert('container', container, [this.container]);
        this.children
            .get(container)
            .filter((x) => this.player.is(x))
            .forEach(callback);
    }

    /**
     * Call a method and catch expected runtime errors
     */
    public command<A extends any[], R extends any>(fn: (...args: A) => R, ...args: A): R | undefined {
        try {
            return fn.call(this, ...args);
        } catch (err) {
            if (err instanceof RuntimeError || err instanceof ArchetypeCastError) {
                this.error(err);
                return undefined;
            }
            throw err;
        }
    }

    /**
     * Gets the best-guess name of an entity. If the name of the entity cannot be found, returns the entity-id instead
     */
    public about(e: Entity) {
        return this.name.get(e) ?? e;
    }

    /**
     * Wraps Game.about with some formatting
     */
    public print(e: Entity) {
        return style(this.name.get(e) ?? e, ['fw-bold']);
    }

    /**
     * Checks to see if a target entity has a set of components.
     * @returns the names of the missing components
     */
    public has(target: Entity, accessors: ReadonlyFlag[]): string[] {
        return accessors.filter((accessor) => !accessor.test(target)).map((accessor) => accessor.name);
    }

    /**
     * Throws if target is missing any of the components in accessors
     * @param arg name of the argument
     * @param target entity id
     * @param accessors the components to check for
     *
     * @throws {ErrorMissingComponent}
     * Thrown if the target is missing a component.
     *
     * @throws {ErrorTargetUndefined}
     * Thrown if the target is undefined or null.
     *
     * @throws {RuntimeError}
     */
    public assert(arg: string, target: Entity, accessors: ReadonlyFlag[]) {
        if (target === undefined || target === null) throw new ErrorTargetUndefined(arg);
        const missing = this.has(target, accessors);
        if (missing.length) throw new ErrorMissingComponent(arg, this.about(target), missing);
    }

    public logCommand(name: string, args: any[], result: any) {
        const resolveArg = (arg: any) => this.resolveArg(arg);
        const delim = text(', ');

        const argEl = args
            .map(resolveArg)
            .map((x) => [x, delim])
            .flat()
            .slice(0, -1);
        this.log(
            style(
                inline(
                    name,
                    '(',
                    ...argEl,
                    ')',
                    style(` → `, ['text-subtle']),
                    style(resolveArg(result), ['text-subtle'])
                ),
                ['fst-italic']
            )
        );
    }

    public logEvent(name: string, args: any[]) {
        const resolveArg = (arg: any) => this.resolveArg(arg);
        const delim = text(', ');

        const argEl = args
            .map(resolveArg)
            .map((x) => [x, delim])
            .flat()
            .slice(0, -1);
        this.log(style(inline(name, '<', ...argEl, '>'), ['fst-italic']));
    }

    /**
     * start logging events with this.events.log();
     */
    public logEvents() {
        this.events.broadcast.on((name, args) => {
            this.logEvent(name, args);
        });
    }

    public resolveArg(arg: any): ElementDescriptor {
        if (Array.isArray(arg)) {
            const delim = text(', ');
            const arr = arg
                .map((x) => this.resolveArg(x))
                .map((x) => [x, delim])
                .flat()
                .slice(0, -1);
            return inline('[', ...arr, ']');
        }
        if (typeof arg === 'function' || arg instanceof Function) return text('[native]');
        if (typeof arg === 'undefined' || arg === undefined) return text('[undefined]');
        if (arg === null) return text('[null]');
        if (arg instanceof Named) {
            return inline(text('['), style(text(arg.toString()), ['debug-object']), text(']'));
        }
        if (typeof arg === 'string') {
            if (arg.length > this.options.eventArgumentLength) return text('[...]');
            if (this.state.has(arg)) {
                if (this.name.has(arg)) return inline('<', style(this.about(arg), ['debug-entity']), '>');
                const archetype = this.getArchetype(arg);
                return inline('<[', style(archetype.name, ['debug-entity']), text(']>'));
            }
            return text(`"${arg}"`);
        }
        return this.resolveArg(String(arg));
    }

    public static defaultOptions = (): GameOptions => ({
        eventArgumentLength: 100,
        logEvents: true,
    });
}

// archetype instance types
export { GenericEntity } from './gamestate/archetype';
export type Container = Instance<InstanceType<typeof Game>['container']>;
export type Child = Instance<InstanceType<typeof Game>['child']>;
export type Player = Instance<InstanceType<typeof Game>['player']>;
export type Room = Instance<InstanceType<typeof Game>['room']>;
export type Object = Instance<InstanceType<typeof Game>['object']>;
export type Prop = Instance<InstanceType<typeof Game>['prop']>;
export type Item = Instance<InstanceType<typeof Game>['item']>;
export type Chest = Instance<InstanceType<typeof Game>['chest']>;
export type Backpack = Instance<InstanceType<typeof Game>['backpack']>;
export type NPC = Instance<InstanceType<typeof Game>['npc']>;

export enum Direction {
    North = 'North',
    South = 'South',
    East = 'East',
    West = 'West',
    Up = 'Up',
    Down = 'Down',
}

/**
 * Describes a relation between directions for adjacent entities (eg north&south, west&east, up&down)
 */
export class AdjacencyRelation extends Named {
    public constructor(public backward?: string, public forward?: string, public name?: string) {
        name = name || AdjacencyRelation.getName(forward, backward);
        super(name);
        this.name = name;
        this.forward = forward.toLowerCase();
        this.backward = backward.toLowerCase();
    }

    private static getName(forward?: string, backward?: string) {
        if (forward && backward) /* room1 is */ return `${backward}_of` /* room2 */;
        return `[${backward}, ${forward}]`;
    }
}

export const adjacencyRelation = {
    northof: new AdjacencyRelation(Direction.North, Direction.South),
    southof: new AdjacencyRelation(Direction.South, Direction.North),
    eastof: new AdjacencyRelation(Direction.East, Direction.West),
    westof: new AdjacencyRelation(Direction.West, Direction.East),
    above: new AdjacencyRelation(Direction.Up, Direction.Down, 'above'),
    below: new AdjacencyRelation(Direction.Down, Direction.Up, 'below'),
};

export class RuntimeError extends Error {}

export class ErrorTargetUndefined extends RuntimeError {
    public constructor(public argName: string) {
        super(`target for "${argName}" is undefined`);
        this.argName = argName;
    }
}

export class ErrorMissingComponent extends RuntimeError {
    public constructor(public argName: string, public targetName: string, public missing: string[]) {
        super(`target for "${argName}" (${targetName}) is missing the fallowing components: [${missing.join(', ')}]`);
        this.argName = argName;
        this.targetName = targetName;
        this.missing = missing;
    }
}
