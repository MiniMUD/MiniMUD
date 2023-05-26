import { AsyncQueue } from './async-queue';

test('AsyncQueue', async () => {
    const q = new AsyncQueue();
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const x: number[] = [];

    q.push(async () => {
        x.push(1);
    });

    q.push(async () => {
        await wait(200);
        x.push(2);
    });

    q.push(async () => {
        x.push(3);
    });

    await q.wait();
    expect(x).toStrictEqual([1, 2, 3]);
});
