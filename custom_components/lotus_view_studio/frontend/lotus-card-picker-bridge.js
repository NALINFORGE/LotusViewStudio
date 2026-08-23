/*
 * Compatibility bridge for Home Assistant's native Lovelace card picker.
 *
 * HA snapshots window.customCards into HuiCardPicker._cards from _loadCards().
 * Extra frontend modules may be loaded after a picker instance was initialized.
 * This bridge makes registration deterministic without requiring a manual
 * Lovelace resource: registration is refreshed before each picker load/connect,
 * and already-mounted pickers are rebuilt once.
 */

import { registerLotusCards } from "./lotus-card-registry.js?v=0.12.2";
import { lotusDebug, lotusSetHass } from "./lotus-i18n.js?v=0.12.2";

const PATCHED = Symbol.for("lotusVisual.cardPickerPatched.v1");

function walkRoots(root, callback) {
  if (!root?.querySelectorAll) return;
  for (const picker of root.querySelectorAll("hui-card-picker")) callback(picker);
  for (const node of root.querySelectorAll("*")) {
    if (node.shadowRoot) walkRoots(node.shadowRoot, callback);
  }
}

function refreshPicker(picker) {
  try {
    if (picker?.hass) lotusSetHass(picker.hass);
    registerLotusCards();
    if (typeof picker?._loadCards === "function" && picker.hass && picker.lovelace) {
      picker._loadCards();
      picker.requestUpdate?.();
    }
  } catch (error) {
    lotusDebug("Unable to refresh the card picker", error);
  }
}

async function installCardPickerBridge() {
  registerLotusCards();
  await customElements.whenDefined("hui-card-picker");

  const Picker = customElements.get("hui-card-picker");
  const prototype = Picker?.prototype;
  if (!prototype) return;

  if (!prototype[PATCHED]) {
    const originalLoadCards = prototype._loadCards;
    if (typeof originalLoadCards === "function") {
      prototype._loadCards = function (...args) {
        registerLotusCards();
        return originalLoadCards.apply(this, args);
      };
    }

    const originalConnectedCallback = prototype.connectedCallback;
    prototype.connectedCallback = function (...args) {
      registerLotusCards();
      const result = typeof originalConnectedCallback === "function"
        ? originalConnectedCallback.apply(this, args)
        : undefined;
      queueMicrotask(() => refreshPicker(this));
      return result;
    };

    Object.defineProperty(prototype, PATCHED, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }

  // Home Assistant can keep dialog elements mounted between openings.
  // Rebuild any picker that already exists now.
  walkRoots(document, refreshPicker);

  // Also cover pickers mounted later inside newly-created shadow roots/dialogs.
  const observer = new MutationObserver(() => {
    walkRoots(document, (picker) => {
      if (!picker.dataset?.lotusRegistryRefresh) {
        if (picker.dataset) picker.dataset.lotusRegistryRefresh = "1";
        refreshPicker(picker);
      }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.LotusVisual = Object.assign(window.LotusVisual || {}, {
    cardPickerBridge: "0.5.3",
  });
}

installCardPickerBridge().catch((error) => {
  lotusDebug("Unable to install the card-picker bridge", error);
});
