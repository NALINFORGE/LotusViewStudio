/*
 * Lotus Digicode contextual editor — internal 0.13.0b4 test candidate.
 *
 * - Contextual configuration driven by preview selection.
 * - Explicit Edit/Test toggle. Test mode validates the real PIN with
 *   preview=true and therefore never executes the protected Home Assistant action.
 * - Keeps security/PIN/action configuration together in the main card editor.
 */

import { lotusT } from "./lotus-i18n.js?v=0.13.0b4";

const editorClass = customElements.get("lotus-digicode-card-editor");

const SECTION_TARGETS = Object.freeze({
  "Nom": "security",
  "Code et sécurité": "security",
  "Format responsive": "frame",
  "Interaction": "interaction",
  "Contour du digicode": "frame",
  "Matrice des touches": "keys",
  "Ordre et placement des touches": "keys",
  "Touches": "keys",
  "Contenu des touches": "keys",
  "Cadran de saisie": "display",
  "Correction de saisie": "controls",
  "Retour en cas d’erreur": "feedback",
  "Retour en cas de code correct": "feedback",
});

if (editorClass && !editorClass.prototype.__lotusDigicodeContextEditorB4) {
  editorClass.prototype.__lotusDigicodeContextEditorB4 = true;

  const originalSection = editorClass.prototype._section;
  editorClass.prototype._section = function contextualSection(title, description = "") {
    const section = originalSection.call(this, title, description);
    section.dataset.lotusSectionSource = title;
    section.dataset.lotusSectionTarget = SECTION_TARGETS[title] || "security";
    return section;
  };

  editorClass.prototype._lotusDigicodePreview = function digicodePreview() {
    return this.shadowRoot?.querySelector("lotus-digicode-card.digicode-preview")
      || this.shadowRoot?.querySelector("lotus-digicode-card");
  };

  editorClass.prototype._lotusDigicodeRuntimeRoot = function digicodeRuntimeRoot() {
    return this._lotusDigicodePreview()?.shadowRoot || null;
  };

  editorClass.prototype._lotusDigicodeTargetFromEvent = function targetFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const element = path.find((node) => node instanceof Element && (
      node.classList?.contains("key")
      || node.classList?.contains("code-display")
      || node.classList?.contains("keys-area")
      || node.classList?.contains("digicode-shell")
    ));
    if (!element) return "frame";
    if (element.classList.contains("key")) {
      return element.classList.contains("backspace") || element.classList.contains("clear")
        ? "controls"
        : "keys";
    }
    if (element.classList.contains("code-display")) return "display";
    if (element.classList.contains("keys-area")) return "keys";
    return "frame";
  };

  editorClass.prototype._lotusDigicodeApplyContext = function applyContext() {
    const pane = this.shadowRoot?.querySelector(".config-pane");
    if (!pane) return;
    const target = this._lotusDigicodeSelection || "security";
    pane.querySelectorAll(".editor-section").forEach((section) => {
      section.hidden = section.dataset.lotusSectionTarget !== target;
    });
    pane.scrollTop = 0;
  };

  editorClass.prototype._lotusDigicodeMarkSelection = function markSelection() {
    const root = this._lotusDigicodeRuntimeRoot();
    if (!root) return;
    root.querySelectorAll(".lotus-digicode-edit-selected")
      .forEach((node) => node.classList.remove("lotus-digicode-edit-selected"));
    if (this._lotusDigicodeTestMode) return;

    const target = this._lotusDigicodeSelection || "security";
    let nodes = [];
    if (target === "frame") nodes = [root.querySelector(".digicode-shell")];
    else if (target === "display" || target === "feedback") nodes = [root.querySelector(".code-display")];
    else if (target === "keys") nodes = Array.from(root.querySelectorAll(".key.digit"));
    else if (target === "controls") nodes = Array.from(root.querySelectorAll(".key.backspace,.key.clear"));
    nodes.filter(Boolean).forEach((node) => node.classList.add("lotus-digicode-edit-selected"));
  };

  editorClass.prototype._lotusDigicodeSyncToolbar = function syncToolbar() {
    const toolbar = this.shadowRoot?.querySelector(".lotus-digicode-toolbar");
    if (!toolbar) return;
    toolbar.querySelectorAll("button[data-target]").forEach((button) => {
      const active = !this._lotusDigicodeTestMode
        && button.dataset.target === (this._lotusDigicodeSelection || "security");
      button.disabled = Boolean(this._lotusDigicodeTestMode);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const toggle = toolbar.querySelector("button[data-test-toggle]");
    if (toggle) {
      const testing = Boolean(this._lotusDigicodeTestMode);
      toggle.classList.toggle("test-active", testing);
      toggle.title = lotusT(testing ? "Revenir au mode édition" : "Tester le digicode");
      toggle.setAttribute("aria-label", toggle.title);
      toggle.querySelector("ha-icon")?.setAttribute("icon", testing ? "mdi:pencil" : "mdi:play-circle-outline");
    }
  };

  editorClass.prototype._lotusDigicodeSelect = function select(target) {
    if (this._lotusDigicodeTestMode) return;
    this._lotusDigicodeSelection = target || "security";
    this._lotusDigicodeApplyContext();
    this._lotusDigicodeMarkSelection();
    this._lotusDigicodeSyncToolbar();
  };

  editorClass.prototype._lotusDigicodeSetTestMode = function setTestMode(value) {
    this._lotusDigicodeTestMode = Boolean(value);
    const preview = this._lotusDigicodePreview();
    // Critical safety invariant: the editor always runs the card in preview mode.
    // A correct server PIN can be tested, but digicode_security.py refuses to
    // execute the configured action when preview=true.
    if (preview) preview.preview = true;
    this.shadowRoot?.querySelector(".preview-frame")
      ?.classList.toggle("lotus-digicode-test-mode", this._lotusDigicodeTestMode);
    this.shadowRoot?.querySelector(".preview-pane")
      ?.classList.toggle("lotus-digicode-testing", this._lotusDigicodeTestMode);
    this.shadowRoot?.querySelector(".lotus-digicode-test-badge")
      ?.toggleAttribute("hidden", !this._lotusDigicodeTestMode);
    this._lotusDigicodeMarkSelection();
    this._lotusDigicodeSyncToolbar();
  };

  editorClass.prototype._lotusDigicodeEnsureRuntimeStyle = function ensureRuntimeStyle() {
    const root = this._lotusDigicodeRuntimeRoot();
    if (!root || root.querySelector('style[data-lotus-digicode-context="1"]')) return;
    const style = document.createElement("style");
    style.dataset.lotusDigicodeContext = "1";
    style.textContent = `
      .code-display { pointer-events:auto !important; }
      .lotus-digicode-edit-selected {
        outline:2px solid var(--primary-color,#03a9f4) !important;
        outline-offset:3px !important;
      }
      .key.lotus-digicode-edit-selected { outline-offset:1px !important; }
    `;
    root.appendChild(style);
  };

  editorClass.prototype._lotusDigicodeInstallUi = function installUi() {
    const previewPane = this.shadowRoot?.querySelector(".preview-pane");
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const preview = this._lotusDigicodePreview();
    const root = preview?.shadowRoot;
    if (!previewPane || !frame || !preview || !root) return;

    this._lotusDigicodeEnsureRuntimeStyle();

    if (!previewPane.querySelector(".lotus-digicode-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.className = "lotus-digicode-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", lotusT("Configuration du digicode"));
      const items = [
        ["security", "mdi:shield-key-outline", "PIN, sécurité et action"],
        ["frame", "mdi:crop-square", "Format et contour du digicode"],
        ["display", "mdi:form-textbox-password", "Cadran de saisie"],
        ["keys", "mdi:dialpad", "Touches numériques"],
        ["controls", "mdi:backspace-outline", "Touches de correction"],
        ["feedback", "mdi:check-circle-outline", "Retours correct / erreur"],
        ["interaction", "mdi:gesture-tap", "Interaction"],
      ];
      for (const [target, iconName, label] of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.target = target;
        button.title = lotusT(label);
        button.setAttribute("aria-label", button.title);
        button.setAttribute("aria-pressed", "false");
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", iconName);
        button.appendChild(icon);
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this._lotusDigicodeSelect(target);
        });
        toolbar.appendChild(button);
      }

      const separator = document.createElement("span");
      separator.className = "lotus-toolbar-separator";
      toolbar.appendChild(separator);

      const testButton = document.createElement("button");
      testButton.type = "button";
      testButton.dataset.testToggle = "1";
      testButton.className = "test-toggle";
      const testIcon = document.createElement("ha-icon");
      testIcon.setAttribute("icon", "mdi:play-circle-outline");
      testButton.appendChild(testIcon);
      testButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._lotusDigicodeSetTestMode(!this._lotusDigicodeTestMode);
      });
      toolbar.appendChild(testButton);
      previewPane.appendChild(toolbar);

      const badge = document.createElement("div");
      badge.className = "lotus-digicode-test-badge";
      badge.textContent = lotusT("MODE TEST — validation réelle du PIN, aucune action Home Assistant exécutée");
      badge.hidden = true;
      previewPane.appendChild(badge);
    }

    if (!root.querySelector('[data-lotus-digicode-selector-listener="1"]')) {
      const sentinel = document.createElement("span");
      sentinel.hidden = true;
      sentinel.dataset.lotusDigicodeSelectorListener = "1";
      root.appendChild(sentinel);
      root.addEventListener("pointerdown", (event) => {
        if (this._lotusDigicodeTestMode || this._activeResize) return;
        const target = this._lotusDigicodeTargetFromEvent(event);
        event.preventDefault();
        event.stopImmediatePropagation();
        this._lotusDigicodeSelect(target);
      }, true);
    }

    if (!frame.dataset.lotusDigicodeBackgroundSelector) {
      frame.dataset.lotusDigicodeBackgroundSelector = "1";
      frame.addEventListener("pointerdown", (event) => {
        if (this._lotusDigicodeTestMode || this._activeResize) return;
        if (event.target === frame) this._lotusDigicodeSelect("security");
      });
    }

    this._lotusDigicodeApplyContext();
    this._lotusDigicodeSetTestMode(Boolean(this._lotusDigicodeTestMode));
    this._lotusDigicodeSelect(this._lotusDigicodeSelection || "security");
  };

  const originalRender = editorClass.prototype._render;
  editorClass.prototype._render = function contextualRender(...args) {
    const selection = this._lotusDigicodeSelection || "security";
    const testMode = Boolean(this._lotusDigicodeTestMode);
    const result = originalRender.apply(this, args);
    this._lotusDigicodeSelection = selection;
    this._lotusDigicodeTestMode = testMode;

    const style = document.createElement("style");
    style.dataset.lotusDigicodeContextUi = "1";
    style.textContent = `
      .editor-section[hidden], .lotus-digicode-test-badge[hidden] { display:none !important; }
      .preview-title { top:58px !important; }
      .lotus-digicode-toolbar {
        position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:50;
        display:flex; align-items:center; gap:4px; max-width:calc(100% - 20px); padding:5px;
        box-sizing:border-box; overflow-x:auto;
        border:1px solid var(--divider-color,rgba(127,127,127,.25)); border-radius:12px;
        background:var(--card-background-color,#fff); box-shadow:0 2px 8px rgba(0,0,0,.12);
      }
      .lotus-digicode-toolbar button {
        appearance:none; flex:0 0 auto; display:grid; place-items:center; width:34px; height:34px; padding:0;
        border:1px solid transparent; border-radius:9px; color:var(--secondary-text-color,#727272);
        background:transparent; cursor:pointer;
      }
      .lotus-digicode-toolbar button:hover:not(:disabled) {
        color:var(--primary-text-color,#212121);
        background:color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent);
      }
      .lotus-digicode-toolbar button.active {
        color:var(--text-primary-color,#fff); background:var(--primary-color,#03a9f4);
      }
      .lotus-digicode-toolbar button:disabled:not([data-test-toggle]) { opacity:.32; cursor:default; }
      .lotus-digicode-toolbar button.test-active {
        color:var(--text-primary-color,#fff); background:var(--success-color,#43a047);
      }
      .lotus-digicode-toolbar ha-icon { --mdc-icon-size:20px; }
      .lotus-toolbar-separator { flex:0 0 1px; width:1px; height:24px; margin:0 2px; background:var(--divider-color,rgba(127,127,127,.25)); }
      .preview-pane.lotus-digicode-testing .preview-title { display:none !important; }
      .lotus-digicode-test-badge {
        position:absolute; left:50%; top:58px; transform:translateX(-50%); z-index:49;
        max-width:calc(100% - 24px); padding:4px 8px; box-sizing:border-box;
        border-radius:8px; background:var(--success-color,#43a047); color:white;
        font-size:10px; font-weight:700; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .preview-frame.lotus-digicode-test-mode { cursor:default; }
      .preview-frame.lotus-digicode-test-mode .resize-handle,
      .preview-frame.lotus-digicode-test-mode .size-badge { display:none !important; }
      .security-action {
        margin:14px 0; padding:12px; border:1px solid var(--divider-color,rgba(127,127,127,.22));
        border-radius:10px; background:color-mix(in srgb,var(--secondary-background-color,#f5f5f5) 72%,transparent);
      }
      .security-action h4 { margin:0 0 6px; font-size:14px; }
      .security-action .helper { margin:0 0 8px; }
      .security-note[data-kind="warning"], .action-sync-warning { color:var(--warning-color,#f57c00); }
      @media (max-width:980px) {
        .preview-title { top:auto !important; }
          .lotus-digicode-toolbar { position:absolute; }
      }
    `;
    this.shadowRoot?.appendChild(style);

    requestAnimationFrame(() => this._lotusDigicodeInstallUi());
    return result;
  };
}
