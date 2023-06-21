import { createElement } from '@/util/create-element';
import { ConsoleManager } from './console-manager';
import { Deferred } from '@/util/deferred';

export interface TextInputDescriptor {
    title: string;
    label: string;
    placeholder?: string;
    cancelable?: boolean;
    cancelButtonText?: string;
    cancelButtonKeybind?: string;
    autofocus?: boolean;
}

export class ConsoleTextInput implements TextInputDescriptor {
    public title: string;
    public label: string;
    public placeholder: string = '';
    public cancelable: boolean = true;
    public cancelButtonText: string = 'Back';
    public cancelButtonKeybind: string = 'Escape';
    public autofocus: boolean = true;
    public password: boolean = false;

    public constructor(opt: TextInputDescriptor) {
        Object.assign(this, opt);
    }

    private createInputElement(submit: (value: string) => void) {
        const el = createElement('input', {
            classList: ['form-control'],
            attributes: {
                placeholder: this.placeholder,
                type: this.password ? 'password' : 'text',
                autofocus: this.autofocus ? 'true' : undefined,
            },
        });
        el.onkeydown = (ev) => {
            if (ev.key === 'Enter') submit(el.value);
        };
        return el;
    }

    private createLabelElement() {
        return createElement('span', {
            text: this.label,
            classList: ['input-group-text'],
        });
    }

    private createButtonElement() {
        return createElement('button', {
            text: this.cancelButtonText,
            classList: ['btn', 'btn-outline-secondary'],
        });
    }

    private createTitleElement() {
        return createElement('h5', { text: this.title });
    }

    public display(target: ConsoleManager): Promise<string | null> {
        const lock = new Deferred();
        const result = new Deferred<string | null>();

        function submit(value: string | null) {
            result.resolve(value);
            lock.resolve(undefined);
        }

        const title = this.createTitleElement();
        const input = this.createInputElement(submit);
        const label = this.createLabelElement();
        const button = this.cancelable ? this.createButtonElement() : undefined;

        const container = createElement('div', {
            children: [
                title,
                createElement('div', {
                    classList: ['input-group'],
                    children: [label, input, button].filter((x) => !!x),
                }),
            ],
        });

        const cancelButtonEventListener = (ev: KeyboardEvent) => {
            if (this.cancelable && ev.key === this.cancelButtonKeybind) submit(null);
        };

        target.presentInput(
            container,
            lock.promise,
            () => {
                if (this.autofocus) setTimeout(() => input.focus(), 100);
                if (this.cancelable) window.addEventListener('keydown', cancelButtonEventListener);
            },
            () => {
                if (this.cancelable) window.removeEventListener('keydown', cancelButtonEventListener);
            }
        );
        return result.promise;
    }
}
