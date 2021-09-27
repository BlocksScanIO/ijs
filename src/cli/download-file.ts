import { createWriteStream } from "fs";
import { pipeline, Readable } from "stream";
import { DownloadStrategyLabel } from "../lib/download";
import { logger } from "../lib/utils/logger";
import { getEnvironment } from "./CommandInterface";

export async function downloadFile(fileId: string, path: string) {
  logger.info('Donwloading file %s', fileId);

  const network = getEnvironment();
  const bucketId = process.env.BUCKET_ID;

  try {
    await new Promise((resolve, reject) => {
      const state = network.download(bucketId, fileId, {
        progressCallback: (progress: number) => {
          logger.info('Progress: %s %', (progress * 100).toFixed(2));
        },
        finishedCallback: (err: Error | null, downloadStream: Readable | null) => {
          if (err) {
            return reject(err);
          }

          pipeline((downloadStream as Readable), createWriteStream(path), (err) => {
            console.log('here i am');
            if (err) {
              return reject(err);
            }
            resolve(null);
          });
        },
        debug: (msg: string) => {
          logger.debug('DEBUG', msg);
        }
      }, {
        label: 'OneStreamOnly',
        params: {}
      });

      process.on('SIGINT', () => {
        network.downloadCancel(state);
      });
    });
    logger.info('File downloaded on path %s', path);

    process.exit(0);
  } catch (err) {
    logger.error('Error uploading file %s', err.message);

    process.exit(1);
  }
}

export async function downloadFileParallel(fileId: string, path: string, strategy?: DownloadStrategyLabel) {
  logger.info('Downloading file %s', fileId);

  const network = getEnvironment();
  const bucketId = process.env.BUCKET_ID;

  try {
    await new Promise((resolve, reject) => {
      const state = network.download(bucketId, fileId, {
        progressCallback: (progress: number) => {
          logger.info('Progress: %s %', (progress * 100).toFixed(2));
        },
        finishedCallback: (err: Error | null, downloadStream: Readable | null) => {
          if (err) {
            return reject(err);
          }

          pipeline((downloadStream as Readable), createWriteStream(path), (err) => {
            if (err) {
              return reject(err);
            }
            resolve(null);
          });
        },
        debug: (msg: string) => {
          logger.debug('DEBUG', msg);
        }
      }, {
        label: 'MultipleStreams',
        params: {}
      });

      process.on('SIGINT', () => {
        network.downloadCancel(state);
      });
    });

    logger.info('File downloaded on path %s', path);

    process.exit(0);
  } catch (err) {
    logger.error('Error downloading file %s', err.message);

    process.exit(1);
  }
}
