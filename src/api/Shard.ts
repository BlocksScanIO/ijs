export interface Shard {
  index: number;
  replaceCount: number;
  hash: string;
  size: number;
  parity: boolean;
  token: string;
  healthy?: boolean;
  farmer: {
    userAgent: string;
    protocol: string;
    address: string;
    port: number;
    nodeID: string;
    lastSeen: Date;
  };
  operation: string;
  url: string;
}

export function buildRequestUrl(shard: Shard) {
  const { address, port } = shard.farmer;

  return `http://${address}:${port}/download/link/${shard.hash}`;
}
