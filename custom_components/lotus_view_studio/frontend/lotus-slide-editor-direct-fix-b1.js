/* Refinements for the 0.13.0b1 direct Lotus Slide preview editor. */

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

  const originalInstall = editorClass.prototype._lotusInstallDirectPreviewEditor;
  editorClass.prototype._lotusInstallDirectPreviewEditor = function refinedInstall() {
    originalInstall.call(this);
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
