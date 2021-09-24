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
__exportStar(require("./download"), exports);
var OneStreamStrategy_1 = require("./OneStreamStrategy");
Object.defineProperty(exports, "OneStreamStrategy", { enumerable: true, get: function () { return OneStreamStrategy_1.OneStreamStrategy; } });
var MultipleStreamsStrategy_1 = require("./MultipleStreamsStrategy");
Object.defineProperty(exports, "MultipleStreamsStrategy", { enumerable: true, get: function () { return MultipleStreamsStrategy_1.MultipleStreamsStrategy; } });
var EmptyStrategy_1 = require("./EmptyStrategy");
Object.defineProperty(exports, "DownloadEmptyStrategy", { enumerable: true, get: function () { return EmptyStrategy_1.EmptyStrategy; } });
