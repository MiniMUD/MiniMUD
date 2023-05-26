import { AccessorCache } from './accessor-cache';

test('AccessorCache', () => {
    const map = new Map<string, number>();

    const cache = new AccessorCache<string, number>(
        (key) => map.get(key),
        (key, value) => value === map.get(key)
    );

    map.set('foo', 12);
    map.set('bar', 34);
    expect(cache.get('foo')).toBe(12);
    expect(cache.get('foo')).toBe(12);
    expect(cache.get('foo')).toBe(12);
    expect(cache.get('bar')).toBe(34);
    expect(cache.get('bar')).toBe(34);
    expect(cache.get('bar')).toBe(34);

    map.set('foo', -1);
    map.set('bar', -1);
    expect(cache.get('foo')).toBe(-1);
    expect(cache.get('bar')).toBe(-1);
});
