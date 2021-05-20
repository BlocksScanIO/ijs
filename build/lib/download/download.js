"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Download = void 0;
var FileObject_1 = require("../../api/FileObject");
var stream_1 = require("stream");
var events_1 = require("../events");
var rs_wrapper_1 = require("rs-wrapper");
var logger_1 = require("../utils/logger");
var buffer_1 = require("../utils/buffer");
function Download(config, bucketId, fileId, options) {
    return __awaiter(this, void 0, void 0, function () {
        var File, shards, shardSize, parities, totalSize, out, fileContent, fileEncryptedStream, buffs;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.encryptionKey) {
                        throw Error('Encryption key required');
                    }
                    File = new FileObject_1.FileObject(config, bucketId, fileId);
                    logger_1.logger.info('Retrieving file info...');
                    return [4 /*yield*/, File.GetFileInfo()];
                case 1:
                    _a.sent();
                    logger_1.logger.info('Retrieving mirrors...');
                    return [4 /*yield*/, File.GetFileMirrors()];
                case 2:
                    _a.sent();
                    shards = File.rawShards.filter(function (s) { return !s.parity; }).length;
                    shardSize = File.rawShards[0].size;
                    console.log('shardSize', shardSize);
                    parities = File.rawShards.length - shards;
                    logger_1.logger.info('Found %s shards and %s parities', shards, parities);
                    totalSize = File.final_length;
                    out = new stream_1.Transform({
                        transform: function (chunk, enc, cb) {
                            if (chunk.length > totalSize) {
                                cb(null, chunk.slice(0, totalSize));
                            }
                            else {
                                totalSize -= chunk.length;
                                cb(null, chunk);
                            }
                        }
                    });
                    logger_1.logger.info('File size is %s bytes', totalSize);
                    out.on('error', function (err) { throw err; });
                    attachFileObjectListeners(File, out);
                    handleFileResolving(File, options.progressCallback, options.decryptionProgressCallback);
                    fileContent = Buffer.alloc(0);
                    logger_1.logger.info('Starting file download');
                    return [4 /*yield*/, File.StartDownloadFile2()];
                case 3:
                    fileEncryptedStream = _a.sent();
                    console.log('I HAVE THE STREAM UNIFIED HERE', fileEncryptedStream);
                    buffs = [];
                    fileEncryptedStream.on('data', function (chunk) { buffs.push(chunk); });
                    return [2 /*return*/, new Promise(function (resolve, reject) {
                            fileEncryptedStream.on('error', reject);
                            fileEncryptedStream.on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                                var rs, passThrough, shardsStatus, nCorruptShards, fileContentRecovered, err_1;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            fileContent = Buffer.concat(buffs);
                                            logger_1.logger.info('File download finished. File encrypted length is %s bytes', fileContent.length);
                                            rs = File.fileInfo && File.fileInfo.erasure && ((_a = File.fileInfo) === null || _a === void 0 ? void 0 : _a.erasure.type) === 'reedsolomon';
                                            passThrough = null;
                                            shardsStatus = File.rawShards.map(function (shard) { return shard.healthy; });
                                            shardsStatus = shardsStatus && shardsStatus.length > 0 ? shardsStatus : [false];
                                            // =========== CORRUPT INTENTIONALLY
                                            // shardsStatus[0] = false;
                                            // fileContent = Buffer.concat([Buffer.alloc(shardSize).fill(0), fileContent.slice(shardSize)])
                                            // ===========
                                            setInterval(function () {
                                                console.log('still alive');
                                            }, 20000);
                                            nCorruptShards = shardsStatus.map(function (shardStatus) { return !shardStatus; }).length;
                                            if (!(nCorruptShards > 0)) return [3 /*break*/, 5];
                                            if (!rs) return [3 /*break*/, 4];
                                            logger_1.logger.info('Some shard(s) is/are corrupt and rs is available. Recovering');
                                            _b.label = 1;
                                        case 1:
                                            _b.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, rs_wrapper_1.reconstruct(fileContent, shards, parities, shardsStatus)];
                                        case 2:
                                            fileContentRecovered = _b.sent();
                                            passThrough = buffer_1.bufferToStream(Buffer.from(fileContentRecovered.slice(0, totalSize)));
                                            return [2 /*return*/, resolve(passThrough.pipe(File.decipher).pipe(out))];
                                        case 3:
                                            err_1 = _b.sent();
                                            logger_1.logger.error('File download error, reason: %s', err_1.message);
                                            if (err_1.message !== 'RESULT_ERROR_TOO_FEW_SHARDS_PRESENT') {
                                                return [2 /*return*/, reject(err_1)];
                                            }
                                            return [3 /*break*/, 4];
                                        case 4:
                                            reject(new Error(nCorruptShards + " file shard(s) is/are corrupt"));
                                            return [3 /*break*/, 6];
                                        case 5:
                                            logger_1.logger.info('Reed solomon not required for this file');
                                            _b.label = 6;
                                        case 6: return [2 /*return*/, resolve(buffer_1.bufferToStream(fileContent).pipe(File.decipher).pipe(out))];
                                    }
                                });
                            }); });
                        })];
            }
        });
    });
}
exports.Download = Download;
// TODO: use propagate lib
function attachFileObjectListeners(f, notified) {
    // propagate events to notified
    f.on(events_1.FILEMUXER.PROGRESS, function (msg) { return notified.emit(events_1.FILEMUXER.PROGRESS, msg); });
    // TODO: Handle filemuxer errors
    f.on(events_1.FILEMUXER.ERROR, function (err) { return notified.emit(events_1.FILEMUXER.ERROR, err); });
    // TODO: Handle fileObject errors
    f.on('error', function (err) { return notified.emit(events_1.FILEOBJECT.ERROR, err); });
    // f.on('end', () => notified.emit(FILEOBJECT.END))
    // f.decipher.on('end', () => notified.emit(DECRYPT.END))
    f.decipher.once('error', function (err) { return notified.emit(events_1.DECRYPT.ERROR, err); });
}
function handleFileResolving(fl, downloadCb, decryptionCb) {
    var _this = this;
    var totalBytesDownloaded = 0, totalBytesDecrypted = 0;
    var progress = 0;
    var totalBytes = fl.rawShards.length > 0 ?
        fl.rawShards.reduce(function (a, b) { return ({ size: a.size + b.size }); }, { size: 0 }).size :
        0;
    function getDownloadProgress() {
        return (totalBytesDownloaded / totalBytes) * 100;
    }
    function getDecryptionProgress() {
        return (totalBytesDecrypted / totalBytes) * 100;
    }
    fl.on(events_1.DOWNLOAD.PROGRESS, function (addedBytes) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            totalBytesDownloaded += addedBytes;
            progress = getDownloadProgress();
            downloadCb(progress, totalBytesDownloaded, totalBytes);
            return [2 /*return*/];
        });
    }); });
    if (decryptionCb) {
        fl.on(events_1.DECRYPT.PROGRESS, function (addedBytes) {
            totalBytesDecrypted += addedBytes;
            progress = getDecryptionProgress();
            decryptionCb(progress, totalBytesDecrypted, totalBytes);
        });
    }
}
