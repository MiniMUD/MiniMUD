import { CircularType } from './runtime-type';
import { t } from './types';

describe('runtime-types', () => {
    test('t.string', () => {
        const tx = t.string;
        expect(tx.is('test')).toBe(true);
        expect(tx.is('')).toBe(true);
        expect(tx.is(undefined)).toBe(false);
        expect(tx.is(6)).toBe(false);
    });

    test('t.number', () => {
        const tx = t.number;
        expect(tx.is(7)).toBe(true);
        expect(tx.is(0)).toBe(true);
        expect(tx.is(undefined)).toBe(false);
        expect(tx.is('1')).toBe(false);
    });

    test('t.boolean', () => {
        const tx = t.boolean;
        expect(tx.is(true)).toBe(true);
        expect(tx.is(false)).toBe(true);
        expect(tx.is(undefined)).toBe(false);
        expect(tx.is('true')).toBe(false);
    });

    describe('t.array', () => {
        test('t.array(t.string)', () => {
            const tx = t.array(t.string);
            expect(tx.is(['foo'])).toBe(true);
            expect(tx.is([])).toBe(true);
            expect(tx.is(['foo', 5])).toBe(false);
            expect(tx.is(undefined)).toBe(false);
        });
        test('t.array(t.number)', () => {
            const tx = t.array(t.number);
            expect(tx.is([5])).toBe(true);
            expect(tx.is([])).toBe(true);
            expect(tx.is(['foo', 5])).toBe(false);
            expect(tx.is(undefined)).toBe(false);
        });
    });

    describe('t.or', () => {
        test('t.or(t.string, t.number)', () => {
            const tx = t.or(t.string, t.number);
            expect(tx.is('foo')).toBe(true);
            expect(tx.is(5)).toBe(true);
            expect(tx.is(false)).toBe(false);
            expect(tx.is(undefined)).toBe(false);
        });
    });

    describe('t.optional', () => {
        test('t.optional(t.number)', () => {
            const tx = t.optional(t.number);
            expect(tx.is(5)).toBe(true);
            expect(tx.is(undefined)).toBe(true);
            expect(tx.is(false)).toBe(false);
            expect(tx.is(null)).toBe(false);
        });
    });

    describe('t.tuple', () => {
        test('t.tuple(t.string, t.number, t.number)', () => {
            const tx = t.tuple(t.string, t.number, t.number);
            expect(tx.is(['foo', 1, 2])).toBe(true);
            expect(tx.is(['', 0, 0])).toBe(true);
            expect(tx.is(['foo', 1])).toBe(false);
            expect(tx.is(['foo', 5, 4, 3])).toBe(false);
            expect(tx.is([1, 1, 'foo'])).toBe(false);
        });
    });

    describe('t.object', () => {
        test('t.object(...)', () => {
            const tx = t.object({
                name: t.string,
                age: t.number,
                height: t.optional(t.number),
            });

            expect(
                tx.is({
                    name: 'foo',
                    age: 22,
                })
            ).toBe(true);

            expect(
                tx.is({
                    name: 'foo',
                    age: '22',
                })
            ).toBe(false);

            expect(
                tx.is({
                    name: 'foo',
                })
            ).toBe(false);
        });

        test('t.object({[key]: t.object()})', () => {
            const tx = t.object({
                name: t.string,
                values: t.object({
                    red: t.number,
                    green: t.number,
                    blue: t.number,
                }),
            });

            expect(
                tx.is({
                    name: 'blue',
                    values: {
                        red: 22,
                        green: 34,
                        blue: 256,
                    },
                })
            ).toBe(true);
        });
    });

    describe('t.matrix', () => {
        test('vec3: t.matrix(number, 3)', () => {
            const tx = t.matrix(t.number, 3);
            expect(tx.is([1, 2, 3])).toBe(true);
            expect(tx.is([1, 2])).toBe(false);
            expect(tx.is([])).toBe(false);
            expect(tx.is([1, '2', 3])).toBe(false);
            expect(tx.is([1, '2', 3, 4])).toBe(false);
        });

        test('mat2: t.matrix(number, 2,2)', () => {
            const tx = t.matrix(t.number, 2, 2);
            expect(
                tx.is([
                    [1, 2],
                    [3, 4],
                ])
            ).toBe(true);
            expect(tx.is([1, 2, 3, 4])).toBe(false);
        });

        test('mat2_3: t.matrix(number, 2,2,2)', () => {
            const tx = t.matrix(t.number, 2, 2, 2);
            expect(
                tx.is([
                    [
                        [1, 2],
                        [3, 4],
                    ],
                    [
                        [5, 6],
                        [7, 8],
                    ],
                ])
            ).toBe(true);
        });
    });

    test('CircularType', () => {
        const cx = new CircularType('tx');
        const tx = t.object({
            recurse: t.array(cx),
        });
        cx.morph(tx);

        expect(
            tx.is({
                recurse: [
                    {
                        recurse: [],
                    },
                ],
            })
        ).toBe(true);
        expect(
            tx.is({
                recurse: [{}],
            })
        ).toBe(false);
    });
});
