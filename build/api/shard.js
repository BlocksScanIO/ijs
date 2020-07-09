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
exports.DownloadShard = exports.CheckShard = void 0;
var crypto_1 = require("../lib/crypto");
function DownloadShardRequest(address, port, hash, token, excluded) {
    if (excluded === void 0) { excluded = []; }
    return __awaiter(this, void 0, void 0, function () {
        var excludedNodeIds;
        return __generator(this, function (_a) {
            excludedNodeIds = excluded.join(',');
            return [2 /*return*/, global.fetch("https://api.internxt.com:8081/http://" + address + ":" + port + "/shards/" + hash + "?token=" + token + "&exclude=" + excluded).then(function (res) {
                    if (res.status === 200) {
                        return res.arrayBuffer();
                    }
                    else {
                        throw res;
                    }
                }).catch(function (err) {
                    console.log('ERROR', err.message);
                    return null;
                })];
        });
    });
}
function CheckShard(shard) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
exports.CheckShard = CheckShard;
function DownloadShard(shard) {
    return __awaiter(this, void 0, void 0, function () {
        var hasher, shardBinary, rmdDigest, finalShardHashBin, finalShardHash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(shard);
                    hasher = crypto_1.sha256HashBuffer();
                    return [4 /*yield*/, DownloadShardRequest(shard.farmer.address, shard.farmer.port, shard.hash, shard.token)];
                case 1:
                    shardBinary = _a.sent();
                    if (shardBinary !== null)
                        hasher.update(Buffer.from(shardBinary));
                    rmdDigest = hasher.digest();
                    finalShardHashBin = crypto_1.ripemd160(rmdDigest);
                    finalShardHash = Buffer.from(finalShardHashBin).toString('hex');
                    console.log('SHARD %s: Is hash ok = %s', shard.index, finalShardHash === shard.hash);
                    // console.log('SHARD %s length: %s', shard.index, shardBinary.length)
                    // TODO create exange report
                    return [2 /*return*/, Buffer.from(shardBinary ? shardBinary : '')];
            }
        });
    });
}
exports.DownloadShard = DownloadShard;
