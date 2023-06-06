import { safeExtractText } from '@common/console';
import { EventChannel } from '@/util/event-channel';

export interface EventChannelContext<T extends any[]> {
    (...args: T): void;
    on(handler: (...args: T) => void): EventChannelContext<T>;
    off(handler: (...args: T) => void): EventChannelContext<T>;
    once(handler: (...args: T) => void): EventChannelContext<T>;
    channel: EventChannel<T>;
}

export class EventManager {
    public events = new Map<string, EventChannel<unknown[]>>();
    public broadcast = new EventChannel((name: string, args: any[]) => {});

    public errorHandler = (err: Error): void => {
        throw err;
    };

    /**
     * Create a event channel
     * @param name name of the event
     * @param dummy a dummy callback function to infer argument names & types from
     * @param silent enable to hide events from logging
     * @returns
     */
    public channel<T extends any[]>(
        name: string,
        dummy: (...args: T) => any,
        silent: boolean = false
    ): EventChannelContext<T> {
        const channel = new EventChannel(dummy);
        channel.errorHandler = (err: Error) => {
            this.errorHandler(err);
        };

        this.events.set(name, channel);
        if (!silent) channel.on((...args) => this.broadcast.emit(name, args));
        const obj = (...args: T): void => channel.emit(...args);

        obj.channel = channel;
        obj.on = (handler: (...args: T) => void) => {
            channel.on(handler);
            return obj;
        };
        obj.off = (handler: (...args: T) => void) => {
            channel.off(handler);
            return obj;
        };
        obj.once = (handler: (...args: T) => void) => {
            channel.once(handler);
            return obj;
        };

        return obj;
    }

    public error = this.channel('error', (...args: any[]) => {}, true);
    public warn = this.channel('warning', (...args: any[]) => {}, true);
    public info = this.channel('info', (...args: any[]) => {}, true);
    public log = this.channel('log', (...args: any[]) => {}, true);
    public debug = this.channel('debug', (...args: any[]) => {}, true);

    public logErrorsToBuiltinConsole() {
        this.error.channel.on((...args) => console.error(args.map((arg) => safeExtractText(arg)).join(' ')));
    }

    public logToBuiltinConsole() {
        this.warn.channel.on((...args) => console.warn(args.map((arg) => safeExtractText(arg)).join(' ')));
        this.info.channel.on((...args) => console.info(args.map((arg) => safeExtractText(arg)).join(' ')));
        this.log.channel.on((...args) => console.log(args.map((arg) => safeExtractText(arg)).join(' ')));
        this.debug.channel.on((...args) => console.debug(args.map((arg) => safeExtractText(arg)).join(' ')));
    }
}

export class ListenerManager {
    public cleanup = new EventChannel(() => {});

    public listen<T extends any[]>(channel: EventChannelContext<T>, listener: (...args: T) => void) {
        channel.on(listener);
        this.cleanup.on(() => channel.off(listener));
    }

    public stop() {
        this.cleanup.emit();
    }
}
