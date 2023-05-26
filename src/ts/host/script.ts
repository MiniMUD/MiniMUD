import { CleanupIntersections } from "@/util/object";
import { GenericEntity, NPC, Player, Room } from "./game";
import { Archetype, ArchetypeCastError, Instance, InstanceProperties } from "./gamestate/archetype";
import Server from "./server";
import { Entity, Gamestate } from "./gamestate/gamestate";
import { EventChannel } from "@/util/event-channel";
import { Accessor } from "./gamestate/accessor";
import { t } from "@/common/runtime-types";
import { s, style } from "@/common/console";

export class ScriptError extends Error {}

class TriggerEvent<K, T extends any[]> {
    private triggers = new Map<K, EventChannel<T>>();

    private touch(target: K) {
        if (this.triggers.has(target)) return;
        this.triggers.set(target, new EventChannel((...args: T)=>{}));
    }

    public on(target: K, handler: (...args: T)=>void) {
        this.touch(target);
        this.triggers.get(target).on(handler);
    }

    public emit(target: K, args: T) {
        if (this.triggers.has(target)) {
            setTimeout(()=>{
                this.triggers.get(target).emit(...args);
            });
        }
    }
}

export class ScriptingEventContext {
    private readonly server: Server;

    private events = {
        player: {
            enter: new TriggerEvent<Entity, [player: Player]>(),
            exit: new TriggerEvent<Entity, [player: Player]>(),
        },
        npc: {
            greet: new TriggerEvent<Entity, [player: Player]>(),
        }
    }

    public player = {
        /**
         * Emitted when a player enters a room
         */
        enter: (room: Room, handler: (player: Player)=>void) => this.events.player.enter.on(room._id, handler),
        /**
         * Emitted when a player exits a room
         */
        exit: (room: Room, handler: (player: Player)=>void) => this.events.player.exit.on(room._id, handler),
    }

    public npc = {
        /**
         * Emitted the first time npc interacts with a player
         */
        greet: (npc: NPC, handler: (player: Player)=>void) => this.events.npc.greet.on(npc._id, handler),
    }

    private get game() {
        return this.server.game;
    }

    constructor(server: Server) {
        this.server = server;

        const npc_greeter_playerlist = this.game.state.bind(Gamestate.Component.array(t.string, 'npc-greeter-playerlist'));

        // setup event listeners
        server.attach((game)=>{
            game.eventEntityMove.on((target, from, to)=>{
                if (this.game.player.is(target)) {
                    const p = this.game.player.cast(target);
                    if (from) {
                        this.events.player.exit.emit(from, [p]);
                    }
                    if (to) {
                        this.events.player.enter.emit(to, [p]);
                    }

                    for (const e of this.game.neighbors(target)) {
                        if (this.game.npc.is(e)) {
                            const greeted = npc_greeter_playerlist.get(e) ?? [];
                            if (greeted.includes(target)) return;
                            greeted.push(target);
                            npc_greeter_playerlist.set(e, greeted);
                            this.events.npc.greet.emit(e, [p]);
                        }
                    }
                }
            });
        });
    }
}

export type ScriptingNPC = CleanupIntersections<NPC & {
    say(message: string): void;
    whisper(player: Player, message: string): void;
}>;

export class ScriptingContext {
    private readonly server: Server;
    public readonly on: ScriptingEventContext;

    public constructor(server: Server) {
        this.server = server;
        this.on = new ScriptingEventContext(server);
    }

    private get game() {
        return this.server.game;
    }

    public cast<T extends Record<string, Accessor>>(archetype: Archetype<T>, target: GenericEntity): InstanceProperties<T> {
        try {
            return archetype.cast(target._id);
        } catch (err) {
            if (err instanceof ArchetypeCastError) {
                throw new ScriptError(err.message);
            } else {
                throw err;
            }
        }
    }

    public find(name: string): GenericEntity {
        const e = this.game.find(name);
        if (!e) throw new ScriptError(`Could not find an entity by the name of ${name}`);
        return {_id: e};
    }
    
    public get<T extends Record<string, Accessor>>(archetype: Archetype<T>, name: string): InstanceProperties<T> {
        const e = this.game.find(name);
        if (!e) throw new ScriptError(`Could not find an entity by the name of ${name}`);
        return this.cast(archetype, {_id: e});
    }

    public npc(name: string): ScriptingNPC {
        const e = this.cast(this.game.npc, this.find(name)) as ScriptingNPC;
        e.say = (message: string) => {
            this.game.say(this.game.roomOf(e._id), e._id, message);
        }
        e.whisper = (target: Player, message: string) => {
            this.game.whisper(target._id, e._id, message);
        }
        return e;
    }

    public room(name: string) {
        return this.get(this.game.room, name);
    }

    public object(name: string) {
        return this.get(this.game.object, name);
    }

    public prop(name: string) {
        return this.get(this.game.prop, name);
    }

    public item(name: string) {
        return this.get(this.game.item, name);
    }

    public chest(name: string) {
        return this.get(this.game.chest, name);
    }

    public backpack(name: string) {
        return this.get(this.game.backpack, name);
    }

    public move(target: GenericEntity, container: GenericEntity) {
        this.game.move(target._id, container._id);
    }

    public tell(target: Player|Room, message: string) {
        if (this.game.player.is(target._id)) {
            this.game.send(target._id, style(message, s.italic));
        } else if (this.game.room.is(target._id)) {
            for (const player of target.children) {
                this.game.send(player, style(message, s.italic));
            }
        }
    }

    public roomOf(player: GenericEntity) {
        return this.cast(this.game.room, {_id: this.game.roomOf(player._id)});
    }
    
    /**
     * Check if two instances refer to the same entity;
     * @returns true if both entities are the same.
     */
    public equal(a: GenericEntity, b: GenericEntity) {
        return a._id === b._id;
    }

    /**
     * Check if two rooms are equal. If either entity is not a room the room containing it will be checked instead.
     * @returns true if both entities are in the same room.
     */
    public sameRoom(a: GenericEntity, b: GenericEntity) {
        return this.game.sameRoom(a._id, b._id);
    }

    public readonly util = {
        wait: (seconds: number)=>new Promise((res)=>setTimeout(res, seconds*1000)),
        playerMovesInTheNextNSeconds: (player: Player, seconds: number) => new Promise((res)=>{
            let moved = false;
            const listener = (target: Entity)=>{
                if (target === player._id) moved = true; 
            }
            this.game.playerMove.on(listener);
            
            setTimeout(()=>{
                this.game.playerMove.off(listener);
                res(moved);
            }, seconds*1000);
        }),
        sequence: async (player: Player, sequence: [delay_seconds: number, event: ()=>void, cancelIfPlayerLeaves?: boolean][]) => {
            for (const [delay, event, cancelIfPlayerLeaves] of sequence) {
                if (cancelIfPlayerLeaves) {
                    if (await this.util.playerMovesInTheNextNSeconds(player, delay)) return;
                } else {
                    await this.util.wait(delay);
                }
                await event();
            }
        }
    };
}