import { hash } from './hash';
import { getRandomByes } from './random';

export function getID(prefix: string = ''): string {
    const decoder = new window.TextDecoder('utf-8');
    return prefix + hash(decoder.decode(getRandomByes(256)));
}

export function alphanumericID(length: number = 32): string {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const count = letters.length;
    return Array.from(getRandomByes(length))
        .map((x) => letters[x % count])
        .join('');
}
