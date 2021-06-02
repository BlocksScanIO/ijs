import { Readable } from 'stream'

import { DownloadFileOptions, Environment, UploadFinishCallback, UploadProgressCallback } from "../../src"
import { FileMeta } from "../../src/api/FileObjectUpload"
import { EncryptFilename } from "../../src/lib/crypto"
import { Download } from "../../src/lib/download"
import { Upload } from "../../src/lib/upload"
import { logger } from '../../src/lib/utils/logger'
import { ShardFailedIntegrityCheckError, ShardSuccesfulIntegrityCheck } from '../../src/lib/filemuxer'
import { DECRYPT, DOWNLOAD, FILEMUXER } from '../../src/lib/events'
import { ActionState, ActionTypes } from '../../src/api/ActionState'

export class LabEnvironment extends Environment {
    /**
     * Uploads a file
     * @param bucketId Bucket id where file is
     * @param file file metadata required for performing the upload
     * @param progress Progress callback
     * @param finish Finish callback
     */
    upload(bucketId: string, file: FileMeta, progress: UploadProgressCallback, finish: UploadFinishCallback) : void {
        if(!this.config.encryptionKey) {
            throw new Error('Mnemonic was not provided')   
        }

        EncryptFilename(this.config.encryptionKey, bucketId, file.name).then((name: string) => {
            Upload(this.config, bucketId, {...file, name}, progress, finish)
        })
    }

    /**
     * Downloads a file
     * @param bucketId Bucket id where file is
     * @param fileId Id of the file to be downloaded
     * @param options Available options for download
     */
    download(bucketId: string, fileId: string, options: DownloadFileOptions): ActionState {
        if(!this.config.encryptionKey) {
            throw new Error('Mnemonic was not provided')
        }

        const downloadState = new ActionState(ActionTypes.DOWNLOAD);

        const finishCbWrapper = (err: Error | null, fileStream: Readable) => {
            if (!err && fileStream) {
                new DownloadLogsManager(fileStream).init();
            }

            options.finishedCallback(err, fileStream);
        }

        Download(this.config, bucketId, fileId, {
            progressCallback: options.progressCallback,
            decryptionProgressCallback: options.decryptionProgressCallback,
            finishedCallback: finishCbWrapper
        }, downloadState);

        return downloadState;
    }
}

class DownloadLogsManager {
    private output: Readable

    constructor(output: Readable) {
        this.output = output
    }

    init() {
        this.addFileMuxerListeners()
        this.addDownloadListeners()
        this.addDecryptListeners()

        this.output.on('error', (err) => {
            logger.error('Download failed due to %s', err.message)
            console.error(err)
        })
    }

    private addFileMuxerListeners() {
        this.output.on(FILEMUXER.ERROR, (err: ShardFailedIntegrityCheckError) => {
            logger.error('%s. Expected hash: %s, actual: %s', err.message, err.content.expectedHash, err.content.actualHash)
        })
    
        this.output.on(FILEMUXER.PROGRESS, (msg: ShardSuccesfulIntegrityCheck) => {
            logger.debug('digest %s', msg.content.digest)
        })
    }

    private addDownloadListeners() {        
        this.output.on(DOWNLOAD.PROGRESS, () => {
            // logger.info('Download progress fired!')
        })

        this.output.on(DOWNLOAD.END, () => {
            logger.info('Shards download finished. Decrypting...')
        })
    }

    private addDecryptListeners() {
        this.output.on(DECRYPT.PROGRESS, () => {
            // logger.info('Decrypting progress fired!')
        })

        this.output.on(DECRYPT.END, () => {
            logger.info('Decrypting finished.')
        })
    }
}