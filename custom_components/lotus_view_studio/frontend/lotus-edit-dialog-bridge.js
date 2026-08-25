import { LOTUS_PACKAGE_VERSION } from "./lotus-version.js";
/*
 * Lotus View Studio edit-dialog bridge
 *
 * Home Assistant's native hui-dialog-edit-card owns two columns on desktop:
 *   - .element-editor  (ha-scrollbar)
 *   - .element-preview (ha-scrollbar)
 *
 * Lotus Stack, Lotus Slide and Lotus Digicode already provide their own editor + live preview.
 * Keeping HA's outer preview and outer scrollbar therefore creates a nested
 * editor, a second vertical scrollbar, and (for Slide) a squeezed/partly hidden
 * Lotus preview.
 *
 * This bridge keeps Home Assistant responsible for the dialog, tabs, YAML,
 * visibility, Save and Cancel. It changes only the desktop layout while the
 * edited card is a Lotus Stack, Lotus Slide or Lotus Digicode:
 *   - hide HA's duplicate .element-preview;
 *   - make .element-editor use the full content width;
 *   - remove HA's outer vertical scrolling;
 *   - let the Lotus inspector/config pane own the only configuration scrollbar;
 *   - make hui-card-element-editor and the Lotus editor fill the available
 *     height so the live preview can be vertically centered.
 *
 * The patch is installed through the native show-dialog lazy import so it is in
 * place before the first hui-dialog-edit-card instance is created on a cold HA
 * frontend. Non-Lotus cards are not changed.
 */

import { lotusDebug, lotusSetHass, lotusT } from "./lotus-i18n.js";

const PATCHED = Symbol.for("lotusVisual.editDialogBridge.v0837");
const CAPTURE_INSTALLED = Symbol.for("lotusVisual.editDialogCapture.v0837");
const IMPORT_WRAPPED = Symbol.for("lotusVisual.editDialogImportWrapped.v0837");
const SCHEDULE_STATE = new WeakMap();
const CARD_EDITOR_PATCHED = Symbol.for("lotusVisual.cardElementEditorLayout.v0837");
const CONDITIONAL_EDITOR_PATCHED = Symbol.for("lotusVisual.conditionalCardEditorLayout.v0837");
const DIGICODE_VALIDITY_EVENT = "lotus-digicode-validity-changed";
const DIGICODE_VALIDITY_LISTENER = Symbol.for("lotusVisual.digicodeSaveValidityListener.v0837");

function isLotusStack(config) {
  return Boolean(
    config &&
    (
      config.type === "custom:lotus-visual-stack" ||
      config.type === "custom:visual-stack-card" ||
      (
        config.type === "picture-elements" &&
        config.lotus_visual_stack &&
        typeof config.lotus_visual_stack === "object"
      )
    )
  );
}

function isLotusSlide(config) {
  return Boolean(config && config.type === "custom:lotus-slide-card");
}

function isLotusDigicode(config) {
  return Boolean(config && config.type === "custom:lotus-digicode-card");
}

function lotusKind(config) {
  if (isLotusStack(config)) return "stack";
  if (isLotusSlide(config)) return "slide";
  if (isLotusDigicode(config)) return "digicode";
  return null;
}

function isNativeConditional(config) {
  return Boolean(
    config &&
    typeof config === "object" &&
    config.type === "conditional" &&
    config.card &&
    typeof config.card === "object"
  );
}

function conditionalLotusKind(config) {
  return isNativeConditional(config) ? lotusKind(config.card) : null;
}

function dialogContainsDigicode(dialog) {
  const config = dialog?._cardConfig;
  return isLotusDigicode(config) || conditionalLotusKind(config) === "digicode";
}

function findDigicodeEditorFromCardEditor(cardEditor) {
  if (!cardEditor) return null;
  const internal = cardEditor._configElement;
  if (internal?.localName === "lotus-digicode-card-editor") return internal;
  const direct = cardEditor.shadowRoot?.querySelector("lotus-digicode-card-editor");
  if (direct) return direct;

  const conditional = internal?.localName === "hui-conditional-card-editor"
    ? internal
    : cardEditor.shadowRoot?.querySelector("hui-conditional-card-editor");
  const nestedCardEditor = conditional?.shadowRoot?.querySelector("hui-card-element-editor");
  if (nestedCardEditor) return findDigicodeEditorFromCardEditor(nestedCardEditor);
  return null;
}

