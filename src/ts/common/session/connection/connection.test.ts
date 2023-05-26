import { ResponseWriter } from '@/common/message';
import { DummyConnection } from './dummy-connection';
import { MessageRequest, Status } from '@/common/message/message';

describe('Connection', () => {
    test('DummyConnection', async () => {
        const conn = new DummyConnection();

        conn.outgoing.on((data: MessageRequest) => {
            expect(data.header.path).toBe('/test');
            const writer = new ResponseWriter(data);
            writer.status = Status.OK;
            writer.content = 'test';
            conn.recive(writer.build());
        });

        const result = await conn.get('/test');
        expect(result.content).toBe('test');
    });
});
