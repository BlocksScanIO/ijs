export declare class ProxyBalancer {
    private proxies;
    constructor();
    getProxy(reqsLessThan: number): Promise<Proxy>;
    attach(p: Proxy): ProxyBalancer;
    del(p: Proxy): void;
}
export declare class Proxy {
    url: string;
    private currentRequests;
    constructor(url: string);
    requests(): number;
    addReq(p: ProxyRequest): void;
    removeReq(p: ProxyRequest): void;
}
export interface ProxyRequest {
    id: string;
}
export declare const getProxy: () => Promise<{
    free: () => void;
    url: string;
}>;
