/*************************************************************************
 * Audio Plugin — Panel JavaScript (CEF / HTML5)
 * Primary data: evalScript callback (return value)
 * Async events: CSXSEvent listener (for push notifications after panel open)
 **************************************************************************/

var csInterface = null;

// ── API Configuration ──
var API_BASE = 'https://your-uniCloud-space.service.tcloudbase.com';
var auth = {
    token: localStorage.getItem('audio_plugin_token') || null,
    user: null
};

// ── HTTP helpers ──
function apiRequest(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (auth.token) {
        headers['Authorization'] = 'Bearer ' + auth.token;
    }
    headers['Content-Type'] = 'application/json';
    return fetch(API_BASE + path, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function(res) {
        if (!res.ok) throw new Error('API error: ' + res.status);
        return res.json();
    });
}

var APP = {
    config: null,
    activeCategory: null,
    activeSub: null,
    audioFiles: [],
    isConnected: false,
    expandedCategories: {}
};

// DOM helpers
var $ = function (id) { return document.getElementById(id); };
var DOM = {
    statusDot: $('connection-status'),
    searchInput: $('search-input'),
    categoryTree: $('category-tree'),
    listTitle: $('list-title'),
    listCount: $('list-count'),
    audioList: $('audio-list'),
    statusBar: $('status-bar'),
    statusText: $('status-text')
};

// ──────────────────────────────────────────────
// Simple status display
// ──────────────────────────────────────────────
var _statusTimer = null;
function showStatus(text, type, duration) {
    DOM.statusText.textContent = text;
    DOM.statusBar.className = 'visible ' + (type || '');
    DOM.statusBar.style.display = 'block';
    if (_statusTimer) clearTimeout(_statusTimer);
    if (duration) {
        _statusTimer = setTimeout(function () {
            DOM.statusBar.style.display = 'none';
        }, duration);
    }
}

function setConnectionStatus(state) {
    if (DOM.statusDot) {
        DOM.statusDot.className = 'status-dot ' + state;
    }
    APP.isConnected = (state === 'connected');
}

// ──────────────────────────────────────────────
// Decode strings encoded by ExtendScript for transport
// ──────────────────────────────────────────────
function fsDecode(obj) {
    if (typeof obj === 'string') {
        try { return decodeURIComponent(obj); } catch (e) { return obj; }
    }
    if (obj instanceof Array) {
        var a = [];
        for (var i = 0; i < obj.length; i++) a.push(fsDecode(obj[i]));
        return a;
    }
    if (obj && typeof obj === 'object') {
        var r = {};
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) r[k] = fsDecode(obj[k]);
        }
        return r;
    }
    return obj;
}

// ──────────────────────────────────────────────
// Message handler — for async events from ExtendScript
// ──────────────────────────────────────────────
function handleMessage(raw) {
    var data = '';
    if (typeof raw === 'string') {
        data = raw;
    } else if (raw && typeof raw === 'object') {
        data = raw.data || raw.text || raw.message || String(raw);
    }

    if (typeof data === 'string' && data.length > 0 && data.length < 200) {
        console.log('[Audio Plugin] EVENT: ' + data);
    }

    var msg = null;
    try { msg = JSON.parse(data); } catch (e) { return; }
    msg = fsDecode(msg);
    if (!msg || !msg.action) return;

    switch (msg.action) {
        case 'previewStarted':
            showStatus('预览中: ' + getFileName(msg.data.filePath), 'info', 3000);
            break;
        case 'previewStopped':
            showStatus('预览已停止', 'info', 1000);
            break;
        case 'audioImported':
            updateFileImportState(msg.data.filePath, true, msg.data.projectItemName);
            showStatus('已导入: ' + (msg.data.projectItemName || ''), 'success', 3000);
            break;
        case 'audioInserted':
            showStatus('已插入: ' + (msg.data.itemName || '') + ' @ ' + (msg.data.time || '0') + 's', 'success', 3000);
            break;
        case 'importStateUpdated':
            // Refresh current file list to update import states
            if (APP.activeCategory && APP.activeSub) {
                selectSubByKey(APP.activeCategory, APP.activeSub);
            }
            break;
        case 'error':
            showStatus('错误: ' + (msg.data.message || ''), 'error', 8000);
            break;
    }
}

