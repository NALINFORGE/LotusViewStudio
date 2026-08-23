/*
 * Lotus Slide direct preview editor — 0.13.0b1.
 *
 * The live preview is also a context selector: clicking an element reveals only
 * the relevant configuration section. Selected visual elements can be resized
 * with the mouse. Preview geometry updates while dragging, but the Home
 * Assistant configuration is committed only on pointer release.
 */

const editorClass = customElements.get("lotus-slide-card-editor");

const clampValue = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const cloneConfig = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const SECTION_TARGETS = Object.freeze({
  "Nom": "general",
  "Comportement": "general",
  "Interaction": "general",
  "Format responsive": "format",
  "Corps / glissière du slider": "track",
  "Bouton du slider": "thumb",
  "Icônes et images d’extrémité": "visuals",
  "Texte": "text",
  "Action Home Assistant": "general",
  "Actions des deux positions": "general",
});

if (editorClass && !editorClass.prototype.__lotusSlideDirectEditorB1Patched) {
  editorClass.prototype.__lotusSlideDirectEditorB1Patched = true;

  const originalSection = editorClass.prototype._section;
  editorClass.prototype._section = function patchedSection(title, description = "") {
    const section = originalSection.call(this, title, description);
    section.dataset.lotusSectionSource = title;
    section.dataset.lotusSectionTarget = SECTION_TARGETS[title] || "general";
    return section;
  };

  const originalIconGroup = editorClass.prototype._renderIconGroup;
  editorClass.prototype._renderIconGroup = function patchedIconGroup(parent, kind, title) {
    const before = new Set(Array.from(parent.children));
    const result = originalIconGroup.call(this, parent, kind, title);
    Array.from(parent.children).forEach((child) => {
      if (!before.has(child) && child.classList?.contains("subgroup")) {
        child.dataset.lotusVisualTarget = kind;
      }
    });
    return result;
  };

  editorClass.prototype._lotusResolvePreviewTarget = function resolvePreviewTarget(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const element = path.find((node) => node instanceof Element && (
      node.classList?.contains("slide-thumb")
      || node.classList?.contains("slide-label")
      || node.classList?.contains("slide-icon-zone")
      || node.classList?.contains("slide-track")
    ));
    if (!element) return null;
    if (element.classList.contains("slide-thumb")) return "thumb";
    if (element.classList.contains("slide-label")) return "text";
    if (element.classList.contains("slide-icon-zone")) {
      return element.dataset.iconKind === "end" ? "end" : "start";
    }
    if (element.classList.contains("slide-track")) return "track";
    return null;
  };

  editorClass.prototype._lotusPreviewElementForTarget = function previewElementForTarget(target) {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!preview || !root) return null;
    if (target === "format") return preview;
    if (target === "track") return root.querySelector(".slide-track");
    if (target === "thumb") return root.querySelector(".slide-thumb");
    if (target === "text") return root.querySelector(".slide-label");
    if (target === "start" || target === "end") {
      const zone = root.querySelector(`.slide-icon-zone[data-icon-kind="${target}"]`);
      if (!zone) return null;
      return zone.querySelector(".slide-side-icon,.slide-side-image") || zone;
    }
    return null;
  };

  editorClass.prototype._lotusApplyContextSections = function applyContextSections() {
    const pane = this.shadowRoot?.querySelector(".config-pane");
    if (!pane) return;
    const selected = this._lotusPreviewSelection || "general";

    pane.querySelectorAll(".editor-section").forEach((section) => {
      const sectionTarget = section.dataset.lotusSectionTarget || "general";
      let visible = false;
      if (selected === "general") visible = sectionTarget === "general";
      else if (selected === "format") visible = sectionTarget === "format";
      else if (selected === "track") visible = sectionTarget === "track";
      else if (selected === "thumb") visible = sectionTarget === "thumb" || sectionTarget === "visuals";
      else if (selected === "text") visible = sectionTarget === "text";
      else if (selected === "start" || selected === "end") visible = sectionTarget === "visuals";
      section.hidden = !visible;

      if (sectionTarget === "visuals") {
        section.querySelectorAll(".subgroup").forEach((group) => {
          const kind = group.dataset.lotusVisualTarget;
          if (!kind) return;
          if (selected === "thumb") group.hidden = kind !== "thumb";
          else if (selected === "start" || selected === "end") group.hidden = kind !== selected;
          else group.hidden = false;
        });
      }
    });

    pane.scrollTop = 0;
  };

  editorClass.prototype._lotusSelectionClassElement = function selectionClassElement() {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!root) return null;
    root.querySelectorAll(".lotus-preview-selected").forEach((node) => node.classList.remove("lotus-preview-selected"));
    const target = this._lotusPreviewSelection;
    let element = null;
    if (target === "track") element = root.querySelector(".slide-track");
    else if (target === "thumb") element = root.querySelector(".slide-thumb");
    else if (target === "text") element = root.querySelector(".slide-label");
    else if (target === "start" || target === "end") element = root.querySelector(`.slide-icon-zone[data-icon-kind="${target}"]`);
    if (element) element.classList.add("lotus-preview-selected");
    return element;
  };

  editorClass.prototype._lotusEnsurePreviewSelectionStyle = function ensurePreviewSelectionStyle() {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!root || root.querySelector('style[data-lotus-direct-editor="1"]')) return;
    const style = document.createElement("style");
    style.dataset.lotusDirectEditor = "1";
    style.textContent = `
      .lotus-preview-selected {
        outline:2px solid var(--primary-color,#03a9f4) !important;
        outline-offset:3px !important;
      }
      .slide-icon-zone.empty { pointer-events:auto !important; }
    `;
    root.appendChild(style);
  };

  editorClass.prototype._lotusPositionResizeOverlay = function positionResizeOverlay() {
    const overlay = this.shadowRoot?.querySelector(".lotus-preview-resize-overlay");
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const target = this._lotusPreviewElementForTarget(this._lotusPreviewSelection);
    if (!overlay || !frame || !target || this._lotusPreviewSelection === "general") {
      if (overlay) overlay.hidden = true;
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    if (!(targetRect.width > 0 && targetRect.height > 0)) {
      overlay.hidden = true;
      return;
    }

    overlay.hidden = false;
    overlay.style.left = `${targetRect.left - frameRect.left}px`;
    overlay.style.top = `${targetRect.top - frameRect.top}px`;
    overlay.style.width = `${targetRect.width}px`;
    overlay.style.height = `${targetRect.height}px`;
  };

  editorClass.prototype._lotusCanResizeSelection = function canResizeSelection() {
    const target = this._lotusPreviewSelection;
    if (["format", "track", "thumb", "text"].includes(target)) return true;
    if (target === "start" || target === "end") {
      const conf = this._config?.icons?.[target];
      if (!conf) return false;
      const hasIcon = String(conf.icon ?? "").trim()
        || String(conf.binary_icon_1 ?? "").trim()
        || String(conf.binary_icon_2 ?? "").trim()
        || (Array.isArray(conf.values) && conf.values.some((entry) => String(entry?.icon ?? "").trim()));
      const hasImage = String(conf.image ?? "").trim()
        || String(conf.binary_image_1 ?? "").trim()
        || String(conf.binary_image_2 ?? "").trim()
        || (Array.isArray(conf.values) && conf.values.some((entry) => String(entry?.image ?? "").trim()));
      return Boolean(hasIcon || hasImage);
    }
    return false;
  };

  editorClass.prototype._lotusRefreshResizeHandle = function refreshResizeHandle() {
    const overlay = this.shadowRoot?.querySelector(".lotus-preview-resize-overlay");
    const handle = overlay?.querySelector(".lotus-preview-resize-handle");
    if (handle) handle.hidden = !this._lotusCanResizeSelection();
    this._lotusPositionResizeOverlay();
  };

  editorClass.prototype._lotusSelectPreviewTarget = function selectPreviewTarget(target) {
    this._lotusPreviewSelection = target || "general";
    this._lotusApplyContextSections();
    this._lotusEnsurePreviewSelectionStyle();
    this._lotusSelectionClassElement();
    this._lotusRefreshResizeHandle();
  };

  editorClass.prototype._lotusResizeDraft = function resizeDraft(session, event) {
    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    const target = session.target;
    const draft = cloneConfig(session.config);

    if (target === "format") {
      const widthRatio = Math.max(0.1, (session.rect.width + dx) / Math.max(1, session.rect.width));
      const heightRatio = Math.max(0.1, (session.rect.height + dy) / Math.max(1, session.rect.height));
      draft.design.width = clampValue(session.config.design.width * widthRatio, 5, 200);
      draft.design.height = clampValue(session.config.design.height * heightRatio, 5, 200);
    } else if (target === "track") {
      const delta = this._config.orientation === "vertical" ? dx : dy;
      const cross = this._config.orientation === "vertical" ? session.rect.width : session.rect.height;
      const ratio = Math.max(0.1, (cross + delta) / Math.max(1, cross));
      draft.track.thickness = clampValue(session.config.track.thickness * ratio, 18, 100);
    } else if (target === "thumb") {
      const ratio = Math.max(0.1, Math.max(
        (session.rect.width + dx) / Math.max(1, session.rect.width),
        (session.rect.height + dy) / Math.max(1, session.rect.height),
      ));
      draft.thumb.size = clampValue(session.config.thumb.size * ratio, 35, 160);
    } else if (target === "start" || target === "end") {
      const ratio = Math.max(0.1, Math.max(
        (session.rect.width + dx) / Math.max(1, session.rect.width),
        (session.rect.height + dy) / Math.max(1, session.rect.height),
      ));
      draft.icons[target].size = clampValue(session.config.icons[target].size * ratio, 12, 100);
    } else if (target === "text") {
      const ratio = Math.max(0.1, (session.rect.height + dy) / Math.max(1, session.rect.height));
      draft.text.font_size = clampValue(session.config.text.font_size * ratio, 8, 36);
    }
    return draft;
  };

  editorClass.prototype._lotusApplyResizePreview = function applyResizePreview(draft) {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    if (!preview) return;
    preview.setConfig(draft);
    preview.hass = this._hass;
    preview.preview = true;
    this._lotusEnsurePreviewSelectionStyle();
    this._lotusSelectionClassElement();
    requestAnimationFrame(() => this._lotusPositionResizeOverlay());
  };

  editorClass.prototype._lotusCommitResizeDraft = function commitResizeDraft(target, draft) {
    if (!draft) return;
    this._commit((config) => {
      if (target === "format") {
        config.design.width = Math.round(draft.design.width * 100) / 100;
        config.design.height = Math.round(draft.design.height * 100) / 100;
      } else if (target === "track") {
        config.track.thickness = Math.round(draft.track.thickness * 100) / 100;
      } else if (target === "thumb") {
        config.thumb.size = Math.round(draft.thumb.size * 100) / 100;
      } else if (target === "start" || target === "end") {
        config.icons[target].size = Math.round(draft.icons[target].size * 100) / 100;
      } else if (target === "text") {
        config.text.font_size = Math.round(draft.text.font_size * 100) / 100;
      }
    });
  };

  editorClass.prototype._lotusStartResize = function startResize(event) {
    if (!this._lotusCanResizeSelection()) return;
    const targetElement = this._lotusPreviewElementForTarget(this._lotusPreviewSelection);
    if (!targetElement) return;
    event.preventDefault();
    event.stopPropagation();

    const session = {
      target: this._lotusPreviewSelection,
      startX: event.clientX,
      startY: event.clientY,
      rect: targetElement.getBoundingClientRect(),
      config: cloneConfig(this._config),
      draft: null,
    };
    this._lotusResizeSession = session;

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      session.draft = this._lotusResizeDraft(session, moveEvent);
      this._lotusApplyResizePreview(session.draft);
    };
    const onEnd = (upEvent) => {
      upEvent.preventDefault();
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      const draft = session.draft;
      this._lotusResizeSession = null;
      if (draft) this._lotusCommitResizeDraft(session.target, draft);
      else this._lotusRefreshResizeHandle();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  };

  editorClass.prototype._lotusInstallDirectPreviewEditor = function installDirectPreviewEditor() {
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!frame || !preview || !root) return;

    frame.classList.add("lotus-direct-preview");
    this._lotusEnsurePreviewSelectionStyle();

    let overlay = frame.querySelector(".lotus-preview-resize-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "lotus-preview-resize-overlay";
      overlay.innerHTML = '<div class="lotus-preview-resize-handle" aria-label="Resize"></div>';
      frame.appendChild(overlay);
      overlay.querySelector(".lotus-preview-resize-handle")
        ?.addEventListener("pointerdown", (event) => this._lotusStartResize(event));
    }

    if (!frame.dataset.lotusBackgroundSelector) {
      frame.dataset.lotusBackgroundSelector = "1";
      frame.addEventListener("pointerdown", (event) => {
        if (event.target === frame) this._lotusSelectPreviewTarget("general");
      });
    }

    if (!root.querySelector('[data-lotus-selector-listener="1"]')) {
      const sentinel = document.createElement("span");
      sentinel.hidden = true;
      sentinel.dataset.lotusSelectorListener = "1";
      root.appendChild(sentinel);
      root.addEventListener("pointerdown", (event) => {
        if (this._lotusResizeSession) return;
        const target = this._lotusResolvePreviewTarget(event);
        if (!target) return;
        // In the mini editor, a pointer click is an edit-selection gesture.
        // Prevent the preview slider itself from starting a real drag.
        event.preventDefault();
        event.stopImmediatePropagation();
        this._lotusSelectPreviewTarget(target);
      }, true);
    }

    this._lotusSelectPreviewTarget(this._lotusPreviewSelection || "general");
  };

  const originalRender = editorClass.prototype._render;
  editorClass.prototype._render = function patchedRender(...args) {
    const selected = this._lotusPreviewSelection || "general";
    const result = originalRender.apply(this, args);
    this._lotusPreviewSelection = selected;

    const style = document.createElement("style");
    style.dataset.lotusDirectEditorUi = "1";
    style.textContent = `
      .editor-section[hidden], .subgroup[hidden] { display:none !important; }
      .preview-frame.lotus-direct-preview { cursor:default; }
      .lotus-preview-resize-overlay {
        position:absolute;
        z-index:20;
        box-sizing:border-box;
        border:1px dashed var(--primary-color,#03a9f4);
        pointer-events:none;
      }
      .lotus-preview-resize-overlay[hidden] { display:none !important; }
      .lotus-preview-resize-handle {
        position:absolute;
        right:-7px;
        bottom:-7px;
        width:14px;
        height:14px;
        box-sizing:border-box;
        border:2px solid var(--card-background-color,#fff);
        border-radius:50%;
        background:var(--primary-color,#03a9f4);
        box-shadow:0 1px 4px rgba(0,0,0,.3);
        cursor:nwse-resize;
        pointer-events:auto;
        touch-action:none;
      }
      .lotus-preview-resize-handle[hidden] { display:none !important; }
    `;
    this.shadowRoot?.appendChild(style);

    requestAnimationFrame(() => this._lotusInstallDirectPreviewEditor());
    return result;
  };
}
