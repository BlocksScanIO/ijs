"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamRequest = exports.request = void 0;
var axios_1 = __importDefault(require("axios"));
var crypto_1 = require("../lib/crypto");
var stream_1 = require("stream");
var https_1 = __importDefault(require("https"));
var url_1 = __importDefault(require("url"));
function request(config, method, targetUrl, params) {
    return __awaiter(this, void 0, void 0, function () {
        var DefaultOptions, options;
        return __generator(this, function (_a) {
            DefaultOptions = {
                method: method,
                auth: {
                    username: config.bridgeUser,
                    password: crypto_1.sha256(Buffer.from(config.bridgePass)).toString('hex')
                },
                url: targetUrl
            };
            options = __assign(__assign({}, DefaultOptions), params);
            return [2 /*return*/, axios_1.default.request(options)];
        });
    });
}
exports.request = request;
function streamRequest(targetUrl, nodeID) {
    var uriParts = url_1.default.parse(targetUrl);
    var downloader = null;
    function _createDownloadStream() {
        new https_1.default.Agent({ keepAlive: true, keepAliveMsecs: 25000 });
        return https_1.default.get({
            protocol: uriParts.protocol,
            hostname: uriParts.hostname,
            port: uriParts.port,
            path: uriParts.path,
            headers: {
                'content-type': 'application/octet-stream',
                'x-storj-node-id': nodeID
            }
        });
    }
    return new stream_1.Readable({
        read: function () {
            var _this = this;
            if (!downloader) {
                downloader = _createDownloadStream();
                downloader.on('response', function (res) {
                    res
                        .on('data', _this.push.bind(_this))
                        .on('error', _this.emit.bind(_this, 'error'))
                        .on('end', function () {
                        _this.push.bind(_this, null);
                        _this.emit('end');
                    }).on('close', _this.emit.bind(_this, 'close'));
                }).on('error', this.emit.bind(this, 'error'));
            }
        }
    });
}
exports.streamRequest = streamRequest;
