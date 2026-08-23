/* Refinements for the 0.13.0b1 direct Lotus Slide preview editor. */

import { lotusT } from "./lotus-i18n.js?v=0.13.0b1";

const editorClass = customElements.get("lotus-slide-card-editor");

if (editorClass && editorClass.prototype.__lotusSlideDirectEditorB1Patched
  && !editorClass.prototype.__lotusSlideDirectEditorB1Refined) {
  editorClass.prototype.__lotusSlideDirectEditorB1Refined = true;

  const originalEnsureStyle = editorClass.prototype._lotusEnsurePreviewSelectionStyle;
  editorClass.prototype._lotusEnsurePreviewSelectionStyle = function refinedSelectionStyle() {
    originalEnsureStyle.call(this);
    const root = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview")?.shadowRoot;
    if (!root || root.querySelector('style[data-lotus-direct-editor-input="1"]')) return;
    const style = document.createElement("style");
    style.dataset.lotusDirectEditorInput = "1";
    style.textContent = `
      /* Runtime end zones are non-interactive. Inside the editor they must be
         selectable even when the visual is empty. */
      .slide-icon-zone,
      .slide-label { pointer-events:auto !important; }
    `;
    root.appendChild(style);
  };

  editorClass.prototype._lotusToolbarSideMeta = function toolbarSideMeta(kind) {
    const vertical = this._config?.orientation === "vertical";
    const reverse = this._config?.reverse === true;
    if (vertical) {
      const startHigh = reverse;
      if (kind === "start") {
        return {
          icon: startHigh ? "mdi:chevron-up" : "mdi:chevron-down",
          label: startHigh ? "Extrémité haute / départ" : "Extrémité basse / départ",
        };
      }
      return {
        icon: startHigh ? "mdi:chevron-down" : "mdi:chevron-up",
        label: startHigh ? "Extrémité basse / arrivée" : "Extrémité haute / arrivée",
      };
    }
    const startRight = reverse;
    if (kind === "start") {
      return {
        icon: startRight ? "mdi:chevron-right" : "mdi:chevron-left",
        label: startRight ? "Extrémité droite / départ" : "Extrémité gauche / départ",
      };
    }
    return {
      icon: startRight ? "mdi:chevron-left" : "mdi:chevron-right",
      label: startRight ? "Extrémité gauche / arrivée" : "Extrémité droite / arrivée",
    };
  };

  editorClass.prototype._lotusToolbarTarget = function toolbarTarget(selection) {
    return selection === "format" ? "general" : (selection || "general");
  };

  editorClass.prototype._lotusSyncContextToolbar = function syncContextToolbar() {
    const toolbar = this.shadowRoot?.querySelector(".lotus-slide-context-toolbar");
    if (!toolbar) return;
    const activeTarget = this._lotusToolbarTarget(this._lotusPreviewSelection);
    toolbar.querySelectorAll("button[data-lotus-target]").forEach((button) => {
      const active = button.dataset.lotusTarget === activeTarget;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  editorClass.prototype._lotusEnsureContextToolbar = function ensureContextToolbar() {
    const previewPane = this.shadowRoot?.querySelector(".preview-pane");
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    if (!previewPane || !frame) return;

    let toolbar = previewPane.querySelector(".lotus-slide-context-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "lotus-slide-context-toolbar";
      toolbar.setAttribute("role", "toolbar");
      toolbar.setAttribute("aria-label", lotusT("Configuration du slider"));
      previewPane.appendChild(toolbar);
    }

    const start = this._lotusToolbarSideMeta("start");
    const end = this._lotusToolbarSideMeta("end");
    const items = [
      ["general", "mdi:tune-variant", "Comportement"],
      ["track", "mdi:minus-thick", "Corps / glissière du slider"],
      ["start", start.icon, start.label],
      ["thumb", "mdi:circle-double", "Bouton du slider"],
      ["end", end.icon, end.label],
      ["text", "mdi:format-text", "Texte"],
      ["interaction", "mdi:gesture-tap", "Interaction"],
    ];

    toolbar.replaceChildren(...items.map(([target, iconName, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lotusTarget = target;
      button.title = lotusT(label);
      button.setAttribute("aria-label", lotusT(label));
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
        this._lotusSelectPreviewTarget(target);
      });
      return button;
    }));

    if (!this.shadowRoot.querySelector('style[data-lotus-context-toolbar="1"]')) {
      const style = document.createElement("style");
      style.dataset.lotusContextToolbar = "1";
      style.textContent = `
        .preview-pane { position:relative; }
        .preview-title { top:54px !important; }
        .preview-frame { padding-top:76px !important; }
        .lotus-slide-context-toolbar {
          position:absolute;
          top:8px;
          left:50%;
          transform:translateX(-50%);
          z-index:40;
          display:flex;
          align-items:center;
          gap:4px;
          max-width:calc(100% - 24px);
          padding:5px;
          box-sizing:border-box;
          overflow-x:auto;
          border:1px solid var(--divider-color,rgba(127,127,127,.25));
          border-radius:12px;
          background:color-mix(in srgb, var(--card-background-color,#fff) 92%, transparent);
          box-shadow:0 2px 8px rgba(0,0,0,.12);
          backdrop-filter:blur(8px);
        }
        .lotus-slide-context-toolbar button {
          appearance:none;
          flex:0 0 auto;
          display:grid;
          place-items:center;
          width:34px;
          height:34px;
          padding:0;
          border:1px solid transparent;
          border-radius:9px;
          color:var(--secondary-text-color,#727272);
          background:transparent;
          cursor:pointer;
        }
        .lotus-slide-context-toolbar button:hover {
          color:var(--primary-text-color,#212121);
          background:color-mix(in srgb, var(--primary-color,#03a9f4) 10%, transparent);
        }
        .lotus-slide-context-toolbar button.active {
          color:var(--text-primary-color,#fff);
          border-color:color-mix(in srgb, var(--primary-color,#03a9f4) 72%, transparent);
          background:var(--primary-color,#03a9f4);
        }
        .lotus-slide-context-toolbar ha-icon { --mdc-icon-size:20px; }
        @media (max-width:720px) {
          .lotus-slide-context-toolbar { gap:2px; }
          .lotus-slide-context-toolbar button { width:32px; height:32px; }
        }
      `;
      this.shadowRoot.appendChild(style);
    }

    this._lotusSyncContextToolbar();
  };

  const originalApplyContext = editorClass.prototype._lotusApplyContextSections;
  editorClass.prototype._lotusApplyContextSections = function refinedApplyContextSections() {
    const pane = this.shadowRoot?.querySelector(".config-pane");
    if (pane) {
      pane.querySelectorAll('.editor-section[data-lotus-section-source="Interaction"]')
        .forEach((section) => { section.dataset.lotusSectionTarget = "interaction"; });
    }

    originalApplyContext.call(this);

    const selected = this._lotusPreviewSelection || "general";
    if (pane && selected === "general") {
      pane.querySelectorAll('.editor-section[data-lotus-section-target="format"]')
        .forEach((section) => { section.hidden = false; });
    } else if (pane && selected === "interaction") {
      pane.querySelectorAll(".editor-section").forEach((section) => {
        section.hidden = section.dataset.lotusSectionTarget !== "interaction";
      });
      pane.scrollTop = 0;
    }
    this._lotusSyncContextToolbar();
  };

  const originalSelectTarget = editorClass.prototype._lotusSelectPreviewTarget;
  editorClass.prototype._lotusSelectPreviewTarget = function refinedSelectPreviewTarget(target) {
    originalSelectTarget.call(this, target);
    this._lotusSyncContextToolbar();
  };

  const originalInstall = editorClass.prototype._lotusInstallDirectPreviewEditor;
  editorClass.prototype._lotusInstallDirectPreviewEditor = function refinedInstall() {
    originalInstall.call(this);
    this._lotusEnsureContextToolbar();

    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!root || root.querySelector('[data-lotus-format-selector="1"]')) return;

    const sentinel = document.createElement("span");
    sentinel.hidden = true;
    sentinel.dataset.lotusFormatSelector = "1";
    root.appendChild(sentinel);

    // A click inside the card but outside rail/thumb/text/end zones selects the
    // card format. A click outside the card in the preview frame still returns
    // to the general settings through the main direct-editor patch.
    root.addEventListener("pointerdown", (event) => {
      if (this._lotusResizeSession) return;
      const target = this._lotusResolvePreviewTarget(event);
      if (target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this._lotusSelectPreviewTarget("format");
    }, true);
  };
}
