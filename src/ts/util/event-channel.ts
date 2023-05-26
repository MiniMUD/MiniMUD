export type EventHandler<T extends any[]> = (...arg: T) => void;

export class EventChannel<T extends any[]> {
    private listeners = new Set<EventHandler<T>>();
    public errorHandler = (err: Error): void => {
        throw err;
    };

    public constructor(dummy: (...args: T) => void) {}

    public on(handler: EventHandler<T>) {
        this.listeners.add(handler);
    }

    public off(handler: EventHandler<T>) {
        this.listeners.delete(handler);
    }

    public once(callback: EventHandler<T>) {
        const handler = (...args: T) => {
            this.off(handler);
            callback(...args);
        };
        this.on(handler);
    }

    public emit(...args: T) {
        for (const handler of this.listeners.values()) {
            try {
                handler(...args);
            } catch (err) {
                this.errorHandler(err);
            }
        }
    }
}
