import { utils } from 'rs-wrapper';
import { EventEmitter, Readable } from 'stream';
import { randomBytes } from 'crypto';

import { EnvironmentConfig, UploadProgressCallback } from '..';
import * as api from '../services/request';

import EncryptStream from '../lib/encryptStream';
import { GenerateFileKey, sha512HmacBuffer } from "../lib/crypto";
import { FunnelStream } from "../lib/funnelStream";
import { getShardMeta, ShardMeta } from '../lib/shardMeta';
import { ContractNegotiated } from '../lib/contracts';
import { logger } from "../lib/utils/logger";

import { ExchangeReport } from "./reports";
import { Shard } from "./shard";
import { promisifyStream } from '../lib/utils/promisify';
import { wrap } from '../lib/utils/error';
import { UPLOAD_CANCELLED } from './constants';

export interface FileMeta {
  size: number;
  name: string;
  content: Readable;
}

export class FileObjectUpload extends EventEmitter {
  private config: EnvironmentConfig;
  private fileMeta: FileMeta;
  private requests: api.INXTRequest[] = [];
  private id = '';
  private aborted = false;

  bucketId: string;
  frameId: string;
  index: Buffer;
  encrypted = false;

  cipher: EncryptStream;
  uploadStream: EncryptStream;
  funnel: FunnelStream;
  fileEncryptionKey: Buffer;

  constructor(config: EnvironmentConfig, fileMeta: FileMeta, bucketId: string) {
    super();

    this.config = config;
    this.index = Buffer.alloc(0);
    this.fileMeta = fileMeta;
    this.bucketId = bucketId;
    this.frameId = '';
    this.funnel = new FunnelStream(utils.determineShardSize(fileMeta.size));
    this.cipher = new EncryptStream(randomBytes(32), randomBytes(16));
    this.uploadStream = new EncryptStream(randomBytes(32), randomBytes(16));
    this.fileEncryptionKey = randomBytes(32);

    this.once(UPLOAD_CANCELLED, this.abort.bind(this));
  }

  getSize(): number {
    return this.fileMeta.size;
  }

  getId(): string {
    return this.id;
  }

  checkIfIsAborted() {
    if (this.isAborted()) {
      throw new Error('Upload aborted');
    }
  }

  async init(): Promise<FileObjectUpload> {
    this.checkIfIsAborted();

    this.index = randomBytes(32);
    this.fileEncryptionKey = await GenerateFileKey(this.config.encryptionKey || '', this.bucketId, this.index);

    this.cipher = new EncryptStream(this.fileEncryptionKey, this.index.slice(0, 16));

    return this;
  }

  async checkBucketExistence(): Promise<boolean> {
    this.checkIfIsAborted();

    // if bucket not exists, bridge returns an error
    return api.getBucketById(this.config, this.bucketId).then((res) => {
      logger.info('Bucket %s exists', this.bucketId);

      return res ? true : false;
    })
    .catch((err) => {
      throw wrap('Bucket existence check error', err);
    });
  }

  stage(): Promise<void> {
    this.checkIfIsAborted();

    return api.createFrame(this.config).then((frame) => {
      if (!frame || !frame.id) {
        throw new Error('Frame response is empty');
      }

      this.frameId = frame.id;

      logger.info('Staged a file with frame %s', this.frameId);
    }).catch((err) => {
      throw wrap('Bridge frame creation error', err);
    });
  }

  SaveFileInNetwork(bucketEntry: api.CreateEntryFromFrameBody): Promise<void | api.CreateEntryFromFrameResponse> {
    this.checkIfIsAborted();

    return api.createEntryFromFrame(this.config, this.bucketId, bucketEntry)
      .catch((err) => {
        throw wrap('Bucket entry creation error', err);
      });
  }

  negotiateContract(frameId: string, shardMeta: ShardMeta): Promise<void | ContractNegotiated> {
    this.checkIfIsAborted();

    return api.addShardToFrame(this.config, frameId, shardMeta)
      .catch((err) => {
        throw wrap('Contract negotiation error', err);
      });
  }

  NodeRejectedShard(encryptedShard: Buffer, shard: Shard): Promise<boolean> {
    this.checkIfIsAborted();

    const request = api.sendShardToNode(this.config, shard, encryptedShard);

    this.requests.push(request);

    return request.start<api.SendShardToNodeResponse>()
      .then(() => false)
      .catch((err) => {
        throw wrap('Farmer request error', err);
      });
  }

  GenerateHmac(shardMetas: ShardMeta[]): string {
    const hmac = sha512HmacBuffer(this.fileEncryptionKey);

    for (const shardMeta of shardMetas) {
      hmac.update(Buffer.from(shardMeta.hash, 'hex'));
    }

    return hmac.digest().toString('hex');
  }

  encrypt(): EncryptStream {
    this.uploadStream = this.fileMeta.content.pipe(this.funnel).pipe(this.cipher);
    this.encrypted = true;

    return this.uploadStream;
  }

