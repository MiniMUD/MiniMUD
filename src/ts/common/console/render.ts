import { createElement } from '../../util/create-element';
import { ElementDescriptor, et } from './element';

function scramble(str: string) {
    return str
        .split('')
        .sort(function () {
            return 0.5 - Math.random();
        })
        .join('');
}

function _render(obj: ElementDescriptor): HTMLElement {
    if (et.textElementDivider.is(obj)) return createElement('hr', { classList: obj.styles ?? [] });
    if (et.textElement.is(obj))
        return createElement('span', {
            text: obj.text,
            classList: obj.styles ?? [],
        });
    if (et.inline.is(obj))
        return createElement('span', {
            children: obj.children.map(render),
            classList: obj.styles ?? [],
        });
    if (et.block.is(obj))
        return createElement('div', {
            children: obj.children.map(render),
            classList: obj.styles ?? [],
        });
    throw new Error(`unexpected ${JSON.stringify(obj)}`);
}

function isVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

export function render(obj: ElementDescriptor): HTMLElement {
    const el = _render(obj);
    if (obj.styles?.includes('text-glitch')) {
        const text = el.innerText.split(' ');
        const x = setInterval(() => {
            if (isVisible(el)) el.innerText = text.map((x) => scramble(x)).join(' ');
            if (!el.parentElement) clearInterval(x);
        }, 100);
        setTimeout(() => clearInterval(x), 1000 * 60 * 5);
    }
    return el;
}
