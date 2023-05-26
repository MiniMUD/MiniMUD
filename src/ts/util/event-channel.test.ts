import { EventChannel } from './event-channel';

describe('EventChannel', () => {
    test('on', () => {
        const e = new EventChannel((data: string) => {});
        let run = 0;
        e.on((data) => {
            expect(data).toBe('test');
            run++;
        });
        e.emit('test');
        e.emit('test');
        expect(run).toBe(2);
    });
    test('off', () => {
        const e = new EventChannel((data: string) => {});

        let run = 0;
        const handler = () => {
            run++;
        };

        e.on(handler);
        e.off(handler);

        e.emit('test');
        expect(run).toBe(0);
    });
    test('once', () => {
        const e = new EventChannel((data: string) => {});
        let run = 0;
        e.once((data) => {
            expect(data).toBe('test');
            run++;
        });
        e.emit('test');
        e.emit('test');
        e.emit('test');
        expect(run).toBe(1);
    });
});