  async upload(callback: UploadProgressCallback): Promise<ShardMeta[]> {
    this.checkIfIsAborted();

    if (!this.encrypted) {
      throw new Error('Tried to upload a file not encrypted. Use .encrypt() before upload()');
    }

    let shardIndex = 0;

    const uploads: Promise<ShardMeta>[] = [];

    this.uploadStream.on('data', (shard: Buffer) => {
      uploads.push(this.uploadShard(shard, shard.length, this.frameId, shardIndex++, 3, false));
    });

    await promisifyStream(this.uploadStream);

    const fileSize = this.getSize();

    logger.debug('Shards obtained %s, shardSize %s', Math.ceil(fileSize / utils.determineShardSize(fileSize)), utils.determineShardSize(fileSize));

    let currentBytesUploaded = 0;
    const uploadResponses = await Promise.all(
      uploads.map(async (request) => {
        const shardMeta = await request;

        currentBytesUploaded = updateProgress(fileSize, currentBytesUploaded, shardMeta.size, callback);

        return shardMeta;
      })
    ).catch((err) => {
      throw wrap('Farmer request error', err);
    });

    return uploadResponses;
  }

  async uploadShard(encryptedShard: Buffer, shardSize: number, frameId: string, index: number, attemps: number, parity: boolean): Promise<ShardMeta> {
    const shardMeta: ShardMeta = getShardMeta(encryptedShard, shardSize, index, parity);

    logger.info('Uploading shard %s index %s size %s parity %s', shardMeta.hash, shardMeta.index, shardMeta.size, parity);

    try {
      const negotiatedContract: ContractNegotiated | void = await this.negotiateContract(frameId, shardMeta);

      if (!negotiatedContract) {
        throw new Error('Unable to receive storage offer');
      }

      const token = negotiatedContract.token;
      const operation = negotiatedContract.operation;
      const farmer = { ...negotiatedContract.farmer, lastSeen: new Date() };

      logger.debug('Negotiated succesfully contract for shard %s (index %s, size %s) with token %s',
        shardMeta.hash,
        shardMeta.index,
        shardMeta.size,
        token
      );

      const hash = shardMeta.hash;
      const shard: Shard = { index, replaceCount: 0, hash, size: shardSize, parity, token, farmer, operation };

      const exchangeReport = new ExchangeReport(this.config);
      exchangeReport.params.dataHash = hash;
      exchangeReport.params.farmerId = shard.farmer.nodeID;

      if (await this.NodeRejectedShard(encryptedShard, shard)) {
        exchangeReport.UploadError();
      } else {
        logger.debug('Node %s accepted shard %s', shard.farmer.nodeID, shard.hash);

        exchangeReport.UploadOk();
      }

      exchangeReport.params.exchangeEnd = new Date();
      exchangeReport.sendReport().catch(() => {
        // no op
      });
    } catch (err) {
      if (attemps > 1) {
        logger.error('Upload for shard %s failed. Reason %s. Retrying ...', shardMeta.hash, err.message);
        await this.uploadShard(encryptedShard, shardSize, frameId, index, attemps - 1, parity);
      } else {
        return Promise.reject(wrap('Upload shard error', err));
      }
    }

    logger.info('Shard %s uploaded succesfully', shardMeta.hash);

    return shardMeta;
  }

  createBucketEntry(shardMetas: ShardMeta[]): Promise<void> {
    return this.SaveFileInNetwork(generateBucketEntry(this, this.fileMeta, shardMetas, false))
      .then((bucketEntry) => {
        if (!bucketEntry) {
          throw new Error('Can not save the file in the network');
        }
        this.id = bucketEntry.id;
      })
      .catch((err) => {
        throw wrap('Bucket entry creation error', err);
      });
  }

  abort(): void {
    logger.info('Aborting file upload');

    this.aborted = true;
    this.requests.forEach((r) => r.abort());
  }

  isAborted(): boolean {
    return this.aborted;
  }
}

function updateProgress(totalBytes: number, currentBytesUploaded: number, newBytesUploaded: number, progress: UploadProgressCallback): number {
  const newCurrentBytes = currentBytesUploaded + newBytesUploaded;
  const progressCounter = newCurrentBytes / totalBytes;

  progress(progressCounter, newCurrentBytes, totalBytes);

  return newCurrentBytes;
}

export function generateBucketEntry(fileObject: FileObjectUpload, fileMeta: FileMeta, shardMetas: ShardMeta[], rs: boolean): api.CreateEntryFromFrameBody {
  const bucketEntry: api.CreateEntryFromFrameBody = {
    frame: fileObject.frameId,
    filename: fileMeta.name,
    index: fileObject.index.toString('hex'),
    hmac: { type: 'sha512', value: fileObject.GenerateHmac(shardMetas) }
  };

  if (rs) {
    bucketEntry.erasure = { type: "reedsolomon" };
  }

  return bucketEntry;
}
