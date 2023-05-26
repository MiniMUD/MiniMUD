import { createElement } from '@/util/create-element';
import { Deferred } from '@/util/deferred';
import { ConsoleManager } from './console-manager';

export interface MenuDescriptor<T> {
    title: string;
    items: MenuItemDescriptor<T>[];
}

export interface MenuItemDescriptor<T> {
    text: string;
    value?: T;
    keybind?: string;
    keyicon?: string;
}

export class ConsoleMenu<T> {
    private title: string;
    private keybinds = new Map<string, T>();
    private keys = Array.from('1234567890qwertyuiopasdfghjklzxcvbnm');
    private items: MenuItemDescriptor<T>[] = [];
    private buttons: Record<string, HTMLElement> = {};

    public constructor(opt: MenuDescriptor<T>) {
        this.title = opt.title;
        for (const item of opt.items) {
            this.push(item);
        }
    }

    public push(menuItem: MenuItemDescriptor<T>) {
        const descriptor = { ...menuItem };
        this.assignMenuKey(descriptor);
        this.items.push(descriptor);
    }

    private searchForKeybind(text: string) {
        const prefix = ['the', 'a', 'an'];
        const letters = text
            .toLowerCase()
            .split(' ')
            .map((word) => word.trim())
            .filter((word) => word && word.length && !prefix.includes(word))
            .join('');
        for (const letter of letters) {
            if (!this.keybinds.has(letter)) return letter;
        }
        while (true) {
            const letter = this.keys.shift();
            if (!letter) break;
            if (!this.keybinds.has(letter)) return letter;
        }
        return undefined;
    }

    public assignMenuKey(descriptor: MenuItemDescriptor<T>) {
        let bind = descriptor.keybind;
        let icon = descriptor.keyicon || bind;
        if (!bind || this.keybinds.has(bind)) {
            bind = this.searchForKeybind(descriptor.text);
            icon = bind;
        }
        descriptor.keybind = bind;
        descriptor.keyicon = icon;
        this.keybinds.set(bind, descriptor.value);
    }

    public renderMenuElement(descriptor: MenuItemDescriptor<T>, submit: (value: T) => void) {
        const btn = createElement('button', {
            text: descriptor.keyicon.toUpperCase(),
            classList: ['btn', 'btn-secondary', 'btn-sm', 'keyicon', 'me-2'],
        });
        this.buttons[descriptor.keybind] = btn;
        const el = createElement('div', {
            classList: ['text-nowrap', 'm-2', 'menu-item'],
            children: [
                btn,
                createElement('span', {
                    text: descriptor.text,
                }),
            ],
        });
        el.onclick = () => submit(descriptor.value);
        return el;
    }

    public display(target: ConsoleManager): Promise<T> {
        const lock = new Deferred();
        const result = new Deferred<T>();

        function submit(value: T) {
            result.resolve(value);
            lock.resolve(undefined);
        }

        const container = createElement('div', {
            children: [
                createElement('h5', { text: this.title }),
                createElement('div', {
                    classList: ['d-flex', 'flex-row', 'justify-content-start', 'align-items-start', 'flex-wrap'],
                    children: this.items.map((descriptor) => this.renderMenuElement(descriptor, submit)),
                }),
            ],
        });

        const eventListener = (ev: KeyboardEvent) => {
            if (this.keybinds.has(ev.key)) {
                try {
                    this.buttons[ev.key].classList.add('btn-click');
                } catch (err) {
                    console.error(err);
                }
                setTimeout(() => submit(this.keybinds.get(ev.key)), 100);
            }
        };

        target.presentInput(
            container,
            lock.promise,
            () => {
                window.addEventListener('keydown', eventListener);
            },
            () => {
                window.removeEventListener('keydown', eventListener);
            }
        );
        return result.promise;
    }
}
