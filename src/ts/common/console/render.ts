import { createElement } from '../../util/create-element';
import { ElementDescriptor, et } from './element';

export function render(obj: ElementDescriptor): HTMLElement {
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
