"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadFile = void 0;
var stream_1 = __importDefault(require("stream"));
var DownloadFile = /** @class */ (function (_super) {
    __extends(DownloadFile, _super);
    function DownloadFile() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return DownloadFile;
}(stream_1.default.Transform));
exports.DownloadFile = DownloadFile;
