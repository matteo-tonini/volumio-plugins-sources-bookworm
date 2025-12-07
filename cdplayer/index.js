/// <reference path="./types.js" />
"use strict";
var libQ = require("kew");
const {
  listCD,
  pRetry,
  detectCdDevice,
  applyDiscIdToItems,
} = require("./lib/utils");
const {
  fetchCdMetadata,
  decorateItems,
  getAlbumartUrl,
} = require("./lib/metadata");
const { createTrayWatcher } = require("./lib/tray-watcher");
const { promisify } = require("util");
const { exec } = require("child_process");
const execAsync = promisify(exec);

module.exports = cdplayer;

const SERVICE_FILE = "cdplayer_stream.service";
const CD_HTTP_BASE_URL = "http://127.0.0.1:8088/wav/track/";
const DEFAULT_COVERART_URL =
  "/albumart?sourceicon=music_service/cdplayer/cdplayer.png";

function cdplayer(context) {
  var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;

  /** @type {CdTrack[]|null} */
  this._items = null;
  /** @type {TrayWatcher|null} */
  this._trayWatcher = null;
  /** @type {number} */
  this._discIdentifier = Date.now();
}

cdplayer.prototype.log = function (msg) {
  var self = this;
  self.logger.info(`[CDPlayer]: ${msg}`);
};

cdplayer.prototype.error = function (err) {
  var self = this;
  self.logger.error(`[CDPlayer]: ${err}`);
};

cdplayer.prototype.onVolumioStart = function () {
  var self = this;
  self.log("onVolumioStart");
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(
    this.context,
    "config.json"
  );
  this.config = new (require("v-conf"))();
  this.config.loadFile(configFile);

  return libQ.resolve();
};

cdplayer.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();
  self.log("onStart");
  self.addToBrowseSources(DEFAULT_COVERART_URL);

  self.log("onStart, starting Daemon service");
  execAsync(`sudo /bin/systemctl enable --now ${SERVICE_FILE}`)
    .then(() => self.log("Daemon service started"))
    .catch((err) => self.error("Failed to start Daemon: " + err.message))
    .finally(() => defer.resolve());

  try {
    self.log(
      "onStart, starting Tray watcher. Is running: " +
        (self._trayWatcher ? self._trayWatcher.isRunning() : "no tray watcher")
    );
    if (!self._trayWatcher || !self._trayWatcher.isRunning()) {
      const device = detectCdDevice();
      self.log("Detected CD device: " + device);
      const trayConfig = getTrayWatcherConfiguration(self, device);
      // self.log(
      //   "Tray watcher configuration: " + JSON.stringify(trayConfig, null, 2)
      // );
      self._trayWatcher = createTrayWatcher(trayConfig);
      self.log("Starting Tray watcher");
      self._trayWatcher.start();
    }
  } catch (e) {
    self.error("Tray watcher failed to start: " + e.message);
  }

  return defer.promise;
};

cdplayer.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();
  self.log("onStop");
  self._items = null;
  self._discIdentifier = Date.now();
  self.removeToBrowseSources();
  self.log("onStop, stopping Daemon service");
  execAsync(`sudo /bin/systemctl disable --now ${SERVICE_FILE}`)
    .then(() => self.log("Daemon service stopped"))
    .catch((err) => self.error("Failed to stop Daemon: " + err.message))
    .finally(() => defer.resolve());

  self.log(
    "onStop, stopping Tray watcher. trayWatcher: Is running: " +
      (self._trayWatcher ? self._trayWatcher.isRunning() : "no tray watcher")
  );
  if (self._trayWatcher) {
    self.log("Stopping existing Tray watcher");
    self._trayWatcher.stop();
  }
  return defer.promise;
};

