/**
 * Helper class for a promise that will be fulfilled later
 */
export class Deferred<T> {
    public promise: Promise<T>;

    public _resolve: (value: T | PromiseLike<T>) => void;
    public _reject: (reason?: Error) => void;

    public waiting = true;
    public resolved = false;
    public rejected = false;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    public resolve(value: T | PromiseLike<T>): void {
        this.waiting = false;
        this.resolved = true;
        this._resolve(value);
    }

    public reject(reason?: Error): void {
        this.waiting = false;
        this.rejected = true;
        this._reject(reason);
    }

    public timeout(ms: number, reason?: string) {
        setTimeout(() => {
            if (this.waiting) this.reject(new ErrorTimeout(reason));
        }, ms);
    }
}

export class ErrorTimeout extends Error {}
