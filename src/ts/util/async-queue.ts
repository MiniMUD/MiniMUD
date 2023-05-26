import { Deferred } from './deferred';

type Callback<T> = () => Promise<T>;

export class AsyncQueue<T = void> {
    private queue: Callback<T>[] = [];
    private current: Promise<void> | undefined = undefined;

    public push(task: Callback<T>) {
        const taskPromise = new Deferred<T>();
        this.queue.push(() => {
            task()
                .then((x) => taskPromise.resolve(x))
                .catch((x) => taskPromise.reject(x));
            return taskPromise.promise;
        });
        if (!this.current) this.current = this.start();
        return taskPromise.promise;
    }

    public async start() {
        while (this.queue.length) {
            const task = this.queue.shift()!;
            await task().catch(() => {});
        }
        this.current = undefined;
    }

    public wait() {
        return this.current || Promise.resolve();
    }
}
