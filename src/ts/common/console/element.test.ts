import { elementDescriptor } from '.';
import { inline, lines } from './element';

describe('ElementDescriptor', () => {
    test('ElementDescriptor', () => {
        const v = lines('hello', 'world');
        elementDescriptor.cast(v);
    });
});
