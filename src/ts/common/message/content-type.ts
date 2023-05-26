import { elementDescriptor } from '../console';
import { CompileType, t } from '../runtime-types';

export const textInputField = t.object({
    title: t.string,
    label: t.string,
    placeholder: t.nullable(t.string),
    token: t.nullable(t.boolean),
});
export type TextInputField = CompileType<typeof textInputField>;

export const menuFieldItem = t.object({
    text: t.string,
    value: t.nullable(t.string),
    keybind: t.nullable(t.string),
    keyicon: t.nullable(t.string),
});
export type MenuFieldItem = CompileType<typeof menuFieldItem>;

export const menuField = t.object({
    title: t.string,
    items: t.array(menuFieldItem),
});
export type MenuField = CompileType<typeof menuField>;

export const formField = t.or(menuField, textInputField, t.string);
export type FormField = CompileType<typeof formField>;

// text to display
export const textContent = t.array(elementDescriptor);
export type TextContent = CompileType<typeof textContent>;
export const textContentType = 'text';

// menu of redirects
export const redirectMenuContent = menuField;
export type RedirectMenuContent = CompileType<typeof redirectMenuContent>;
export const redirectMenuContentType = 'redirect-menu';

// form fields
export const formContent = t.record(t.string, formField);
export type FormContent = CompileType<typeof formContent>;
export const formContentType = 'form';

// form submission
export const formDataContent = t.record(t.string, t.nullable(t.string));
export type FormDataContent = CompileType<typeof formDataContent>;
export const formDataContentType = 'form-data';

// sequence of redirects
export const sequenceContent = t.array(t.string);
export type SequenceContent = CompileType<typeof sequenceContent>;
export const sequenceContentType = 'sequence-data';

export const CONTENT_TYPE = 'content-type';
