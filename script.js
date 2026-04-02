const UI = {
    editors: {
        html: document.getElementById('editor-html'),
        css: document.getElementById('editor-css'),
        js: document.getElementById('editor-js')
    },
    status: document.getElementById('status-indicator'),
    preview: document.getElementById('preview-iframe'),
    previewSheet: document.getElementById('experiment-site'),
    master: document.getElementById('master-site'),
    history: document.getElementById('action-history')
};

let state = {
    isSandbox: false,
    isLocked: false,
    autoRepair: false,
    currentPreviewState: 'collapsed',
    lastSaved: null
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updatePreview();
});

function setupEventListeners() {
    // Curtains
    document.querySelectorAll('.curtain-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const parent = trigger.parentElement;
            const wasActive = parent.classList.contains('active');
            document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
            if (!wasActive) parent.classList.add('active');
        });
    });

    // Preview Toggles
    document.getElementById('preview-drag-handle').addEventListener('click', () => {
        if (state.currentPreviewState === 'collapsed') {
            expandPreview();
        } else {
            collapsePreview();
        }
    });

    document.getElementById('btn-focus-mode').addEventListener('click', toggleFocusMode);
    document.getElementById('btn-close-preview').addEventListener('click', collapsePreview);

    // Sandbox & Lock
    document.getElementById('toggle-sandbox').addEventListener('click', toggleSandbox);
    document.getElementById('toggle-lock').addEventListener('click', toggleLock);

    // Editors
    Object.values(UI.editors).forEach(el => {
        el.addEventListener('input', () => {
            debouncedSave();
            updatePreview();
            setStatus('UNSAVED CHANGES');
        });
    });

    // Actions
    document.getElementById('btn-save-stable').addEventListener('click', saveStable);
    document.getElementById('btn-export').addEventListener('click', exportZip);
    document.getElementById('btn-snapshot').addEventListener('click', takeSnapshot);
    document.getElementById('btn-generate').addEventListener('click', simulateAI);
    
    // Menu
    document.getElementById('btn-menu').addEventListener('click', () => document.getElementById('global-menu').classList.remove('hidden'));
    document.getElementById('btn-menu-close').addEventListener('click', () => document.getElementById('global-menu').classList.add('hidden'));
}

// PREVIEW ENGINE
function updatePreview() {
    const html = UI.editors.html.value;
    const css = `<style>${UI.editors.css.value}</style>`;
    const js = `<script>${UI.editors.js.value}<\/script>`;
    
    const content = `
        <!DOCTYPE html>
        <html>
            <head>${css}</head>
            <body>
                ${html}
                ${js}
            </body>
        </html>
    `;

    const blob = new Blob([content], { type: 'text/html' });
    UI.preview.src = URL.createObjectURL(blob);
    document.getElementById('preview-status').textContent = 'PREVIEW OK';
    document.getElementById('preview-status').style.color = 'var(--cyan)';
}

// STORAGE SYSTEM
function saveDraft() {
    const prefix = state.isSandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
    localStorage.setItem(prefix + 'html', UI.editors.html.value);
    localStorage.setItem(prefix + 'css', UI.editors.css.value);
    localStorage.setItem(prefix + 'js', UI.editors.js.value);
    setStatus('DRAFT SAVED');
    logAction(state.isSandbox ? 'Sandbox draft updated' : 'Draft autosaved');
}

let saveTimeout;
function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDraft, 1000);
}

function saveStable() {
    const data = {
        html: UI.editors.html.value,
        css: UI.editors.css.value,
        js: UI.editors.js.value,
        timestamp: Date.now()
    };
    localStorage.setItem('fr_builder_stable', JSON.stringify(data));
    setStatus('STABLE SAVED');
    logAction('Stable baseline saved');
}

function takeSnapshot() {
    const name = prompt("Name this snapshot:", "Milestone " + new Date().toLocaleTimeString());
    if (!name) return;

    const snapshots = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    snapshots.push({
        id: Date.now(),
        name: name,
        html: UI.editors.html.value,
        css: UI.editors.css.value,
        js: UI.editors.js.value
    });
    localStorage.setItem('fr_builder_snapshots', JSON.stringify(snapshots));
    renderSnapshots();
    logAction(`Snapshot created: ${name}`);
}

