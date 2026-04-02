<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>FIELDBUILDER // CORE</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
</head>
<body>

    <div id="master-site" class="master-container">
        <header class="toolbar">
            <div class="toolbar-top">
                <div class="brand">
                    <span class="brand-name">FIELDBUILDER</span>
                    <div id="status-indicator" class="status-pill">SYSTEM READY</div>
                </div>
                <div class="toolbar-actions">
                    <button id="btn-copy-all" class="btn-subtle">COPY ALL</button>
                    <button id="btn-menu" class="btn-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            
            <div class="quick-action-bar">
                <button id="btn-save-stable-quick" class="qa-btn">SAVE STABLE</button>
                <button id="btn-snapshot-quick" class="qa-btn">SNAPSHOT</button>
                <button id="toggle-sandbox" class="qa-btn">SANDBOX MODE</button>
                <button id="btn-export-quick" class="qa-btn">EXPORT ZIP</button>
                <button id="btn-repair-quick" class="qa-btn">AUTO-REPAIR</button>
            </div>
        </header>

        <main class="build-area">
            <section class="curtain" data-section="search">
                <button class="curtain-trigger">GLOBAL SEARCH</button>
                <div class="curtain-content">
                    <div class="search-container">
                        <input type="text" id="global-search" placeholder="Find code across all layers...">
                        <div id="search-results" class="search-results-panel"></div>
                    </div>
                </div>
            </section>

            <section class="curtain active" data-section="html">
                <button class="curtain-trigger">HTML STRUCTURE</button>
                <div class="curtain-content">
                    <div class="editor-wrapper">
                        <div class="line-numbers" id="ln-html"></div>
                        <textarea id="editor-html" spellcheck="false" class="code-editor"></textarea>
                    </div>
                </div>
            </section>

            <section class="curtain" data-section="css">
                <button class="curtain-trigger">CSS STYLING</button>
                <div class="curtain-content">
                    <div class="editor-wrapper">
                        <div class="line-numbers" id="ln-css"></div>
                        <textarea id="editor-css" spellcheck="false" class="code-editor"></textarea>
                    </div>
                </div>
            </section>

            <section class="curtain" data-section="js">
                <button class="curtain-trigger">JS LOGIC</button>
                <div class="curtain-content">
                    <div class="editor-wrapper">
                        <div class="line-numbers" id="ln-js"></div>
                        <textarea id="editor-js" spellcheck="false" class="code-editor"></textarea>
                    </div>
                </div>
            </section>

            <section class="curtain" data-section="versions">
                <button class="curtain-trigger">VERSION HISTORY</button>
                <div class="curtain-content">
                    <button id="btn-restore-stable" class="btn-subtle" style="width: 100%; margin-bottom: 15px;">RESTORE STABLE BASELINE</button>
                    <div id="snapshot-list" class="snapshot-history"></div>
                </div>
            </section>
        </main>

        <div id="guide-toast" class="guide-toast hidden"></div>
        <div class="history-log" id="action-history"></div>
    </div>

    <div id="experiment-site" class="preview-sheet collapsed">
        <div class="preview-handle" id="preview-drag-handle">
            <div class="handle-bar"></div>
            <div class="handle-labels">
                <span id="preview-status-pill" class="p-status">PREVIEW OK</span>
                <span class="pull-text">PULL TO EXPAND</span>
            </div>
        </div>
        <div class="preview-toolbar">
            <button id="btn-focus-mode" class="btn-subtle">FULLSCREEN</button>
            <button id="btn-close-preview" class="btn-subtle">MINIMIZE</button>
        </div>
        <div class="preview-body">
            <iframe id="preview-iframe" sandbox="allow-scripts allow-forms allow-modals allow-same-origin"></iframe>
        </div>
    </div>

    <div id="global-menu" class="menu-overlay hidden">
        <div class="menu-content">
            <h3>MASTER CONTROLS</h3>
            <div class="menu-grid">
                <button id="m-copy-html">COPY HTML</button>
                <button id="m-copy-css">COPY CSS</button>
                <button id="m-copy-js">COPY JS</button>
                <button id="m-export-single" style="color: var(--purple); border-color: var(--purple);">EXPORT SINGLE FILE (.html)</button>
                <hr style="border: 0; border-top: 1px solid var(--border); width: 100%;">
                <button id="m-repair-toggle">AUTO-REPAIR: OFF</button>
                <button id="m-clear-data" style="color: var(--red);">WIPE ALL LOCAL DATA</button>
            </div>
            <button id="btn-menu-close" class="btn-primary" style="width: 100%;">EXIT MENU</button>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
