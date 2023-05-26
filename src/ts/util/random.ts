export function getRandomByes(size: number): Uint8Array {
    const arr = new Uint8Array(size);
    window.crypto.getRandomValues(arr);
    return arr;
}

export function getRandomString(size: number): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(getRandomByes(size));
}
