import { encode, utils } from "rs-wrapper";

import { EnvironmentConfig, UploadProgressCallback, UploadFinishCallback } from "../..";
import { FileObjectUpload, FileMeta } from "../../api/FileObjectUpload";
import { ShardMeta } from '../shardMeta';
import { CreateEntryFromFrameBody } from '../../services/request';
import { logger } from "../utils/logger";

const MIN_SHARD_SIZE = 2097152; // 2Mb

/**
 * Uploads a file to the network
 * @param config Environment config
 * @param bucketId id whose bucket is going to store the file
 * @param fileMeta file metadata
 * @param progress upload progress callback
 * @param finish finish progress callback
 */
export async function Upload(config: EnvironmentConfig, bucketId: string, fileMeta: FileMeta, progress: UploadProgressCallback, finish: UploadFinishCallback): Promise<void> {
    if (!config.encryptionKey) {
        throw new Error('Encryption key is null');
    }

    const File = await new FileObjectUpload(config, fileMeta, bucketId).init();
    const Output = await File.StartUploadFile();
    
    const fileSize = fileMeta.size;
    const buffs: Buffer[] = [];

    progress(0, 0, fileSize);

    Output.on('data', async (shard: Buffer) => { buffs.push(shard); });

    Output.on('error', (err) => finish(err, null));

    Output.on('end', async () => {
        let fileContent = Buffer.concat(buffs);

        const shardSize = utils.determineShardSize(fileSize);
        const nShards = Math.ceil(fileSize / shardSize);
        const parityShards = utils.determineParityShards(nShards);

        const rs = fileSize >= MIN_SHARD_SIZE;
        const totalSize = rs ? fileSize + (parityShards * shardSize) : fileSize;

        const action: UploadShardsAction = {
            fileContent, nShards, shardSize, fileObject: File, firstIndex: 0, parity: false
        }

        logger.debug('Shards obtained %s, shardSize %s', nShards, shardSize);

        let shardUploadRequests = uploadShards(action);
        let paritiesUploadRequests: Promise<ShardMeta>[] = [];

        if (rs) {
            // console.log({ shardSize, nShards, parityShards, fileContentSize: fileContent.length });
            logger.debug("Applying Reed Solomon. File size %s. Creating %s parities", fileContent.length, parityShards);

            const parities = await getParities(fileContent, shardSize, nShards, parityShards);

            logger.debug("Parities content size %s", parities.length);

            action.fileContent = Buffer.from(parities);
            action.firstIndex = shardUploadRequests.length;
            action.parity = true;
            action.nShards = parityShards;

            // upload parities
            paritiesUploadRequests = uploadShards(action);
        } else {
            logger.debug('File too small (%s), not creating parities', fileSize);
        }

        try {
            logger.debug('Waiting for upload to progress');

            let currentBytesUploaded = 0;
            const uploadResponses = await Promise.all(
                shardUploadRequests.concat(paritiesUploadRequests).map(async (request) => {
                    const shardMeta = await request;

                    currentBytesUploaded = updateProgress(totalSize, currentBytesUploaded, shardMeta.size, progress);

                    return shardMeta;
                })
            ).catch((err) => {
                throw new Error('Farmer request error');
            });

            logger.debug('Upload finished');

            const savingFileResponse = await createBucketEntry(File, fileMeta, uploadResponses, rs);

            // TODO: Change message and way of handling
            if (!savingFileResponse) {
                throw new Error('Can not save the file in network');
            }

            progress(100, fileSize, fileSize);
            finish(null, savingFileResponse);

            logger.info('File uploaded with id %s', savingFileResponse.id);
        } catch (err) {
            finish(err, null);
        }
    });
}

function createBucketEntry(fileObject: FileObjectUpload, fileMeta: FileMeta, shardMetas: ShardMeta[], rs: boolean) {
    const bucketEntry: CreateEntryFromFrameBody = {
        frame: fileObject.frameId,
        filename: fileMeta.name,
        index: fileObject.index.toString('hex'),
        hmac: {
            type: 'sha512',
            value: fileObject.GenerateHmac(shardMetas)
        }
    };

    if (rs) {
        bucketEntry.erasure = { type: "reedsolomon" };
    }

    return fileObject.SaveFileInNetwork(bucketEntry);
}

async function getParities(file: Buffer, shardSize: number, totalShards: number, parityShards: number) {
    const fileEncoded = await encode(file, shardSize, totalShards, parityShards);

    return fileEncoded.slice(totalShards * shardSize);
}

function updateProgress(totalBytes: number, currentBytesUploaded: number, newBytesUploaded: number, progress: UploadProgressCallback): number {
    const newCurrentBytes = currentBytesUploaded + newBytesUploaded;
    const progressCounter = Math.ceil((newCurrentBytes / totalBytes) * 100);
    progress(progressCounter, newCurrentBytes, totalBytes);

    return newCurrentBytes;
}

interface UploadShardsAction {
    fileObject: FileObjectUpload;
    fileContent: Buffer;
    shardSize: number;
    nShards: number;
    firstIndex: number;
    parity: boolean;
}

function uploadShards(action: UploadShardsAction): Promise<ShardMeta>[] {
    let from = 0;
    let currentShard = null;
    const shardUploadRequests: Promise<ShardMeta>[] = [];

    for (let i = action.firstIndex; i < (action.firstIndex + action.nShards); i++) {
        currentShard = action.fileContent.slice(from, from + action.shardSize);

        shardUploadRequests.push(uploadShard(action.fileObject, currentShard, i, action.parity));

        from += action.shardSize;
    }

    return shardUploadRequests;
}

function uploadShard(fileObject: FileObjectUpload, shard: Buffer, index: number, isParity: boolean): Promise<ShardMeta> {
    return fileObject.UploadShard(shard, shard.length, fileObject.frameId, index, 3, isParity);
}