// ──────────────────────────────────────────────
// Login / Auth functions
// ──────────────────────────────────────────────
function checkLogin() {
    if (!auth.token) {
        showLoginPanel();
        return false;
    }
    return true;
}

function showLoginPanel() {
    var loginPanel = document.getElementById('login-overlay');
    if (loginPanel) loginPanel.style.display = 'flex';
    var mainUI = document.getElementById('main-ui');
    if (mainUI) mainUI.style.display = 'none';
}

function hideLoginPanel() {
    var loginPanel = document.getElementById('login-overlay');
    if (loginPanel) loginPanel.style.display = 'none';
    var mainUI = document.getElementById('main-ui');
    if (mainUI) mainUI.style.display = '';
}

function doLogin() {
    var mobile = document.getElementById('login-mobile').value.trim();
    var code = document.getElementById('login-code').value.trim();
    if (!mobile || !code) {
        showStatus('请输入手机号和验证码', 'error', 3000);
        return;
    }
    var btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = '登录中...';

    apiRequest('/api/login', {
        method: 'POST',
        body: { mobile: mobile, code: code, source: 'plugin' }
    }).then(function(res) {
        if (res.code === 0) {
            auth.token = res.data.token;
            auth.user = res.data.user;
            localStorage.setItem('audio_plugin_token', auth.token);
            hideLoginPanel();
            loadPluginData();
            showStatus('登录成功', 'success', 2000);
        } else {
            showStatus('登录失败: ' + res.message, 'error', 3000);
        }
    }).catch(function(err) {
        showStatus('网络错误: ' + err.message, 'error', 5000);
    }).finally(function() {
        btn.disabled = false;
        btn.textContent = '登录';
    });
}

