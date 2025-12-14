"use strict";
var libQ = require("kew");
const {
  listCD,
  pRetry,
  detectCdDevice,
  applyDiscIdToItems,
  ejectTray,
} = require("../lib/utils");
const {
  fetchCdMetadata,
  decorateItems,
  getAlbumartUrl,
} = require("../lib/metadata");
const { getSocket } = require("../lib/socket");
const { createTrayWatcher, onEject } = require("../lib/tray-watcher");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

interface CDTrack {
  album: string;
  artist: string;
  title: string;
  name: string;
  trackType: string;
  type: string;
  service: string;
  uri: string;
  duration: number;
}

class CDPlayer {
  #context: any;
  #config: any;
  #logger: any;
  #commandRouter: any;
  #configManager: any;

  _items: CDTrack[] | null = null;
  _trayWatcher: any | null = null;
  _discIdentifier: number = Date.now();

  constructor(context: any) {
    this.#context = context;
    this.#commandRouter = context.coreCommand;
    this.#logger = context.logger;
    this.#configManager = context.configManager;

    this._items = null;
    this._trayWatcher = null;
    this._discIdentifier = Date.now();
  }

  log(msg: string) {
    this.#logger.info(`[CDPlayer]: ${msg}`);
  }

  error(err: string) {
    this.#logger.error(`[CDPlayer]: ${err}`);
  }
}

export = CDPlayer;
