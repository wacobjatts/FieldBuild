const UI = {
    editors: {
        html: document.getElementById('editor-html'),
        css: document.getElementById('editor-css'),
        js: document.getElementById('editor-js')
    },
    lines: {
        html: document.getElementById('ln-html'),
        css: document.getElementById('ln-css'),
        js: document.getElementById('ln-js')
    },
    preview: document.getElementById('preview-iframe'),
    status: document.getElementById('status-indicator'),
    sheet: document.getElementById('experiment-site'),
    history: document.getElementById('action-history'),
    guide: document.getElementById('guide-toast'),
    menu: document.getElementById('global-menu')
};

let state = {
    sandbox: false,
    autoRepair: false,
    currentBlobUrl: null,
    lastUpdate: Date.now()
};

// 1. PREVIEW ENGINE
function updatePreview() {
    const html = UI.editors.html.value;
    const css = `<style>${UI.editors.css.value}</style>`;
    const js = `<script>
        try {
            ${UI.editors.js.value}
            window.parent.postMessage({status: 'OK'}, '*');
        } catch(e) {
            window.parent.postMessage({status: 'ERROR', msg: e.message}, '*');
        }
    <\/script>`;

    const doc = `<!DOCTYPE html><html><head>${css}</head><body>${html}${js}</body></html>`;
    const blob = new Blob([doc], { type: 'text/html' });

    if (state.currentBlobUrl) URL.revokeObjectURL(state.currentBlobUrl);
    state.currentBlobUrl = URL.createObjectURL(blob);
    UI.preview.src = state.currentBlobUrl;
}

window.addEventListener('message', (e) => {
    const pill = document.getElementById('preview-status-pill');
    if (e.data.status === 'OK') {
        pill.textContent = 'PREVIEW OK';
        pill.style.color = 'var(--cyan)';
    } else if (e.data.status === 'ERROR') {
        pill.textContent = 'PREVIEW BROKEN';
        pill.style.color = 'var(--red)';
    }
});

// 2. CORE SYSTEMS
function saveDraft() {
    const prefix = state.sandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
    localStorage.setItem(prefix + 'html', UI.editors.html.value);
    localStorage.setItem(prefix + 'css', UI.editors.css.value);
    localStorage.setItem(prefix + 'js', UI.editors.js.value);
    UI.status.textContent = state.sandbox ? 'SANDBOX DIRTY' : 'DRAFT SAVED';
}

let saveTimer;
function debounceUpdate() {
    UI.status.textContent = 'WRITING...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveDraft();
        updatePreview();
        if (state.autoRepair) runRepair(true);
    }, 1000);
}

function runRepair(silent = false) {
    let code = UI.editors.html.value;
    const tags = ['div', 'span', 'p', 'section', 'header', 'footer', 'main'];
    let fixedCount = 0;

    tags.forEach(tag => {
        const opened = (code.match(new RegExp('<' + tag, 'g')) || []).length;
        const closed = (code.match(new RegExp('</' + tag + '>', 'g')) || []).length;
        if (opened > closed) {
            code += `\n</${tag}>`.repeat(opened - closed);
            fixedCount += (opened - closed);
        }
    });

    if (fixedCount > 0) {
        UI.editors.html.value = code;
        updateLineNumbers('html');
        updatePreview();
        logEvent(`Repair: Fixed ${fixedCount} unclosed tags.`);
        if (!silent) showGuide(`Repaired ${fixedCount} tags`);
    } else if (!silent) {
        showGuide("No issues found");
    }
}

// 3. EXPORT & COPY
async function copyProject(type = 'all') {
    let content = '';
    if (type === 'all') {
        content = `<!DOCTYPE html><html><head><style>${UI.editors.css.value}</style></head><body>${UI.editors.html.value}<script>${UI.editors.js.value}<\/script></body></html>`;
    } else {
        content = UI.editors[type].value;
    }
    await navigator.clipboard.writeText(content);
    showGuide(`${type.toUpperCase()} Copied`);
    logEvent(`Action: Copied ${type}`);
}

function exportZip() {
    const zip = new JSZip();
    zip.file("index.html", `<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body>${UI.editors.html.value}<script src="script.js"><\/script></body></html>`);
    zip.file("style.css", UI.editors.css.value);
    zip.file("script.js", UI.editors.js.value);

    zip.generateAsync({type:"blob"}).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = "fieldbuilder_project.zip";
        link.click();
        logEvent("Action: ZIP Exported");
        showGuide("ZIP Downloaded");
    });
}

// 4. VERSIONING
function saveStable() {
    const data = { h: UI.editors.html.value, c: UI.editors.css.value, j: UI.editors.js.value, ts: Date.now() };
    localStorage.setItem('fr_builder_stable', JSON.stringify(data));
    logEvent("Checkpoint: Stable saved");
    showGuide("Stable baseline saved");
}

function takeSnapshot() {
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    snaps.push({ id: Date.now(), h: UI.editors.html.value, c: UI.editors.css.value, j: UI.editors.js.value });
    localStorage.setItem('fr_builder_snapshots', JSON.stringify(snaps));
    renderSnapshots();
    logEvent("Checkpoint: Snapshot created");
    showGuide("Snapshot created");
}

function renderSnapshots() {
    const container = document.getElementById('snapshot-list');
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    if (snaps.length === 0) {
        container.innerHTML = '<div class="empty-state">No snapshots yet</div>';
        return;
    }
    container.innerHTML = snaps.map(s => `
        <div class="snapshot-item">
            <span>${new Date(s.id).toLocaleTimeString()}</span>
            <button class="btn-subtle" onclick="restoreSnapshot(${s.id})">RESTORE</button>
        </div>
    `).reverse().join('');
}

