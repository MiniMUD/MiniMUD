import { Table } from './table';

test('Table', () => {
    const tba = new Table<string, number, string>();

    const rows = ['a', 'b'];
    const cols = [1, 2];

    tba.set(rows[0], cols[0], 'foo');
    tba.row(rows[0]).col(cols[1]).set('bar');
    tba.cell(rows[1], cols[0]).set('baz');

    expect(tba.get(rows[0], cols[0])).toBe('foo');
    expect(tba.row(rows[0]).col(cols[1]).value()).toBe('bar');
    expect(tba.cell(rows[1], cols[0]).value()).toBe('baz');
    expect(tba.get(rows[1], cols[1])).toBe(undefined);

    const tbb = new Table<string, number, string>(tba);

    for (const r of rows) for (const c of cols) expect(tba.get(r, c)).toBe(tbb.get(r, c));
});
