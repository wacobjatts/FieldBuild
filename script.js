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
    guide: document.getElementById('guide-toast')
};

let state = {
    sandbox: false,
    autoRepair: false,
    lastUpdate: Date.now(),
    history: []
};

// 1. PREVIEW ENGINE (HIGH INTERACTION)
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
    UI.preview.src = URL.createObjectURL(blob);
}

window.addEventListener('message', (e) => {
    const pill = document.getElementById('preview-status-pill');
    if(e.data.status === 'OK') {
        pill.textContent = 'PREVIEW OK';
        pill.style.color = 'var(--cyan)';
    } else if(e.data.status === 'ERROR') {
        pill.textContent = 'PREVIEW BROKEN';
        pill.style.color = 'var(--red)';
        showGuide("Preview broken — open repair?");
    }
});

// 2. STORAGE & AUTO-SAVE
function saveDraft() {
    const prefix = state.sandbox ? 'fr_builder_sandbox_' : 'fr_builder_';
    localStorage.setItem(prefix + 'html', UI.editors.html.value);
    localStorage.setItem(prefix + 'css', UI.editors.css.value);
    localStorage.setItem(prefix + 'js', UI.editors.js.value);
    UI.status.textContent = 'DRAFT SAVED';
}

let saveTimer;
function debounceSave() {
    UI.status.textContent = 'WRITING...';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveDraft();
        if(state.autoRepair) runRepair(true);
    }, 1000);
}

// 3. REPAIR ENGINE
function runRepair(silent = false) {
    let fixes = [];
    let html = UI.editors.html.value;
    
    // Simple tag repair
    const tags = ['div', 'section', 'span', 'p', 'header', 'footer'];
    tags.forEach(tag => {
        const opened = (html.match(new RegExp('<'+tag, 'g')) || []).length;
        const closed = (html.match(new RegExp('</'+tag+'>', 'g')) || []).length;
        if(opened > closed) {
            html += `</${tag}>`.repeat(opened - closed);
            fixes.push(`Closed ${opened-closed} ${tag} tags`);
        }
    });

    if(fixes.length > 0) {
        UI.editors.html.value = html;
        updatePreview();
        logEvent(`Repair: ${fixes.join(', ')}`);
        if(!silent) alert("Repaired: " + fixes.join(", "));
    }
}

// 4. GLOBAL COPY SYSTEM
async function copyProject(type = 'all') {
    let text = '';
    if(type === 'all') {
        text = `<!DOCTYPE html><html><head><style>${UI.editors.css.value}</style></head><body>${UI.editors.html.value}<script>${UI.editors.js.value}<\/script></body></html>`;
    } else {
        text = UI.editors[type].value;
    }
    await navigator.clipboard.writeText(text);
    logEvent(`Copied ${type} to clipboard`);
    showGuide("Code copied!");
}

// 5. UI LOGIC
function setupUI() {
    // Curtains
    document.querySelectorAll('.curtain-trigger').forEach(btn => {
        btn.onclick = () => {
            const p = btn.parentElement;
            const active = p.classList.contains('active');
            document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
            if(!active) p.classList.add('active');
        };
    });

    // Editors
    ['html', 'css', 'js'].forEach(lang => {
        UI.editors[lang].oninput = () => {
            updateLineNumbers(lang);
            debounceSave();
            updatePreview();
        };
        updateLineNumbers(lang);
    });

    // Preview
    document.getElementById('preview-drag-handle').onclick = () => {
        UI.sheet.classList.toggle('collapsed');
        document.querySelector('.pull-text').textContent = UI.sheet.classList.contains('collapsed') ? 'PULL TO EXPAND' : 'PULL TO HIDE';
    };

    document.getElementById('btn-focus-mode').onclick = () => {
        UI.sheet.classList.add('full');
    };

    document.getElementById('btn-close-preview').onclick = () => {
        UI.sheet.classList.add('collapsed');
        UI.sheet.classList.remove('full');
    };

    // Actions
    document.getElementById('btn-copy-all').onclick = () => copyProject('all');
    document.getElementById('btn-repair-quick').onclick = () => runRepair();
    document.getElementById('toggle-sandbox').onclick = toggleSandbox;
    document.getElementById('btn-save-stable-quick').onclick = saveStable;
    
    // Search
    document.getElementById('global-search').oninput = (e) => runSearch(e.target.value);
}

function updateLineNumbers(lang) {
    const lines = UI.editors[lang].value.split('\n').length;
    UI.lines[lang].innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
}

function logEvent(msg) {
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    UI.history.prepend(entry);
}

function showGuide(msg) {
    UI.guide.textContent = msg;
    UI.guide.classList.remove('hidden');
    setTimeout(() => UI.guide.classList.add('hidden'), 3000);
}

function toggleSandbox() {
    state.sandbox = !state.sandbox;
    const btn = document.getElementById('toggle-sandbox');
    btn.classList.toggle('active', state.sandbox);
    logEvent(state.sandbox ? "Entered Sandbox" : "Exit Sandbox");
    showGuide(state.sandbox ? "Sandbox Active: Edits isolated" : "Sandbox Closed");
}

function saveStable() {
    const bundle = {
        h: UI.editors.html.value,
        c: UI.editors.css.value,
        j: UI.editors.js.value,
        t: Date.now()
    };
    localStorage.setItem('fr_builder_stable', JSON.stringify(bundle));
    logEvent("Stable baseline saved");
    showGuide("Stable baseline updated");
}

function runSearch(query) {
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    if(!query) return;

    ['html', 'css', 'js'].forEach(lang => {
        const lines = UI.editors[lang].value.split('\n');
        lines.forEach((line, i) => {
            if(line.includes(query)) {
                const div = document.createElement('div');
                div.className = 'search-item';
                div.innerHTML = `<span class="line">${lang.toUpperCase()} L${i+1}</span> ${line.substring(0, 30)}...`;
                div.onclick = () => jumpToCode(lang, i);
                results.appendChild(div);
            }
        });
    });
}

function jumpToCode(lang, line) {
    document.querySelectorAll('.curtain').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-section="${lang}"]`).classList.add('active');
    UI.editors[lang].focus();
    const lineheight = 20.8; // Approx
    UI.editors[lang].scrollTop = line * lineheight;
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    UI.editors.html.value = localStorage.getItem('fr_builder_html') || '<h1>FieldBuilder</h1>';
    UI.editors.css.value = localStorage.getItem('fr_builder_css') || 'body { font-family: sans-serif; padding: 20px; }';
    UI.editors.js.value = localStorage.getItem('fr_builder_js') || 'console.log("System Ready");';
    setupUI();
    updatePreview();
});
