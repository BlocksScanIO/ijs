import { createReadStream, existsSync, statSync } from 'fs';

import { logger } from '../lib/utils/logger';
import { getEnvironment } from './CommandInterface';

export async function uploadFile(filepath: string) {
  if (!existsSync(filepath)) {
    logger.error('File "%s" does not exist', filepath);
    return process.exit(-1);
  }

  try {
    const network = getEnvironment();

    const bucketId = process.env.BUCKET_ID;

    const fileId = await new Promise((resolve: (fileId: string) => void, reject) => {
      const state = network.upload(
        bucketId, 
        {
          progressCallback: (progress: number) => {
            logger.info('Progress %s%', (progress * 100).toFixed(2));
          },
          finishedCallback: (err: Error | null, res: string) => {
            if (err) {
              return reject(err);
            }
            resolve(res);
          },
          fileSize: statSync(filepath).size,
          source: createReadStream(filepath)
        }
      );

      process.on('SIGINT', () => {
        logger.info('Aborting upload');
        network.uploadCancel(state);
      });
    });

    console.log('File %s uploaded', fileId);
  } catch (err) {
    logger.error('Error uploading file: %s', err.message);
    process.exit(-1);
  }
}
