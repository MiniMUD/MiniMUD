import { createElement } from '@/util/create-element';
import { Game } from './game';
import { Entity } from './gamestate/gamestate';
import { nullike } from '@/util/gaurd';
import { EventChannel } from '@/util/event-channel';

export class EntityTree {
    private game: Game;
    public entity?: Entity;
    public children = new Map<string, EntityTree>();

    public parent: EntityTree;
    public root: EntityTree;
    public depth: number = 0;
    public truncated: boolean = false;

    public handle: HTMLElement;
    public name: HTMLElement;
    public type: HTMLElement;
    public list: HTMLElement;
    public container: HTMLElement;

    public select = new EventChannel((target: Entity) => {});

    public constructor(game: Game, entity?: Entity, parent?: EntityTree) {
        this.game = game;
        this.entity = entity;
        this.parent = parent;
        if (this.parent) this.depth = this.parent.depth + 1;
        this.root = this._root();

        this.truncated = this.depth > EntityTree.MAX_DEPTH;

        const indent = createElement('div', { classList: ['indent'] });

        this.list = createElement('div', {});
        this.name = createElement('span', { classList: ['treenode-name'] });
        this.type = createElement('span', { classList: ['treenode-type'] });
        this.handle = createElement('span', { classList: ['treenode-handle'], children: [this.name] });
        this.container = createElement('div', {
            classList: ['treenode'],
            children: [this.handle, this.type, createElement('div', { children: [indent, this.list] })],
        });

        const archetype = this.game.getArchetype(entity);
        if (archetype) {
            this.container.setAttribute('archetype', archetype.name);
            this.type.replaceChildren(document.createTextNode(archetype.name));
        }

        this.update();
    }

    private getChildren() {
        if (nullike(this.entity)) return this.game.roots();
        return this.game.childrenOf(this.entity);
    }

    public update() {
        const children = this.getChildren();

        // === name ===
        let name: string = undefined;
        if (!nullike(this.entity)) name = this.game.about(this.entity) || 'unknown';
        if (this.game.door.is(this.entity))
            name = `${this.game.direction.get(this.entity)}: ${this.game.about(this.game.reference.get(this.entity))}`;

        if (this.name) this.name.replaceChildren(document.createTextNode(name));
        else this.name.replaceChildren();

        // skip children of duplicates and truncated nodes
        if (this.truncated) {
            this.list.replaceChildren(createElement('li', { text: '...' }));
            return;
        }

        // === children ===
        const map = new Map<string, EntityTree>();
        const childElements: HTMLElement[] = [];
        for (const child of children) {
            const node = this.children.has(child)
                ? this.children.get(child).lazyUpdate()
                : new EntityTree(this.game, child, this);

            map.set(child, node);
            childElements.push(node.container);
        }
        this.children = map;
        this.list.replaceChildren(...childElements);

        // === events ===
        this.handle.setAttribute('draggable', this.draggable ? 'true' : 'false');
        if (this.draggable) {
            this.handle.classList.add('grabbable');
            this.handle.ondragstart = (ev) => {
                this.root.list.classList.add('drag-active');
                ev.dataTransfer.setData('text', this.entity);
                this.root.select.emit(this.entity);
            };
            this.handle.ondragend = (ev) => {
                this.root.list.classList.remove('drag-active');
            };
        } else {
            this.handle.classList.remove('grabbable');
        }

        if (this.droppable) {
            this.container.classList.add('tree-dropzone');
            this.container.classList.remove('tree-nodrop');
            this.handle.ondragover = (ev) => {
                const entity = ev.dataTransfer.getData('text');
                if (entity && this.game.player.is(entity) && !this.game.room.is(this.entity)) return;
                if (ev.target instanceof HTMLElement) ev.preventDefault();
            };
            this.handle.ondrop = (ev) => {
                if (ev.target instanceof HTMLElement) {
                    ev.preventDefault();
                    const entity = ev.dataTransfer.getData('text');
                    this.game.move(entity, this.entity);
                }
            };
        } else {
            this.container.classList.remove('tree-dropzone');
            this.container.classList.add('tree-nodrop');
        }

        this.handle.onclick = (ev) => {
            ev.preventDefault();
            this.root.select.emit(this.entity);
        };

        return this;
    }

    public lazyUpdate() {
        setTimeout(() => this.update());
        return this;
    }

    private get draggable() {
        return this.game.parent.has(this.entity) && this.game.name.has(this.entity);
    }

    public get droppable() {
        return this.game.children.has(this.entity) && this.game.name.has(this.entity);
    }

    private _root(): EntityTree {
        if (this.parent) return this.parent._root();
        return this;
    }

    static MAX_DEPTH = 16;
}
