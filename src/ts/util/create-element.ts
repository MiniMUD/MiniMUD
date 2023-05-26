export interface ElementOptions {
    text?: string;
    classList?: string[];
    children?: (HTMLElement | Text)[];
    id?: string;
    attributes?: Record<string, string>;
}

export function createElement(type: 'input', options: ElementOptions): HTMLInputElement;
export function createElement(type: 'span', options: ElementOptions): HTMLSpanElement;
export function createElement(type: 'div', options: ElementOptions): HTMLDivElement;
export function createElement(type: 'ul', options: ElementOptions): HTMLUListElement;
export function createElement(type: 'li', options: ElementOptions): HTMLLIElement;
export function createElement(type: 'button', options: ElementOptions): HTMLButtonElement;
export function createElement(type: 'a', options: ElementOptions): HTMLAnchorElement;
export function createElement(type: 'pre', options: ElementOptions): HTMLPreElement;
export function createElement(type: 'hr', options: ElementOptions): HTMLHRElement;
export function createElement(type: 'h1', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: 'h2', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: 'h3', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: 'h4', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: 'h5', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: 'h6', options: ElementOptions): HTMLHeadingElement;
export function createElement(type: string, options: ElementOptions): HTMLElement {
    const el = document.createElement(type);

    if (options.text) el.appendChild(document.createTextNode(options.text));
    if (options.classList) el.classList.add(...options.classList);
    if (options.id) el.id = options.id;
    if (options.children) for (const child of options.children) el.appendChild(child);
    if (options.attributes) for (const [key, value] of Object.entries(options.attributes)) el.setAttribute(key, value);

    return el;
}
