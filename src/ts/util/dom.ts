export function setHeight(el: HTMLElement, height: string) {
    if (height === undefined) {
        el.style.removeProperty('height');
        el.style.removeProperty('min-height');
        el.style.removeProperty('max-height');
    } else {
        el.style.setProperty('height', height);
        el.style.setProperty('min-height', height);
        el.style.setProperty('max-height', height);
    }
}

export function setWidth(el: HTMLElement, width: string) {
    if (width === undefined) {
        el.style.removeProperty('width');
        el.style.removeProperty('min-width');
        el.style.removeProperty('max-width');
    } else {
        el.style.setProperty('width', width);
        el.style.setProperty('min-width', width);
        el.style.setProperty('max-width', width);
    }
}
