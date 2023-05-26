import { HmacSHA256, SHA256, MD5, enc } from 'crypto-js';

export function hash(x: string): string {
    return MD5(x).toString(enc.Base64url);
}

export function encode(message: string, secret: string): string {
    return HmacSHA256(message, secret).toString(enc.Base64url);
}

export function hashSecure(x: string): string {
    return SHA256(x).toString(enc.Base64url);
}
