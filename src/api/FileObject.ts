import * as Winston from 'winston';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { doUntil, eachLimit, retry } from 'async';

import DecryptStream from "../lib/decryptstream";
import FileMuxer from "../lib/filemuxer";
import { GenerateFileKey } from "../lib/crypto";

import { ShardObject } from "./ShardObject";
import { FileInfo, GetFileInfo, GetFileMirrors, GetFileMirror, ReplacePointer } from "./fileinfo";
import { EnvironmentConfig } from "..";
import { Shard } from "./shard";
import { ExchangeReport } from './reports';
import { Decrypt, Download, FILEMUXER } from '../lib/events';
import { logger } from '../lib/utils/logger';
import { DEFAULT_INXT_MIRRORS, DOWNLOAD_CANCELLED, DOWNLOAD_CANCELLED_ERROR } from './constants';
import { wrap } from '../lib/utils/error';
import { drainStream } from '../lib/utils/stream';

export class FileObject extends EventEmitter {
  shards: ShardObject[] = [];
  rawShards: Shard[] = [];
  fileInfo: FileInfo | undefined;
  config: EnvironmentConfig;

  length = -1;
  final_length = -1;

  bucketId: string;
  fileId: string;

  fileKey: Buffer;

  totalSizeWithECs = 0;

  decipher: DecryptStream;

  private aborted = false;
  private debug: Winston.Logger;

  constructor(config: EnvironmentConfig, bucketId: string, fileId: string, debug: Winston.Logger) {
    super();
    this.config = config;
    this.bucketId = bucketId;
    this.fileId = fileId;
    this.debug = debug;
    this.fileKey = Buffer.alloc(0);
    this.decipher = new DecryptStream(randomBytes(32), randomBytes(16));

    this.once(DOWNLOAD_CANCELLED, this.abort.bind(this));

    // DOWNLOAD_CANCELLED attach one listener per concurrent download
    this.setMaxListeners(100);
  }

  checkIfIsAborted() {
    if (this.isAborted()) {
      throw new Error('Download aborted');
    }
  }

  async getInfo(): Promise<FileInfo | undefined> {
    this.checkIfIsAborted();

    logger.info('Retrieving file info...');

    if (!this.fileInfo) {
      this.fileInfo = await GetFileInfo(this.config, this.bucketId, this.fileId)
        .catch((err) => {
          throw wrap('Get file info error', err);
        });
      if (this.config.encryptionKey) {
        this.fileKey = await GenerateFileKey(this.config.encryptionKey, this.bucketId, Buffer.from(this.fileInfo.index, 'hex'))
          .catch((err) => {
            throw wrap('Generate file key error', err);
          });
      }
    }

    return this.fileInfo;
  }

  async getMirrors(): Promise<void> {
    this.checkIfIsAborted();

    logger.info('Retrieving file mirrors...');

    // Discard mirrors for shards with parities (ECs)
    this.rawShards = (await GetFileMirrors(this.config, this.bucketId, this.fileId)).filter(shard => !shard.parity);

    await eachLimit(this.rawShards, 1, (shard: Shard, nextShard) => {
      let attempts = 0;

      const farmerIsOk = shard.farmer && shard.farmer.nodeID && shard.farmer.port && shard.farmer.address;

      if (farmerIsOk) {
        shard.farmer.address = shard.farmer.address.trim();

        return nextShard(null);
      }

      logger.warn('Pointer for shard %s failed, retrieving a new one', shard.index);

      doUntil((next: (err: Error | null, result: Shard | null) => void) => {
        ReplacePointer(this.config, this.bucketId, this.fileId, shard.index, []).then((newShard) => {
          next(null, newShard[0]);
        }).catch((err) => {
          next(err, null);
        }).finally(() => {
          attempts++;
        });
      }, (result: Shard | null, next: any) => {
        const validPointer = result && result.farmer && result.farmer.nodeID && result.farmer.port && result.farmer.address;

        return next(null, validPointer || attempts >= DEFAULT_INXT_MIRRORS);
      }).then((result: any) => {
        logger.info('Pointer replaced for shard %s', shard.index);

        result.farmer.address = result.farmer.address.trim();

        this.rawShards[shard.index] = result;

        nextShard(null);
      }).catch((err) => {
        nextShard(wrap('Bridge request pointer error', err));
      });
    });

    this.length = this.rawShards.reduce((a, b) => { return { size: a.size + b.size }; }, { size: 0 }).size;
    this.final_length = this.rawShards.filter(x => x.parity === false).reduce((a, b) => { return { size: a.size + b.size }; }, { size: 0 }).size;
  }

