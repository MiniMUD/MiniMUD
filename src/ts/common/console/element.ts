import { CompileType, t } from '../runtime-types';
import { CircularType, RuntimeType } from '../runtime-types/runtime-type';

export interface Style {
    styles: string[];
}
export interface TextElement {
    text: string;
    styles?: string[];
}
export interface TextElementDivider {
    text: '%==';
    styles?: string[];
}
export interface Inline {
    display: 'inline';
    children: ElementDescriptor[];
    styles?: string[];
}
export interface Block {
    display: 'block';
    children: ElementDescriptor[];
    styles?: string[];
}

export type ElementDescriptor = TextElement | Inline | Block;

const circularElementDescriptor = new CircularType<ElementDescriptor>('ElementDescriptor');

export namespace et {
    export const style: RuntimeType<Style> = t.object({
        styles: t.array(t.string),
    });

    export const textElement: RuntimeType<TextElement> = t.object({
        text: t.string,
        styles: t.optional(t.array(t.string)),
    });

    export const textElementDivider = t.object({
        text: t.literal('%=='),
        styles: t.optional(t.array(t.string)),
    });

    export const inline: RuntimeType<Inline> = t.object({
        display: t.literal('inline'),
        children: t.array(circularElementDescriptor),
        styles: t.optional(t.array(t.string)),
    });

    export const block: RuntimeType<Block> = t.object({
        display: t.literal('block'),
        children: t.array(circularElementDescriptor),
        styles: t.optional(t.array(t.string)),
    });

    export const elementDescriptor: RuntimeType<ElementDescriptor> = t.or(et.textElement, et.inline, et.block);
    circularElementDescriptor.morph(elementDescriptor);
}

// add to the style list of an object
export function applyStyle<T extends {}>(obj: T, classList: string[]) {
    if (et.style.is(obj)) {
        return { ...obj, styles: [...obj.styles, ...classList] };
    } else {
        return { ...obj, styles: [...classList] };
    }
}

// turn an object into a ElementDescriptor (ElementDescriptors will be passed through)
export function elementFrom(obj: any): ElementDescriptor {
    if (t.string.is(obj)) return { text: obj };
    if (et.elementDescriptor.is(obj)) return obj;
    return elementFrom(String(obj));
}

export function text(text: string): ElementDescriptor {
    return { text };
}

export const divider = () => text('%==');

export function block(...children: any[]): Block {
    return { display: 'block', children: children.map(elementFrom) };
}

export function lines(...children: any[]) {
    return block(...children.map((child) => block(child)));
}

export function center(...children: any[]) {
    return style(block(...children), ['text-center', 'w-100']);
}

export function inline(...children: any[]): Inline {
    return { display: 'inline', children: children.map(elementFrom) };
}

export function extractText(obj: ElementDescriptor): string {
    if (et.textElement.is(obj)) return obj.text;
    if (et.inline.is(obj)) return obj.children.map(extractText).join('');
    if (et.block.is(obj)) return obj.children.map(extractText).join('') + '\n';
    throw new Error('never');
}

export function style(obj: any, styles: string[] = []): ElementDescriptor {
    return applyStyle(elementFrom(obj), styles);
}

export function safeExtractText(obj: any): string {
    return extractText(elementFrom(obj));
}
