import { Transform } from 'stream';

export function drainStream(stream: Transform) {
    return new Promise(r => stream.once('drain', r));
}
