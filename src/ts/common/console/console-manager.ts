import { AsyncQueue } from '@/util/async-queue';
import { createElement } from '../../util/create-element';
import { Inline, block, inline, style } from './element';
import { render } from './render';
import { setHeight } from '@/util/dom';
import { ConsoleMenu, MenuItemDescriptor } from './console-menu';
import { ConsoleTextInput } from './console-text-input';

export class ConsoleManager {
    public container: HTMLElement;
    public outputContainer: HTMLElement;
    public inputContainer: HTMLElement;
    public output: HTMLElement;
    public input: HTMLElement;
    public lastOutput: HTMLElement | Text;

    private inputLock = new AsyncQueue();

    public constructor(container: HTMLElement) {
        const output = createElement('div', {
            classList: ['container-xl'],
        });

        const outputContainer = createElement('pre', {
            classList: ['console-output', 'm-0', 'p-0'],
            children: [output],
        });

        const input = createElement('div', {
            classList: ['container-xl'],
        });

        const inputContainer = createElement('div', {
            classList: ['console-input', 'p-4'],
            children: [input],
        });

        container.appendChild(outputContainer);
        container.appendChild(inputContainer);

        this.container = container;
        this.outputContainer = outputContainer;
        this.inputContainer = inputContainer;
        this.output = output;
        this.input = input;

        this.hideInput();
    }

    public menu<T>(title: string, ...items: MenuItemDescriptor<T>[]): Promise<T>;
    public menu(title: string, ...items: (MenuItemDescriptor<string> | string)[]): Promise<string>;
    public menu<T>(title: string, ...items: (MenuItemDescriptor<T> | string)[]): Promise<unknown> {
        const menu = new ConsoleMenu({ title, items: [] });
        for (const item of items) {
            if (typeof item === 'string') {
                menu.push({ text: item, value: item });
            } else {
                menu.push(item);
            }
        }
        return menu.display(this);
    }

    public simpleMenu<T>(title: string, items: Record<string, T>): Promise<T> {
        return this.menu(
            title,
            ...Object.entries(items).map(([key, value]) => ({
                text: key,
                value,
            }))
        );
    }

    public ask(title: string, label: string, placeholder?: string): Promise<string | null> {
        const input = new ConsoleTextInput({ title, label, placeholder });
        return input.display(this);
    }

    public setInputSize(pixels?: number) {
        this.inputContainer.style.removeProperty('display');
        if (pixels === undefined) {
            setHeight(this.inputContainer, undefined);
            setHeight(this.outputContainer, '100%');
        } else {
            setHeight(this.inputContainer, `${pixels}px`);
            setHeight(this.outputContainer, `calc(100% - ${pixels}px)`);
        }
    }

    public resizeInput() {
        const wasScrolledToBottom = this.isScrolledToBottom();
        const min = 128;
        this.setInputSize();
        this.setInputSize(Math.max(this.inputContainer.getBoundingClientRect().height, min));
        if (wasScrolledToBottom) this.scrollToBottom();
    }

    public hideInput() {
        this.input.replaceChildren();
        this.inputContainer.style.setProperty('display', 'none');
        setHeight(this.inputContainer, '0');
        setHeight(this.outputContainer, '100%');
    }

    public disableInput() {
        this.input.style.setProperty('opacity', '50%');
        this.input.setAttribute('disabled', 'true');
    }

    public enableInput() {
        this.input.style.removeProperty('opacity');
        this.input.removeAttribute('disabled');
    }

    public presentInput(el: HTMLElement, promise: Promise<unknown>, ready: () => void, cleanup: () => void) {
        this.inputLock.push(async () => {
            this.input.replaceChildren(el);
            this.enableInput();
            this.resizeInput();
            ready();
            await promise;
            cleanup();
            this.disableInput();
            // this.input.replaceChildren();
            // this.hideInput();
        });
    }

    private injectSpaces(arr: HTMLElement[]): (HTMLElement | Text)[] {
        const space = () => document.createTextNode(' ');
        return arr
            .map((el) => [el, space()])
            .flat()
            .slice(0, -1);
    }

    public write(...args: any[]) {
        const wasScrolledToBottom = this.isScrolledToBottom();
        const children = this.injectSpaces(args.map((x) => render(style(x))));
        if (
            (this.lastOutput instanceof HTMLHRElement || this.lastOutput === undefined) &&
            children[0] instanceof HTMLHRElement
        )
            children.shift();
        if (children.length === 0) return;
        this.lastOutput = children[children.length - 1];
        this.output.appendChild(createElement('div', { children, classList: ['w-100'] }));

        if (wasScrolledToBottom) this.scrollToBottom();
        setTimeout(()=>{
            if (wasScrolledToBottom) this.scrollToBottom();
        });
    }

    public clear() {
        this.output.replaceChildren();
    }

    public isScrolledToBottom() {
        const el = this.outputContainer;
        return el.scrollHeight - el.clientHeight <= el.scrollTop + 1;
    }

    public scrollToBottom() {
        const el = this.outputContainer;
        el.scrollTop = el.scrollHeight;
    }

    private header(text: string, styles: string[]): Inline {
        return inline(style('['), style(text, styles), style(']:'));
    }

    public error(...args: any[]) {
        this.write(this.header('error', ['text-danger']), ...args);
    }

    public warn(...args: any[]) {
        this.write(this.header('warning', ['text-warning']), ...args);
    }

    public info(...args: any[]) {
        this.write(this.header('info', ['text-info']), ...args);
    }

    public log(...args: any[]) {
        this.write(...args);
    }

    public debug(...args: any[]) {
        this.write(this.header('debug', ['text-subtle']), ...args);
    }
}
