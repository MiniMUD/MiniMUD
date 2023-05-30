import { Deferred } from './deferred';

type Callback<T> = () => Promise<T>;

export class Task<T> extends Deferred<T> {
    public start: () => void;
}

export class AsyncQueue<T = void> {
    private queue: Task<T>[] = [];
    private currentTask: Task<T> | undefined = undefined;
    private current: Promise<void> | undefined = undefined;

    public push(callback: Callback<T>) {
        const task = new Task<T>();
        task.start = () => {
            callback()
                .then((x) => task.resolve(x))
                .catch((x) => task.reject(x));
        };
        this.queue.push(task);
        if (!this.current) this.current = this.start();
        return task.promise;
    }

    public async start() {
        while (this.queue.length) {
            const task = this.queue.shift();
            this.currentTask = task;
            task.start();
            await task.promise.catch(() => {});
        }
        this.currentTask = undefined;
        this.current = undefined;
    }

    public interupt() {
        while (this.queue.length) {
            const task = this.queue.shift()!;
            task.reject();
        }
        if (this.currentTask) this.currentTask.reject();
        this.currentTask = undefined;
        this.current = undefined;
    }

    public wait() {
        return this.current || Promise.resolve();
    }
}
