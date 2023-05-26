import { Method } from './message';
import { Router } from './router';
import { RequestWriter } from './writer';

test('Router', () => {
    const r = new Router();

    r.get('/', ({ req, res }) => {
        res.header.test = 'test /';
    });
    r.get('/a', ({ req, res }) => {
        res.header.test = 'test /a';
    });
    r.get('/a/b', ({ req, res }) => {
        res.header.test = 'test /a/b';
    });
    r.get('/:variable', ({ req, res, options }) => {
        res.header.test = options.variable;
    });

    expect(r.route(new RequestWriter(Method.GET, { path: '/' })).header.test).toBe('test /');

    expect(r.route(new RequestWriter(Method.GET, { path: '/a' })).header.test).toBe('test /a');

    expect(r.route(new RequestWriter(Method.GET, { path: '/a/b' })).header.test).toBe('test /a/b');

    expect(r.route(new RequestWriter(Method.GET, { path: '/test' })).header.test).toBe('test');

    expect(r.route(new RequestWriter(Method.GET, { path: '/:test' })).header.test).toBe(':test');
});