function digicodeSaveValidation(dialog) {
  if (!dialogContainsDigicode(dialog)) return { valid: true, pending: false, reason: "" };
  const cardEditor = dialog?.shadowRoot?.querySelector("hui-card-element-editor");
  const editor = findDigicodeEditorFromCardEditor(cardEditor);
  if (!editor || typeof editor.getSaveValidation !== "function") {
    return {
      valid: false,
      pending: true,
      reason: "Vérification du code PIN Lotus Digicode en cours.",
    };
  }
  try {
    const result = editor.getSaveValidation();
    return result && typeof result === "object"
      ? result
      : { valid: false, pending: true, reason: "Vérification du code PIN Lotus Digicode en cours." };
  } catch (error) {
    return {
      valid: false,
      pending: false,
      reason: `Impossible de vérifier le code PIN : ${String(error?.message || error || "erreur inconnue")}`,
    };
  }
}

function ensureDigicodeValidityListener(dialog) {
  if (!dialog || dialog[DIGICODE_VALIDITY_LISTENER]) return;
  const listener = (event) => {
    if (event.type !== DIGICODE_VALIDITY_EVENT) return;
    // The custom editor may have emitted config-changed immediately before
    // this validity notification. Let Home Assistant finish propagating that
    // config through hui-card-element-editor -> hui-dialog-edit-card before we
    // ask the dialog to render again; otherwise the dialog can re-inject its
    // previous card config into the Digicode editor.
    requestAnimationFrame(() => {
      dialog.requestUpdate?.();
      scheduleDialogLayout(dialog, 4);
    });
  };
  dialog.addEventListener(DIGICODE_VALIDITY_EVENT, listener, true);
  Object.defineProperty(dialog, DIGICODE_VALIDITY_LISTENER, {
    value: listener,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function unwrapNativeConditional(config) {
  if (!isNativeConditional(config)) return config;
  const source = structuredClone(config);
  const nested = source.card && typeof source.card === "object" ? source.card : {};
  const { type: _type, conditions: _conditions, card: _card, ...outerMetadata } = source;
  return { ...nested, ...outerMetadata };
}

function findOwningEditDialog(node) {
  let current = node;
  const visited = new Set();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current.localName === "hui-dialog-edit-card") return current;
    const root = current.getRootNode?.();
    if (root?.host && root.host !== current) current = root.host;
    else current = current.parentElement;
  }
  return null;
}

function findConditionalEditor(cardEditor) {
  return cardEditor?.shadowRoot?.querySelector("hui-conditional-card-editor") || null;
}

function ensureDialogStyle(root) {
  let style = root.querySelector('style[data-lotus-edit-dialog-layout="1"]');
  if (style) return style;

  style = document.createElement("style");
  style.dataset.lotusEditDialogLayout = "1";
  style.textContent = `
    :host([data-lotus-immersive-editor]) ha-dialog::part(body) {
      overflow: hidden !important;
    }

    :host([data-lotus-immersive-editor]) .content {
      width: 100% !important;
      max-width: 100% !important;
      height: var(--code-mirror-max-height) !important;
      max-height: var(--code-mirror-max-height) !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    :host([data-lotus-immersive-editor]) .content > .element-preview {
      display: none !important;
      width: 0 !important;
      min-width: 0 !important;
      max-width: 0 !important;
      flex: 0 0 0 !important;
      overflow: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    :host([data-lotus-immersive-editor]) .content > .element-editor {
      display: block !important;
      flex: 1 1 100% !important;
      flex-basis: 100% !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      scrollbar-width: none !important;
      padding-inline-end: 0 !important;
      margin-bottom: 0 !important;
    }

    :host([data-lotus-immersive-editor]) .content > .element-editor::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    :host([data-lotus-immersive-editor]) .content > .element-editor > hui-card-element-editor {
      display: flex !important;
      width: 100% !important;
      max-width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    @media all and (max-width: 980px), all and (max-height: 500px) {
      :host([data-lotus-immersive-editor]) ha-dialog::part(body) {
        overflow: auto !important;
      }

      :host([data-lotus-immersive-editor]) .content {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }

      :host([data-lotus-immersive-editor]) .content > .element-editor,
      :host([data-lotus-immersive-editor]) .content > .element-editor > hui-card-element-editor {
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
      }
    }
  `;
  root.appendChild(style);
  return style;
}

function ensureCardEditorStyle(cardEditor) {
  const root = cardEditor?.shadowRoot;
  if (!root) return false;

  let style = root.querySelector('style[data-lotus-card-editor-layout="1"]');
  if (!style) {
    style = document.createElement("style");
    style.dataset.lotusCardEditorLayout = "1";
    style.textContent = `
      :host([data-lotus-immersive-card-editor]) {
        display: flex !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      :host([data-lotus-immersive-card-editor]) .wrapper {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      :host([data-lotus-immersive-card-editor]) .gui-editor {
        display: flex !important;
        flex-direction: column !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      :host([data-lotus-immersive-card-editor]) .gui-editor > ha-tab-group {
        flex: 0 0 auto !important;
      }

      :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-visual-stack-editor,
      :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-slide-card-editor,
      :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-digicode-card-editor {
        display: block !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      :host([data-lotus-immersive-card-editor]) .gui-editor > hui-conditional-card-editor {
        display: flex !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      :host([data-lotus-immersive-card-editor][data-lotus-yaml-only]) .wrapper {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        overflow: hidden !important;
      }

      :host([data-lotus-immersive-card-editor][data-lotus-yaml-only]) .yaml-editor {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        padding: 0 !important;
      }

      :host([data-lotus-immersive-card-editor][data-lotus-yaml-only]) .yaml-editor > ha-yaml-editor {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
      }

      :host([data-lotus-immersive-card-editor]) .gui-editor > hui-card-visibility-editor,
      :host([data-lotus-immersive-card-editor]) .gui-editor > hui-card-layout-editor {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: auto !important;
      }

      @media all and (max-width: 980px), all and (max-height: 500px) {
        :host([data-lotus-immersive-card-editor]),
        :host([data-lotus-immersive-card-editor]) .wrapper,
        :host([data-lotus-immersive-card-editor]) .gui-editor {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-visual-stack-editor,
        :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-slide-card-editor,
        :host([data-lotus-immersive-card-editor]) .gui-editor > lotus-digicode-card-editor,
        :host([data-lotus-immersive-card-editor]) .gui-editor > hui-conditional-card-editor {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;
    root.appendChild(style);
  }

  return true;
}


function ensureConditionalEditorStyle(conditionalEditor) {
  const root = conditionalEditor?.shadowRoot;
  if (!root) return false;

  let style = root.querySelector('style[data-lotus-conditional-editor-layout="1"]');
  if (!style) {
    style = document.createElement("style");
    style.dataset.lotusConditionalEditorLayout = "1";
    style.textContent = `
      :host([data-lotus-nested-card-editor]) {
        display: flex !important;
        flex-direction: column !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      :host([data-lotus-nested-card-editor]) > ha-tab-group {
        flex: 0 0 auto !important;
      }

      :host([data-lotus-nested-card-editor]) .card {
        display: flex !important;
        flex-direction: column !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      :host([data-lotus-nested-card-editor]) .card-options {
        flex: 0 0 auto !important;
      }

      :host([data-lotus-nested-card-editor]) .card > hui-card-element-editor {
        display: flex !important;
        flex: 1 1 auto !important;
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      @media all and (max-width: 980px), all and (max-height: 500px) {
        :host([data-lotus-nested-card-editor]) {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
        :host([data-lotus-nested-card-editor]) .card,
        :host([data-lotus-nested-card-editor]) .card > hui-card-element-editor {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }
      }
    `;
    root.appendChild(style);
  }

  return true;
}

function clearConditionalEditorState(cardEditor) {
  const conditionalEditor = findConditionalEditor(cardEditor);
  if (!conditionalEditor) return;
  conditionalEditor.removeAttribute("data-lotus-nested-card-editor");
  const nestedEditor = conditionalEditor.shadowRoot?.querySelector("hui-card-element-editor");
  if (nestedEditor) {
    nestedEditor.removeAttribute("data-lotus-immersive-card-editor");
    nestedEditor.removeAttribute("data-lotus-yaml-only");
  }
}

async function removeConditionalFromDialog(dialog, button) {
  const config = dialog?._cardConfig;
  const saveCardConfig = dialog?._params?.saveCardConfig;
  if (!isNativeConditional(config) || typeof saveCardConfig !== "function") return;

  button.disabled = true;
  button.loading = true;
  try {
    const unwrapped = unwrapNativeConditional(config);
    await saveCardConfig(unwrapped);
    dialog._cardConfig = unwrapped;
    dialog._discardDirtyStateChanges?.();
    dialog.closeDialog?.();
  } catch (error) {
    lotusDebug("Unable to remove conditional mode", error);
    button.disabled = false;
    button.loading = false;
  }
}

function syncRemoveConditionalButton(dialog) {
  const root = dialog?.shadowRoot;
  if (!root) return false;
  const footer = root.querySelector("ha-dialog-footer");
  if (!footer) return false;

  let button = footer.querySelector('ha-button[data-lotus-remove-conditional="1"]');
  if (!isNativeConditional(dialog?._cardConfig)) {
    button?.remove();
    return true;
  }

  if (!button) {
    button = document.createElement("ha-button");
    button.dataset.lotusRemoveConditional = "1";
    button.slot = "secondaryAction";
    button.setAttribute("appearance", "plain");
    if (dialog?.hass) lotusSetHass(dialog.hass);
    button.textContent = lotusT("Retirer la condition");
    button.title = lotusT("Supprimer le mode conditionnel sans supprimer la carte");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void removeConditionalFromDialog(dialog, button);
    });

    const guiModeButton = footer.querySelector(".gui-mode-button");
    if (guiModeButton?.nextSibling) footer.insertBefore(button, guiModeButton.nextSibling);
    else if (guiModeButton) footer.appendChild(button);
    else footer.prepend(button);
  }
  button.disabled = false;
  return true;
}

function patchConditionalCardEditor() {
  const ConditionalEditorClass = customElements.get("hui-conditional-card-editor");
  const prototype = ConditionalEditorClass?.prototype;
  if (!prototype) return false;
  if (prototype[CONDITIONAL_EDITOR_PATCHED]) return true;

  const originalUpdated = prototype.updated;
  prototype.updated = function lotusConditionalCardEditorUpdated(...args) {
    const result = typeof originalUpdated === "function"
      ? originalUpdated.apply(this, args)
      : undefined;
    requestAnimationFrame(() => {
      const dialog = findOwningEditDialog(this);
      if (dialog) scheduleDialogLayout(dialog, 12);
    });
    return result;
  };

  Object.defineProperty(prototype, CONDITIONAL_EDITOR_PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return true;
}

function patchCardElementEditor() {
  const CardEditorClass = customElements.get("hui-card-element-editor");
  const prototype = CardEditorClass?.prototype;
  if (!prototype) return false;
  if (prototype[CARD_EDITOR_PATCHED]) return true;

  const originalUpdated = prototype.updated;
  prototype.updated = function lotusCardElementEditorUpdated(...args) {
    const result = typeof originalUpdated === "function"
      ? originalUpdated.apply(this, args)
      : undefined;
    if (this.hasAttribute?.("data-lotus-immersive-card-editor")) {
      if (this.GUImode === false) this.setAttribute("data-lotus-yaml-only", "1");
      else this.removeAttribute("data-lotus-yaml-only");
      requestAnimationFrame(() => {
        ensureCardEditorStyle(this);
        const dialog = findOwningEditDialog(this);
        if (dialog) scheduleDialogLayout(dialog, 4);
      });
    }
    return result;
  };

  Object.defineProperty(prototype, CARD_EDITOR_PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return true;
}

function restoreDialog(dialog) {
  if (!dialog) return;
  dialog.removeAttribute("data-lotus-immersive-editor");
  const root = dialog.shadowRoot;
  const outerEditor = root?.querySelector(".element-editor");
  const outerPreview = root?.querySelector(".element-preview");
  const cardEditor = root?.querySelector("hui-card-element-editor");

  // hui-dialog-edit-card creates both native panes with ha-scrollbar. Restore
  // those classes when the persistent HA dialog is reused for a non-Lotus card
  // or while a conditional card is showing its Conditions tab.
  if (outerEditor) {
    outerEditor.classList.add("ha-scrollbar");
    outerEditor.removeAttribute("data-lotus-no-outer-scroll");
    for (const property of [
      "display", "flex", "flex-basis", "width", "max-width", "height",
      "max-height", "min-width", "min-height", "overflow", "padding-inline-end",
      "margin-bottom",
    ]) outerEditor.style.removeProperty(property);
  }
  if (outerPreview) {
    outerPreview.hidden = false;
    outerPreview.classList.add("ha-scrollbar");
    outerPreview.removeAttribute("aria-hidden");
    outerPreview.removeAttribute("inert");
    for (const property of [
      "display", "visibility", "width", "min-width", "max-width", "flex",
      "flex-basis", "overflow", "padding", "margin",
    ]) outerPreview.style.removeProperty(property);
  }
  if (cardEditor) {
    cardEditor.removeAttribute("data-lotus-immersive-card-editor");
    cardEditor.removeAttribute("data-lotus-yaml-only");
    clearConditionalEditorState(cardEditor);
  }
}

function applyImmersiveDialogChrome(dialog, kind) {
  const root = dialog?.shadowRoot;
  if (!root) return { content: null, outerEditor: null, outerPreview: null, cardEditor: null };

  ensureDialogStyle(root);
  dialog.setAttribute("data-lotus-immersive-editor", kind);

  const content = root.querySelector(".content");
  const outerEditor = root.querySelector(".element-editor");
  const outerPreview = root.querySelector(".element-preview");
  const cardEditor = outerEditor?.querySelector("hui-card-element-editor");

  // HA applies haStyleScrollbar through this class. Removing the class is
  // deliberate: the Lotus editor's own inspector is the only vertical scroller.
  if (outerEditor) {
    outerEditor.classList.remove("ha-scrollbar");
    outerEditor.setAttribute("data-lotus-no-outer-scroll", "1");
    outerEditor.scrollTop = 0;
    outerEditor.style.setProperty("display", "block", "important");
    outerEditor.style.setProperty("flex", "1 1 100%", "important");
    outerEditor.style.setProperty("flex-basis", "100%", "important");
    outerEditor.style.setProperty("width", "100%", "important");
    outerEditor.style.setProperty("max-width", "100%", "important");
    outerEditor.style.setProperty("height", "100%", "important");
    outerEditor.style.setProperty("max-height", "100%", "important");
    outerEditor.style.setProperty("min-width", "0", "important");
    outerEditor.style.setProperty("min-height", "0", "important");
    outerEditor.style.setProperty("overflow", "hidden", "important");
    outerEditor.style.setProperty("padding-inline-end", "0", "important");
    outerEditor.style.setProperty("margin-bottom", "0", "important");
  }

  if (outerPreview) {
    // The Lotus custom editors already own their live preview. Hiding HA's
    // duplicate preview gives the nested editor the same geometry as when the
    // card is edited directly (outside a conditional wrapper).
    outerPreview.hidden = true;
    outerPreview.classList.remove("ha-scrollbar");
    outerPreview.setAttribute("aria-hidden", "true");
    outerPreview.setAttribute("inert", "");
    outerPreview.style.setProperty("display", "none", "important");
    outerPreview.style.setProperty("visibility", "hidden", "important");
    outerPreview.style.setProperty("width", "0", "important");
    outerPreview.style.setProperty("min-width", "0", "important");
    outerPreview.style.setProperty("max-width", "0", "important");
    outerPreview.style.setProperty("flex", "0 0 0", "important");
    outerPreview.style.setProperty("flex-basis", "0", "important");
    outerPreview.style.setProperty("overflow", "hidden", "important");
    outerPreview.style.setProperty("padding", "0", "important");
    outerPreview.style.setProperty("margin", "0", "important");
  }

  if (content) content.scrollTop = 0;

  if (cardEditor) {
    cardEditor.setAttribute("data-lotus-immersive-card-editor", kind);
    if (cardEditor.GUImode === false) cardEditor.setAttribute("data-lotus-yaml-only", "1");
    else cardEditor.removeAttribute("data-lotus-yaml-only");
    ensureCardEditorStyle(cardEditor);
  }

  return { content, outerEditor, outerPreview, cardEditor };
}

function applyDialogLayout(dialog) {
  const config = dialog?._cardConfig;
  const directKind = lotusKind(config);
  const nestedKind = conditionalLotusKind(config);
  const root = dialog?.shadowRoot;

  if (!root) return { active: false, pending: true, ready: false };

  // This action is intentionally available for every native conditional card,
  // not only for Lotus cards. It unwraps the card without deleting it.
  syncRemoveConditionalButton(dialog);

  if (directKind) {
    const { content, outerEditor, outerPreview, cardEditor } = applyImmersiveDialogChrome(dialog, directKind);
    return {
      active: true,
      pending: false,
      ready: Boolean(content && outerEditor && outerPreview && cardEditor?.shadowRoot),
    };
  }

  if (nestedKind) {
    const outerCardEditor = root.querySelector(".element-editor hui-card-element-editor");

    // The full YAML editor for the conditional wrapper should also use the full
    // dialog width. In GUI mode, the Conditions tab keeps HA's native 50/50
    // editor+preview. Only the Card tab becomes immersive.
    if (outerCardEditor?.GUImode === false) {
      const parts = applyImmersiveDialogChrome(dialog, `conditional-${nestedKind}`);
      return {
        active: true,
        pending: false,
        ready: Boolean(parts.content && parts.outerEditor && parts.outerPreview && parts.cardEditor?.shadowRoot),
      };
    }

    const conditionalEditor = findConditionalEditor(outerCardEditor);
    if (!conditionalEditor?.shadowRoot) {
      restoreDialog(dialog);
      return { active: false, pending: true, ready: false };
    }

    patchConditionalCardEditor();
    const cardTabActive = conditionalEditor._cardTab === true
      || Boolean(conditionalEditor.shadowRoot.querySelector(".card"));

    if (!cardTabActive) {
      // Conditions tab: preserve Home Assistant's own editor and its outer live
      // preview. This is the layout the user expects when editing conditions.
      restoreDialog(dialog);
      return { active: false, pending: false, ready: true };
    }

    const parts = applyImmersiveDialogChrome(dialog, `conditional-${nestedKind}`);
    const liveConditionalEditor = findConditionalEditor(parts.cardEditor) || conditionalEditor;
    liveConditionalEditor.setAttribute("data-lotus-nested-card-editor", nestedKind);
    ensureConditionalEditorStyle(liveConditionalEditor);

    const nestedCardEditor = liveConditionalEditor.shadowRoot?.querySelector("hui-card-element-editor");
    if (nestedCardEditor) {
      nestedCardEditor.setAttribute("data-lotus-immersive-card-editor", nestedKind);
      if (nestedCardEditor.GUImode === false) nestedCardEditor.setAttribute("data-lotus-yaml-only", "1");
      else nestedCardEditor.removeAttribute("data-lotus-yaml-only");
      ensureCardEditorStyle(nestedCardEditor);
    }

    return {
      active: true,
      pending: !nestedCardEditor?.shadowRoot,
      ready: Boolean(
        parts.content
        && parts.outerEditor
        && parts.outerPreview
        && parts.cardEditor?.shadowRoot
        && liveConditionalEditor.shadowRoot
        && nestedCardEditor?.shadowRoot
      ),
    };
  }

  restoreDialog(dialog);
  return { active: false, pending: false, ready: true };
}

function scheduleDialogLayout(dialog, frames = 18) {
  if (!dialog) return;

  const previous = SCHEDULE_STATE.get(dialog);
  if (previous?.raf) cancelAnimationFrame(previous.raf);

  const state = { raf: 0, count: 0 };
  SCHEDULE_STATE.set(dialog, state);

  const run = () => {
    state.raf = 0;
    const result = applyDialogLayout(dialog);
    state.count += 1;

    // Keep re-applying during the first render frames because both the outer
    // conditional editor and the nested Lotus editor are loaded asynchronously.
    if ((result.active || result.pending) && state.count < frames) {
      state.raf = requestAnimationFrame(run);
    }
  };

  state.raf = requestAnimationFrame(run);
}

function patchNativeEditDialog() {
  const DialogClass = customElements.get("hui-dialog-edit-card");
  const prototype = DialogClass?.prototype;
  if (!prototype) return false;
  if (prototype[PATCHED]) return true;

  patchCardElementEditor();
  patchConditionalCardEditor();

  const originalShowDialog = prototype.showDialog;
  const originalUpdated = prototype.updated;
  const originalCloseDialog = prototype.closeDialog;
  const originalSave = prototype._save;
  const canSaveDescriptor = Object.getOwnPropertyDescriptor(prototype, "_canSave");

  if (typeof originalShowDialog !== "function") return false;

  if (typeof canSaveDescriptor?.get === "function") {
    Object.defineProperty(prototype, "_canSave", {
      configurable: canSaveDescriptor.configurable !== false,
      enumerable: canSaveDescriptor.enumerable === true,
      get() {
        const nativeCanSave = canSaveDescriptor.get.call(this);
        if (!nativeCanSave) return false;
        if (!dialogContainsDigicode(this)) return true;
        return digicodeSaveValidation(this).valid === true;
      },
    });
  }

  if (typeof originalSave === "function") {
    prototype._save = async function lotusValidatedSave(...args) {
      if (dialogContainsDigicode(this)) {
        const validation = digicodeSaveValidation(this);
        if (!validation.valid) {
          const cardEditor = this.shadowRoot?.querySelector("hui-card-element-editor");
          const editor = findDigicodeEditorFromCardEditor(cardEditor);
          editor?._updateSaveGuard?.();
          editor?.shadowRoot?.querySelector('[data-save-guard="1"]')?.scrollIntoView?.({ block: "nearest" });
          this.requestUpdate?.();
          return;
        }
      }
      return originalSave.apply(this, args);
    };
  }

  prototype.showDialog = async function lotusShowEditDialog(params) {
    ensureDigicodeValidityListener(this);
    const promise = originalShowDialog.call(this, params);
    scheduleDialogLayout(this);
    try {
      return await promise;
    } finally {
      scheduleDialogLayout(this);
    }
  };

  prototype.updated = function lotusUpdated(...args) {
    const result = typeof originalUpdated === "function"
      ? originalUpdated.apply(this, args)
      : undefined;
    scheduleDialogLayout(this, 8);
    return result;
  };

  if (typeof originalCloseDialog === "function") {
    prototype.closeDialog = function lotusCloseDialog(...args) {
      const result = originalCloseDialog.apply(this, args);
      // Do not restore before HA's dirty-state confirmation has decided to
      // close. A later non-Lotus showDialog/updated call restores the layout.
      if (result !== false) requestAnimationFrame(() => restoreDialog(this));
      return result;
    };
  }

  Object.defineProperty(prototype, PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return true;
}

function wrapEditDialogImport(detail) {
  const originalImport = detail?.dialogImport;
  if (typeof originalImport !== "function") return false;
  if (originalImport[IMPORT_WRAPPED]) return true;

  const wrappedImport = async () => {
    const imported = await originalImport();
    if (!patchNativeEditDialog()) {
      await customElements.whenDefined("hui-dialog-edit-card");
      if (!patchNativeEditDialog()) {
        throw new Error(
          "Lotus View Studio: hui-dialog-edit-card chargé mais impossible à patcher.",
        );
      }
    }
    return imported;
  };

  Object.defineProperty(wrappedImport, IMPORT_WRAPPED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  detail.dialogImport = wrappedImport;
  return true;
}

function interceptShowDialog(event) {
  const detail = event?.detail;
  if (!detail || detail.dialogTag !== "hui-dialog-edit-card") return;

  if (patchNativeEditDialog()) return;
  wrapEditDialogImport(detail);
}

function installBridge() {
  if (window[CAPTURE_INSTALLED]) return;

  Object.defineProperty(window, CAPTURE_INSTALLED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  window.addEventListener("show-dialog", interceptShowDialog, true);

  patchNativeEditDialog();
  customElements.whenDefined("hui-dialog-edit-card")
    .then(() => patchNativeEditDialog())
    .catch(() => {});
  customElements.whenDefined("hui-card-element-editor")
    .then(() => patchCardElementEditor())
    .catch(() => {});
  customElements.whenDefined("hui-conditional-card-editor")
    .then(() => patchConditionalCardEditor())
    .catch(() => {});

  window.LotusVisual = Object.assign(window.LotusVisual || {}, {
    editDialogBridge: LOTUS_PACKAGE_VERSION,
    editDialogMode: "visual-preview-yaml-code-only",
  });
}

installBridge();
