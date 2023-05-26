import { RuntimeType, t } from '@common/runtime-types';
import { Indexed, SerializedTable } from './serialized-table';
import { CompressedTable } from './compressed-table';

function indexed<T>(tt: RuntimeType<T>) {
    return t.array(t.tuple(t.number, tt));
}

export class TableLoader<R, C, V> {
    private t: RuntimeType<{
        indicies: [Indexed<R>, Indexed<C>];
        table: Indexed<Indexed<V>>;
    }>;

    public constructor(tr: RuntimeType<R>, tc: RuntimeType<C>, tv: RuntimeType<V>) {
        this.t = t.object({
            indicies: t.tuple(indexed(tr), indexed(tc)),
            table: indexed(indexed(tv)),
        });
    }

    private parse(data: unknown): SerializedTable<R, C, V> {
        const obj = this.t.cast(data);
        return new SerializedTable(obj.indicies, obj.table);
    }

    public load(data: any): CompressedTable<R, C, V> {
        if (typeof data === 'string') return this.load(JSON.parse(data));
        const serialized = this.parse(data);
        const compressed = new CompressedTable<R, C, V>(serialized);
        return compressed;
    }
}