function loadData() {
    UI.editors.html.value = localStorage.getItem('fr_builder_html') || '\n<div class="hero"><h1>FieldBuilder</h1></div>';
    UI.editors.css.value = localStorage.getItem('fr_builder_css') || 'body { background: #020408; color: #00f2ff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }';
    UI.editors.js.value = localStorage.getItem('fr_builder_js') || 'console.log("Ready.");';
    renderSnapshots();
}

// MODES
function toggleSandbox() {
    if (!state.isSandbox) {
        if (confirm("Enter Sandbox Mode? Edits won't affect your main draft.")) {
            state.isSandbox = true;
            document.body.classList.add('sandbox-active');
            document.getElementById('toggle-sandbox').textContent = 'SANDBOX ON';
            document.getElementById('toggle-sandbox').classList.add('active');
            logAction('Entered Sandbox Mode');
        }
    } else {
        const choice = confirm("Exit Sandbox? OK to Promote to Draft, Cancel to Discard.");
        if (choice) {
            saveDraft(); // Saves sandbox values to main draft
            logAction('Sandbox promoted to draft');
        }
        state.isSandbox = false;
        document.body.classList.remove('sandbox-active');
        document.getElementById('toggle-sandbox').textContent = 'SANDBOX OFF';
        document.getElementById('toggle-sandbox').classList.remove('active');
        loadData();
    }
}

function toggleLock() {
    state.isLocked = !state.isLocked;
    const btn = document.getElementById('toggle-lock');
    btn.textContent = state.isLocked ? 'LOCKED' : 'EDITING';
    btn.classList.toggle('active', state.isLocked);
    Object.values(UI.editors).forEach(ed => ed.disabled = state.isLocked);
    logAction(state.isLocked ? 'Editors locked' : 'Editors unlocked');
}

// UI HELPERS
function setStatus(text) {
    UI.status.textContent = text;
}

function logAction(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    UI.history.prepend(entry);
}

function expandPreview() {
    UI.previewSheet.classList.remove('collapsed');
    state.currentPreviewState = 'expanded';
    document.querySelector('.pull-text').textContent = 'PULL TO HIDE';
}

function collapsePreview() {
    UI.previewSheet.classList.add('collapsed');
    UI.previewSheet.classList.remove('full');
    UI.master.classList.remove('hidden');
    state.currentPreviewState = 'collapsed';
    document.querySelector('.pull-text').textContent = 'PULL TO EXPAND';
}

function toggleFocusMode() {
    UI.previewSheet.classList.add('full');
    UI.master.classList.add('hidden');
    state.currentPreviewState = 'full';
}

// EXPORT
async function exportZip() {
    const zip = new JSZip();
    zip.file("index.html", UI.editors.html.value);
    zip.file("style.css", UI.editors.css.value);
    zip.file("script.js", UI.editors.js.value);
    
    const content = await zip.generateAsync({type:"blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "fieldbuilder_project.zip";
    link.click();
    logAction('Project exported as ZIP');
}

// SNAPSHOT RENDERING
function renderSnapshots() {
    const list = document.getElementById('snapshot-list');
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    list.innerHTML = snaps.map(s => `
        <div class="snapshot-item" onclick="restoreSnapshot(${s.id})">
            <span>${s.name}</span>
            <small>${new Date(s.id).toLocaleDateString()}</small>
        </div>
    `).join('');
}

function restoreSnapshot(id) {
    if (!confirm("Restore this snapshot? Current unsaved changes will be lost.")) return;
    const snaps = JSON.parse(localStorage.getItem('fr_builder_snapshots') || '[]');
    const snap = snaps.find(s => s.id === id);
    if (snap) {
        UI.editors.html.value = snap.html;
        UI.editors.css.value = snap.css;
        UI.editors.js.value = snap.js;
        updatePreview();
        saveDraft();
        logAction(`Restored snapshot: ${snap.name}`);
    }
}

// AI MOCK
function simulateAI() {
    const prompt = document.getElementById('ai-prompt').value;
    if (!prompt) return;
    setStatus('AI GENERATING...');
    logAction(`AI Prompt sent: ${prompt}`);
    
    setTimeout(() => {
        UI.editors.html.value += `\n\n<div class="card"><h3>${prompt}</h3></div>`;
        updatePreview();
        saveDraft();
        setStatus('DRAFT SAVED');
    }, 1500);
}

