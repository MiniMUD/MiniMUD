import { CompressedTable } from './compressed-table';
import { Table } from './table';

test('CompressedTable', () => {
    const tba = new Table<string, string, string>();

    const rows = ['row_a', 'row_b'];
    const cols = ['col_1', 'col_2'];

    tba.set(rows[0], cols[0], 'foo');
    tba.row(rows[0]).col(cols[1]).set('bar');
    tba.cell(rows[1], cols[0]).set('baz');

    const compressed = new CompressedTable(tba);
    const tbb = new Table<string, string, string>();
    compressed.write(tbb);

    expect(tbb.get(rows[0], cols[0])).toBe('foo');
    expect(tbb.get(rows[0], cols[1])).toBe('bar');
    expect(tbb.get(rows[1], cols[0])).toBe('baz');
});
