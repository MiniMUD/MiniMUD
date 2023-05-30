import { block, divider, inline, style } from './element';

export namespace s {
    export const bold = ['bold'];
    export const italic = ['italic'];

    export const text = ['text'];
    export const embed = ['embed'];

    export const invisable = ['invisable'];
    export const spacer = [...invisable, 'my-2'];

    export const lead = ['lead', 'bold'];
    export const title = ['fs-2', ...lead];

    export const subtle = ['text-subtle'];
    export const glitch = ['text-glitch'];

    export const proper_noun = ['proper-noun'];
    export const first_person = [...proper_noun, 'first-person'];
    export const player = [...proper_noun, 'player'];
    export const room = [...proper_noun, 'room'];
    export const backpack = [...proper_noun, 'backpack'];
    export const chest = [...proper_noun, 'chest'];
    export const item = [...proper_noun, 'item'];
    export const prop = [...proper_noun, 'prop'];
    export const npc = [...proper_noun, 'npc'];

    export const chapter = (text: string) =>
        style(
            block(
                style(inline(divider()), ['w-100', 'px-4']),
                style(text, title),
                style(inline(divider()), ['w-100', 'px-4'])
            ),
            ['d-flex', 'flex-row', 'w-100', 'justify-content-center', 'align-items-center']
        );
}