window.restoreSnapshot = (id) => {
    if (!confirm("Discard current changes?")) return;
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    const snap = snaps.find(s => s.id === id);
    if (snap) {
        UI.editors.html.value = snap.h;
        UI.editors.css.value = snap.c;
        UI.editors.js.value = snap.j;
        ['html', 'css', 'js'].forEach(updateLineNumbers);
        updatePreview();
        showGuide("Snapshot restored");
    }
};

// 5. NAVIGATION & SEARCH
function runSearch(q) {
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    if (!q || q.length < 2) return;

    ['html', 'css', 'js'].forEach(lang => {
        const lines = UI.editors[lang].value.split('\n');
        lines.forEach((line, i) => {
            if (line.toLowerCase().includes(q.toLowerCase())) {
                const item = document.createElement('div');
                item.className = 'search-item';
                const preview = line.trim().slice(0, 70).replace(new RegExp(q, 'gi'), m => `<mark>${m}</mark>`);
                item.innerHTML = `<span class="line">${lang.toUpperCase()} L${i+1}</span> ${preview}`;
                item.onclick = () => jumpToLine(lang, i);
                results.appendChild(item);
            }
        });
    });
}

function jumpToLine(lang, index) {
    document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
    const parent = document.querySelector(`[data-section="${lang}"]`);
    parent.classList.add('active');
    
    UI.editors[lang].focus();
    const lineHeight = 22.4; 
    UI.editors[lang].scrollTop = index * lineHeight;
    showGuide(`Jumped to L${index + 1}`);
}

// 6. INITIALIZATION & EVENTS
function setupEventListeners() {
    // Top Bar
    document.getElementById('btn-copy-all').onclick = () => copyProject('all');
    document.getElementById('btn-menu').onclick = () => UI.menu.classList.remove('hidden');
    document.getElementById('btn-menu-close').onclick = () => UI.menu.classList.add('hidden');
    
    // Quick Actions
    document.getElementById('btn-save-stable-quick').onclick = saveStable;
    document.getElementById('btn-snapshot-quick').onclick = takeSnapshot;
    document.getElementById('btn-export-quick').onclick = exportZip;
    document.getElementById('btn-repair-quick').onclick = () => runRepair();
    document.getElementById('toggle-sandbox').onclick = () => {
        state.sandbox = !state.sandbox;
        document.getElementById('toggle-sandbox').classList.toggle('active', state.sandbox);
        const prefix = state.sandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
        UI.editors.html.value = localStorage.getItem(prefix + 'html') || '';
        UI.editors.css.value = localStorage.getItem(prefix + 'css') || '';
        UI.editors.js.value = localStorage.getItem(prefix + 'js') || '';
        ['html', 'css', 'js'].forEach(updateLineNumbers);
        updatePreview();
        showGuide(state.sandbox ? "Sandbox Mode Active" : "Switched to Main Draft");
    };

    // Curtains
    document.querySelectorAll('.curtain-trigger').forEach(btn => {
        btn.onclick = () => {
            const cur = btn.parentElement;
            const wasActive = cur.classList.contains('active');
            if (!wasActive) {
                document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
                cur.classList.add('active');
                cur.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                cur.classList.remove('active');
            }
        };
    });

    // Editors
    ['html', 'css', 'js'].forEach(lang => {
        UI.editors[lang].oninput = () => {
            updateLineNumbers(lang);
            debounceUpdate();
        };
        UI.editors[lang].onscroll = () => {
            UI.lines[lang].scrollTop = UI.editors[lang].scrollTop;
        };
    });

    // Preview
    document.getElementById('preview-drag-handle').onclick = () => {
        UI.sheet.classList.toggle('collapsed');
        const collapsed = UI.sheet.classList.contains('collapsed');
        document.querySelector('.pull-text').textContent = collapsed ? 'PULL TO EXPAND' : 'PULL TO HIDE';
    };
    document.getElementById('btn-focus-mode').onclick = () => UI.sheet.classList.add('full');
    document.getElementById('btn-close-preview').onclick = () => {
        UI.sheet.classList.add('collapsed');
        UI.sheet.classList.remove('full');
    };

    // Menu Sub-actions
    document.getElementById('m-copy-html').onclick = () => copyProject('html');
    document.getElementById('m-copy-css').onclick = () => copyProject('css');
    document.getElementById('m-copy-js').onclick = () => copyProject('js');
    document.getElementById('m-repair-toggle').onclick = () => {
        state.autoRepair = !state.autoRepair;
        document.getElementById('m-repair-toggle').textContent = `AUTO-REPAIR: ${state.autoRepair ? 'ON' : 'OFF'}`;
    };
    document.getElementById('m-clear-data').onclick = () => {
        if (confirm("Erase all progress?")) {
            localStorage.clear();
            location.reload();
        }
    };

    // Search
    document.getElementById('global-search').oninput = (e) => runSearch(e.target.value);
}

function updateLineNumbers(lang) {
    const lines = UI.editors[lang].value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '<br>';
    UI.lines[lang].innerHTML = html;
}

function logEvent(msg) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    UI.history.prepend(div);
}

function showGuide(msg) {
    UI.guide.textContent = msg;
    UI.guide.classList.remove('hidden');
    setTimeout(() => UI.guide.classList.add('hidden'), 2500);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    UI.editors.html.value = localStorage.getItem('fr_builder_html') || '<h1>FieldBuilder</h1>\n<p>Start creating.</p>';
    UI.editors.css.value = localStorage.getItem('fr_builder_css') || 'body { background: #fff; padding: 40px; font-family: system-ui; color: #111; }';
    UI.editors.js.value = localStorage.getItem('fr_builder_js') || 'console.log("Ready.");';
    
    ['html', 'css', 'js'].forEach(updateLineNumbers);
    setupEventListeners();
    updatePreview();
    renderSnapshots();
});
