import { MerkleTree, merkleTree } from './merkleTree';
import { ripemd160, sha256 } from './crypto';

// req object for put a frame
export interface ShardMeta {
  hash: string;
  size: number; // size of the actual file
  index: number;
  parity: boolean;
  challenges?: Buffer[];
  challenges_as_str: string[];
  tree: string[];
  exclude?: any;
}

function getShardHash(encryptedShardData: Buffer): Buffer {
  const shardHash: Buffer = ripemd160(sha256(encryptedShardData));
  return shardHash;
}

export function getShardMeta(encryptedShardData: Buffer, fileSize: number, index: number, parity: boolean, exclude?: any): ShardMeta {
  const mT: MerkleTree = merkleTree(encryptedShardData);
  const shardMeta: ShardMeta = {
    hash: getShardHash(encryptedShardData).toString("hex"),
    size: fileSize,
    index,
    parity,
    challenges_as_str: mT.challenges_as_str,
    tree: mT.leaf
  };
  return shardMeta;
}

function getShardMerkleTree(encryptedShardData: Buffer): MerkleTree {
  const mT: MerkleTree = merkleTree(encryptedShardData);
  return mT;
}
