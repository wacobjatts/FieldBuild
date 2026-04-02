/** * FIELDBUILDER - SURGICAL FIX PASS v1.2
 * Focus: Error guarding, missing handlers, and functional completeness.
 */

window.onerror = function (msg, src, line) {
    console.error('FieldBuilder error:', msg, 'at line:', line);
};

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

// --- CORE UTILITIES ---
function logEvent(msg) {
    if (!UI.history) return;
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    UI.history.prepend(div);
}

function showGuide(msg) {
    if (!UI.guide) return;
    UI.guide.textContent = msg;
    UI.guide.classList.remove('hidden');
    setTimeout(() => UI.guide.classList.add('hidden'), 2500);
}

function updateLineNumbers(lang) {
    if (!UI.editors[lang] || !UI.lines[lang]) return;
    const lines = UI.editors[lang].value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) html += i + '<br>';
    UI.lines[lang].innerHTML = html;
}

// --- PREVIEW ENGINE ---
function updatePreview() {
    if (!UI.preview) return;

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
    if (!pill) return;
    if (e.data.status === 'OK') {
        pill.textContent = 'PREVIEW OK';
        pill.style.color = 'var(--cyan)';
    } else if (e.data.status === 'ERROR') {
        pill.textContent = 'PREVIEW BROKEN';
        pill.style.color = 'var(--red)';
    }
});

// --- DATA PERSISTENCE ---
function saveDraft() {
    const prefix = state.sandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
    localStorage.setItem(prefix + 'html', UI.editors.html.value);
    localStorage.setItem(prefix + 'css', UI.editors.css.value);
    localStorage.setItem(prefix + 'js', UI.editors.js.value);
    if (UI.status) UI.status.textContent = state.sandbox ? 'SANDBOX DIRTY' : 'DRAFT SAVED';
}

let saveTimer;
function debounceUpdate() {
    if (UI.status) UI.status.textContent = 'WRITING...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveDraft();
        updatePreview();
        if (state.autoRepair) runRepair(true);
    }, 1000);
}

// --- FEATURE HANDLERS ---
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

async function copyProject(type = 'all') {
    let content = (type === 'all') ? 
        `<!DOCTYPE html><html><head><style>${UI.editors.css.value}</style></head><body>${UI.editors.html.value}<script>${UI.editors.js.value}<\/script></body></html>` : 
        UI.editors[type].value;

    try {
        await navigator.clipboard.writeText(content);
        showGuide(`${type.toUpperCase()} Copied`);
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showGuide(`${type.toUpperCase()} Copied`);
    }
    logEvent(`Action: Copied ${type}`);
}

