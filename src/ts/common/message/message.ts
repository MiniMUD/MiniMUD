import { getID } from '@/util/id';
import { CompileType, RuntimeType, t } from '../runtime-types';

export type Header = Record<string, string>;

export const enum Method {
    GET = 'GET',
    POST = 'POST',
    RESPONSE = 'RESPONSE',
}

export const enum Status {
    OK = 'OK',
    BAD_REQUEST = 'BAD_REQUEST',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    SERVER_ERROR = 'SERVER_ERROR',
    REDIRECT = 'REDIRECT',
}

const message = <M extends Method>(method: RuntimeType<M>) =>
    t.object({
        header: t.and(
            t.object({
                method: method,
            }),
            t.record(t.string, t.string)
        ),
        content: t.unknown,
    });

export const messageGetRequest = message(t.literal(Method.GET));
export const messagePostRequest = message(t.literal(Method.POST));
export const messageRequest = message(t.oneof(Method.GET, Method.POST));
export const messageResponse = message(t.literal(Method.RESPONSE));
export const messageAny = message(t.oneof(Method.GET, Method.POST, Method.RESPONSE));

export type MessageGetRequest = CompileType<typeof messageGetRequest>;
export type MessagePostRequest = CompileType<typeof messagePostRequest>;
export type MessageRequest = CompileType<typeof messageRequest>;
export type MessageResponse = CompileType<typeof messageResponse>;
export type MessageAny = CompileType<typeof messageAny>;