function doSendSMS() {
    var mobile = document.getElementById('login-mobile').value.trim();
    if (!mobile) { showStatus('请输入手机号', 'error', 2000); return; }
    var btn = document.getElementById('btn-send-sms');
    btn.disabled = true;
    var countdown = 60;
    btn.textContent = countdown + 's';
    var timer = setInterval(function() {
        countdown--;
        btn.textContent = countdown + 's';
        if (countdown <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }, 1000);

    apiRequest('/api/send-sms', {
        method: 'POST',
        body: { mobile: mobile }
    }).then(function(res) {
        if (res.code !== 0) {
            showStatus('发送失败: ' + res.message, 'error', 3000);
        }
    });
}

// ──────────────────────────────────────────────
// Data loading from API (replaces evalScript file scanning)
// ──────────────────────────────────────────────
function loadPluginData() {
    showStatus('正在加载数据...', 'info', 5000);

    apiRequest('/api/plugin/categories')
        .then(function(res) {
            if (res.code === 0) {
                setConnectionStatus('connected');
                APP.config = {
                    categories: res.data.categories,
                    audioMap: {}
                };
                var audios = res.data.audios || [];
                for (var i = 0; i < audios.length; i++) {
                    var audio = audios[i];
                    if (!APP.config.audioMap[audio.category_id]) {
                        APP.config.audioMap[audio.category_id] = [];
                    }
                    APP.config.audioMap[audio.category_id].push(audio);
                }
                APP.favoriteIds = res.data.favoriteIds || [];
                APP.audioFiles = audios;
                renderCategoryTree();
                var catCount = res.data.categories ? res.data.categories.length : 0;
                showStatus('就绪 — ' + catCount + ' 个分类', 'success', 2000);
                if (DOM.searchInput) DOM.searchInput.disabled = false;
            } else if (res.code === 401) {
                auth.token = null;
                localStorage.removeItem('audio_plugin_token');
                showLoginPanel();
            } else {
                showStatus('数据加载失败: ' + res.message, 'error', 5000);
            }
        })
        .catch(function(err) {
            showStatus('网络错误: ' + err.message, 'error', 5000);
        });
}

// ──────────────────────────────────────────────
// Init — set up CSInterface, check login, load data
// ──────────────────────────────────────────────
function boot() {
    showStatus('正在初始化...', 'info', 5000);

    // Get CSInterface
    try {
        csInterface = new CSInterface();
        console.log('[Audio Plugin] CSInterface OK');
    } catch (e1) {
        console.log('[Audio Plugin] CSInterface not ready, retrying...');
        setTimeout(boot, 300);
        return;
    }
    if (!csInterface) { setTimeout(boot, 300); return; }

    // Register event listeners for async push events from ExtendScript
    csInterface.addEventListener('audioPluginEvent', handleMessage);

    setConnectionStatus('connecting');

    // Check login instead of loading local config via evalScript
    if (!auth.token) {
        showLoginPanel();
        setConnectionStatus('disconnected');
    } else {
        loadPluginData();
    }
}

// Start boot process
boot();

// ──────────────────────────────────────────────
// UI rendering functions
// ──────────────────────────────────────────────

function renderCategoryTree() {
    if (!APP.config || !APP.config.categories) {
        DOM.categoryTree.innerHTML = '<div style="padding:12px;color:#999;">配置无分类数据</div>';
        return;
    }
    var html = '';
    var cats = APP.config.categories;
    for (var i = 0; i < cats.length; i++) {
        renderCategoryNode(cats[i], 0, '');
    }
    DOM.categoryTree.innerHTML = html;

    function renderCategoryNode(node, level, parentId) {
        var nodeId = node._id || node.key || '';
        var nodeLabel = node.label || node.name || '';
        var children = node.children || node.subs || [];
        var audios = node.audios || [];
        var isExpanded = APP.expandedCategories[nodeId] !== false;

        if (level === 0) {
            // Level 1: category header with expandable sub-list
            html += '<div class="cat-group">';
            html += '  <div class="cat-header" data-cat="' + nodeId + '" onclick="toggleCategory(this)">';
            html += '    <span class="arrow' + (isExpanded ? ' expanded' : '') + '">▶</span>';
            html += '    <span>' + escHtml(nodeLabel) + '</span>';
            html += '  </div>';
            html += '  <div class="sub-list' + (isExpanded ? ' expanded' : '') + '">';
            for (var j = 0; j < children.length; j++) {
                renderCategoryNode(children[j], 1, nodeId);
            }
            html += '  </div>';
            html += '</div>';
        } else if (level === 1) {
            // Level 2: sub-item with its level-3 children (audio entries)
            html += '<div class="cat-group">';
            html += '  <div class="cat-header" data-cat="' + nodeId + '" onclick="toggleCategory(this)">';
            html += '    <span class="arrow' + (isExpanded ? ' expanded' : '') + '">▶</span>';
            html += '    <span>' + escHtml(nodeLabel) + '</span>';
            html += '  </div>';
            html += '  <div class="sub-list' + (isExpanded ? ' expanded' : '') + '">';
            // Level 3 nodes are audio entries — clickable sub-items
            for (var k = 0; k < children.length; k++) {
                var child = children[k];
                var childId = child._id || child.key || '';
                var childLabel = child.label || child.name || '';
                var childAudioCount = (child.audios || []).length;
                html += '    <div class="sub-item" data-cat="' + nodeId + '" data-sub="' + childId + '"';
                html += ' onclick="selectSub(this)">';
                html += '      <span>' + escHtml(childLabel) + '</span>';
                html += '      <span class="sub-count" id="count-' + nodeId + '-' + childId + '">' + childAudioCount + '</span>';
                html += '    </div>';
            }
            html += '  </div>';
            html += '</div>';
        }
    }
}

function toggleCategory(header) {
    var arrow = header.querySelector('.arrow');
    var subList = header.nextElementSibling;
    var catKey = header.getAttribute('data-cat');
    if (arrow.classList.contains('expanded')) {
        arrow.classList.remove('expanded');
        subList.classList.remove('expanded');
        APP.expandedCategories[catKey] = false;
    } else {
        arrow.classList.add('expanded');
        subList.classList.add('expanded');
        APP.expandedCategories[catKey] = true;
    }
}

function selectSub(el) {
    var items = DOM.categoryTree.querySelectorAll('.sub-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
    el.classList.add('active');
    var catKey = el.getAttribute('data-cat');
    var subKey = el.getAttribute('data-sub');
    selectSubByKey(catKey, subKey);
}

// Programmatic select (used for refresh after import or favorite toggle)
function selectSubByKey(catKey, subKey) {
    DOM.audioList.innerHTML = '<div class="empty-state">加载中...</div>';
    APP.activeCategory = catKey;
    APP.activeSub = subKey;
    APP.audioFiles = APP.config.audioMap[subKey] || [];
    // Mark favorites
    for (var i = 0; i < APP.audioFiles.length; i++) {
        APP.audioFiles[i].isFavorite = APP.favoriteIds.indexOf(APP.audioFiles[i]._id) >= 0;
    }
    updateListHeader();
    renderAudioList();
    updateSubCounts();
    showStatus('加载了 ' + APP.audioFiles.length + ' 个文件', 'success', 2000);
}

function updateListHeader() {
    var catLabel = APP.activeCategory || '';
    var subLabel = APP.activeSub || '';
    // Find labels from the flat audios data or category tree
    for (var i = 0; i < APP.audioFiles.length; i++) {
        var f = APP.audioFiles[i];
        if (f.category_id === APP.activeSub) {
            catLabel = f.name || '';
            break;
        }
    }
    DOM.listTitle.textContent = (catLabel || '音频') + ' · ' + (APP.audioFiles.length || 0) + ' 个文件';
    DOM.listCount.textContent = '';
}

function updateSubCounts() {
    if (APP.activeCategory && APP.activeSub) {
        var badge = $('count-' + APP.activeCategory + '-' + APP.activeSub);
        if (badge) badge.textContent = APP.audioFiles.length;
    }
}

function renderAudioList() {
    var files = APP.audioFiles;
    if (files.length === 0) {
        DOM.audioList.innerHTML = '<div class="empty-state">此分类下没有音频文件</div>';
        return;
    }
    var searchTerm = DOM.searchInput.value.trim().toLowerCase();
    var filtered = files;
    if (searchTerm) {
        filtered = files.filter(function (f) {
            return (f.name || '').toLowerCase().indexOf(searchTerm) >= 0 ||
                   (f.description || '').toLowerCase().indexOf(searchTerm) >= 0;
        });
    }
    if (filtered.length === 0) {
        DOM.audioList.innerHTML = '<div class="empty-state">无匹配结果</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var f = filtered[i];
        var displayName = f.name || '';
        var description = f.description || '';
        var iconUrl = f.icon || '';
        var fId = escAttr(f._id || '');
        var versions = f.versions || [];
        var isFavorite = f.isFavorite || false;

        // Default to first version's file URL
        var defaultFileUrl = versions.length > 0 ? escAttr(versions[0].file_url || '') : '';

        html += '<div class="audio-item" data-audio-id="' + fId + '">';
        // Icon
        if (iconUrl) {
            html += '  <img class="audio-icon" src="' + escHtml(iconUrl) + '" alt="">';
        } else {
            html += '  <span class="file-icon">&#x1f3a7;</span>';
        }
        html += '  <div class="file-info">';
        html += '    <div class="file-name" title="' + escHtml(displayName) + '">' + escHtml(displayName) + '</div>';
        html += '    <div class="file-detail">' + escHtml(description) + '</div>';
        html += '  </div>';
        // Version selector
        if (versions.length > 0) {
            html += '  <select class="version-select" onchange="onVersionChange(this, \'' + fId + '\')">';
            for (var v = 0; v < versions.length; v++) {
                var vName = versions[v].version_name || versions[v].version_id || '';
                var vDur = versions[v].duration ? ' (' + versions[v].duration + 's)' : '';
                html += '    <option value="' + escAttr(versions[v].file_url || '') + '">' + escHtml(vName) + vDur + '</option>';
            }
            html += '  </select>';
        }
        html += '  <div class="btn-group">';
        html += '    <button class="btn-favorite' + (isFavorite ? ' active' : '') +
                '" onclick="toggleFavorite(\'' + fId + '\')" title="收藏">' +
                (isFavorite ? '&#10084;' : '&#9825;') + '</button>';
        html += '    <button class="btn-preview" onclick="previewAudio(getAudioUrl(\'' + fId + '\'))" title="试听">&#9654;</button>';
        html += '    <button class="btn-import" onclick="importAudio(getAudioUrl(\'' + fId + '\'))">导入</button>';
        html += '    <button class="btn-insert" onclick="insertAudio(getAudioUrl(\'' + fId + '\'))" title="插入到播放头">&#8595; 插入</button>';
        html += '  </div>';
        html += '</div>';
    }
    DOM.audioList.innerHTML = html;
}

// Get currently selected version URL for an audio item
function getAudioUrl(audioId) {
    var item = document.querySelector('.audio-item[data-audio-id="' + audioId + '"]');
    if (!item) return '';
    var sel = item.querySelector('.version-select');
    if (sel) return sel.value;
    // Fallback: find audio in array and use first version
    for (var i = 0; i < APP.audioFiles.length; i++) {
        if (APP.audioFiles[i]._id === audioId) {
            var vers = APP.audioFiles[i].versions || [];
            return vers.length > 0 ? vers[0].file_url || '' : '';
        }
    }
    return '';
}

function onVersionChange(selectEl, audioId) {
    // Store selected version — handled in getAudioUrl at click time
}

function updateFileImportState(filePath, isImported, projectItemName) {
    for (var i = 0; i < APP.audioFiles.length; i++) {
        if (APP.audioFiles[i].filePath === filePath) {
            APP.audioFiles[i].isImported = isImported;
            APP.audioFiles[i].projectItemName = projectItemName || '';
            break;
        }
    }
    renderAudioList();
}

// ──────────────────────────────────────────────
// Actions (download → operate, via ExtendScript)
// ──────────────────────────────────────────────
function previewAudio(fileUrl) {
    if (!fileUrl) return;
    showStatus('正在下载预览...', 'info', 2000);
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndPreview("' + escAttr(fileUrl) + '")'
    );
}
function importAudio(fileUrl) {
    if (!fileUrl) return;
    showStatus('正在下载并导入...', 'info', 3000);
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndImport("' + escAttr(fileUrl) + '")'
    );
}
function insertAudio(fileUrl) {
    if (!fileUrl) return;
    csInterface.evalScript(
        '$._AUDIO_PLUGIN_.downloadAndInsert("' + escAttr(fileUrl) + '")'
    );
}
function stopPreview() {
    csInterface.evalScript('$._AUDIO_PLUGIN_.stopPreview()');
}