function exportSingle() {
    const content = `<!DOCTYPE html><html><head><style>${UI.editors.css.value}</style></head><body>${UI.editors.html.value}<script>${UI.editors.js.value}<\/script></body></html>`;
    const blob = new Blob([content], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "fieldbuilder_single.html";
    link.click();
    logEvent("Action: Exported Single HTML");
    showGuide("HTML Downloaded");
}

function exportZip() {
    if (typeof JSZip === 'undefined') {
        showGuide("Error: JSZip not loaded");
        return;
    }
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

function saveStable() {
    const data = { h: UI.editors.html.value, c: UI.editors.css.value, j: UI.editors.js.value, ts: Date.now() };
    localStorage.setItem('fr_builder_stable', JSON.stringify(data));
    logEvent("Checkpoint: Stable saved");
    showGuide("Stable baseline saved");
}

function restoreStable() {
    const raw = localStorage.getItem('fr_builder_stable');
    if (!raw) {
        showGuide("No stable version found");
        return;
    }
    if (!confirm("Restore stable version? Current changes will be lost.")) return;
    const data = JSON.parse(raw);
    UI.editors.html.value = data.h;
    UI.editors.css.value = data.c;
    UI.editors.js.value = data.j;
    ['html', 'css', 'js'].forEach(updateLineNumbers);
    updatePreview();
    logEvent("Checkpoint: Restored Stable");
    showGuide("Stable version restored");
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
    if (!container) return;
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
    if (!confirm("Restore this snapshot?")) return;
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    const snap = snaps.find(s => s.id === id);
    if (snap) {
        UI.editors.html.value = snap.h;
        UI.editors.css.value = snap.c;
        UI.editors.js.value = snap.j;
        ['html', 'css', 'js'].forEach(updateLineNumbers);
        updatePreview();
        logEvent(`Checkpoint: Restored Snapshot ${id}`);
        showGuide("Snapshot restored");
    }
};

// --- EVENT WIRING ---
function setupEventListeners() {
    const wire = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.onclick = fn;
    };

    // Header & Menu
    wire('btn-copy-all', () => copyProject('all'));
    wire('btn-menu', () => UI.menu && UI.menu.classList.remove('hidden'));
    wire('btn-menu-close', () => UI.menu && UI.menu.classList.add('hidden'));

    // Quick Actions
    wire('btn-save-stable-quick', saveStable);
    wire('btn-snapshot-quick', takeSnapshot);
    wire('btn-export-quick', exportZip);
    wire('btn-repair-quick', () => runRepair());
    
    wire('toggle-sandbox', () => {
        state.sandbox = !state.sandbox;
        const btn = document.getElementById('toggle-sandbox');
        if (btn) btn.classList.toggle('active', state.sandbox);
        const prefix = state.sandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
        UI.editors.html.value = localStorage.getItem(prefix + 'html') || '';
        UI.editors.css.value = localStorage.getItem(prefix + 'css') || '';
        UI.editors.js.value = localStorage.getItem(prefix + 'js') || '';
        ['html', 'css', 'js'].forEach(updateLineNumbers);
        updatePreview();
        showGuide(state.sandbox ? "Sandbox Mode Active" : "Main Draft Loaded");
    });

    // Preview
    wire('preview-drag-handle', () => {
        if (!UI.sheet) return;
        UI.sheet.classList.toggle('collapsed');
        const txt = document.querySelector('.pull-text');
        if (txt) txt.textContent = UI.sheet.classList.contains('collapsed') ? 'PULL TO EXPAND' : 'PULL TO HIDE';
    });
    wire('btn-focus-mode', () => UI.sheet && UI.sheet.classList.add('full'));
    wire('btn-close-preview', () => {
        if (!UI.sheet) return;
        UI.sheet.classList.add('collapsed');
        UI.sheet.classList.remove('full');
    });

    // Menu Internals
    wire('m-copy-html', () => copyProject('html'));
    wire('m-copy-css', () => copyProject('css'));
    wire('m-copy-js', () => copyProject('js'));
    wire('m-export-single', exportSingle);
    wire('m-repair-toggle', (e) => {
        state.autoRepair = !state.autoRepair;
        e.target.textContent = `AUTO-REPAIR: ${state.autoRepair ? 'ON' : 'OFF'}`;
    });
    wire('m-clear-data', () => {
        if (confirm("ERASE ALL LOCAL STORAGE? This cannot be undone.")) {
            localStorage.clear();
            location.reload();
        }
    });

    // Versions
    wire('btn-restore-stable', restoreStable);

    // Editors
    ['html', 'css', 'js'].forEach(lang => {
        if (UI.editors[lang]) {
            UI.editors[lang].oninput = () => {
                updateLineNumbers(lang);
                debounceUpdate();
            };
            UI.editors[lang].onscroll = () => {
                if (UI.lines[lang]) UI.lines[lang].scrollTop = UI.editors[lang].scrollTop;
            };
        }
    });

    // Curtains
    document.querySelectorAll('.curtain-trigger').forEach(btn => {
        btn.onclick = () => {
            const cur = btn.parentElement;
            const wasActive = cur.classList.contains('active');
            document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
            if (!wasActive) {
                cur.classList.add('active');
                cur.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
    });

    // Search
    const searchInp = document.getElementById('global-search');
    if (searchInp) {
        searchInp.oninput = (e) => {
            const results = document.getElementById('search-results');
            if (!results) return;
            const q = e.target.value.toLowerCase();
            results.innerHTML = '';
            if (q.length < 2) return;
            ['html', 'css', 'js'].forEach(lang => {
                UI.editors[lang].value.split('\n').forEach((line, i) => {
                    if (line.toLowerCase().includes(q)) {
                        const div = document.createElement('div');
                        div.className = 'search-item';
                        div.innerHTML = `<span class="line">${lang.toUpperCase()} L${i+1}</span> ${line.trim().slice(0,60).replace(new RegExp(q,'gi'), m=>`<mark>${m}</mark> `)}`;
                        div.onclick = () => {
                            document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
                            const p = document.querySelector(`[data-section="${lang}"]`);
                            if (p) p.classList.add('active');
                            UI.editors[lang].focus();
                            UI.editors[lang].scrollTop = i * 22;
                        };
                        results.appendChild(div);
                    }
                });
            });
        };
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        UI.editors.html.value = localStorage.getItem('fr_builder_html') || '<h1>FieldBuilder</h1>';
        UI.editors.css.value = localStorage.getItem('fr_builder_css') || 'body { background: #fff; padding: 20px; font-family: sans-serif; }';
        UI.editors.js.value = localStorage.getItem('fr_builder_js') || 'console.log("Ready.");';
        ['html', 'css', 'js'].forEach(updateLineNumbers);
        setupEventListeners();
        updatePreview();
        renderSnapshots();
        console.log("FieldBuilder v1.2 Online");
    } catch (e) {
        console.error("Critical Init Error:", e);
    }
});
