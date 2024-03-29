import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

import { EnvironmentConfig } from './';
import { FileObjectUploadProtocol } from './FileObjectUploadProtocol';
import { ShardObject } from './ShardObject';
import { INXTRequest } from '../lib';
import {
  Bridge,
  CreateEntryFromFrameBody,
  CreateEntryFromFrameResponse,
  FrameStaging,
  InxtApiI,
} from '../services/api';
import { GenerateFileKey, sha512HmacBuffer } from '../lib/utils/crypto';
import { logger } from '../lib/utils/logger';
import { wrap } from '../lib/utils/error';
import { UploadFinishedMessage, UploadStrategy, Events } from '../lib/core';
import { Abortable } from './Abortable';

interface ShardMeta {
  hash: string;
  size: number; // size of the actual file
  index: number;
  parity: boolean;
  challenges?: Buffer[];
  challenges_as_str: string[];
  tree: string[];
}

export class FileObjectUpload extends EventEmitter implements FileObjectUploadProtocol, Abortable {
  private name: string;
  private config: EnvironmentConfig;
  private requests: INXTRequest[] = [];
  private id = '';
  private aborted = false;
  private api: InxtApiI;
  private uploader: UploadStrategy;

  iv: Buffer;
  index: Buffer;
  frameId: string;
  bucketId: string;
  fileEncryptionKey = Buffer.alloc(0);

  constructor(config: EnvironmentConfig, name: string, bucketId: string, uploader: UploadStrategy, api?: InxtApiI) {
    super();
    this.uploader = uploader;
    this.name = name;

    this.config = config;
    this.index = Buffer.alloc(0);
    this.bucketId = bucketId;
    this.frameId = '';
    this.api = api ?? new Bridge(this.config);

    if (this.config.inject && this.config.inject.index) {
      this.index = this.config.inject.index;
      logger.debug('Using injected index %s', this.index.toString('hex'));
    } else {
      this.index = randomBytes(32);
    }

    this.iv = this.index.slice(0, 16);

    this.once(Events.Upload.Abort, this.abort.bind(this));
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

    if (this.config.inject && this.config.inject.fileEncryptionKey) {
      this.fileEncryptionKey = this.config.inject.fileEncryptionKey;
      logger.debug('Using injected file encryption key %s', this.fileEncryptionKey.toString('hex'));
    } else {
      this.fileEncryptionKey = await GenerateFileKey(this.config.encryptionKey || '', this.bucketId, this.index);
    }

    return this;
  }

  async checkBucketExistence(): Promise<boolean> {
    this.checkIfIsAborted();

    const req = this.api.getBucketById(this.bucketId);
    this.requests.push(req);

    return req
      .start()
      .then(() => {
        logger.info('Bucket %s exists', this.bucketId);

        return true;
      })
      .catch((err) => {
        throw wrap('Bucket existence check error', err);
      });
  }

  stage(): Promise<void> {
    this.checkIfIsAborted();

    const req = this.api.createFrame({ data: { bucketId: this.bucketId } });
    this.requests.push(req);

    return req
      .start<FrameStaging>()
      .then((frame) => {
        if (!frame || !frame.id) {
          throw new Error('Frame response is empty');
        }

        this.frameId = frame.id;

        logger.info('Staged a file with frame %s', this.frameId);
      })
      .catch((err) => {
        throw wrap('Bridge frame creation error', err);
      });
  }

  SaveFileInNetwork(bucketEntry: CreateEntryFromFrameBody): Promise<CreateEntryFromFrameResponse> {
    this.checkIfIsAborted();

    const req = this.api.createEntryFromFrame(this.bucketId, bucketEntry);
    this.requests.push(req);

    return req.start<CreateEntryFromFrameResponse>().catch((err) => {
      throw wrap('Saving file in network error', err);
    });
  }

  GenerateHmac(shardMetas: ShardMeta[]): string {
    const shardMetasCopy = [...shardMetas].sort((sA, sB) => sA.index - sB.index);
    const hmac = sha512HmacBuffer(this.fileEncryptionKey);

    for (const shardMeta of shardMetasCopy) {
      hmac.update(Buffer.from(shardMeta.hash, 'hex'));
    }

    return hmac.digest().toString('hex');
  }

  upload(): Promise<ShardMeta[]> {
    this.checkIfIsAborted();

    this.uploader.setFileEncryptionKey(this.fileEncryptionKey);
    this.uploader.setIv(this.iv);

    this.uploader.once(Events.Upload.Abort, () => this.uploader.emit(Events.Upload.Error, new Error('Upload aborted')));
    this.uploader.on(Events.Upload.Progress, (progress: number) => this.emit(Events.Upload.Progress, progress));
    this.uploader.on(Events.Upload.EncryptProgress, (progress: number) => {
      this.emit(Events.Upload.EncryptProgress, progress);
    });

    const errorHandler = (reject: (err: Error) => void) => (err: Error) => {
      this.uploader.removeAllListeners();
      reject(err);
    };

    const finishHandler = (resolve: (result: ShardMeta[]) => void) => (message: UploadFinishedMessage) => {
      this.uploader.removeAllListeners();
      resolve(message.result);
    };

    const negotiateContract = (shardMeta: ShardMeta) => {
      return new ShardObject(this.api, this.frameId, shardMeta).negotiateContract();
    };

    return new Promise((resolve, reject) => {
      this.uploader.once(Events.Upload.Error, errorHandler(reject));
      this.uploader.once(Events.Upload.Finished, finishHandler(resolve));

      this.uploader.upload(negotiateContract);
    });
  }

  createBucketEntry(shardMetas: ShardMeta[]): Promise<void> {
    return this.SaveFileInNetwork(generateBucketEntry(this, this.name, shardMetas, false))
      .then((bucketEntry) => {
        if (!bucketEntry) {
          throw new Error('Can not save the file in the network');
        }

        logger.info('Created bucket entry with id %s', bucketEntry.id);
        this.id = bucketEntry.id;
      })
      .catch((err) => {
        throw wrap('Bucket entry creation error', err);
      });
  }

  abort(): void {
    this.aborted = true;
    this.requests.forEach((r) => r.abort());
    this.uploader.abort();
  }

  isAborted(): boolean {
    return this.aborted;
  }
}

export function generateBucketEntry(
  fileObject: FileObjectUpload,
  filename: string,
  shardMetas: ShardMeta[],
  rs: boolean,
): CreateEntryFromFrameBody {
  const bucketEntry: CreateEntryFromFrameBody = {
    frame: fileObject.frameId,
    filename,
    index: fileObject.index.toString('hex'),
    hmac: { type: 'sha512', value: fileObject.GenerateHmac(shardMetas) },
  };

  if (rs) {
    bucketEntry.erasure = { type: 'reedsolomon' };
  }

  return bucketEntry;
}
