import { t } from '../common/runtime-types';
import { Table } from './table';
import { TableLoader } from './table-loader';

test('TableLoader', () => {
    const tb = new Table<string, string, string | null>();
    const serialized =
        '{"indicies":[[[0,"row_a"],[1,"row_b"]],[[0,"col_1"],[1,"col_2"]]],"table":[[0,[[0,"foo"],[1,"bar"]]],[1,[[0,"baz"],[1,null]]]]}';
    const tableLoader = new TableLoader(t.string, t.string, t.nullable(t.string));
    tableLoader.load(serialized).write(tb);

    expect(tb.row('row_a').col('col_1').value()).toBe('foo');
    expect(tb.row('row_a').col('col_2').value()).toBe('bar');
    expect(tb.row('row_b').col('col_1').value()).toBe('baz');
    expect(tb.row('row_b').col('col_2').value()).toBe(null);
});
