"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _CDPlayer_context, _CDPlayer_config, _CDPlayer_logger, _CDPlayer_commandRouter, _CDPlayer_configManager;
var libQ = require("kew");
const { listCD, pRetry, detectCdDevice, applyDiscIdToItems, ejectTray, } = require("../lib/utils");
const { fetchCdMetadata, decorateItems, getAlbumartUrl, } = require("../lib/metadata");
const { getSocket } = require("../lib/socket");
const { createTrayWatcher, onEject } = require("../lib/tray-watcher");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);
class CDPlayer {
    constructor(context) {
        _CDPlayer_context.set(this, void 0);
        _CDPlayer_config.set(this, void 0);
        _CDPlayer_logger.set(this, void 0);
        _CDPlayer_commandRouter.set(this, void 0);
        _CDPlayer_configManager.set(this, void 0);
        this._items = null;
        this._trayWatcher = null;
        this._discIdentifier = Date.now();
        __classPrivateFieldSet(this, _CDPlayer_context, context, "f");
        __classPrivateFieldSet(this, _CDPlayer_commandRouter, context.coreCommand, "f");
        __classPrivateFieldSet(this, _CDPlayer_logger, context.logger, "f");
        __classPrivateFieldSet(this, _CDPlayer_configManager, context.configManager, "f");
        this._items = null;
        this._trayWatcher = null;
        this._discIdentifier = Date.now();
    }
    log(msg) {
        __classPrivateFieldGet(this, _CDPlayer_logger, "f").info(`[CDPlayer]: ${msg}`);
    }
    error(err) {
        __classPrivateFieldGet(this, _CDPlayer_logger, "f").error(`[CDPlayer]: ${err}`);
    }
}
_CDPlayer_context = new WeakMap(), _CDPlayer_config = new WeakMap(), _CDPlayer_logger = new WeakMap(), _CDPlayer_commandRouter = new WeakMap(), _CDPlayer_configManager = new WeakMap();
module.exports = CDPlayer;
//# sourceMappingURL=index.js.map