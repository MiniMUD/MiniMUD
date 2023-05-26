export { ConsoleManager } from './console-manager';
export { ConsoleMenu, MenuItemDescriptor } from './console-menu';
export { ConsoleTextInput } from './console-text-input';
export { safeExtractText, style, et } from './element';
export { inline, block, text, lines, divider, center } from './element';

import { et } from './element';
export const elementDescriptor = et.elementDescriptor;

export const BACK = {
    text: 'Back',
    value: null as null,
    keybind: 'Escape',
    keyicon: 'ESC',
};

export const CANCEL = {
    text: 'Cancel',
    value: null as null,
    kebind: 'Escape',
    keyicon: 'ESC',
};

export { s } from './style';