  TryDownloadShardWithFileMuxer(shard: Shard, excluded: string[] = []): Promise<Buffer> {
    this.checkIfIsAborted();

    logger.info('Downloading shard %s from farmer %s', shard.index, shard.farmer.nodeID);

    const exchangeReport = new ExchangeReport(this.config);

    return new Promise((resolve, reject) => {
      retry({ times: this.config.config?.shardRetry || 3, interval: 1000 }, async (nextTry: any) => {
        exchangeReport.params.exchangeStart = new Date();
        exchangeReport.params.farmerId = shard.farmer.nodeID;
        exchangeReport.params.dataHash = shard.hash;

        let downloadHasError = false;
        let downloadError: Error | null = null;
        let downloadCancelled = false;

        const oneFileMuxer = new FileMuxer({ shards: 1, length: shard.size });
        const shardObject = new ShardObject(this.config, shard, this.bucketId, this.fileId);

        let buffs: Buffer[] = [];
        let downloaderStream: Readable;

        this.once(DOWNLOAD_CANCELLED, () => {
          buffs = [];
          downloadCancelled = true;

          if (downloaderStream) {
            downloaderStream.destroy();
          }
        });

        oneFileMuxer.on(FILEMUXER.PROGRESS, (msg) => this.emit(FILEMUXER.PROGRESS, msg));
        oneFileMuxer.on('error', (err) => {
          if (err.message === DOWNLOAD_CANCELLED_ERROR) {
            return;
          }

          downloadHasError = true;
          downloadError = err;
          this.emit(FILEMUXER.ERROR, err);

          exchangeReport.DownloadError();
          exchangeReport.sendReport().catch(() => null);

          oneFileMuxer.emit('drain');
        });

        oneFileMuxer.on('data', (data: Buffer) => { buffs.push(data); });

        oneFileMuxer.once('drain', () => {
          logger.info('Drain received for shard %s', shard.index);

          if (downloadCancelled) {
            nextTry(null, Buffer.alloc(0));

            return;
          }

          if (downloadHasError) {
            nextTry(downloadError);
          } else {
            exchangeReport.DownloadOk();
            exchangeReport.sendReport().catch(() => null);

            nextTry(null, Buffer.concat(buffs));
          }
        });

        downloaderStream = await shardObject.StartDownloadShard();
        oneFileMuxer.addInputSource(downloaderStream, shard.size, Buffer.from(shard.hash, 'hex'), null);

      }, async (err: Error | null | undefined, result: Buffer | undefined) => {
        try {
          if (!err) {
            if (result) {
              resolve(result);
            } else {
              reject(wrap('Empty result from downloading shard', new Error('')));
            }
          } else {
            logger.warn('It seems that shard %s download from farmer %s went wrong. Replacing pointer', shard.index, shard.farmer.nodeID);

            excluded.push(shard.farmer.nodeID);

            const newShard = await GetFileMirror(this.config, this.bucketId, this.fileId, 1, shard.index, excluded);

            if (!newShard[0].farmer) {
              return reject(wrap('File missing shard error', err));
            }

            const buffer = await this.TryDownloadShardWithFileMuxer(newShard[0], excluded);

            return resolve(buffer);
          }
        } catch (err) {
          return reject(err);
        }
      });
    });
  }

  download(): Readable {
    if (!this.fileInfo) {
      throw new Error('Undefined fileInfo');
    }

    this.decipher = new DecryptStream(this.fileKey.slice(0, 32), Buffer.from(this.fileInfo.index, 'hex').slice(0, 16))
      .on(Decrypt.Progress, (msg) => {
        this.emit(Decrypt.Progress, msg);
      })
      .on('error', (err) => {
        this.emit(Decrypt.Error, err);
      });

    eachLimit(this.rawShards, 1, (shard, nextItem) => {
      this.checkIfIsAborted();

      if (shard.healthy === false) {
        throw new Error('Bridge request pointer error');
      }

      this.TryDownloadShardWithFileMuxer(shard).then((shardBuffer) => {
        logger.info('Shard %s downloaded OK', shard.index);

        this.emit(Download.Progress, shardBuffer.length);

        if (!this.decipher.write(shardBuffer)) {
          // backpressuring to avoid congestion for excessive buffering
          return drainStream(this.decipher);
        }
      }).then(() => {
        nextItem();
      }).catch((err) => {
        nextItem(wrap('Download shard error', err));
      });
    }, () => {
      this.decipher.end();
    });

    return this.decipher;
  }

  abort(): void {
    this.debug.info('Aborting file upload');
    this.aborted = true;
  }

  isAborted(): boolean {
    return this.aborted;
  }
}
