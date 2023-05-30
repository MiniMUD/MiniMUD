export function nullike(x: unknown): boolean {
    return x === undefined || x === null;
}

export async function gaurd<T, R>(x: T | Promise<T>, safe: (x: T) => R): Promise<R> {
    if (nullike(x)) return null;
    return safe(await x);
}

export function includesCharacters(str: string, characters: string) {
    return Array.from(characters).some((x) => str.includes(x));
}

export function onlyusesCharacters(str: string, characters: string) {
    return Array.from(str).every((x) => characters.includes(x));
}

export const lowercase = 'abcdefghijklmnopqrstuvwxyz';
export const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const numbers = '1234567890';
export const alphabet = lowercase + uppercase;
export const alphanumeric = alphabet + numbers;
export const alphanumeric_ext = alphanumeric + '_';
