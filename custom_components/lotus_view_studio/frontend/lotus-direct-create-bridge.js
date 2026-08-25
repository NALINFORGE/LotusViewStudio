/*
 * Lotus View Studio direct-create bridge — v0.13.0b3
 *
 * Goal
 * ----
 * The Lotus first-level "Ajouter" menu has already selected the authoring
 * tool. Choosing Lotus Stack, Lotus Slide or Lotus Digicode must therefore open that card's
 * visual editor directly, without displaying Home Assistant's global card
 * picker a second time.
 *
 * Home Assistant's native create flow is intentionally retained for the edit
 * and save stages. hui-view emits showCreateCardDialog(), which fires a
 * composed "show-dialog" event containing:
 *   - dialogTag: "hui-dialog-create-card"
 *   - dialogImport: the native lazy import function
 *   - dialogParams: the create-card parameters
 *
 * The 0.5.1 bridge patched hui-dialog-create-card only after
 * customElements.whenDefined(). On a cold frontend this raced Home Assistant's
 * first lazy import: HA could call showDialog() before the patch existed, so
 * the global picker appeared.
 *
 * 0.5.2 fixes the race at its source. A capture listener intercepts the native
 * show-dialog event BEFORE Home Assistant's dialog manager handles it. When a
 * Lotus direct marker is present, the native dialogImport is wrapped so the
 * class is patched immediately after its module loads and BEFORE the dialog
 * manager creates/calls the dialog instance. If the class is already loaded,
 * it is patched synchronously during capture.
 *
 * Ordinary Home Assistant card creation is untouched.
 */

const DIRECT_PREFIX = "__lotus_direct__:";
const PATCHED = Symbol.for("lotusVisual.directCreateBridge.v2");
const CAPTURE_INSTALLED = Symbol.for("lotusVisual.directCreateCapture.v2");
const IMPORT_WRAPPED = Symbol.for("lotusVisual.directCreateImportWrapped.v2");
const lotusDebug = (...args) => globalThis.LotusVisualI18n?.debug?.(...args);

const DIRECT_CARD_TAGS = Object.freeze({
  "lotus-visual-stack": "lotus-visual-stack",
  "lotus-slide-card": "lotus-slide-card",
  "lotus-digicode-card": "lotus-digicode-card",
});

const deepClone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

function directCardType(suggestedCards) {
  if (!Array.isArray(suggestedCards)) return null;
  const marker = suggestedCards.find(
    (entry) => typeof entry === "string" && entry.startsWith(DIRECT_PREFIX),
  );
  return marker ? marker.slice(DIRECT_PREFIX.length) : null;
}

function getStubConfig(cardType) {
  const tag = DIRECT_CARD_TAGS[cardType];
  if (!tag) return null;

  const CardClass = customElements.get(tag);
  if (!CardClass || typeof CardClass.getStubConfig !== "function") return null;

  const stub = CardClass.getStubConfig();
  return stub && typeof stub === "object" ? deepClone(stub) : null;
}

function cleanNativeParams(params) {
  return {
    ...params,
    // The marker is Lotus-only. Never let the native picker display it as a
    // suggested card if a later compatibility fallback is required.
    suggestedCards: undefined,
  };
}

function patchNativeCreateDialog() {
  const DialogClass = customElements.get("hui-dialog-create-card");
  const prototype = DialogClass?.prototype;
  if (!prototype) return false;
  if (prototype[PATCHED]) return true;

  const originalShowDialog = prototype.showDialog;
  if (typeof originalShowDialog !== "function") return false;

  prototype.showDialog = function lotusDirectShowDialog(params) {
    const cardType = directCardType(params?.suggestedCards);
    if (!cardType) {
      return originalShowDialog.call(this, params);
    }

    const stub = getStubConfig(cardType);
    if (!stub) {
      lotusDebug(`Direct creation unavailable: getStubConfig() is missing for ${cardType}.`);
      return originalShowDialog.call(this, cleanNativeParams(params));
    }

    // Let HA initialise all native create-dialog state (_params, container,
    // narrow mode, etc.), but prevent the Lotus marker from entering its UI.
    const result = originalShowDialog.call(this, cleanNativeParams(params));

    if (typeof this._handleCardPicked !== "function") {
      lotusDebug("Direct creation unavailable: Home Assistant no longer exposes _handleCardPicked().");
      return result;
    }

    try {
      // This is deliberately Home Assistant's own picked-card path. It opens
      // hui-dialog-edit-card with isNew=true and keeps HA responsible for
      // Enregistrer / Annuler and for the final Lovelace save.
      this._handleCardPicked({ detail: { config: stub } });
    } catch (error) {
      lotusDebug(`Unable to open the ${cardType} editor directly.`, error);
    }

    return result;
  };

  Object.defineProperty(prototype, PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return true;
}

function wrapNativeDialogImport(detail) {
  const originalImport = detail?.dialogImport;
  if (typeof originalImport !== "function") return false;
  if (originalImport[IMPORT_WRAPPED]) return true;

  const wrappedImport = async () => {
    const imported = await originalImport();

    // customElements.define() runs while the module evaluates, so the class
    // should already be available here. whenDefined() is kept as a defensive
    // compatibility fallback for future HA chunking changes.
    if (!patchNativeCreateDialog()) {
      await customElements.whenDefined("hui-dialog-create-card");
      if (!patchNativeCreateDialog()) {
        throw new Error(
          "Lotus View Studio: hui-dialog-create-card chargé mais impossible à patcher.",
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

  // The show-dialog detail object is intentionally mutable. Home Assistant's
  // dialog manager reads it only after this capture phase completes.
  detail.dialogImport = wrappedImport;
  return true;
}

function interceptShowDialog(event) {
  const detail = event?.detail;
  if (!detail || detail.dialogTag !== "hui-dialog-create-card") return;

  const cardType = directCardType(detail.dialogParams?.suggestedCards);
  if (!cardType || !DIRECT_CARD_TAGS[cardType]) return;

  // If HA already loaded this dialog earlier in the session, patch it now,
  // synchronously, before the bubbling dialog-manager listener runs.
  if (patchNativeCreateDialog()) return;

  // Cold frontend: guarantee the patch is installed inside HA's own lazy
  // import, before make-dialog-manager creates the dialog element.
  if (!wrapNativeDialogImport(detail)) {
    lotusDebug(`Unable to intercept the native import for ${cardType}.`);
  }
}

function installCaptureBridge() {
  if (window[CAPTURE_INSTALLED]) return;

  Object.defineProperty(window, CAPTURE_INSTALLED, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  // show-dialog is bubbles:true + composed:true in Home Assistant. Capturing
  // on window guarantees this runs before makeDialogManager's bubbling
  // listener, including through nested shadow roots.
  window.addEventListener("show-dialog", interceptShowDialog, true);

  // Also patch immediately when HA happened to load the dialog before Lotus.
  patchNativeCreateDialog();
  customElements.whenDefined("hui-dialog-create-card")
    .then(() => patchNativeCreateDialog())
    .catch(() => {});

  window.LotusVisual = Object.assign(window.LotusVisual || {}, {
    directCreateBridge: "0.13.0b3",
    directCreateMode: "capture-import-before-dialog",
  });
}

installCaptureBridge();
