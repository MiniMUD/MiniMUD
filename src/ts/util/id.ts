import { hash } from './hash';
import { getRandomByes } from './random';

export function getID(prefix: string = ''): string {
    const decoder = new window.TextDecoder('utf-8');
    return prefix + hash(decoder.decode(getRandomByes(256)));
}

export function charset(numbers: number[], pool: string) {
    const count = pool.length;
    return numbers.map((x) => pool[Math.abs(x % count)] ?? '_').join('');
}

export function charsetID(length: number = 32, pool: string) {
    return charset(Array.from(getRandomByes(length)), pool);
}

export function alphanumericID(length: number = 32): string {
    return charsetID(length, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
}
