import { HmacSHA256, SHA256, MD5, enc } from 'crypto-js';

export function hash(x: string): string {
    return MD5(x).toString(enc.Base64url);
}

export function hashHex(x: string): string {
    return MD5(x).toString(enc.Hex);
}

export function hashNumbers(x: string): number[] {
    const words = MD5(x).words;
    const buff = new ArrayBuffer(32 * 4);
    const w = new Int32Array(buff);
    w.set(words);
    return Array.from(new Uint8Array(buff));
}

export function encode(message: string, secret: string): string {
    return HmacSHA256(message, secret).toString(enc.Base64url);
}

export function hashSecure(x: string): string {
    return SHA256(x).toString(enc.Base64url);
}
