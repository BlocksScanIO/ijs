/// <reference types="node" />
export declare class GlobalHash {
    private hasher;
    private currentIndex;
    private HKeys;
    constructor(key: Buffer | String);
    push(index: number, hash?: Buffer): void;
    digest(): Buffer;
}
