import { Gamestate, GamestateValidationError } from './gamestate';

describe('Gamestate', () => {
    test('Gamestate', () => {
        const gs = new Gamestate();

        const name = gs.bind(Gamestate.Component.string('name'));
        const size = gs.bind(Gamestate.Component.number('size'));

        const e = gs.entity();
        name.setSafe(e, 'foo');
        size.setSafe(e, 20);

        expect(gs.validate()).toBe(undefined);

        name.set(e, null);
        expect(gs.validate()).toBeInstanceOf(GamestateValidationError);
    });

    test('Save/Load', () => {
        const cname = Gamestate.Component.string('name');
        const csize = Gamestate.Component.number('size');

        const create = () => {
            const gs = new Gamestate();
            const name = gs.bind(cname);
            const size = gs.bind(csize);

            return { gs, name, size };
        };

        const a = create();
        const b = create();

        const e = a.gs.entity();

        {
            a.name.set(e, null);
            b.name.set(e, 'bar');
            const data = a.gs.save();
            expect(b.gs.load(data)).toBeInstanceOf(GamestateValidationError);
            expect(b.name.get(e)).toBe('bar');
        }

        {
            a.name.set(e, 'foo');
            b.name.set(e, 'bar');
            const data = a.gs.save();
            expect(b.gs.load(data)).toBe(undefined);
            expect(b.name.get(e)).toBe('foo');
        }
    });
});