cdplayer.prototype.onRestart = function () {
  var self = this;
  var defer = libQ.defer();
  self._items = null;
  self._discIdentifier = Date.now();

  self.log("onRestart, restarting Daemon service");
  execAsync(`sudo /bin/systemctl restart ${SERVICE_FILE}`)
    .then(() => self.log("Daemon service restarted"))
    .catch((err) => self.error("Failed to restart Daemon: " + err.message))
    .finally(() => defer.resolve());

  try {
    self.log(
      "onRestart, restarting Tray watcher. IS running: " +
        (self._trayWatcher ? self._trayWatcher.isRunning() : "no tray watcher")
    );
    if (self._trayWatcher) {
      self.log("Stopping existing Tray watcher");
      self._trayWatcher.stop();
    }
    const device = detectCdDevice();
    self.log("Detected CD device: " + device);
    const trayConfig = getTrayWatcherConfiguration(self, device);
    self.log(
      "Tray watcher configuration: " + JSON.stringify(trayConfig, null, 2)
    );
    self._trayWatcher = createTrayWatcher(trayConfig);
    self.log("Starting Tray watcher");
    self._trayWatcher.start();
    self.log("Tray watcher restarted");
  } catch (e) {
    self.error("Tray watcher failed to start: " + e.message);
  }

  return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

cdplayer.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;

  var lang_code = this.commandRouter.sharedVars.get("language_code");

  self.commandRouter
    .i18nJson(
      __dirname + "/i18n/strings_" + lang_code + ".json",
      __dirname + "/i18n/strings_en.json",
      __dirname + "/UIConfig.json"
    )
    .then(function (uiconf) {
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};

cdplayer.prototype.getConfigurationFiles = function () {
  return ["config.json"];
};

cdplayer.prototype.setUIConfig = function (data) {
  var self = this;
  //Perform your installation tasks here
};

cdplayer.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};

cdplayer.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it

cdplayer.prototype.addToBrowseSources = function (albumart) {
  const self = this;
  var data = {
    name: "CDPlayer",
    uri: "cdplayer",
    plugin_type: "music_service",
    plugin_name: "cdplayer",
    albumart,
  };
  self.log(
    "Adding CDPlayer to Browse Sources wirth albumart: " +
      JSON.stringify(data, null, 2)
  );
  this.commandRouter.volumioAddToBrowseSources(data);
};

cdplayer.prototype.removeToBrowseSources = function () {
  const self = this;
  self.log("Removing CDPlayer from Browse Sources");
  self.commandRouter.volumioRemoveToBrowseSources("CDPlayer");
};

cdplayer.prototype.handleBrowseUri = function (curUri) {
  const self = this;

  if (curUri !== "cdplayer") {
    self.log("handleBrowseUri called with non-cdplayer URI: " + curUri);
    return libQ.resolve(null);
  }

  if (self._items) {
    self.log("Using cached CD track list");
    return libQ.resolve({
      navigation: {
        prev: { uri: "cdplayer" },
        lists: [
          {
            title: self._items[0]?.album || "CD Tracks",
            icon: "fa fa-music",
            availableListViews: ["list"],
            items: self._items,
          },
        ],
      },
    });
  }

  const p = (async () => {
    try {
      const items = await listCD();

      if (items.length === 0) {
        self.error("No audio tracks returned");
        self.commandRouter.pushToastMessage(
          "error",
          "CD Player",
          "Please insert an audio CD"
        );
        return { navigation: { lists: [] } };
      }

      const meta = await fetchCdMetadata();
      self.log("Fetched CD metadata: " + JSON.stringify(meta, null, 2));
      let decoratedItems = items;
      if (meta) {
        // eg. https://coverartarchive.org/release/2174675c-2159-4405-a3af-3a4860106b58/front
        const albumart = await getAlbumartUrl(meta.releaseId);
        self.log("Fetched album art URL: " + JSON.stringify(albumart, null, 2));
        decoratedItems = decorateItems(
          items,
          meta,
          albumart || DEFAULT_COVERART_URL
        );
        self.log("Updating browse sources with new album art");
        self.removeToBrowseSources();
        self.addToBrowseSources(albumart || DEFAULT_COVERART_URL);
      } else {
        self.log("No CD metadata found, retrying in background");
        void retryFetchMetadata(items, self);
      }

      const itemsWithDiscUri = applyDiscIdToItems(
        decoratedItems,
        self._discIdentifier
      );
      self.log("Applied disc identifier to items");

      self._items = itemsWithDiscUri;
      self.log(
        "Updated internal items cache" + JSON.stringify(self._items, null, 2)
      );

      return {
        navigation: {
          prev: { uri: "cdplayer" },
          lists: [
            {
              title: meta?.album || "CD Tracks",
              icon: "fa fa-music",
              availableListViews: ["list"],
              items: itemsWithDiscUri,
            },
          ],
        },
      };
    } catch (err) {
      self.error(`Error while listing CD tracks`);
      self.commandRouter.pushToastMessage(
        "error",
        "CD Player",
        "Error while listing CD tracks"
      );
      return { navigation: { lists: [] } };
    }
  })();

  return toKew(p);
};

cdplayer.prototype.explodeUri = function (uri) {
  const self = this;
  const defer = libQ.defer();

  const match = uri.match(/^cdplayer\/(\d+)(?:\?.*)?$/);
  if (match) {
    const n = parseInt(match[1], 10);
    self.log("explodeUri called with track number: " + n);
    const track = {
      ...self._items[n - 1],
      service: "mpd",
      uri: `${CD_HTTP_BASE_URL}${n}?disc=${self._discIdentifier}`,
    };
    self.log("Exploding URI to track: " + JSON.stringify(track, null, 2));
    defer.resolve([track]);
    return defer.promise;
  } else {
    self.log("explodeUri called with invalid URI: " + uri);
  }

  defer.resolve([]);
  return defer.promise;
};

cdplayer.prototype.search = function (query) {
  const self = this;
  const defer = libQ.defer();

  if (!self._items) {
    defer.resolve(null);
    return defer.promise;
  }

  if (!query || !query.value) {
    defer.resolve(null);
    return defer.promise;
  }

  try {
    const resultItems = getResultItems(self._items, query.value);
    const list = [
      {
        type: "title",
        title: "Search results",
        availableListViews: ["list"],
        items: resultItems,
      },
    ];

    defer.resolve(list);
  } catch (err) {
    self.error(`[CDPlayer] Search error: ${err.message}`);
    defer.reject(err);
  }

  return defer.promise;
};

/**
 * Filters CD tracks based on a query string.
 * Matches are case-insensitive and partial (substring-based).
 *
 * @param {CdTrack[]} items - Array of track objects.
 * @param {string} query - The search query.
 * @returns {CdTrack[]} Filtered array of matching tracks.
 */
function getResultItems(items, query) {
  if (!items || !Array.isArray(items) || !query) return [];

  const q = query.trim().toLowerCase();

  return items.filter((item) => {
    const titleMatch = item.title?.toLowerCase().includes(q);
    const artistMatch = item.artist?.toLowerCase().includes(q);
    const albumMatch = item.album?.toLowerCase().includes(q);
    return titleMatch || artistMatch || albumMatch;
  });
}

function retryFetchMetadata(items, self) {
  pRetry(
    async () => {
      const meta = await fetchCdMetadata();
      self.log("Fetched CD metadata: " + JSON.stringify(meta, null, 2));
      if (!meta) {
        // If null, we force a retry
        throw new Error("CD metadata unavailable");
      }

      // If metadata retrieved:
      const albumart = await getAlbumartUrl(meta.releaseId);
      self.log("Fetched album art URL: " + JSON.stringify(albumart, null, 2));
      const decoratedItems = decorateItems(
        items,
        meta,
        albumart || DEFAULT_COVERART_URL
      );
      self.log(
        "Updating browse sources with new album art: " +
          (albumart || DEFAULT_COVERART_URL)
      );
      self.removeToBrowseSources();
      self.addToBrowseSources(albumart || DEFAULT_COVERART_URL);

      self._items = applyDiscIdToItems(decoratedItems, self._discIdentifier);
      self.log(
        "Updated internal items cache" + JSON.stringify(self._items, null, 2)
      );
    },
    {
      delay: 700,
      maxAttempts: 3,
      logger: self,
      name: "CD metadata fetch",
    }
  ).catch((err) => {
    // This is ONLY the last retry failure.
    self.error(
      "CD metadata fetch failed after retries: " +
        (err && err.stack ? err.stack : err)
    );
    // Do NOT rethrow – swallow the error so the plugin continues
  });
}

function toKew(promise) {
  const d = libQ.defer();
  let settled = false;
  Promise.resolve(promise)
    .then((val) => {
      if (!settled) {
        settled = true;
        d.resolve(val);
      }
    })
    .catch((err) => {
      if (!settled) {
        settled = true;
        d.reject(err);
      }
    });
  return d.promise;
}

/**
 * Build configuration object for tray watcher.
 * Extracted to keep onStart concise.
 * @param {any} self Plugin instance (for logging & callbacks)
 * @param {string|null} device Detected device path
 * @returns {TrayWatcherOptions}
 */
function getTrayWatcherConfiguration(self, device) {
  return {
    logger: self,
    device,
    onEvent: function () {},
    onEject: function () {
      self.log("Eject detected ... ");
      // Drop CD track cache so next browse forces a re-scan
      self._items = null;
      // Bump disc identifier to avoid caching issues
      self._discIdentifier = Date.now();

      try {
        const state = self.commandRouter.volumioGetState();

        const isCdStream =
          state &&
          state.service === "mpd" &&
          typeof state.uri === "string" &&
          state.uri.indexOf(CD_HTTP_BASE_URL) === 0;

        if (isCdStream) {
          self.log("Stopping CD playback due to eject event");
          self.commandRouter.volumioStop();
          self.commandRouter.volumioClearQueue();
        }
      } catch (e) {
        self.log("Error stopping playback on eject: " + e.message);
      }

      // Refresh browse source so albumart resets to the default icon
      try {
        self.removeToBrowseSources();
        self.addToBrowseSources(DEFAULT_COVERART_URL);
      } catch (e) {
        self.log("Error refreshing browse sources after eject: " + e.message);
      }
    },
  };
}
