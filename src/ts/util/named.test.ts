import { Named } from './named';

test('Named', () => {
    const x = new Named('test');
    expect(String(x)).toBe('test');
});
