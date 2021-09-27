// import { existsSync } from 'fs';

// import { UploadOptions, UploadStrategyObject } from '../lib/upload';
// import { logger } from '../lib/utils/logger';
// import { getEnvironment } from './CommandInterface';

// export function uploadFile(filepath: string) {
//   if (!existsSync(filepath)) {
//     logger.error('File "%s" does not exist', filepath);
//     process.exit(0);
//   }

//   const network = getEnvironment();
//   const bucketId = process.env.BUCKET_ID;

//   const uploadStrategy: UploadStrategyObject = {
//     label: 'MultipleStreams',
//     params: { desiredRamUsage: 200 * 1024 * 1024, filepath }
//   };

//   return new Promise((resolve, reject) => {
//     const uploadOpts: UploadOptions = {
//       filename: filepath,
//       progressCallback: (progress: number) => {
//         logger.debug('Progress %s%', (progress * 100).toFixed(2));
//       },
//       finishedCallback: (err: Error | null, res: string | null) => {
//         if (err) {
//           return reject(err);
//         }
//         resolve(res);
//       }
//     };

//     network.upload(bucketId, uploadOpts, uploadStrategy);
//   });
// }