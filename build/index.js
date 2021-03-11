"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
var fs = __importStar(require("fs"));
var stream_to_blob_1 = __importDefault(require("stream-to-blob"));
var blob_to_stream_1 = __importDefault(require("blob-to-stream"));
var upload_1 = require("./lib/upload");
var download_1 = require("./lib/download");
var crypto_1 = require("./lib/crypto");
var logger_1 = require("./lib/utils/logger");
var Environment = /** @class */ (function () {
    function Environment(config) {
        this.config = config;
    }
    /**
     * Gets general API info
     * @param cb Callback that will receive api's info
     */
    Environment.prototype.getInfo = function (cb) {
        /* TODO */
        cb(null, 'Not implemented yet');
    };
    /**
     * Gets list of available buckets
     * @param cb Callback that will receive the list of buckets
     */
    Environment.prototype.getBuckets = function (cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    /**
     * Gets a bucket id by name
     * @param bucketName Name of the bucket to be retrieved
     * @param cb Callback that will receive the bucket id
     */
    Environment.prototype.getBucketId = function (bucketName, cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    /**
     * Creates a bucket
     * @param bucketName Name of the new bucket
     * @param cb Callback that will receive the response after creation
     */
    Environment.prototype.createBucket = function (bucketName, cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    /**
     * Deletes a bucket
     * @param bucketId Id whose bucket is going to be deleted
     * @param cb Callback that will receive the response after deletion
     */
    Environment.prototype.deleteBucket = function (bucketId, cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    /**
     * Deletes a file from a bucket
     * @param bucketId Bucket id where file is
     * @param fileId Id of the file to be deleted
     * @param cb Callback that receives the response after deletion
     */
    Environment.prototype.deleteFile = function (bucketId, fileId, cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    /**
     * Lists files in a bucket
     * @param bucketId Bucket id whose files are going to be listed
     * @param cb Callback that receives the files list
     */
    Environment.prototype.listFiles = function (bucketId, cb) {
        /* TODO */
        cb(Error('Not implemented yet'), null);
    };
    Environment.prototype.setEncryptionKey = function (newEncryptionKey) {
        this.config.encryptionKey = newEncryptionKey;
    };
    Environment.prototype.downloadFile = function (bucketId, fileId, options) {
        return download_1.Download(this.config, bucketId, fileId, options).then(function (stream) {
            options.finishedCallback(null);
            return stream_to_blob_1.default(stream, 'application/octet-stream');
        });
    };
    Environment.prototype.uploadFile = function (bucketId, data) {
        var _this = this;
        if (!this.config.encryptionKey) {
            throw new Error('Mnemonic was not provided, please, provide a mnemonic');
        }
        var filename = data.filename, size = data.fileSize, fileContent = data.fileContent, progress = data.progressCallback, finished = data.finishedCallback;
        crypto_1.EncryptFilename(this.config.encryptionKey, bucketId, filename)
            .then(function (name) {
            logger_1.logger.debug("Filename " + filename + " encrypted is " + name);
            var content = blob_to_stream_1.default(fileContent);
            var fileToUpload = { content: content, name: name, size: size };
            upload_1.Upload(_this.config, bucketId, fileToUpload, progress, finished);
        })
            .catch(function (err) {
            logger_1.logger.error("Error encrypting filename due to " + err.message);
            console.error(err);
            finished(err, null);
        });
    };
    /**
     * Downloads a file, returns state object
     * @param bucketId Bucket id where file is
     * @param fileId Id of the file to be downloaded
     * @param filePath File path where the file maybe already is
     * @param options Options for resolve file case
     */
    Environment.prototype.resolveFile = function (bucketId, fileId, filePath, options) {
        if (!options.overwritte && fs.existsSync(filePath)) {
            return options.finishedCallback(new Error('File already exists'));
        }
        var fileStream = fs.createWriteStream(filePath);
        download_1.Download(this.config, bucketId, fileId, options).then(function (stream) {
            console.log('START DUMPING FILE');
            var dump = stream.pipe(fileStream);
            dump.on('error', function (err) {
                console.log('DUMP FILE error', err.message);
                options.finishedCallback(err);
            });
            dump.on('end', function (err) {
                console.log('DUMP FILE END');
                options.finishedCallback(err);
            });
        });
        /* TODO: Returns state object */
        return;
    };
    /**
     * Cancels the upload
     * @param state Download file state at the moment
     */
    Environment.prototype.resolveFileCancel = function (state) {
        throw new Error('Not implemented yet');
    };
    return Environment;
}());
exports.Environment = Environment;
