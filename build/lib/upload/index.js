"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./upload"), exports);
var OneStreamStrategy_1 = require("./OneStreamStrategy");
Object.defineProperty(exports, "OneStreamStrategy", { enumerable: true, get: function () { return OneStreamStrategy_1.OneStreamStrategy; } });
var StreamsFileSystemStrategy_1 = require("./StreamsFileSystemStrategy");
Object.defineProperty(exports, "StreamFileSystemStrategy", { enumerable: true, get: function () { return StreamsFileSystemStrategy_1.StreamFileSystemStrategy; } });
