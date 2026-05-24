/*************************************************************************
 * Audio Plugin — ExtendScript Backend
 * Communication: evalScript return value (primary) + CSXSEvent (async push)
 * Pattern: Adobe LABOR extension style — return JSON strings from functions
 **************************************************************************/

// Silence top-level errors from JSX loading (app may not be ready yet)
try {
    if (typeof app !== 'undefined' && app && app.setSDKEventMessage) {
        app.setSDKEventMessage('JSX_LOADED', 'info');
    }
} catch (e) {}

// Minimal JSON-like serialization without relying on JSON object
function simpleStringify(obj) {
    if (typeof obj === 'string') {
        var s = obj;
        try { s = encodeURIComponent(obj); } catch (e) {}
        return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj === null || obj === undefined) return 'null';
    if (obj instanceof Array) {
        var parts = [];
        for (var i = 0; i < obj.length; i++) parts.push(simpleStringify(obj[i]));
        return '[' + parts.join(',') + ']';
    }
    var pairs = [];
    for (var k in obj) {
        if (obj.hasOwnProperty && !obj.hasOwnProperty(k)) continue;
        pairs.push('"' + k + '":' + simpleStringify(obj[k]));
    }
    return '{' + pairs.join(',') + '}';
}

$._AUDIO_PLUGIN_ = {
    config: null,
    importedFileMap: {},
    pluginRoot: null,

    // Async push to panel — only for events AFTER panel is listening
    _sendToPanel: function (action, data) {
        var msg = simpleStringify({ action: action, data: data || {} });
        try {
            var plugplugLibrary = new ExternalObject('lib:PlugPlugExternalObject');
            if (plugplugLibrary) {
                var eventObj = new CSXSEvent();
                eventObj.type = 'audioPluginEvent';
                eventObj.data = msg;
                eventObj.dispatch();
            }
        } catch (e) {}
    },

    // Called by panel via evalScript — returns JSON string via callback
    init: function () {
        try {
            // Derive plugin root from $.fileName only if not already set
            if (!this.pluginRoot) {
                try {
                    var scriptFile = new File($.fileName);
                    if (scriptFile && scriptFile.parent && scriptFile.parent.parent) {
                        this.pluginRoot = String(scriptFile.parent.parent.fsName);
                    }
                } catch (ePath) {}
            }
            // Hard fallback
            if (!this.pluginRoot) {
                this.pluginRoot = '/Users/zsc/Documents/Code_s/ExtendScript/Audio';
            }

            // Read config
            var configPath = this.pluginRoot + '/config/categories.json';
            var configFile = new File(configPath);
            if (configFile.exists) {
                configFile.open('r');
                var content = configFile.read();
                configFile.close();
                this.config = eval('(' + content + ')');
            }

            // Return result as JSON string for evalScript callback
            return simpleStringify({
                status: 'initialized',
                pluginRoot: this.pluginRoot,
                configLoaded: !!this.config,
                config: this.config
            });
        } catch (e) {
            return simpleStringify({ error: 'INIT_ERROR: ' + e.toString() });
        }
    },

    // Called by panel via evalScript — returns JSON string with file list
    getAudioFilesForCategory: function (categoryKey, subKey) {
        try {
            if (!this.config) {
                return simpleStringify({ error: 'Config not loaded' });
            }
            // Find sub in config
            var cat = null, sub = null;
            for (var i = 0; i < this.config.categories.length; i++) {
                if (this.config.categories[i].key === categoryKey) {
                    cat = this.config.categories[i];
                    for (var j = 0; j < cat.subs.length; j++) {
                        if (cat.subs[j].key === subKey) {
                            sub = cat.subs[j];
                            break;
                        }
                    }
                    break;
                }
            }
            if (!cat || !sub) {
                return simpleStringify({ error: 'Category not found' });
            }

            var audioBase = this.pluginRoot;
            if (this.config.audioBasePath && this.config.audioBasePath.indexOf('./') === 0) {
                audioBase += '/' + this.config.audioBasePath.substring(2);
            } else {
                audioBase += '/audio_files';
            }
            var scanPath = audioBase + '/' + cat.label + '/' + sub.folderName;
            var folder = new Folder(scanPath);
            var files = [];

            if (folder.exists) {
                var rawFiles = folder.getFiles();
                for (var i = 0; i < rawFiles.length; i++) {
                    var f = rawFiles[i];
                    if (f instanceof File) {
                        files.push({
                            fileName: f.name,
                            filePath: String(f.fsName),
                            displayName: f.name.replace(/\.[^.]+$/, ''),
                            durationLabel: sub.label,
                            isImported: !!this.importedFileMap[String(f.fsName)]
                        });
                    }
                }
            }

            return simpleStringify({
                categoryKey: categoryKey,
                subKey: subKey,
                categoryLabel: cat.label,
                subLabel: sub.label,
                files: files
            });
        } catch (e) {
            return simpleStringify({ error: 'GET_FILES_ERROR: ' + e.toString() });
        }
    },

    previewAudio: function (filePath) {
        try {
            var property = 'BE.Prefs.Audio.AutoPeakGeneration';
            var initialValue = app.properties.getProperty(property);
            if (initialValue === 'true') app.properties.setProperty(property, 'false', 1, true);
            app.sourceMonitor.openFilePath(filePath);
            if (initialValue === 'true') app.properties.setProperty(property, initialValue, 1, true);
            app.sourceMonitor.play(1.0);
            this._sendToPanel('previewStarted', { filePath: filePath });
        } catch (e) {
            this._sendToPanel('error', { message: 'Preview: ' + e.toString() });
        }
    },

    stopPreview: function () {
        try {
            app.sourceMonitor.closeClip();
            this._sendToPanel('previewStopped', {});
        } catch (e) {
            this._sendToPanel('error', { message: 'Stop: ' + e.toString() });
        }
    },

    importAudio: function (filePath) {
        try {
            var targetBin = null;
            var searchBin = function (bin, name) {
                if (!bin || !bin.children) return null;
                for (var i = 0; i < bin.children.numItems; i++) {
                    var child = bin.children[i];
                    if (!child) continue;
                    if (child.type === 2 && child.name === name) return child;
                    if (child.type === 2) {
                        var found = searchBin(child, name);
                        if (found) return found;
                    }
                }
                return null;
            };
            targetBin = searchBin(app.project.rootItem, 'Audio Plugin Imports');
            if (!targetBin) targetBin = app.project.rootItem.createBin('Audio Plugin Imports');
            app.project.importFiles([filePath], true, targetBin, false);

            var importedItem = null;
            for (var i = 0; i < targetBin.children.numItems; i++) {
                try {
                    if (targetBin.children[i].getMediaPath && targetBin.children[i].getMediaPath() === filePath) {
                        importedItem = targetBin.children[i];
                        break;
                    }
                } catch (e2) {}
            }
            if (!importedItem && targetBin.children.numItems > 0) {
                importedItem = targetBin.children[targetBin.children.numItems - 1];
            }
            if (importedItem) this.importedFileMap[filePath] = importedItem;

            this._sendToPanel('audioImported', {
                filePath: filePath,
                projectItemName: importedItem ? importedItem.name : '',
                success: true
            });
        } catch (e) {
            this._sendToPanel('error', { message: 'Import: ' + e.toString() });
        }
    },

    insertAudioAtPlayhead: function (filePath) {
        try {
            var seq = app.project.activeSequence;
            if (!seq) { this._sendToPanel('error', { message: 'No active sequence' }); return; }
            var item = this.importedFileMap[filePath];
            if (!item) { this._sendToPanel('error', { message: 'Not imported yet' }); return; }
            if (seq.audioTracks.numTracks === 0) { this._sendToPanel('error', { message: 'No audio tracks' }); return; }
            var playhead = seq.getPlayerPosition();
            seq.audioTracks[0].insertClip(item, playhead.seconds);
            this._sendToPanel('audioInserted', {
                filePath: filePath,
                itemName: item.name,
                time: String(playhead.seconds)
            });
        } catch (e) {
            this._sendToPanel('error', { message: 'Insert: ' + e.toString() });
        }
    },

    scanProjectForImportedAudio: function () {
        this.importedFileMap = {};
        if (!app.project) return;
        var self = this;
        var scan = function (bin) {
            if (!bin || !bin.children) return;
            for (var i = 0; i < bin.children.numItems; i++) {
                var child = bin.children[i];
                if (!child) continue;
                if (child.type === 2) { scan(child); continue; }
                try {
                    if (child.getMediaPath) {
                        var mp = child.getMediaPath();
                        if (mp) self.importedFileMap[mp] = child;
                    }
                } catch (e) {}
            }
        };
        scan(app.project.rootItem);
        this._sendToPanel('importStateUpdated', { count: Object.keys(this.importedFileMap).length });
    },

    loadConfig: function () {
        if (this.config) {
            this._sendToPanel('configLoaded', this.config);
        }
    },

    // ──────────────────────────────────────────────
    // Download audio from cloud URL to local temp
    // ──────────────────────────────────────────────
    _downloadToTemp: function (url) {
        try {
            var tempDir = new Folder(Folder.temp.fsName + '/audio_plugin_cache');
            if (!tempDir.exists) tempDir.create();

            // Extract filename from URL
            var urlPath = url.split('?')[0];
            var parts = urlPath.split('/');
            var fileName = parts[parts.length - 1];
            if (!fileName || fileName.length < 4) {
                fileName = 'download_' + (new Date()).getTime() + '.mp3';
            }
            var localPath = tempDir.fsName + '/' + fileName;

            // Use ExtendScript Socket for HTTP GET
            var socket = new Socket();
            var urlClean = url.replace('https://', '').replace('http://', '');
            var hostEnd = urlClean.indexOf('/');
            var host = urlClean.substring(0, hostEnd);
            var path = urlClean.substring(hostEnd);

            if (socket.open(host + ':443', 'UTF-8')) {
                socket.write('GET ' + path + ' HTTP/1.1\r\n' +
                    'Host: ' + host + '\r\n' +
                    'Connection: close\r\n\r\n');
                var response = socket.read(9999999);
                socket.close();

                var bodyStart = response.indexOf('\r\n\r\n');
                if (bodyStart >= 0) {
                    var body = response.substring(bodyStart + 4);
                    var localFile = new File(localPath);
                    localFile.open('w');
                    localFile.encoding = 'BINARY';
                    localFile.write(body);
                    localFile.close();
                    return localPath;
                }
            }
            return null;
        } catch (e) {
            this._sendToPanel('error', { message: 'Download error: ' + e.toString() });
            return null;
        }
    },

    downloadAndPreview: function (url) {
        try {
            var localPath = this._downloadToTemp(url);
            if (!localPath) {
                this._sendToPanel('error', { message: '音频下载失败' });
                return;
            }
            this.previewAudio(localPath);
        } catch (e) {
            this._sendToPanel('error', { message: 'Download+Preview: ' + e.toString() });
        }
    },

    downloadAndImport: function (url) {
        try {
            var localPath = this._downloadToTemp(url);
            if (!localPath) {
                this._sendToPanel('error', { message: '音频下载失败' });
                return;
            }
            this.importAudio(localPath);
        } catch (e) {
            this._sendToPanel('error', { message: 'Download+Import: ' + e.toString() });
        }
    },

    downloadAndInsert: function (url) {
        try {
            var localPath = this._downloadToTemp(url);
            if (!localPath) {
                this._sendToPanel('error', { message: '音频下载失败' });
                return;
            }
            this.importAudio(localPath);
            // Small delay to let import complete before insert
            $.sleep(500);
            this.insertAudioAtPlayhead(localPath);
        } catch (e) {
            this._sendToPanel('error', { message: 'Download+Insert: ' + e.toString() });
        }
    }
};

// Do NOT auto-init — panel will call init() via evalScript when ready