function toggleFavorite(audioId) {
    if (!checkLogin()) return;
    apiRequest('/api/plugin/favorites', {
        method: 'POST',
        body: { action: 'toggle', audio_id: audioId }
    }).then(function(res) {
        if (res.code === 0) {
            if (res.data.favorited) {
                APP.favoriteIds.push(audioId);
            } else {
                var idx = APP.favoriteIds.indexOf(audioId);
                if (idx >= 0) APP.favoriteIds.splice(idx, 1);
            }
            if (APP.activeCategory && APP.activeSub) {
                selectSubByKey(APP.activeCategory, APP.activeSub);
            }
        }
    });
}

// ──────────────────────────────────────────────
// Search
// ──────────────────────────────────────────────
var _searchDebounce = null;
if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', function () {
        if (_searchDebounce) clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(function () {
            if (APP.audioFiles.length > 0) renderAudioList();
        }, 200);
    });
}

// ──────────────────────────────────────────────
// Divider resize
// ──────────────────────────────────────────────
(function () {
    var div = $('divider');
    var left = $('left-panel');
    if (!div || !left) return;
    var dragging = false, sx, sw;
    div.addEventListener('mousedown', function (e) {
        dragging = true; sx = e.clientX; sw = left.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        var w = Math.max(140, Math.min(400, sw + (e.clientX - sx)));
        left.style.width = w + 'px';
    });
    document.addEventListener('mouseup', function () {
        if (dragging) { dragging = false; document.body.style.cursor = ''; }
    });
})();

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escAttr(s) {
    if (!s) return '';
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
function getFileName(p) {
    if (!p) return '';
    var parts = String(p).replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
}
