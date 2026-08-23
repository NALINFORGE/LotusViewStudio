import {
  LOTUS_VISUAL_VERSION,
  LOTUS_LAYOUT_KEY,
  LOTUS_LEGACY_LAYOUT_KEYS,
  clamp,
  roundPct,
  deepClone,
  lotusThemeCss,
  makeIconButton,
  fireEvent,
  lotusTabEdgeBorderPath,
} from "./lotus-core.js?v=0.12.2";
import { lotusDebug, lotusSetHass, lotusT } from "./lotus-i18n.js?v=0.12.2";
import { registerLotusStackCard, registerLotusSlideCard, registerLotusDigicodeCard } from "./lotus-card-registry.js?v=0.12.2";
import { openLotusTabsEditor } from "./lotus-tabs-editor.js?v=0.12.2";

const DEFAULT_LAYOUT = Object.freeze({ x: 2, y: 2, width: 30, height: 18, locked: false, z: 1 });

// First-level creation menu owned by Lotus View Studio.  Keep this registry small:
// Home Assistant remains the provider for ordinary Lovelace cards, while each
// Lotus-specific authoring tool gets one explicit entry.  New Lotus tools can
// be added here without changing the creation flow or replacing HA's picker.
const LOTUS_CREATE_TOOLS = Object.freeze([
  Object.freeze({
    id: "lotus-stack",
    icon: "mdi:view-grid-plus-outline",
    title: "Lotus Stack",
    description: "Créer une carte composite et ouvrir directement son éditeur graphique Lotus.",
  }),
  Object.freeze({
    id: "lotus-slide",
    icon: "mdi:gesture-swipe-horizontal",
    title: "Lotus Slide",
    description: "Créer un slider de validation et ouvrir directement son éditeur graphique Lotus.",
  }),
  Object.freeze({
    id: "lotus-digicode",
    icon: "mdi:dialpad",
    title: "Lotus Digicode",
    description: "Créer un digicode responsive et ouvrir directement son éditeur graphique Lotus.",
  }),
  Object.freeze({
    id: "home-assistant",
    icon: "mdi:home-assistant",
    title: "Carte Home Assistant",
    description: "Ouvrir le sélecteur natif Home Assistant pour les cartes standards et les autres cartes installées.",
  }),
]);

const LOTUS_VIEW_META_KEY = "lotus_visual";
const LOTUS_VIEW_FILL_KEY = "fill_color";
const LOTUS_VIEW_LEGACY_FILL_KEY = "lotus_fill_color";
const LOTUS_VIEW_TABS_KEY = "tabs";
const LOTUS_VIEW_DISPLAY_KEY = "display";
const LOTUS_VIEW_LAYERS_KEY = "layers";
const LOTUS_GLOBAL_LAYER_SCOPE = "__global__";
const LOTUS_DEFAULT_LAYER_ID = "layer-1";
const LOTUS_EDITOR_SIDEBAR_STORAGE_KEY = "lotus_view_studio_editor_sidebar_v1";
const LOTUS_EDITOR_GUIDES_STORAGE_KEY = "lotus_view_studio_editor_guides_v1";
const LOTUS_CARD_CLIPBOARD_STORAGE_KEY = "lotus_view_studio_card_clipboard_v1";
const LOTUS_LEGACY_EDITOR_SIDEBAR_STORAGE_KEY = "lotus_visual_editor_sidebar_v1";
const LOTUS_LEGACY_EDITOR_GUIDES_STORAGE_KEY = "lotus_visual_editor_guides_v1";
const LOTUS_LEGACY_CARD_CLIPBOARD_STORAGE_KEY = "lotus_visual_card_clipboard_v1";
let LOTUS_CARD_CLIPBOARD_MEMORY = null;

const normalizeLotusCardClipboard = (value) => {
  if (!value || typeof value !== "object" || value.schema !== 1) return null;
  if (!value.card || typeof value.card !== "object" || Array.isArray(value.card)) return null;
  const layout = value.layout && typeof value.layout === "object" ? value.layout : {};
  return {
    schema:1,
    card:deepClone(value.card),
    layout:deepClone(layout),
    source:value.source && typeof value.source === "object" ? deepClone(value.source) : {},
    copiedAt:Number(value.copiedAt) || Date.now(),
  };
};

const loadLotusCardClipboard = () => {
  if (LOTUS_CARD_CLIPBOARD_MEMORY) return deepClone(LOTUS_CARD_CLIPBOARD_MEMORY);
  try {
    const raw = sessionStorage.getItem(LOTUS_CARD_CLIPBOARD_STORAGE_KEY)
      || sessionStorage.getItem(LOTUS_LEGACY_CARD_CLIPBOARD_STORAGE_KEY);
    if (raw) {
      if (!sessionStorage.getItem(LOTUS_CARD_CLIPBOARD_STORAGE_KEY)) {
        sessionStorage.setItem(LOTUS_CARD_CLIPBOARD_STORAGE_KEY, raw);
      }
      const normalized = normalizeLotusCardClipboard(JSON.parse(raw));
      if (normalized) {
        LOTUS_CARD_CLIPBOARD_MEMORY = normalized;
        return deepClone(normalized);
      }
    }
  } catch (_error) {
    // sessionStorage can be unavailable in hardened/private browser contexts.
  }
  return LOTUS_CARD_CLIPBOARD_MEMORY ? deepClone(LOTUS_CARD_CLIPBOARD_MEMORY) : null;
};

const saveLotusCardClipboard = (payload) => {
  const normalized = normalizeLotusCardClipboard(payload);
  if (!normalized) return false;
  LOTUS_CARD_CLIPBOARD_MEMORY = normalized;
  try {
    sessionStorage.setItem(LOTUS_CARD_CLIPBOARD_STORAGE_KEY, JSON.stringify(normalized));
  } catch (_error) {
    // The in-memory fallback still allows copy/paste while this HA page lives.
  }
  return true;
};
// Editor-only layer state must survive Home Assistant rebuilding the view after
// a card save/delete. It is deliberately kept in memory only: leaving edit
// mode clears it, so hidden layers never become a dashboard display setting.
const LOTUS_EDITOR_LAYER_SESSION_CACHE = new Map();
const LOTUS_LAYOUT_POSITION_MIN = -1000;
const LOTUS_LAYOUT_POSITION_MAX = 1000;
const LOTUS_EDITOR_ZOOM_MIN = 10;
const LOTUS_EDITOR_ZOOM_MAX = 800;
const LOTUS_EDITOR_ZOOM_STEP = 10;
const LOTUS_EDITOR_WORKSPACE_PADDING = 18;
const LOTUS_TABS_DEFAULTS = Object.freeze({ position:"bottom", span:100, thickness:7, align:"center" });
const LOTUS_TAB_GRID_DEFAULTS = Object.freeze({ min_width:280, gap:16, padding:16, max_columns:4 });
const HA_THEME_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey",
  "grey", "dark-grey", "blue-grey", "black", "white",
]);

const lotusViewFillCss = (value) => {
  const color = String(value ?? "").trim();
  if (!color || color === "none") return "var(--primary-background-color)";
  if (color === "state") return "var(--primary-background-color)";
  if (HA_THEME_COLORS.has(color)) {
    if (color === "primary") return "var(--primary-color, var(--primary-background-color))";
    if (color === "accent") return "var(--accent-color, var(--primary-color, var(--primary-background-color)))";
    return `var(--${color}-color, var(--primary-background-color))`;
  }
  return color;
};

const loadEditorGuidePreferences = () => {
  try {
    const stored = localStorage.getItem(LOTUS_EDITOR_GUIDES_STORAGE_KEY)
      || localStorage.getItem(LOTUS_LEGACY_EDITOR_GUIDES_STORAGE_KEY)
      || "{}";
    if (!localStorage.getItem(LOTUS_EDITOR_GUIDES_STORAGE_KEY) && stored !== "{}") {
      localStorage.setItem(LOTUS_EDITOR_GUIDES_STORAGE_KEY, stored);
    }
    const raw = JSON.parse(stored);
    return {
      showGrid: raw?.showGrid !== false,
      showFrame: raw?.showFrame !== false,
      gridScope: raw?.gridScope === "viewport" ? "viewport" : "image",
    };
  } catch (_error) {
    return { showGrid:true, showFrame:true, gridScope:"image" };
  }
};

const saveEditorGuidePreferences = (preferences) => {
  try {
    localStorage.setItem(LOTUS_EDITOR_GUIDES_STORAGE_KEY, JSON.stringify(preferences));
  } catch (_error) {
    // Local storage is an editor convenience only. Rendering must continue if
    // the browser blocks it (private mode, embedded webview, quota, etc.).
  }
};

const loadEditorSidebarWidth = () => {
  try {
    const stored = localStorage.getItem(LOTUS_EDITOR_SIDEBAR_STORAGE_KEY)
      ?? localStorage.getItem(LOTUS_LEGACY_EDITOR_SIDEBAR_STORAGE_KEY);
    if (stored != null && localStorage.getItem(LOTUS_EDITOR_SIDEBAR_STORAGE_KEY) == null) {
      localStorage.setItem(LOTUS_EDITOR_SIDEBAR_STORAGE_KEY, stored);
    }
    const value = Number(stored);
    return Number.isFinite(value) ? Math.max(220, value) : 300;
  } catch (_error) {
    return 300;
  }
};

const saveEditorSidebarWidth = (value) => {
  try {
    localStorage.setItem(LOTUS_EDITOR_SIDEBAR_STORAGE_KEY, String(Math.round(value)));
  } catch (_error) {
    // Editor-only preference. Ignore storage failures.
  }
};

const isLotusStackConfig = (config) => Boolean(
  config
  && typeof config === "object"
  && config.type === "picture-elements"
  && config.lotus_visual_stack
  && typeof config.lotus_visual_stack === "object"
);

const isNativeConditionalConfig = (config) => Boolean(
  config
  && typeof config === "object"
  && config.type === "conditional"
  && config.card
  && typeof config.card === "object"
);

// Remove only the native conditional wrapper and keep the actual card. Any
// wrapper-level layout metadata (view_layout, grid_options, etc.) belongs to
// the card's position in the view, so it is transferred to the unwrapped card.
const unwrapNativeConditionalConfig = (config) => {
  if (!isNativeConditionalConfig(config)) return deepClone(config);
  const source = deepClone(config);
  const nested = source.card && typeof source.card === "object" ? source.card : {};
  const { type: _type, conditions: _conditions, card: _card, ...outerMetadata } = source;
  return {
    ...nested,
    ...outerMetadata,
  };
};

const conditionalLotusStackConfig = (config) => {
  if (!isNativeConditionalConfig(config)) return null;
  return isLotusStackConfig(config.card) ? config.card : null;
};

const digicodeConfigFromCard = (config) => {
  if (!config || typeof config !== "object") return null;
  if (config.type === "custom:lotus-digicode-card") return config;
  if (isNativeConditionalConfig(config)) return digicodeConfigFromCard(config.card);
  return null;
};

const slideConfigFromCard = (config) => {
  if (!config || typeof config !== "object") return null;
  if (config.type === "custom:lotus-slide-card") return config;
  if (isNativeConditionalConfig(config)) return slideConfigFromCard(config.card);
  return null;
};

const modalBlockerEnabled = (config) => Boolean(
  digicodeConfigFromCard(config)?.interaction?.modal_blocker === true
  || slideConfigFromCard(config)?.interaction?.modal_blocker === true
);

// Home Assistant card editors are free to emit only the fields they own. In a
// custom view, that can drop view_layout and therefore reset Lotus position and
// size after editing. Keep the original view-layout metadata around the native
// dialog save callback instead of maintaining a second card editor.
const installLotusCardLayoutPreservationBridge = () => {
  customElements.whenDefined("hui-dialog-edit-card").then(() => {
    const DialogClass = customElements.get("hui-dialog-edit-card");
    const prototype = DialogClass?.prototype;
    if (!prototype || prototype.__lotusLayoutPreservationBridge) return;

    const originalShowDialog = prototype.showDialog;
    if (typeof originalShowDialog !== "function") return;

    Object.defineProperty(prototype, "__lotusLayoutPreservationBridge", {
      value: true,
      configurable: false,
      enumerable: false,
    });

    prototype.showDialog = function(params) {
      const originalViewLayout = params?.cardConfig?.view_layout;
      const legacyLotusLayout = LOTUS_LEGACY_LAYOUT_KEYS
        .map((key) => originalViewLayout?.[key])
        .find((value) => value && typeof value === "object") || {};
      const currentLotusLayout = originalViewLayout?.[LOTUS_LAYOUT_KEY];
      const storedLotusLayout = {
        ...deepClone(legacyLotusLayout),
        ...(currentLotusLayout && typeof currentLotusLayout === "object" ? deepClone(currentLotusLayout) : {}),
      };

      if (!Object.keys(storedLotusLayout).length || typeof params?.saveCardConfig !== "function") {
        return originalShowDialog.call(this, params);
      }

      const originalSave = params.saveCardConfig;
      const wrappedParams = {
        ...params,
        saveCardConfig: async (newCardConfig) => {
          const incoming = newCardConfig && typeof newCardConfig === "object"
            ? newCardConfig
            : {};
          const incomingViewLayout = incoming.view_layout && typeof incoming.view_layout === "object"
            ? incoming.view_layout
            : {};
          const mergedViewLayout = {
            ...deepClone(originalViewLayout || {}),
            ...deepClone(incomingViewLayout),
          };

          const incomingLegacyLotusLayout = LOTUS_LEGACY_LAYOUT_KEYS
            .map((key) => incomingViewLayout[key])
            .find((value) => value && typeof value === "object") || {};
          const incomingCurrentLotusLayout = incomingViewLayout[LOTUS_LAYOUT_KEY];
          mergedViewLayout[LOTUS_LAYOUT_KEY] = {
            ...deepClone(storedLotusLayout),
            ...deepClone(incomingLegacyLotusLayout),
            ...(incomingCurrentLotusLayout && typeof incomingCurrentLotusLayout === "object"
              ? deepClone(incomingCurrentLotusLayout)
              : {}),
          };
          for (const legacyKey of LOTUS_LEGACY_LAYOUT_KEYS) delete mergedViewLayout[legacyKey];

          return originalSave({
            ...incoming,
            view_layout: mergedViewLayout,
          });
        },
      };

      return originalShowDialog.call(this, wrappedParams);
    };
  }).catch((error) => {
    lotusDebug("Unable to protect view_layout while editing", error);
  });
};

installLotusCardLayoutPreservationBridge();

class LotusVisualLayout extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._lovelace = undefined;
    this._index = 0;
    this._cards = [];
    this._previousCardCount = 0;
    this._badges = [];
    this._config = undefined;
    this._selectedIndex = null;
    this._selectedIndices = [];
    this._multiSelectMode = false;
    // Layers are scoped to the active tab. When tabs are disabled, the same
    // machinery uses one global scope. Visibility remains editor-only while
    // layer order/name/lock are persisted per scope. Every card resolves to a
    // layer that belongs to its own tab.
    this._editorHiddenLayerIdsByScope = new Map();
    this._editorLockedLayerIdsByScope = new Map();
    this._activeLayerIdsByScope = new Map();
    this._renamingLayerId = null;
    this._layerConfigOverrides = new Map();
    this._restoredLayerEditorStateKey = null;
    this._sidebarWidth = loadEditorSidebarWidth();
    this._sidebarResize = null;
    const guidePreferences = loadEditorGuidePreferences();
    this._showEditorGrid = guidePreferences.showGrid;
    this._showBackgroundFrame = guidePreferences.showFrame;
    this._editorGridScope = guidePreferences.gridScope;
    this._editorZoom = 100;
    this._editorZoomMode = "fit";
    this._viewScrollModeOverride = null;
    this._workingLayouts = new Map();
    this._baselineLayouts = new Map();
    this._dirty = false;
    this._interaction = null;
    this._saveInProgress = false;
    this._statusMessage = "";
    this._statusKind = "";
    this._activeTabId = null;
    this._pendingNewCardTabId = null;
    this._pendingNewCardLayerId = null;
    this._backgroundRatio = null;
    this._backgroundProbeKey = "";
    this._backgroundProbeSequence = 0;
    this._backgroundProbeTimers = [];
    this._modalActiveIndex = null;
    this._resizeObserver = new ResizeObserver(() => this._syncCanvasHeight());
    this._windowResizeHandler = () => {
      this._applySidebarWidth(this._sidebarWidth, false);
      this._syncCanvasHeight();
    };
    this._renderShell();
  }

  connectedCallback() {
    window.addEventListener("resize", this._windowResizeHandler, { passive: true });
    this._resizeObserver.observe(this);
    this._syncCanvasHeight();
  }

  disconnectedCallback() {
    if (this._isEditMode()) this._persistLayerEditorState();
    window.removeEventListener("resize", this._windowResizeHandler);
    this._resizeObserver.disconnect();
    for (const timer of this._backgroundProbeTimers) clearTimeout(timer);
    this._backgroundProbeTimers = [];
    this._backgroundProbeSequence += 1;
    this._endSidebarResize();
    this._endInteraction();
  }

  set hass(value) {
    this._hass = value;
    if (value) lotusSetHass(value);
    for (const card of this._cards) {
      // A saved Lotus Stack is replaced by the dedicated runtime in this view;
      // its native picture-elements instance is therefore disconnected and
      // does not need to process every global Home Assistant state update.
      if (!card?.isConnected) continue;
      try { card.hass = value; } catch (_error) { /* third-party read-only property */ }
    }
    for (const runtime of this.shadowRoot?.querySelectorAll('lotus-visual-stack[data-lotus-runtime="true"]') || []) {
      try { runtime.hass = value; } catch (_error) { /* defensive */ }
    }
    // Entity-state updates cannot change the configured view background ratio.
    // Do not restart background probes / scene geometry work for every light,
    // sensor or helper update.
    this._syncViewBackground(false);
    this._updateToolbar();
  }
  get hass() { return this._hass; }

  set lovelace(value) {
    const previousEdit = Boolean(this._lovelace?.editMode);
    const nextEdit = Boolean(value?.editMode);
    // Home Assistant can replace lovelace.config (and even rebuild this custom
    // element) after any card operation. Capture the editor layer state before
    // accepting that update so card mutations cannot reset hidden/locked/active
    // layer settings.
    if (previousEdit) this._persistLayerEditorState();
    this._lovelace = value;
    this._viewScrollModeOverride = null;
    if (previousEdit !== nextEdit) {
      requestAnimationFrame(() => this._syncCanvasHeight());
    }
    if (previousEdit && !nextEdit) {
      this._clearSelection();
      this._multiSelectMode = false;
      this._editorHiddenLayerIdsByScope.clear();
      this._editorLockedLayerIdsByScope.clear();
      this._activeLayerIdsByScope.clear();
      this._layerConfigOverrides.clear();
      this._restoredLayerEditorStateKey = null;
      LOTUS_EDITOR_LAYER_SESSION_CACHE.clear();
      this._endSidebarResize();
      this._endInteraction();
    } else if (nextEdit) {
      this._restoreLayerEditorState(true);
    }
    this._ensureActiveTab();
    this._renderCards();
    this._updateToolbar();
  }
  get lovelace() { return this._lovelace; }

  set index(value) {
    const nextIndex = Number.isFinite(value) ? value : 0;
    if (nextIndex !== this._index) {
      if (this._isEditMode()) this._persistLayerEditorState();
      this._layerConfigOverrides.clear();
      this._activeLayerIdsByScope.clear();
      this._renamingLayerId = null;
      this._editorHiddenLayerIdsByScope.clear();
      this._editorLockedLayerIdsByScope.clear();
      this._restoredLayerEditorStateKey = null;
    }
    this._index = nextIndex;
    if (this._isEditMode()) this._restoreLayerEditorState();
    this._captureBaselineLayouts(true);
    this._renderCards();
  }
  get index() { return this._index; }

  set cards(value) {
    const previousCount = this._cards.length;
    this._cards = Array.isArray(value) ? value : [];
    if (this._isEditMode()) this._restoreLayerEditorState();
    if (this._cards.length !== previousCount) {
      // Adding/removing cards is not a layer-state operation. In particular,
      // never reveal hidden layers or reset the active/locked layer here.
      this._ensureActiveLayer();
    }
    this._previousCardCount = previousCount;
    this._captureBaselineLayouts(true);
    if (this._isEditMode() && this._cards.length > previousCount) {
      this._selectedIndex = this._cards.length - 1;
      this._selectedIndices = [this._selectedIndex];
      const current = this._workingLayouts.get(this._selectedIndex) || this._readStoredLayout(this._selectedIndex);
      const newCardLayout = {
        ...current,
        layer:this._pendingNewCardLayerId || current?.layer || LOTUS_DEFAULT_LAYER_ID,
      };
      if (this._tabsEnabled()) {
        newCardLayout.tab = this._pendingNewCardTabId || current?.tab || this._ensureActiveTab() || this._defaultTabId();
      } else {
        delete newCardLayout.tab;
      }
      this._workingLayouts.set(this._selectedIndex, newCardLayout);
      this._dirty = true;
      queueMicrotask(() => { if (this._dirty && !this._saveInProgress) void this._applyChanges("Carte ajoutée au calque actif"); });
      this._pendingNewCardTabId = null;
      this._pendingNewCardLayerId = null;
      this._statusMessage = "Carte ajoutée";
      this._statusKind = "success";
    } else {
      this._selectedIndices = this._selectedIndices.filter((index) => index >= 0 && index < this._cards.length);
      this._selectedIndex = this._selectedIndices[0] ?? null;
    }
    this._renderCards();
  }
  get cards() { return this._cards; }

  set badges(value) { this._badges = Array.isArray(value) ? value : []; }
  get badges() { return this._badges; }

  setConfig(config) {
    this._config = config;
    if (this._isEditMode()) this._restoreLayerEditorState();
    this._ensureActiveTab();
    this._captureBaselineLayouts(true);
    this._syncViewBackground();
    this._renderCards();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        ${lotusThemeCss}
        :host {
          display:block;
          width:100%;
          min-width:0;
          --lotus-selection:var(--lotus-accent);
          --lotus-reference:var(--warning-color, #ff9800);
          --lotus-guide-grid:#00e5ff;
          --lotus-guide-grid-shadow:rgba(0,0,0,.88);
          --lotus-guide-frame:#ffb300;
          --lotus-guide-frame-shadow:rgba(0,0,0,.92);
        }
        #root {
          position:relative;
          display:flex;
          flex-direction:column;
          width:100%;
          min-width:0;
          min-height:300px;
          overflow:hidden;
        }
        #toolbar {
          position:relative;
          z-index:40;
          flex:0 0 auto;
          width:100%;
          display:none;
          align-items:center;
          gap:6px;
          min-height:50px;
          box-sizing:border-box;
          padding:5px 8px;
          color:var(--lotus-fg);
          background:color-mix(in srgb, var(--lotus-bg) 97%, transparent);
          border-bottom:1px solid var(--lotus-border);
          box-shadow:0 1px 5px rgba(0,0,0,.08);
          backdrop-filter:blur(10px);
          overflow-x:auto;
          overflow-y:hidden;
          scrollbar-width:thin;
        }
        :host([data-edit-mode="true"]) #toolbar { display:flex; }
        #editorBody {
          position:relative;
          display:flex;
          flex:1 1 auto;
          min-width:0;
          min-height:0;
          overflow:hidden;
        }
        #sideToolbar {
          position:relative;
          z-index:65;
          flex:0 0 var(--lotus-sidebar-width,300px);
          width:var(--lotus-sidebar-width,300px);
          min-width:min(220px,30vw);
          max-width:30vw;
          display:none;
          flex-direction:column;
          box-sizing:border-box;
          color:var(--lotus-fg);
          background:color-mix(in srgb,var(--lotus-bg) 98%,transparent);
          border-left:1px solid var(--lotus-border);
          box-shadow:-1px 0 5px rgba(0,0,0,.07);
          overflow:hidden;
          backdrop-filter:blur(10px);
        }
        :host([data-edit-mode="true"]) #sideToolbar { display:flex; }
        #sideResizeHandle {
          position:absolute;
          left:-5px;
          top:0;
          bottom:0;
          z-index:3;
          width:10px;
          cursor:ew-resize;
          touch-action:none;
        }
        #sideResizeHandle::after {
          content:"";
          position:absolute;
          left:4px;
          top:0;
          bottom:0;
          width:1px;
          background:transparent;
          transition:background .12s ease;
        }
        #sideResizeHandle:hover::after,
        #sideResizeHandle[data-dragging="true"]::after { background:var(--lotus-accent); }
        .side-scroll {
          flex:1 1 auto;
          min-height:0;
          overflow:auto;
          padding:8px;
          scrollbar-width:thin;
        }
        .side-section { padding:2px 0 10px; }
        .side-section[hidden] { display:none !important; }
        .side-heading {
          display:flex;
          align-items:center;
          gap:8px;
          margin:5px 2px 8px;
          color:var(--lotus-muted);
          font-size:11px;
          font-weight:750;
          letter-spacing:.035em;
          text-transform:uppercase;
        }
        .side-heading::after {
          content:"";
          flex:1 1 auto;
          height:1px;
          background:var(--lotus-border);
        }
        .selected-actions {
          display:flex;
          flex-direction:column;
          gap:2px;
        }
        .selected-actions[hidden] { display:none !important; }
        .selection-action-group {
          display:block;
          padding-top:2px;
        }
        .selection-action-group[hidden] { display:none !important; }
        .side-subheading {
          display:flex;
          align-items:center;
          gap:7px;
          margin:8px 2px 5px;
          color:var(--lotus-muted);
          font-size:10px;
          font-weight:700;
          letter-spacing:.025em;
        }
        .side-subheading::after {
          content:"";
          flex:1 1 auto;
          height:1px;
          background:color-mix(in srgb,var(--lotus-border) 85%,transparent);
        }
        .side-tools, .card-action-grid {
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:4px;
          margin-bottom:8px;
        }
        .side-tools .lotus-icon-button,
        .card-action-grid .lotus-icon-button { flex:0 0 auto; }
        .layers-list { display:flex; flex-direction:column; gap:4px; }
        .layer-row {
          display:grid;
          grid-template-columns:30px 30px 30px minmax(0,1fr) 30px;
          align-items:center;
          gap:3px;
          min-height:38px;
          padding:3px;
          border:1px solid transparent;
          border-radius:9px;
        }
        .layer-row[data-active="true"] {
          background:color-mix(in srgb,var(--lotus-accent) 11%,transparent);
          border-color:color-mix(in srgb,var(--lotus-accent) 28%,var(--lotus-border));
        }
        .layer-row[data-hidden="true"] .layer-name-button { opacity:.55; }
        .layer-mini {
          appearance:none;
          display:grid;
          place-items:center;
          width:30px;
          height:30px;
          padding:0;
          color:inherit;
          background:transparent;
          border:1px solid transparent;
          border-radius:7px;
          cursor:pointer;
        }
        .layer-mini:hover:not(:disabled) { background:rgba(127,127,127,.10); border-color:var(--lotus-border); }
        .layer-mini:disabled { opacity:.35; cursor:default; }
        .layer-mini ha-icon { --mdc-icon-size:18px; }
        .layer-name-button {
          min-width:0;
          appearance:none;
          border:0;
          padding:4px 3px;
          background:transparent;
          color:inherit;
          text-align:left;
          cursor:pointer;
        }
        .layer-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:650; }
        .layer-meta { display:block; color:var(--lotus-muted); font-size:10px; line-height:13px; }
        .layer-rename-input {
          width:100%;
          min-width:0;
          box-sizing:border-box;
          height:30px;
          padding:4px 6px;
          color:inherit;
          background:var(--lotus-bg);
          border:1px solid var(--lotus-accent);
          border-radius:6px;
          font:inherit;
          font-size:12px;
        }
        .selected-card-header {
          display:flex;
          align-items:center;
          gap:6px;
          margin:0 2px 8px;
        }
        .selected-card-title {
          flex:1 1 auto;
          min-width:0;
          margin:0;
          font-size:13px;
          font-weight:700;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .selected-card-header-actions {
          flex:0 0 auto;
          display:flex;
          align-items:center;
        }
        .selected-card-header-actions .lotus-icon-button {
          width:32px;
          height:32px;
          border-radius:8px;
        }
        .selected-card-header-actions .lotus-icon-button ha-icon { --mdc-icon-size:19px; }
        .selected-card-layer {
          margin:-4px 2px 8px;
          color:var(--lotus-muted);
          font-size:11px;
        }
        .layers-empty { padding:14px 8px; color:var(--lotus-muted); font-size:12px; text-align:center; }
        :host([data-edit-mode="true"]) .lotus-card[data-editor-hidden="true"] {
          display:none !important;
          pointer-events:none !important;
        }
        .selection-info {
          flex:1 1 auto;
          min-width:140px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap:1px;
          padding:0 4px;
        }
        #selectedName {
          font-size:13px;
          font-weight:650;
          line-height:17px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        #selectedMetrics, #status {
          color:var(--lotus-muted);
          font-size:11px;
          line-height:14px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        #status:empty { display:none; }
        #status[data-kind="error"] { color:var(--lotus-danger); }
        #status[data-kind="success"] { color:var(--success-color, #43a047); }
        #viewport {
          position:relative;
          flex:1 1 auto;
          width:100%;
          min-width:0;
          min-height:0;
          overflow:hidden;
          background:var(--lotus-view-fill, var(--primary-background-color));
        }
        #tabsBar {
          position:absolute;
          z-index:55;
          display:none;
          box-sizing:border-box;
          overflow:hidden;
          background:transparent;
          filter:drop-shadow(0 1px 3px rgba(0,0,0,.12));
        }
        #tabsBar[data-visible="true"] { display:flex; }
        #tabsBar[data-position="top"], #tabsBar[data-position="bottom"] { flex-direction:row; }
        #tabsBar[data-position="left"], #tabsBar[data-position="right"] { flex-direction:column; }
        .lotus-view-tab-slot {
          position:relative;
          flex:1 1 0;
          min-width:0;
          min-height:0;
          display:flex;
          background:var(--lotus-tab-underlay,transparent);
        }
        .lotus-view-tab {
          appearance:none;
          position:relative;
          z-index:1;
          flex:1 1 auto;
          width:100%;
          height:100%;
          min-width:0;
          min-height:0;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          box-sizing:border-box;
          padding:4px 7px;
          overflow:hidden;
          border:0;
          border-right:1px solid color-mix(in srgb,var(--lotus-tab-fg) 18%,transparent);
          background:var(--lotus-tab-bg);
          color:var(--lotus-tab-fg);
          font:inherit;
          cursor:pointer;
          touch-action:manipulation;
        }
        #tabsBar[data-position="left"] .lotus-view-tab,
        #tabsBar[data-position="right"] .lotus-view-tab {
          flex-direction:column;
          border-right:0;
          border-bottom:1px solid color-mix(in srgb,var(--lotus-tab-fg) 18%,transparent);
        }
        #tabsBar[data-position="top"] .lotus-view-tab[data-suppress-divider="true"],
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-suppress-divider="true"] { border-right:0; }
        #tabsBar[data-position="left"] .lotus-view-tab[data-suppress-divider="true"],
        #tabsBar[data-position="right"] .lotus-view-tab[data-suppress-divider="true"] { border-bottom:0; }
        .lotus-tab-edge-border {
          position:absolute;
          z-index:3;
          inset:0;
          width:100%;
          height:100%;
          overflow:visible;
          pointer-events:none;
          fill:none;
        }
        .lotus-tab-edge-border path {
          fill:none;
          stroke:var(--lotus-tab-edge-stroke,var(--divider-color,rgba(127,127,127,.24)));
          stroke-width:var(--lotus-tab-edge-width,1);
          vector-effect:non-scaling-stroke;
          stroke-linecap:butt;
          stroke-linejoin:round;
        }
        .lotus-view-tab[data-active="true"] {
          --lotus-active-outline:color-mix(in srgb,var(--lotus-tab-fg) 35%,transparent);
          box-shadow:
            inset 0 2px 0 var(--lotus-active-outline),
            inset 0 -2px 0 var(--lotus-active-outline),
            inset 2px 0 0 var(--lotus-active-outline),
            inset -2px 0 0 var(--lotus-active-outline);
          font-weight:700;
        }
        #tabsBar[data-position="top"] .lotus-view-tab[data-active="true"][data-suppress-divider="true"],
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-active="true"][data-suppress-divider="true"] {
          box-shadow:
            inset 0 2px 0 var(--lotus-active-outline),
            inset 0 -2px 0 var(--lotus-active-outline),
            inset 2px 0 0 var(--lotus-active-outline);
        }
        #tabsBar[data-position="left"] .lotus-view-tab[data-active="true"][data-suppress-divider="true"],
        #tabsBar[data-position="right"] .lotus-view-tab[data-active="true"][data-suppress-divider="true"] {
          box-shadow:
            inset 0 2px 0 var(--lotus-active-outline),
            inset 2px 0 0 var(--lotus-active-outline),
            inset -2px 0 0 var(--lotus-active-outline);
        }
        .lotus-view-tab span {
          min-width:0;
          max-width:100%;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .lotus-view-tab ha-icon { --mdc-icon-size:22px; flex:0 0 auto; }
        #tabsBar[data-position="top"] .lotus-view-tab[data-edge-corners="start"],
        #tabsBar[data-position="top"] .lotus-view-tab[data-edge-corners="both"] { border-top-left-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="top"] .lotus-view-tab[data-edge-corners="end"],
        #tabsBar[data-position="top"] .lotus-view-tab[data-edge-corners="both"] { border-top-right-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-edge-corners="start"],
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-edge-corners="both"] { border-bottom-left-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-edge-corners="end"],
        #tabsBar[data-position="bottom"] .lotus-view-tab[data-edge-corners="both"] { border-bottom-right-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="left"] .lotus-view-tab[data-edge-corners="start"],
        #tabsBar[data-position="left"] .lotus-view-tab[data-edge-corners="both"] { border-top-left-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="left"] .lotus-view-tab[data-edge-corners="end"],
        #tabsBar[data-position="left"] .lotus-view-tab[data-edge-corners="both"] { border-bottom-left-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="right"] .lotus-view-tab[data-edge-corners="start"],
        #tabsBar[data-position="right"] .lotus-view-tab[data-edge-corners="both"] { border-top-right-radius:var(--lotus-tab-edge-radius,0px); }
        #tabsBar[data-position="right"] .lotus-view-tab[data-edge-corners="end"],
        #tabsBar[data-position="right"] .lotus-view-tab[data-edge-corners="both"] { border-bottom-right-radius:var(--lotus-tab-edge-radius,0px); }
        .lotus-tab-image { display:block; width:28px; height:28px; flex:0 0 28px; overflow:hidden; border-radius:5px; }
        #scrollspace {
          position:absolute;
          inset:0;
          min-width:0;
          min-height:0;
          overflow:hidden;
          background:var(--lotus-view-fill, var(--primary-background-color));
        }
        #scrollspace[data-layout-mode="grid"] {
          overflow:auto;
          overscroll-behavior:contain;
          scrollbar-gutter:stable;
        }
        :host([data-edit-mode="true"]) #scrollspace[data-layout-mode="canvas"] {
          overflow:auto;
          overscroll-behavior:contain;
          scrollbar-gutter:stable;
        }
        :host([data-edit-mode="false"]) #scrollspace[data-layout-mode="canvas"][data-scroll-mode="vertical"] {
          overflow-x:hidden;
          overflow-y:auto;
          overscroll-behavior-y:contain;
          scrollbar-gutter:stable;
        }
        :host([data-edit-mode="false"]) #scrollspace[data-layout-mode="canvas"][data-scroll-mode="horizontal"] {
          overflow-x:auto;
          overflow-y:hidden;
          overscroll-behavior-x:contain;
          scrollbar-gutter:stable;
        }
        .actions {
          display:flex;
          align-items:center;
          gap:1px;
          flex:0 0 auto;
        }
        .toolbar-group {
          display:flex;
          align-items:center;
          gap:1px;
          flex:0 0 auto;
        }
        .action-spacer {
          flex:0 0 9px;
          width:9px;
          height:1px;
          pointer-events:none;
        }
        .editor-zoom-value {
          appearance:none;
          min-width:54px;
          height:36px;
          padding:0 6px;
          border:0;
          border-radius:8px;
          background:transparent;
          color:var(--lotus-fg);
          font:inherit;
          font-size:12px;
          font-weight:650;
          cursor:pointer;
          white-space:nowrap;
        }
        .editor-zoom-value:hover:not(:disabled) {
          background:color-mix(in srgb,var(--lotus-accent) 10%,transparent);
        }
        .editor-zoom-value:disabled { opacity:.42; cursor:default; }
        .actions[hidden], .separator[hidden] {
          display:none !important;
        }
        .separator {
          flex:0 0 1px;
          width:1px;
          height:28px;
          margin:0 5px;
          background:var(--lotus-border);
        }
        #canvas {
          position:absolute;
          isolation:isolate;
          box-sizing:border-box;
          min-width:1px;
          min-height:1px;
          overflow:visible;
          touch-action:none;
          background:transparent;
          transform-origin:top left;
        }
        .editor-guide-grid {
          position:absolute;
          inset:0;
          z-index:0;
          display:none;
          width:100%;
          height:100%;
          overflow:visible;
          pointer-events:none;
        }
        :host([data-edit-mode="true"][data-show-grid="true"][data-grid-scope="image"]) #canvas[data-layout-mode="canvas"] #editorGrid {
          display:block;
        }
        #editorViewportGrid {
          position:absolute;
          inset:0;
          z-index:45;
          display:none;
          width:100%;
          height:100%;
          overflow:hidden;
          pointer-events:none;
        }
        :host([data-edit-mode="true"][data-show-grid="true"][data-grid-scope="viewport"]) #scrollspace[data-layout-mode="canvas"] > #editorViewportGrid {
          display:block;
        }
        .editor-guide-grid .guide-shadow line,
        .editor-guide-grid .guide-color line,
        .editor-guide-grid .guide-major-shadow line,
        .editor-guide-grid .guide-major-color line {
          vector-effect:non-scaling-stroke;
          fill:none;
        }
        .editor-guide-grid .guide-shadow line {
          stroke:var(--lotus-guide-grid-shadow);
          stroke-width:2.6;
          stroke-dasharray:4 6;
          opacity:.72;
        }
        .editor-guide-grid .guide-color line {
          stroke:var(--lotus-guide-grid);
          stroke-width:1.1;
          stroke-dasharray:4 6;
          opacity:.82;
        }
        .editor-guide-grid .guide-major-shadow line {
          stroke:var(--lotus-guide-grid-shadow);
          stroke-width:3.2;
          stroke-dasharray:8 5;
          opacity:.86;
        }
        .editor-guide-grid .guide-major-color line {
          stroke:var(--lotus-guide-grid);
          stroke-width:1.6;
          stroke-dasharray:8 5;
          opacity:.98;
        }
        #backgroundFrameGuide {
          position:absolute;
          inset:0;
          z-index:1;
          display:none;
          box-sizing:border-box;
          pointer-events:none;
          border:2px dashed var(--lotus-guide-frame);
          box-shadow:
            inset 0 0 0 1px var(--lotus-guide-frame-shadow),
            inset 0 0 0 3px rgba(255,255,255,.72);
        }
        :host([data-edit-mode="true"][data-show-frame="true"]) #canvas[data-layout-mode="canvas"][data-has-background-image="true"] #backgroundFrameGuide {
          display:block;
        }
        #sceneExtent {
          position:absolute;
          left:var(--lotus-scene-extent-left, 0%);
          top:var(--lotus-scene-extent-top, 0%);
          z-index:-2;
          width:calc(var(--lotus-scene-extent-width, 100%) + var(--lotus-scene-tail-x, 0px));
          height:calc(var(--lotus-scene-extent-height, 100%) + var(--lotus-scene-tail-y, 0px));
          pointer-events:none;
          visibility:hidden;
        }
        #canvas[data-layout-mode="grid"] {
          position:relative;
          left:0!important;
          top:0!important;
          width:100%!important;
          height:auto!important;
          min-height:100%;
          display:grid;
          grid-template-columns:repeat(var(--lotus-grid-columns,1),minmax(0,1fr));
          grid-auto-flow:row;
          align-content:start;
          align-items:start;
          gap:var(--lotus-grid-gap,16px);
          padding:var(--lotus-grid-padding,16px);
          overflow:visible;
          touch-action:auto;
        }
        #canvas[data-layout-mode="grid"] #viewBackground { display:none!important; }
        #viewBackground {
          position:absolute !important;
          inset:0 !important;
          z-index:-1 !important;
          width:100% !important;
          height:100% !important;
          pointer-events:none;
        }
        .empty-state {
          position:absolute;
          inset:0;
          display:none;
          place-items:center;
          pointer-events:none;
        }
        :host([data-edit-mode="true"]) #canvas[data-empty="true"] .empty-state {
          display:grid;
        }
        .empty-card {
          display:grid;
          justify-items:center;
          gap:8px;
          max-width:320px;
          padding:24px;
          color:var(--lotus-muted);
          text-align:center;
          pointer-events:auto;
        }
        .empty-add {
          appearance:none;
          display:grid;
          place-items:center;
          width:62px;
          height:62px;
          padding:0;
          color:var(--text-primary-color, #fff);
          background:var(--lotus-accent);
          border:0;
          border-radius:50%;
          box-shadow:0 4px 16px color-mix(in srgb, var(--lotus-accent) 35%, transparent);
          cursor:pointer;
        }
        .empty-add:hover { filter:brightness(1.04); }
        .empty-add ha-icon { --mdc-icon-size:32px; }
        .empty-title {
          color:var(--lotus-fg);
          font-size:14px;
          font-weight:650;
        }
        .empty-hint {
          font-size:12px;
          line-height:17px;
        }
        #modalBlocker {
          position:absolute;
          inset:0;
          z-index:2147483000;
          display:none;
          box-sizing:border-box;
          background:transparent;
          pointer-events:none;
          touch-action:none;
        }
        #modalBlocker[data-active="true"] {
          display:block;
          pointer-events:auto;
        }
        :host([data-edit-mode="true"]) #modalBlocker {
          display:none !important;
          pointer-events:none !important;
        }
        .lotus-card[data-runtime-visible="false"] {
          display:none !important;
          pointer-events:none !important;
        }
        .lotus-card[data-runtime-visible="false"] .card-content,
        .lotus-card[data-runtime-visible="false"] .card-content > * {
          pointer-events:none !important;
        }
        .lotus-card[data-modal-active="true"] {
          z-index:2147483001 !important;
          pointer-events:auto !important;
        }
        .lotus-card {
          position:absolute;
          box-sizing:border-box;
          min-width:28px;
          min-height:28px;
          overflow:visible;
        }
        #canvas[data-layout-mode="grid"] .lotus-card {
          position:relative!important;
          left:auto!important;
          top:auto!important;
          width:auto!important;
          height:auto!important;
          min-width:0;
          min-height:0;
          z-index:auto!important;
          align-self:start;
        }
        #canvas[data-layout-mode="grid"] .lotus-card[data-grid-ratio="true"] {
          aspect-ratio:var(--lotus-grid-aspect);
          width:100%!important;
        }
        .card-content {
          position:relative;
          box-sizing:border-box;
          width:100%;
          height:100%;
          min-width:0;
          min-height:0;
          overflow:auto;
          border-radius:var(--ha-card-border-radius, 12px);
        }
        .card-content > * {
          display:block;
          box-sizing:border-box;
          width:100%;
          height:100%;
          max-width:100%;
          min-width:0;
          min-height:0;
        }
        #canvas[data-layout-mode="grid"] .card-content {
          height:auto;
          overflow:visible;
        }
        #canvas[data-layout-mode="grid"] .card-content > * {
          height:auto;
          min-height:0;
        }
        #canvas[data-layout-mode="grid"] .lotus-card[data-grid-ratio="true"] .card-content,
        #canvas[data-layout-mode="grid"] .lotus-card[data-grid-ratio="true"] .card-content > * {
          height:100%!important;
        }
        #canvas[data-layout-mode="grid"] .edit-overlay { cursor:pointer; }
        #canvas[data-layout-mode="grid"] .resize-handle,
        #canvas[data-layout-mode="grid"] .resize-edge,
        #canvas[data-layout-mode="grid"] .locked-badge { display:none!important; }
        .card-content > .condition-probe {
          position:absolute;
          left:-10000px;
          top:-10000px;
          display:block;
          width:1px !important;
          height:1px !important;
          min-width:1px !important;
          min-height:1px !important;
          overflow:hidden;
          opacity:0;
          pointer-events:none;
        }
        .lotus-card[data-ratio-locked="true"] .card-content {
          overflow:hidden;
        }
        .lotus-card[data-ratio-locked="true"] .card-content > * {
          width:100% !important;
          height:100% !important;
          max-width:100% !important;
          max-height:100% !important;
        }
        .edit-overlay {
          position:absolute;
          inset:0;
          z-index:20;
          display:none;
          box-sizing:border-box;
          border:2px solid transparent;
          border-radius:var(--ha-card-border-radius,12px);
          cursor:grab;
          touch-action:none;
        }
        :host([data-edit-mode="true"]) .edit-overlay { display:block; }
        .lotus-card[data-locked="true"] .edit-overlay { cursor:default; }
        .lotus-card[data-selected="true"] .edit-overlay {
          border-color:var(--lotus-selection);
          box-shadow:0 0 0 2px color-mix(in srgb, var(--lotus-selection) 25%, transparent);
        }
        .lotus-card[data-reference="true"] .edit-overlay {
          border-color:var(--lotus-reference);
          box-shadow:0 0 0 3px color-mix(in srgb, var(--lotus-reference) 32%, transparent);
        }
        .resize-handle {
          position:absolute;
          right:-9px;
          bottom:-9px;
          z-index:31;
          display:none;
          width:22px;
          height:22px;
          box-sizing:border-box;
          background:var(--lotus-selection);
          border:3px solid var(--lotus-bg);
          border-radius:50%;
          box-shadow:0 1px 5px rgba(0,0,0,.35);
          cursor:nwse-resize;
          touch-action:none;
        }
        :host([data-edit-mode="true"]) .lotus-card[data-primary="true"]:not([data-locked="true"]) .resize-handle {
          display:block;
        }
        .lotus-card[data-reference="true"] .resize-handle {
          background:var(--lotus-reference);
        }
        .resize-edge {
          position:absolute;
          z-index:30;
          display:none;
          touch-action:none;
        }
        .resize-edge::after {
          content:"";
          position:absolute;
          background:transparent;
          transition:background .12s ease;
        }
        .resize-edge-left,
        .resize-edge-right {
          top:10px;
          bottom:10px;
          width:14px;
          cursor:ew-resize;
        }
        .resize-edge-left { left:-7px; }
        .resize-edge-right { right:-7px; }
        .resize-edge-left::after,
        .resize-edge-right::after {
          top:0;
          bottom:0;
          left:6px;
          width:2px;
        }
        .resize-edge-top,
        .resize-edge-bottom {
          left:10px;
          right:10px;
          height:14px;
          cursor:ns-resize;
        }
        .resize-edge-top { top:-7px; }
        .resize-edge-bottom { bottom:-7px; }
        .resize-edge-top::after,
        .resize-edge-bottom::after {
          left:0;
          right:0;
          top:6px;
          height:2px;
        }
        .resize-edge:hover::after,
        .resize-edge:focus-visible::after {
          background:var(--lotus-selection);
        }
        :host([data-edit-mode="true"]) .lotus-card[data-primary="true"]:not([data-locked="true"]) .resize-edge {
          display:block;
        }
        .lotus-card[data-reference="true"] .resize-edge:hover::after,
        .lotus-card[data-reference="true"] .resize-edge:focus-visible::after {
          background:var(--lotus-reference);
        }
        .locked-badge {
          position:absolute;
          top:6px;
          right:6px;
          z-index:31;
          display:none;
          width:28px;
          height:28px;
          place-items:center;
          background:color-mix(in srgb, var(--lotus-bg) 92%, transparent);
          border:1px solid var(--lotus-border);
          border-radius:9px;
          pointer-events:none;
        }
        .locked-badge ha-icon { --mdc-icon-size:17px; }
        :host([data-edit-mode="true"]) .lotus-card[data-locked="true"] .locked-badge { display:grid; }
        .lotus-icon-button[data-active="true"] {
          color:var(--text-primary-color, #fff);
          background:var(--lotus-accent);
          border-color:var(--lotus-accent);
        }

        @media (max-width:760px) {
          #toolbar { flex-wrap:wrap; }
          .selection-info { flex:1 0 calc(100% - 100px); }
          .actions { overflow-x:auto; justify-content:flex-start; }
          .selected-actions, .commit-actions { max-width:100%; }
        }
      </style>
      <div id="root">
        <div id="toolbar" role="toolbar" aria-label="${lotusT("Outils de l’éditeur Lotus View Studio")}">
          <div class="selection-info">
            <div id="selectedName">${lotusT("Vue Lotus")}</div>
            <div id="status"></div>
          </div>
          <div class="actions global-actions"></div>
          <div class="actions commit-actions"></div>
        </div>
        <div id="editorBody">
          <div id="viewport">
          <div id="tabsBar" data-visible="false" aria-label="${lotusT("Onglets Lotus")}"></div>
          <div id="scrollspace">
            <div id="canvas" data-empty="true">
              <hui-view-background id="viewBackground" aria-hidden="true"></hui-view-background>
              <svg id="editorGrid" class="editor-guide-grid" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                <g class="guide-shadow"><line x1="50" y1="0" x2="50" y2="1000"></line><line x1="0" y1="50" x2="1000" y2="50"></line><line x1="100" y1="0" x2="100" y2="1000"></line><line x1="0" y1="100" x2="1000" y2="100"></line><line x1="150" y1="0" x2="150" y2="1000"></line><line x1="0" y1="150" x2="1000" y2="150"></line><line x1="200" y1="0" x2="200" y2="1000"></line><line x1="0" y1="200" x2="1000" y2="200"></line><line x1="300" y1="0" x2="300" y2="1000"></line><line x1="0" y1="300" x2="1000" y2="300"></line><line x1="350" y1="0" x2="350" y2="1000"></line><line x1="0" y1="350" x2="1000" y2="350"></line><line x1="400" y1="0" x2="400" y2="1000"></line><line x1="0" y1="400" x2="1000" y2="400"></line><line x1="450" y1="0" x2="450" y2="1000"></line><line x1="0" y1="450" x2="1000" y2="450"></line><line x1="550" y1="0" x2="550" y2="1000"></line><line x1="0" y1="550" x2="1000" y2="550"></line><line x1="600" y1="0" x2="600" y2="1000"></line><line x1="0" y1="600" x2="1000" y2="600"></line><line x1="650" y1="0" x2="650" y2="1000"></line><line x1="0" y1="650" x2="1000" y2="650"></line><line x1="700" y1="0" x2="700" y2="1000"></line><line x1="0" y1="700" x2="1000" y2="700"></line><line x1="800" y1="0" x2="800" y2="1000"></line><line x1="0" y1="800" x2="1000" y2="800"></line><line x1="850" y1="0" x2="850" y2="1000"></line><line x1="0" y1="850" x2="1000" y2="850"></line><line x1="900" y1="0" x2="900" y2="1000"></line><line x1="0" y1="900" x2="1000" y2="900"></line><line x1="950" y1="0" x2="950" y2="1000"></line><line x1="0" y1="950" x2="1000" y2="950"></line></g>
                <g class="guide-color"><line x1="50" y1="0" x2="50" y2="1000"></line><line x1="0" y1="50" x2="1000" y2="50"></line><line x1="100" y1="0" x2="100" y2="1000"></line><line x1="0" y1="100" x2="1000" y2="100"></line><line x1="150" y1="0" x2="150" y2="1000"></line><line x1="0" y1="150" x2="1000" y2="150"></line><line x1="200" y1="0" x2="200" y2="1000"></line><line x1="0" y1="200" x2="1000" y2="200"></line><line x1="300" y1="0" x2="300" y2="1000"></line><line x1="0" y1="300" x2="1000" y2="300"></line><line x1="350" y1="0" x2="350" y2="1000"></line><line x1="0" y1="350" x2="1000" y2="350"></line><line x1="400" y1="0" x2="400" y2="1000"></line><line x1="0" y1="400" x2="1000" y2="400"></line><line x1="450" y1="0" x2="450" y2="1000"></line><line x1="0" y1="450" x2="1000" y2="450"></line><line x1="550" y1="0" x2="550" y2="1000"></line><line x1="0" y1="550" x2="1000" y2="550"></line><line x1="600" y1="0" x2="600" y2="1000"></line><line x1="0" y1="600" x2="1000" y2="600"></line><line x1="650" y1="0" x2="650" y2="1000"></line><line x1="0" y1="650" x2="1000" y2="650"></line><line x1="700" y1="0" x2="700" y2="1000"></line><line x1="0" y1="700" x2="1000" y2="700"></line><line x1="800" y1="0" x2="800" y2="1000"></line><line x1="0" y1="800" x2="1000" y2="800"></line><line x1="850" y1="0" x2="850" y2="1000"></line><line x1="0" y1="850" x2="1000" y2="850"></line><line x1="900" y1="0" x2="900" y2="1000"></line><line x1="0" y1="900" x2="1000" y2="900"></line><line x1="950" y1="0" x2="950" y2="1000"></line><line x1="0" y1="950" x2="1000" y2="950"></line></g>
                <g class="guide-major-shadow"><line x1="250" y1="0" x2="250" y2="1000"></line><line x1="0" y1="250" x2="1000" y2="250"></line><line x1="500" y1="0" x2="500" y2="1000"></line><line x1="0" y1="500" x2="1000" y2="500"></line><line x1="750" y1="0" x2="750" y2="1000"></line><line x1="0" y1="750" x2="1000" y2="750"></line></g>
                <g class="guide-major-color"><line x1="250" y1="0" x2="250" y2="1000"></line><line x1="0" y1="250" x2="1000" y2="250"></line><line x1="500" y1="0" x2="500" y2="1000"></line><line x1="0" y1="500" x2="1000" y2="500"></line><line x1="750" y1="0" x2="750" y2="1000"></line><line x1="0" y1="750" x2="1000" y2="750"></line></g>
              </svg>
              <div id="backgroundFrameGuide" aria-hidden="true"></div>
              <div id="sceneExtent" aria-hidden="true"></div>
              <div id="modalBlocker" data-active="false" aria-hidden="true"></div>
              <div class="empty-state">
                <div class="empty-card">
                  <button class="empty-add" type="button" title="${lotusT("Ajouter une carte")}" aria-label="${lotusT("Ajouter une carte")}">
                    <ha-icon icon="mdi:plus"></ha-icon>
                  </button>
                  <div class="empty-title">${lotusT("Ajouter une carte")}</div>
                  <div class="empty-hint">${lotusT("Choisissez un outil Lotus ou une carte Home Assistant.")}</div>
                </div>
              </div>
            </div>
          </div>
          </div>
          <aside id="sideToolbar" aria-label="${lotusT("Calques et outils de sélection")}">
            <div id="sideResizeHandle" role="separator" aria-orientation="vertical" aria-label="${lotusT("Redimensionner la barre latérale")}"></div>
            <div class="side-scroll">
              <section id="sideLayersSection" class="side-section">
                <div id="layersHeading" class="side-heading">${lotusT("Calques")}</div>
                <div class="side-tools layer-toolbar-tools"></div>
                <div id="layersList" class="layers-list"></div>
              </section>
              <section id="sideCardSection" class="side-section" hidden>
                <div id="selectionHeading" class="side-heading">${lotusT("Sélection")}</div>
                <div class="selected-card-header">
                  <div id="sideSelectedName" class="selected-card-title"></div>
                  <div class="selected-card-header-actions"></div>
                </div>
                <div id="selectedMetrics" class="selected-card-layer"></div>
                <div id="selectedCardLayer" class="selected-card-layer"></div>
                <div class="selected-actions">
                  <div id="editActionGroup" class="selection-action-group">
                    <div id="editHeading" class="side-subheading">${lotusT("Édition")}</div>
                    <div class="card-action-grid edit-actions"></div>
                  </div>
                  <div id="positionActionGroup" class="selection-action-group">
                    <div id="positionHeading" class="side-subheading">${lotusT("Position")}</div>
                    <div class="card-action-grid position-actions"></div>
                  </div>
                  <div id="cardLayerActionGroup" class="selection-action-group">
                    <div id="cardLayerHeading" class="side-subheading">${lotusT("Calque")}</div>
                    <div class="card-action-grid card-layer-tools"></div>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>`;

    this._root = this.shadowRoot.getElementById("root");
    this._viewport = this.shadowRoot.getElementById("viewport");
    this._tabsBar = this.shadowRoot.getElementById("tabsBar");
    this._scrollspace = this.shadowRoot.getElementById("scrollspace");
    this._canvas = this.shadowRoot.getElementById("canvas");
    this._viewBackground = this.shadowRoot.getElementById("viewBackground");
    this._editorGrid = this.shadowRoot.getElementById("editorGrid");
    this._backgroundFrameGuide = this.shadowRoot.getElementById("backgroundFrameGuide");
    this._sceneExtent = this.shadowRoot.getElementById("sceneExtent");
    this._modalBlocker = this.shadowRoot.getElementById("modalBlocker");
    if (this._modalBlocker) {
      for (const eventName of ["pointerdown", "pointerup", "click", "dblclick", "contextmenu"]) {
        this._modalBlocker.addEventListener(eventName, (event) => {
          if (this._modalBlocker?.dataset.active !== "true") return;
          event.preventDefault();
          event.stopPropagation();
        });
      }
    }
    this._editorViewportGrid = this._editorGrid?.cloneNode(true) || null;
    if (this._editorViewportGrid) {
      this._editorViewportGrid.id = "editorViewportGrid";
      this._scrollspace.appendChild(this._editorViewportGrid);
    }
    this._toolbar = this.shadowRoot.getElementById("toolbar");
    this._editorBody = this.shadowRoot.getElementById("editorBody");
    this._sideToolbar = this.shadowRoot.getElementById("sideToolbar");
    this._sideResizeHandle = this.shadowRoot.getElementById("sideResizeHandle");
    this._layersList = this.shadowRoot.getElementById("layersList");
    this._layersHeading = this.shadowRoot.getElementById("layersHeading");
    this._selectionHeading = this.shadowRoot.getElementById("selectionHeading");
    this._cardLayerHeading = this.shadowRoot.getElementById("cardLayerHeading");
    this._editHeading = this.shadowRoot.getElementById("editHeading");
    this._positionHeading = this.shadowRoot.getElementById("positionHeading");
    this._sideCardSection = this.shadowRoot.getElementById("sideCardSection");
    this._sideSelectedName = this.shadowRoot.getElementById("sideSelectedName");
    this._selectedCardLayer = this.shadowRoot.getElementById("selectedCardLayer");
    this._selectedName = this.shadowRoot.getElementById("selectedName");
    this._selectedMetrics = this.shadowRoot.getElementById("selectedMetrics");
    this._status = this.shadowRoot.getElementById("status");
    this._globalActions = this.shadowRoot.querySelector(".global-actions");
    this._selectedActions = this.shadowRoot.querySelector(".selected-actions");
    this._layerToolbarTools = this.shadowRoot.querySelector(".layer-toolbar-tools");
    this._cardLayerTools = this.shadowRoot.querySelector(".card-layer-tools");
    this._editActions = this.shadowRoot.querySelector(".edit-actions");
    this._positionActions = this.shadowRoot.querySelector(".position-actions");
    this._selectedCardHeaderActions = this.shadowRoot.querySelector(".selected-card-header-actions");
    this._cardLayerActionGroup = this.shadowRoot.getElementById("cardLayerActionGroup");
    this._editActionGroup = this.shadowRoot.getElementById("editActionGroup");
    this._positionActionGroup = this.shadowRoot.getElementById("positionActionGroup");
    this._commitActions = this.shadowRoot.querySelector(".commit-actions");
    this._applySidebarWidth(this._sidebarWidth, false);
    this._sideResizeHandle?.addEventListener("pointerdown", (event) => this._beginSidebarResize(event));
    this._scrollspace?.addEventListener("click", (event) => this._handleCanvasBlankClick(event));
    this.shadowRoot.querySelector(".empty-add")?.addEventListener("click", () => this._createCard());
    this._buildToolbarButtons();
  }

  _buildToolbarButtons() {
    this._buttons = {};

    // Actions de la vue : toujours disponibles en mode édition.
    this._buttons.add = makeIconButton({
      icon:"mdi:plus",
      title:"Ajouter une carte",
      className:"primary",
      onClick:() => this._createCard(),
    });
    this._buttons.tabs = makeIconButton({
      icon:"mdi:tab",
      title:"Configurer les onglets de la vue",
      onClick:() => this._openTabsEditor(),
    });
    this._buttons.multiSelect = makeIconButton({
      icon:"mdi:checkbox-multiple-marked-outline",
      title:"Activer la sélection multiple",
      onClick:() => this._toggleMultiSelectMode(),
    });
    this._buttons.guideGrid = makeIconButton({
      icon:"mdi:grid",
      title:"Masquer la grille d’aide",
      onClick:() => this._toggleEditorGrid(),
    });
    this._buttons.guideFrame = makeIconButton({
      icon:"mdi:border-all",
      title:"Masquer le contour de l’image de fond",
      onClick:() => this._toggleBackgroundFrame(),
    });
    this._buttons.guideScope = makeIconButton({
      icon:"mdi:image-outline",
      title:"Étendre la grille à toute la fenêtre d’édition",
      onClick:() => this._toggleEditorGridScope(),
    });
    this._buttons.zoomOut = makeIconButton({
      icon:"mdi:magnify-minus-outline",
      title:"Dézoomer l’éditeur",
      onClick:() => this._adjustEditorZoom(-LOTUS_EDITOR_ZOOM_STEP),
    });
    this._zoomValue = document.createElement("button");
    this._zoomValue.type = "button";
    this._zoomValue.className = "editor-zoom-value";
    this._zoomValue.title = lotusT("Zoom de l’éditeur — cliquer pour revenir à l’image complète");
    this._zoomValue.setAttribute("aria-label", this._zoomValue.title);
    this._zoomValue.addEventListener("click", () => this._setEditorZoomPreset("fit"));
    this._buttons.zoomIn = makeIconButton({
      icon:"mdi:magnify-plus-outline",
      title:"Zoomer l’éditeur",
      onClick:() => this._adjustEditorZoom(LOTUS_EDITOR_ZOOM_STEP),
    });
    this._buttons.zoomFit = makeIconButton({
      icon:"mdi:fit-to-screen-outline",
      title:"Image complète dans l’éditeur",
      onClick:() => this._setEditorZoomPreset("fit"),
    });
    this._buttons.zoomWidth = makeIconButton({
      icon:"mdi:arrow-expand-horizontal",
      title:"Image à la largeur de l’éditeur",
      onClick:() => this._setEditorZoomPreset("width"),
    });
    this._buttons.zoomHeight = makeIconButton({
      icon:"mdi:arrow-expand-vertical",
      title:"Image à la hauteur de l’éditeur",
      onClick:() => this._setEditorZoomPreset("height"),
    });
    this._buttons.viewFit = makeIconButton({
      icon:"mdi:fit-to-screen-outline",
      title:"Vue sans défilement : tout afficher",
      onClick:() => this._setViewScrollMode("none"),
    });
    this._buttons.viewScrollVertical = makeIconButton({
      icon:"mdi:swap-vertical",
      title:"Défilement vertical : largeur toujours entièrement visible",
      onClick:() => this._setViewScrollMode("vertical"),
    });
    this._buttons.viewScrollHorizontal = makeIconButton({
      icon:"mdi:swap-horizontal",
      title:"Défilement horizontal : hauteur toujours entièrement visible",
      onClick:() => this._setViewScrollMode("horizontal"),
    });
    this._buttons.nativeYaml = makeIconButton({
      icon:"mdi:code-braces",
      title:"Ouvrir l’éditeur YAML Home Assistant",
      onClick:() => this._openNativeYamlEditor(),
    });
    this._buttons.pasteCard = makeIconButton({
      icon:"mdi:content-paste",
      title:"Coller la carte copiée",
      onClick:() => this._pasteCopiedCard(),
    });
    this._buttons.pasteCard.hidden = true;
    // Barre horizontale : groupes fonctionnels distincts, séparés visuellement.
    // 1. Cartes : création et collage depuis le presse-papiers Lotus.
    const cardToolsGroup = this._toolbarGroup(
      this._buttons.add,
      this._buttons.pasteCard,
    );
    // 2. Structure / sélection de la vue.
    const viewToolsGroup = this._toolbarGroup(
      this._buttons.tabs,
      this._buttons.multiSelect,
    );
    // 3. Repères visuels propres à l'éditeur.
    const guideToolsGroup = this._toolbarGroup(
      this._buttons.guideGrid,
      this._buttons.guideFrame,
      this._buttons.guideScope,
    );
    // 4. Zoom de l'espace de travail.
    const zoomToolsGroup = this._toolbarGroup(
      this._buttons.zoomOut,
      this._zoomValue,
      this._buttons.zoomIn,
      this._buttons.zoomFit,
      this._buttons.zoomWidth,
      this._buttons.zoomHeight,
    );
    // 5. Mode d'affichage final de la vue.
    const displayToolsGroup = this._toolbarGroup(
      this._buttons.viewFit,
      this._buttons.viewScrollVertical,
      this._buttons.viewScrollHorizontal,
    );
    // 6. Outils avancés.
    const advancedToolsGroup = this._toolbarGroup(
      this._buttons.nativeYaml,
    );
    this._globalActions.append(
      cardToolsGroup,
      this._separator(),
      viewToolsGroup,
      this._separator(),
      guideToolsGroup,
      this._separator(),
      zoomToolsGroup,
      this._separator(),
      displayToolsGroup,
      this._separator(),
      advancedToolsGroup,
    );

    // Barre verticale : commandes propres aux calques de l’onglet actif (ou globales sans onglets).
    this._buttons.layerAdd = makeIconButton({
      icon:"mdi:plus",
      title:"Ajouter un calque",
      onClick:() => this._addLayer(),
    });
    this._buttons.layerDelete = makeIconButton({
      icon:"mdi:delete-outline",
      title:"Supprimer le calque actif s’il est vide",
      className:"danger",
      onClick:() => this._deleteActiveLayer(),
    });
    this._buttons.layerBackward = makeIconButton({
      icon:"mdi:arrange-send-backward",
      title:"Reculer le calque actif",
      onClick:() => this._moveActiveLayer(-1),
    });
    this._buttons.layerForward = makeIconButton({
      icon:"mdi:arrange-bring-forward",
      title:"Avancer le calque actif",
      onClick:() => this._moveActiveLayer(1),
    });
    this._layerToolbarTools?.append(
      this._buttons.layerAdd,
      this._buttons.layerDelete,
      this._buttons.layerBackward,
      this._buttons.layerForward,
    );

    // Actions contextuelles : uniquement lorsqu'une carte est sélectionnée.
    this._buttons.edit = makeIconButton({
      icon:"mdi:pencil-outline",
      title:"Modifier la carte",
      onClick:() => this._editSelectedCard(),
    });
    this._buttons.lock = makeIconButton({
      icon:"mdi:lock-open-variant-outline",
      title:"Verrouiller",
      onClick:() => this._toggleSelectedLock(),
    });
    this._buttons.duplicate = makeIconButton({
      icon:"mdi:content-duplicate",
      title:"Dupliquer la carte",
      onClick:() => this._duplicateSelected(),
    });
    this._buttons.copyCard = makeIconButton({
      icon:"mdi:content-copy",
      title:"Copier la carte",
      onClick:() => this._copySelectedCard(),
    });
    this._buttons.moveTab = makeIconButton({
      icon:"lotus:tab-move",
      title:"Déplacer vers un autre onglet",
      onClick:() => this._openMoveCardToTabMenu(),
    });
    this._buttons.moveTab.hidden = true;
    this._buttons.centerOnImageHorizontal = makeIconButton({
      icon:"mdi:align-horizontal-center",
      title:"Centrer horizontalement la carte sur l’image de fond",
      onClick:() => this._centerSelectedOnBackground("horizontal"),
    });
    this._buttons.centerOnImageVertical = makeIconButton({
      icon:"mdi:align-vertical-center",
      title:"Centrer verticalement la carte sur l’image de fond",
      onClick:() => this._centerSelectedOnBackground("vertical"),
    });
    this._buttons.alignLeft = makeIconButton({
      icon:"mdi:align-horizontal-left",
      title:"Aligner à gauche sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("left"),
    });
    this._buttons.alignHCenter = makeIconButton({
      icon:"mdi:align-horizontal-center",
      title:"Centrer horizontalement sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("hcenter"),
    });
    this._buttons.alignRight = makeIconButton({
      icon:"mdi:align-horizontal-right",
      title:"Aligner à droite sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("right"),
    });
    this._buttons.alignTop = makeIconButton({
      icon:"mdi:align-vertical-top",
      title:"Aligner en haut sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("top"),
    });
    this._buttons.alignVCenter = makeIconButton({
      icon:"mdi:align-vertical-center",
      title:"Centrer verticalement sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("vcenter"),
    });
    this._buttons.alignBottom = makeIconButton({
      icon:"mdi:align-vertical-bottom",
      title:"Aligner en bas sur la carte de référence",
      onClick:() => this._applyBatchLayoutAction("bottom"),
    });
    this._buttons.sameSize = makeIconButton({
      icon:"mdi:arrow-expand-all",
      title:"Donner la même dimension que la carte de référence",
      onClick:() => this._applyBatchLayoutAction("same-size"),
    });
    this._buttons.distributeHorizontal = makeIconButton({
      icon:"mdi:distribute-horizontal-center",
      title:"Répartir horizontalement à égale distance entre les cartes extrêmes",
      onClick:() => this._applyDistributionAction("horizontal"),
    });
    this._buttons.distributeVertical = makeIconButton({
      icon:"mdi:distribute-vertical-center",
      title:"Répartir verticalement à égale distance entre les cartes extrêmes",
      onClick:() => this._applyDistributionAction("vertical"),
    });
    this._buttons.delete = makeIconButton({
      icon:"mdi:delete-outline",
      title:"Supprimer la carte",
      className:"danger",
      onClick:() => this._deleteSelectedCards(),
    });
    this._buttons.cardAddToActiveLayer = makeIconButton({
      icon:"mdi:plus-circle-outline",
      title:"Ajouter la carte au calque de travail",
      onClick:() => this._assignSelectedToActiveLayer(),
    });
    this._buttons.cardRemoveFromLayer = makeIconButton({
      icon:"mdi:minus-circle-outline",
      title:"Retirer la carte de son calque et la replacer dans le Calque 1",
      onClick:() => this._removeSelectedFromLayer(),
    });
    this._buttons.cardMoveLayer = makeIconButton({
      icon:"mdi:swap-vertical",
      title:"Déplacer la carte vers un autre calque",
      onClick:() => this._openMoveCardToLayerMenu(),
    });
    const copyDuplicateSpacer = document.createElement("span");
    copyDuplicateSpacer.className = "action-spacer";
    copyDuplicateSpacer.setAttribute("aria-hidden", "true");
    this._editActions?.append(
      this._buttons.edit,
      this._buttons.copyCard,
      copyDuplicateSpacer,
      this._buttons.duplicate,
      this._buttons.lock,
      this._buttons.moveTab,
    );
    this._positionActions?.append(
      this._buttons.centerOnImageHorizontal,
      this._buttons.centerOnImageVertical,
      this._buttons.alignLeft,
      this._buttons.alignHCenter,
      this._buttons.alignRight,
      this._buttons.alignTop,
      this._buttons.alignVCenter,
      this._buttons.alignBottom,
      this._buttons.sameSize,
      this._buttons.distributeHorizontal,
      this._buttons.distributeVertical,
    );
    this._cardLayerTools?.append(
      this._buttons.cardAddToActiveLayer,
      this._buttons.cardMoveLayer,
      this._buttons.cardRemoveFromLayer,
    );
    this._selectedCardHeaderActions?.append(
      this._buttons.delete,
    );

  }

  _layerEditorStateKey(index = this._index) {
    const view = this._lovelace?.config?.views?.[index] || (index === this._index ? this._config : null) || {};
    const path = typeof view?.path === "string" && view.path ? view.path : "";
    const title = typeof view?.title === "string" && view.title ? view.title : "";
    const routeRoot = (() => {
      try {
        const segment = String(window?.location?.pathname || "").split("/").filter(Boolean)[0] || "lovelace";
        return segment;
      } catch (_error) {
        return "lovelace";
      }
    })();
    return `${routeRoot}|${index}|${path}|${title}`;
  }

  _persistLayerEditorState() {
    if (!this._isEditMode()) return;
    const key = this._layerEditorStateKey();
    const scopes = this._tabsEnabled()
      ? this._tabsConfig().items.map((item) => item.id)
      : [LOTUS_GLOBAL_LAYER_SCOPE];
    const layerConfigs = {};
    for (const scopeKey of scopes) {
      layerConfigs[scopeKey] = this._serializeLayers(
        this._layersConfig(this._currentViewConfig(), scopeKey),
      );
    }
    const hidden = {};
    for (const [scopeKey, ids] of this._editorHiddenLayerIdsByScope.entries()) hidden[scopeKey] = [...ids];
    const editorLocked = {};
    for (const [scopeKey, ids] of this._editorLockedLayerIdsByScope.entries()) editorLocked[scopeKey] = [...ids];
    const active = Object.fromEntries(this._activeLayerIdsByScope.entries());
    LOTUS_EDITOR_LAYER_SESSION_CACHE.set(key, { layerConfigs, hidden, editorLocked, active });
    this._restoredLayerEditorStateKey = key;
  }

  _restoreLayerEditorState(force = false) {
    if (!this._isEditMode()) return;
    const key = this._layerEditorStateKey();
    if (!force && this._restoredLayerEditorStateKey === key) return;
    const state = LOTUS_EDITOR_LAYER_SESSION_CACHE.get(key);
    if (!state) {
      this._restoredLayerEditorStateKey = key;
      return;
    }

    this._editorHiddenLayerIdsByScope = new Map(
      Object.entries(state.hidden || {}).map(([scopeKey, ids]) => [scopeKey, new Set(Array.isArray(ids) ? ids : [])]),
    );
    this._editorLockedLayerIdsByScope = new Map(
      Object.entries(state.editorLocked || {}).map(([scopeKey, ids]) => [scopeKey, new Set(Array.isArray(ids) ? ids : [])]),
    );
    this._activeLayerIdsByScope = new Map(Object.entries(state.active || {}));
    this._layerConfigOverrides = new Map(
      Object.entries(state.layerConfigs || {}).map(([scopeKey, layers]) => [scopeKey, this._normalizeLayerList(layers)]),
    );
    this._restoredLayerEditorStateKey = key;
  }

  _layerScopeKeyForTab(tabId = null) {
    if (!this._tabsEnabled()) return LOTUS_GLOBAL_LAYER_SCOPE;
    const candidate = typeof tabId === "string" && tabId ? tabId : this._ensureActiveTab();
    return candidate || LOTUS_GLOBAL_LAYER_SCOPE;
  }

  _currentLayerScopeKey() {
    return this._layerScopeKeyForTab(this._tabsEnabled() ? this._ensureActiveTab() : null);
  }

  _layerScopeKeyForCard(index) {
    if (!this._tabsEnabled()) return LOTUS_GLOBAL_LAYER_SCOPE;
    return this._layerScopeKeyForTab(this._cardTabId(index));
  }

  _scopeSet(store, scopeKey = this._currentLayerScopeKey()) {
    if (!store.has(scopeKey)) store.set(scopeKey, new Set());
    return store.get(scopeKey);
  }

  _hiddenLayerIds(scopeKey = this._currentLayerScopeKey()) {
    return this._scopeSet(this._editorHiddenLayerIdsByScope, scopeKey);
  }

  _editorLockedLayerIds(scopeKey = this._currentLayerScopeKey()) {
    return this._scopeSet(this._editorLockedLayerIdsByScope, scopeKey);
  }

  _normalizeLayerList(source) {
    const seen = new Set();
    const layers = [];
    for (const item of Array.isArray(source) ? source : []) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const numericId = /^layer-(\d+)$/.exec(id)?.[1];
      const fallbackName = id === LOTUS_DEFAULT_LAYER_ID ? "Calque 1" : `Calque ${numericId || layers.length + 1}`;
      layers.push({ id, name:typeof item.name === "string" && item.name.trim() ? item.name.trim() : fallbackName, locked:Boolean(item.locked) });
    }
    const base = layers.find((layer) => layer.id === LOTUS_DEFAULT_LAYER_ID);
    if (!base) layers.unshift({ id:LOTUS_DEFAULT_LAYER_ID, name:"Calque 1", locked:false });
    return layers.length ? layers : [{ id:LOTUS_DEFAULT_LAYER_ID, name:"Calque 1", locked:false }];
  }

  _referencedLayerIds(view = this._currentViewConfig(), scopeKey = this._currentLayerScopeKey()) {
    const referenced = [];
    const seen = new Set();
    const tabs = this._tabsConfig();
    const validTabIds = new Set(tabs.items.map((item) => item.id));
    const fallbackTabId = tabs.items[0]?.id || null;
    for (const card of Array.isArray(view?.cards) ? view.cards : []) {
      const viewLayout = card?.view_layout || {};
      const legacyStored = LOTUS_LEGACY_LAYOUT_KEYS
        .map((key) => viewLayout[key])
        .find((value) => value && typeof value === "object") || {};
      const currentStored = viewLayout[LOTUS_LAYOUT_KEY];
      const stored = {
        ...legacyStored,
        ...(currentStored && typeof currentStored === "object" ? currentStored : {}),
      };
      const cardScope = tabs.enabled
        ? (validTabIds.has(stored.tab) ? stored.tab : fallbackTabId)
        : LOTUS_GLOBAL_LAYER_SCOPE;
      if (cardScope !== scopeKey) continue;
      const layerId = typeof stored.layer === "string" && stored.layer.trim() ? stored.layer.trim() : LOTUS_DEFAULT_LAYER_ID;
      if (seen.has(layerId)) continue;
      seen.add(layerId);
      referenced.push(layerId);
    }
    return referenced;
  }

  _layersConfig(view = this._currentViewConfig(), scopeKey = this._currentLayerScopeKey()) {
    const override = this._layerConfigOverrides.get(scopeKey);
    if (Array.isArray(override)) return this._normalizeLayerList(override);

    const raw = view?.[LOTUS_VIEW_META_KEY]?.[LOTUS_VIEW_LAYERS_KEY];
    let source = [];
    if (Array.isArray(raw)) {
      // 0.10.2 and older stored one global list. While migrating, use it as a
      // template for every tab so existing card layer assignments are kept.
      source = raw;
    } else if (raw && typeof raw === "object") {
      if (scopeKey !== LOTUS_GLOBAL_LAYER_SCOPE && Array.isArray(raw.tabs?.[scopeKey])) {
        source = raw.tabs[scopeKey];
      } else if (scopeKey === LOTUS_GLOBAL_LAYER_SCOPE && Array.isArray(raw.global)) {
        source = raw.global;
      } else if (scopeKey === LOTUS_GLOBAL_LAYER_SCOPE && raw.tabs && typeof raw.tabs === "object") {
        source = Object.values(raw.tabs).find((layers) => Array.isArray(layers)) || [];
      } else if (scopeKey !== LOTUS_GLOBAL_LAYER_SCOPE && Array.isArray(raw.global)) {
        // A tab without its own layer set starts from the global template, but
        // becomes independent as soon as its layers are edited.
        source = raw.global;
      } else if (Array.isArray(raw[scopeKey])) {
        // Transitional direct-map shape accepted defensively.
        source = raw[scopeKey];
      }
    }
    const normalized = this._normalizeLayerList(source);
    const known = new Set(normalized.map((layer) => layer.id));
    // 0.10.3 could transiently lose a tab's layer catalogue while the cards
    // themselves still retained their layer identifiers. Never demote those
    // cards to layer-1: reconstruct missing layer descriptors from the saved
    // card metadata, then persist the repaired catalogue on the next save.
    for (const layerId of this._referencedLayerIds(view, scopeKey)) {
      if (known.has(layerId)) continue;
      known.add(layerId);
      const numericId = /^layer-(\d+)$/.exec(layerId)?.[1];
      normalized.push({
        id:layerId,
        name:layerId === LOTUS_DEFAULT_LAYER_ID ? "Calque 1" : `Calque ${numericId || normalized.length + 1}`,
        locked:false,
      });
    }
    return normalized;
  }

  _ensureActiveLayer(scopeKey = this._currentLayerScopeKey()) {
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey);
    let active = this._activeLayerIdsByScope.get(scopeKey);
    if (!layers.some((layer) => layer.id === active)) {
      active = layers[0].id;
      this._activeLayerIdsByScope.set(scopeKey, active);
    }
    return active;
  }

  _layerById(layerId, scopeKey = this._currentLayerScopeKey()) {
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey);
    return layers.find((layer) => layer.id === layerId) || layers[0];
  }

  _layerIdForCard(index) {
    const scopeKey = this._layerScopeKeyForCard(index);
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey);
    const ids = new Set(layers.map((layer) => layer.id));
    const layout = this._workingLayouts.get(index) || this._readStoredLayout(index);
    return typeof layout?.layer === "string" && ids.has(layout.layer) ? layout.layer : LOTUS_DEFAULT_LAYER_ID;
  }

  _layerCardIndices(layerId, scopeKey = this._currentLayerScopeKey()) {
    const indices = [];
    for (let index = 0; index < this._cards.length; index += 1) {
      if (this._layerScopeKeyForCard(index) !== scopeKey) continue;
      if (this._layerIdForCard(index) === layerId) indices.push(index);
    }
    return indices;
  }

  _layerOrderIndex(layerId, scopeKey = this._currentLayerScopeKey()) {
    const index = this._layersConfig(this._currentViewConfig(), scopeKey).findIndex((layer) => layer.id === layerId);
    return Math.max(0, index);
  }

  _effectiveLayerZ(index, layout = this._layerLayout(index)) {
    const scopeKey = this._layerScopeKeyForCard(index);
    const layerId = typeof layout?.layer === "string" ? layout.layer : this._layerIdForCard(index);
    const layerIndex = this._layerOrderIndex(layerId, scopeKey);
    const localZ = Math.max(0, Math.round(Number(layout?.z ?? index + 1) || 0));
    return layerIndex * 10000 + Math.min(localZ, 9999);
  }

  _layerLayout(index) {
    return this._workingLayouts.get(index) || this._readStoredLayout(index);
  }

  _isLayerLocked(layerId, scopeKey = this._currentLayerScopeKey()) {
    return Boolean(this._layerById(layerId, scopeKey)?.locked || this._editorLockedLayerIds(scopeKey).has(layerId));
  }

  _isCardEditorLocked(index) {
    const layout = this._layerLayout(index);
    const scopeKey = this._layerScopeKeyForCard(index);
    return Boolean(layout?.locked || this._isLayerLocked(this._layerIdForCard(index), scopeKey));
  }

  _isLayerAbove(index, referenceIndex) {
    return this._effectiveLayerZ(index) > this._effectiveLayerZ(referenceIndex);
  }

  _setEditorLayerHidden(layerId, hidden, scopeKey = this._currentLayerScopeKey()) {
    if (!this._layersConfig(this._currentViewConfig(), scopeKey).some((layer) => layer.id === layerId)) return;
    const hiddenIds = this._hiddenLayerIds(scopeKey);
    if (hidden) hiddenIds.add(layerId);
    else hiddenIds.delete(layerId);

    if (hidden) {
      this._selectedIndices = this._selectedIndices.filter((index) => !(this._layerScopeKeyForCard(index) === scopeKey && this._layerIdForCard(index) === layerId));
      this._selectedIndex = this._selectedIndices[0] ?? null;
    }
    for (let index = 0; index < this._cards.length; index += 1) {
      if (this._layerScopeKeyForCard(index) !== scopeKey || this._layerIdForCard(index) !== layerId) continue;
      const wrapper = this._canvas?.querySelector(`.lotus-card[data-index="${index}"]`);
      if (wrapper) wrapper.dataset.editorHidden = String(Boolean(hidden));
    }
    this._persistLayerEditorState();
  }

  _toggleEditorLayerVisibility(layerId) {
    const scopeKey = this._currentLayerScopeKey();
    this._setEditorLayerHidden(layerId, !this._hiddenLayerIds(scopeKey).has(layerId), scopeKey);
    this._syncSelectionState();
    this._renderLayersPanel();
    this._updateToolbar();
  }

  _toggleEditorLayerLock(layerId) {
    if (this._saveInProgress || this._dirty) return;
    const layers = this._layersConfig().map((layer) => ({ ...layer }));
    const layer = layers.find((candidate) => candidate.id === layerId);
    if (!layer) return;
    layer.locked = !layer.locked;
    void this._saveLayersConfig(layers, layer.locked ? "Calque verrouillé" : "Calque déverrouillé");
  }

  _showAllEditorLayers() {
    const scopeKey = this._currentLayerScopeKey();
    const hiddenIds = this._hiddenLayerIds(scopeKey);
    if (!hiddenIds.size) return;
    hiddenIds.clear();
    for (const wrapper of this._canvas?.querySelectorAll('.lotus-card[data-editor-hidden="true"]') || []) {
      const index = Number(wrapper.dataset.index);
      if (this._layerScopeKeyForCard(index) === scopeKey) wrapper.dataset.editorHidden = "false";
    }
    this._persistLayerEditorState();
    this._renderLayersPanel();
    this._updateToolbar();
  }

  _hideLayersAboveSelected() {
    if (this._selectedIndex === null) return;
    const scopeKey = this._layerScopeKeyForCard(this._selectedIndex);
    const selectedLayerIndex = this._layerOrderIndex(this._layerIdForCard(this._selectedIndex), scopeKey);
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey);
    for (let index = selectedLayerIndex + 1; index < layers.length; index += 1) {
      this._setEditorLayerHidden(layers[index].id, true, scopeKey);
    }
    this._renderLayersPanel();
    this._updateToolbar();
  }

  _setActiveLayer(layerId) {
    const scopeKey = this._currentLayerScopeKey();
    if (!this._layersConfig(this._currentViewConfig(), scopeKey).some((layer) => layer.id === layerId)) return;
    this._activeLayerIdsByScope.set(scopeKey, layerId);
    this._renamingLayerId = null;
    this._persistLayerEditorState();
    this._renderLayersPanel();
    this._updateToolbar();
  }

  _serializeLayers(layers) {
    return this._normalizeLayerList(layers).map((layer) => ({ id:layer.id, name:layer.name, ...(layer.locked ? { locked:true } : {}) }));
  }

  _layerStorageForSave(raw) {
    const base = [{ id:LOTUS_DEFAULT_LAYER_ID, name:"Calque 1" }];
    if (Array.isArray(raw)) return { global:this._serializeLayers(raw), tabs:{} };
    if (raw && typeof raw === "object") {
      const global = Array.isArray(raw.global) ? this._serializeLayers(raw.global) : base;
      const tabs = {};
      if (raw.tabs && typeof raw.tabs === "object") {
        for (const [tabId, layers] of Object.entries(raw.tabs)) {
          if (Array.isArray(layers)) tabs[tabId] = this._serializeLayers(layers);
        }
      }
      // Also accept the short-lived direct-map shape if encountered.
      for (const [key, layers] of Object.entries(raw)) {
        if (key === "global" || key === "tabs" || !Array.isArray(layers)) continue;
        tabs[key] = this._serializeLayers(layers);
      }
      return { global, tabs };
    }
    return { global:base, tabs:{} };
  }

  async _saveLayersConfig(layers, successMessage) {
    if (this._saveInProgress || this._dirty) return false;
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Enregistrement des calques indisponible";
      this._statusKind = "error";
      this._updateToolbar();
      return false;
    }
    const scopeKey = this._currentLayerScopeKey();
    const previousOverride = this._layerConfigOverrides.has(scopeKey)
      ? this._layerConfigOverrides.get(scopeKey).map((layer) => ({ ...layer }))
      : null;
    this._layerConfigOverrides.set(scopeKey, layers.map((layer) => ({ ...layer })));
    this._persistLayerEditorState();
    try {
      this._saveInProgress = true;
      this._statusMessage = "Enregistrement des calques…";
      this._statusKind = "";
      this._updateToolbar();
      const newConfig = this._buildConfigWithWorkingLayouts();
      const view = newConfig?.views?.[this._index];
      if (!view) return false;
      const meta = view[LOTUS_VIEW_META_KEY] && typeof view[LOTUS_VIEW_META_KEY] === "object"
        ? { ...view[LOTUS_VIEW_META_KEY] }
        : {};
      const storage = this._layerStorageForSave(meta[LOTUS_VIEW_LAYERS_KEY]);
      const serialized = this._serializeLayers(layers);
      if (scopeKey === LOTUS_GLOBAL_LAYER_SCOPE || !this._tabsEnabled()) storage.global = serialized;
      else storage.tabs[scopeKey] = serialized;
      meta[LOTUS_VIEW_LAYERS_KEY] = storage;
      view[LOTUS_VIEW_META_KEY] = meta;
      await this._lovelace.saveConfig(newConfig);
      this._statusMessage = successMessage;
      this._statusKind = "success";
      return true;
    } catch (error) {
      if (previousOverride) this._layerConfigOverrides.set(scopeKey, previousOverride);
      else this._layerConfigOverrides.delete(scopeKey);
      this._persistLayerEditorState();
      lotusDebug("Unable to save layers", error);
      this._statusMessage = `Échec de l’enregistrement des calques : ${error?.message || error}`;
      this._statusKind = "error";
      return false;
    } finally {
      this._saveInProgress = false;
      this._ensureActiveLayer(scopeKey);
      this._persistLayerEditorState();
      this._renderCards();
      this._updateToolbar();
    }
  }

  async _addLayer() {
    if (this._saveInProgress || this._dirty) return;
    const scopeKey = this._currentLayerScopeKey();
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey).map((layer) => ({ ...layer }));
    const used = new Set(layers.map((layer) => layer.id));
    let ordinal = layers.length + 1;
    let id = `layer-${ordinal}`;
    while (used.has(id)) { ordinal += 1; id = `layer-${ordinal}`; }
    const layer = { id, name:`Calque ${layers.length + 1}` };
    layers.push(layer);
    this._activeLayerIdsByScope.set(scopeKey, id);
    const saved = await this._saveLayersConfig(layers, `Calque « ${layer.name} » ajouté`);
    if (saved) {
      this._renamingLayerId = id;
      this._renderLayersPanel();
    }
  }

  async _deleteActiveLayer() {
    if (this._saveInProgress || this._dirty) return;
    const scopeKey = this._currentLayerScopeKey();
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey);
    const active = this._ensureActiveLayer(scopeKey);
    if (layers.length <= 1 || active === LOTUS_DEFAULT_LAYER_ID) return;
    if (this._layerCardIndices(active, scopeKey).length) {
      this._statusMessage = "Le calque doit être vide avant d’être supprimé.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    const index = layers.findIndex((layer) => layer.id === active);
    const next = layers.filter((layer) => layer.id !== active);
    this._activeLayerIdsByScope.set(scopeKey, next[Math.max(0, Math.min(index - 1, next.length - 1))]?.id || LOTUS_DEFAULT_LAYER_ID);
    this._hiddenLayerIds(scopeKey).delete(active);
    this._editorLockedLayerIds(scopeKey).delete(active);
    this._persistLayerEditorState();
    await this._saveLayersConfig(next, "Calque vide supprimé");
  }

  async _moveActiveLayer(delta) {
    if (this._saveInProgress || this._dirty) return;
    const scopeKey = this._currentLayerScopeKey();
    const layers = this._layersConfig(this._currentViewConfig(), scopeKey).map((layer) => ({ ...layer }));
    const active = this._ensureActiveLayer(scopeKey);
    const index = layers.findIndex((layer) => layer.id === active);
    const target = index + (delta > 0 ? 1 : -1);
    if (index < 0 || target < 0 || target >= layers.length) return;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    await this._saveLayersConfig(layers, delta > 0 ? "Calque avancé" : "Calque reculé");
  }

  _startLayerRename(layerId) {
    this._renamingLayerId = layerId;
    this._renderLayersPanel();
  }

  async _renameLayer(layerId, rawName) {
    const layers = this._layersConfig().map((layer) => ({ ...layer }));
    const layer = layers.find((candidate) => candidate.id === layerId);
    if (!layer) return;
    const name = String(rawName || "").trim();
    this._renamingLayerId = null;
    if (!name || name === layer.name) {
      this._renderLayersPanel();
      return;
    }
    layer.name = name.slice(0, 80);
    await this._saveLayersConfig(layers, `Calque renommé « ${layer.name} »`);
  }

  _renderLayersPanel() {
    if (!this._layersList) return;
    const focusedRename = this._layersList.querySelector(".layer-rename-input");
    if (focusedRename && this.shadowRoot?.activeElement === focusedRename && this._renamingLayerId) return;
    const layers = this._layersConfig();
    const active = this._ensureActiveLayer();
    this._layersList.replaceChildren();

    layers.slice().reverse().forEach((layer) => {
      const hidden = this._hiddenLayerIds().has(layer.id);
      const locked = this._isLayerLocked(layer.id);
      const count = this._layerCardIndices(layer.id).length;
      const row = document.createElement("div");
      row.className = "layer-row";
      row.dataset.active = String(layer.id === active);
      row.dataset.hidden = String(hidden);

      const work = document.createElement("button");
      work.type = "button";
      work.className = "layer-mini";
      work.title = lotusT(layer.id === active ? "Calque de travail actif" : "Travailler dans ce calque");
      work.setAttribute("aria-label", work.title);
      const workIcon = document.createElement("ha-icon");
      workIcon.setAttribute("icon", layer.id === active ? "mdi:check-circle" : "mdi:circle-outline");
      work.appendChild(workIcon);
      work.addEventListener("click", () => this._setActiveLayer(layer.id));

      const eye = document.createElement("button");
      eye.type = "button";
      eye.className = "layer-mini";
      eye.title = lotusT(hidden ? "Afficher ce calque dans l’éditeur" : "Masquer ce calque dans l’éditeur");
      eye.setAttribute("aria-label", eye.title);
      const eyeIcon = document.createElement("ha-icon");
      eyeIcon.setAttribute("icon", hidden ? "mdi:eye-off-outline" : "mdi:eye-outline");
      eye.appendChild(eyeIcon);
      eye.addEventListener("click", () => this._toggleEditorLayerVisibility(layer.id));

      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "layer-mini";
      lock.title = lotusT(locked ? "Déverrouiller ce calque" : "Verrouiller ce calque");
      lock.setAttribute("aria-label", lock.title);
      const lockIcon = document.createElement("ha-icon");
      lockIcon.setAttribute("icon", locked ? "mdi:lock" : "mdi:lock-open-variant-outline");
      lock.appendChild(lockIcon);
      lock.addEventListener("click", () => this._toggleEditorLayerLock(layer.id));

      let nameControl;
      if (this._renamingLayerId === layer.id) {
        const input = document.createElement("input");
        input.className = "layer-rename-input";
        input.value = layer.name;
        input.maxLength = 80;
        input.setAttribute("aria-label", lotusT("Nom du calque"));
        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          void this._renameLayer(layer.id, input.value);
        };
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          else if (event.key === "Escape") { event.preventDefault(); this._renamingLayerId = null; this._renderLayersPanel(); }
        });
        input.addEventListener("blur", commit);
        nameControl = input;
        queueMicrotask(() => { input.focus(); input.select(); });
      } else {
        const nameButton = document.createElement("button");
        nameButton.type = "button";
        nameButton.className = "layer-name-button";
        nameButton.title = lotusT("Définir comme calque de travail");
        const name = document.createElement("span");
        name.className = "layer-name";
        name.textContent = layer.name;
        const meta = document.createElement("span");
        meta.className = "layer-meta";
        meta.textContent = `${count} ${lotusT(count > 1 ? "cartes" : "carte")}${locked ? ` · ${lotusT("verrouillé")}` : ""}${hidden ? ` · ${lotusT("masqué")}` : ""}`;
        nameButton.append(name, meta);
        nameButton.addEventListener("click", () => this._setActiveLayer(layer.id));
        nameButton.addEventListener("dblclick", (event) => { event.preventDefault(); this._startLayerRename(layer.id); });
        nameControl = nameButton;
      }

      const rename = document.createElement("button");
      rename.type = "button";
      rename.className = "layer-mini";
      rename.title = lotusT("Renommer le calque");
      rename.setAttribute("aria-label", rename.title);
      const renameIcon = document.createElement("ha-icon");
      renameIcon.setAttribute("icon", "mdi:pencil-outline");
      rename.appendChild(renameIcon);
      rename.addEventListener("click", () => this._startLayerRename(layer.id));

      row.append(work, eye, lock, nameControl, rename);
      this._layersList.appendChild(row);
    });
  }

  _applySidebarWidth(value, persist = true) {
    const max = Math.max(1, Math.floor(window.innerWidth * 0.30));
    const min = Math.min(220, max);
    this._sidebarWidth = clamp(Number(value) || 300, min, max);
    this._sideToolbar?.style.setProperty("--lotus-sidebar-width", `${Math.round(this._sidebarWidth)}px`);
    if (persist) saveEditorSidebarWidth(this._sidebarWidth);
  }

  _beginSidebarResize(event) {
    if (!this._isEditMode() || this._saveInProgress || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    this._sidebarResize = { pointerId:event.pointerId, startX:event.clientX, startWidth:this._sidebarWidth };
    this._sideResizeHandle.dataset.dragging = "true";
    this._sideResizeHandle.setPointerCapture?.(event.pointerId);
    this._sidebarResizeMove = (moveEvent) => {
      if (!this._sidebarResize || moveEvent.pointerId !== this._sidebarResize.pointerId) return;
      const delta = this._sidebarResize.startX - moveEvent.clientX;
      this._applySidebarWidth(this._sidebarResize.startWidth + delta, false);
      this._syncCanvasHeight();
    };
    this._sidebarResizeEnd = (upEvent) => {
      if (this._sidebarResize && upEvent.pointerId === this._sidebarResize.pointerId) this._endSidebarResize();
    };
    window.addEventListener("pointermove", this._sidebarResizeMove);
    window.addEventListener("pointerup", this._sidebarResizeEnd);
    window.addEventListener("pointercancel", this._sidebarResizeEnd);
  }

  _endSidebarResize() {
    if (!this._sidebarResize) return;
    saveEditorSidebarWidth(this._sidebarWidth);
    this._sidebarResize = null;
    if (this._sideResizeHandle) this._sideResizeHandle.dataset.dragging = "false";
    window.removeEventListener("pointermove", this._sidebarResizeMove);
    window.removeEventListener("pointerup", this._sidebarResizeEnd);
    window.removeEventListener("pointercancel", this._sidebarResizeEnd);
    requestAnimationFrame(() => this._syncCanvasHeight());
  }

  _handleCanvasBlankClick(event) {
    if (!this._isEditMode() || this._saveInProgress) return;
    const path = event.composedPath?.() || [];
    if (path.some((node) => node?.classList?.contains?.("lotus-card") || node?.classList?.contains?.("empty-card") || node?.closest?.("button,input,select,textarea"))) return;
    if (!this._selectedIndices.length) return;
    this._clearSelection();
    this._statusMessage = "";
    this._statusKind = "";
    this._updateToolbar();
    this._renderTabs();
  }

  async _assignSelectedToLayer(layerId, message = "Carte déplacée vers le calque") {
    if (!this._selectedIndices.length || this._saveInProgress || this._dirty) return;
    if (this._selectedIndices.some((index) => this._isCardEditorLocked(index))) return;
    if (!this._layersConfig().some((layer) => layer.id === layerId)) return;
    const changed = [];
    for (const index of this._selectedIndices) {
      const current = { ...(this._workingLayouts.get(index) || this._readStoredLayout(index)) };
      if (this._layerIdForCard(index) === layerId) continue;
      this._workingLayouts.set(index, { ...current, layer:layerId });
      changed.push(index);
    }
    if (!changed.length) return;
    this._markDirty();
    for (const index of changed) this._applyLayoutToWrapper(index);
    const saved = await this._applyChanges(message);
    if (saved) this._renderCards();
  }

  _assignSelectedToActiveLayer() {
    const layer = this._layerById(this._ensureActiveLayer());
    const message = this._selectedIndices.length > 1
      ? lotusT("Cartes sélectionnées ajoutées au calque « {layer} »", { layer:layer.name })
      : lotusT("Carte ajoutée au calque « {layer} »", { layer:layer.name });
    void this._assignSelectedToLayer(layer.id, message);
  }

  _removeSelectedFromLayer() {
    const base = this._layerById(LOTUS_DEFAULT_LAYER_ID);
    const message = this._selectedIndices.length > 1
      ? lotusT("Cartes sélectionnées replacées dans « {layer} »", { layer:base.name })
      : lotusT("Carte replacée dans « {layer} »", { layer:base.name });
    void this._assignSelectedToLayer(base.id, message);
  }

  _openMoveCardToLayerMenu() {
    if (!this._selectedIndices.length || this._saveInProgress || this._dirty) return;
    const layers = this._layersConfig();
    if (layers.length < 2) return;
    document.querySelectorAll(".lotus-move-layer-backdrop").forEach((node) => node.remove());
    const backdrop = document.createElement("div");
    backdrop.className = "lotus-move-layer-backdrop";
    const style = document.createElement("style");
    style.textContent = `
      .lotus-move-layer-backdrop { position:fixed; inset:0; z-index:100004; display:grid; place-items:center; padding:18px; box-sizing:border-box; background:rgba(0,0,0,.38); }
      .lotus-move-layer-dialog { width:min(480px,94vw); max-height:min(680px,88vh); overflow:hidden; display:flex; flex-direction:column; border-radius:16px; background:var(--card-background-color,var(--ha-card-background,#fff)); color:var(--primary-text-color,#212121); box-shadow:0 20px 60px rgba(0,0,0,.34); }
      .lotus-move-layer-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.12)); }
      .lotus-move-layer-close { appearance:none; border:0; background:transparent; color:inherit; width:40px; height:40px; border-radius:50%; cursor:pointer; display:grid; place-items:center; }
      .lotus-move-layer-list { padding:10px; overflow:auto; display:grid; gap:8px; }
      .lotus-move-layer-item { appearance:none; width:100%; border:1px solid var(--divider-color,rgba(0,0,0,.14)); background:var(--secondary-background-color,rgba(127,127,127,.08)); color:inherit; border-radius:12px; padding:11px 12px; cursor:pointer; display:flex; align-items:center; gap:12px; text-align:left; font:inherit; }
      .lotus-move-layer-item:hover { background:color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent); }
      .lotus-move-layer-item ha-icon { --mdc-icon-size:24px; }
    `;
    const dialog = document.createElement("div");
    dialog.className = "lotus-move-layer-dialog";
    const header = document.createElement("div");
    header.className = "lotus-move-layer-header";
    const title = document.createElement("strong");
    title.textContent = lotusT(this._selectedIndices.length > 1 ? "Déplacer les cartes vers un calque" : "Déplacer la carte vers un calque");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "lotus-move-layer-close";
    close.innerHTML = '<ha-icon icon="mdi:close"></ha-icon>';
    header.append(title, close);
    const list = document.createElement("div");
    list.className = "lotus-move-layer-list";
    layers.slice().reverse().forEach((layer) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lotus-move-layer-item";
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", "mdi:layers-outline");
      const label = document.createElement("span");
      label.textContent = layer.name;
      item.append(icon, label);
      item.addEventListener("click", async () => {
        cleanup();
        const message = this._selectedIndices.length > 1
          ? lotusT("Cartes sélectionnées déplacées vers « {layer} »", { layer:layer.name })
          : lotusT("Carte déplacée vers « {layer} »", { layer:layer.name });
        await this._assignSelectedToLayer(layer.id, message);
      });
      list.appendChild(item);
    });
    dialog.append(header, list);
    backdrop.append(style, dialog);
    const cleanup = () => { document.removeEventListener("keydown", onKeyDown, true); backdrop.remove(); };
    const onKeyDown = (event) => { if (event.key === "Escape") cleanup(); };
    close.addEventListener("click", cleanup);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) cleanup(); });
    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(backdrop);
  }

  _persistEditorGuidePreferences() {
    saveEditorGuidePreferences({
      showGrid:this._showEditorGrid,
      showFrame:this._showBackgroundFrame,
      gridScope:this._editorGridScope,
    });
  }

  _syncEditorGuideState() {
    this.dataset.showGrid = String(Boolean(this._showEditorGrid));
    this.dataset.showFrame = String(Boolean(this._showBackgroundFrame));
    this.dataset.gridScope = this._editorGridScope === "viewport" ? "viewport" : "image";
  }

  _toggleEditorGrid() {
    this._showEditorGrid = !this._showEditorGrid;
    this._persistEditorGuidePreferences();
    this._syncEditorGuideState();
    this._statusMessage = this._showEditorGrid ? "Grille d’aide affichée" : "Grille d’aide masquée";
    this._statusKind = "";
    this._updateToolbar();
  }

  _toggleBackgroundFrame() {
    this._showBackgroundFrame = !this._showBackgroundFrame;
    this._persistEditorGuidePreferences();
    this._syncEditorGuideState();
    this._statusMessage = this._showBackgroundFrame
      ? "Contour de l’image de fond affiché"
      : "Contour de l’image de fond masqué";
    this._statusKind = "";
    this._updateToolbar();
  }

  _toggleEditorGridScope() {
    this._editorGridScope = this._editorGridScope === "viewport" ? "image" : "viewport";
    this._persistEditorGuidePreferences();
    this._syncEditorGuideState();
    this._statusMessage = this._editorGridScope === "viewport"
      ? "Grille étendue à toute la fenêtre d’édition"
      : "Grille limitée au cadre de l’image";
    this._statusKind = "";
    this._updateToolbar();
  }

  _editorWorkspacePadding() {
    // The configured safety margin belongs to the final dashboard rendering
    // only.  The editor keeps its own small working padding so changing the
    // phone/tablet safe area never changes the authoring coordinate space.
    return LOTUS_EDITOR_WORKSPACE_PADDING;
  }

  _editorFitGeometry(viewportWidth = null, viewportHeight = null) {
    const rect = (this._scrollspace || this._viewport)?.getBoundingClientRect?.() || {};
    const width = Math.max(1, Number(viewportWidth) || this._scrollspace?.clientWidth || rect.width || 1);
    const height = Math.max(1, Number(viewportHeight) || this._scrollspace?.clientHeight || rect.height || 1);
    const padding = this._editorWorkspacePadding();
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    const ratio = Number(this._backgroundRatio);

    if (Number.isFinite(ratio) && ratio > 0) {
      const scale = Math.min(innerWidth / ratio, innerHeight);
      return {
        width,
        height,
        padding,
        innerWidth,
        innerHeight,
        fitWidth:Math.max(1, ratio * scale),
        fitHeight:Math.max(1, scale),
        imageLocked:true,
      };
    }

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      fitWidth:innerWidth,
      fitHeight:innerHeight,
      imageLocked:false,
    };
  }

  _editorZoomForPreset(mode) {
    const geometry = this._editorFitGeometry();
    if (mode === "width") {
      return clamp((geometry.innerWidth / Math.max(1, geometry.fitWidth)) * 100, LOTUS_EDITOR_ZOOM_MIN, LOTUS_EDITOR_ZOOM_MAX);
    }
    if (mode === "height") {
      return clamp((geometry.innerHeight / Math.max(1, geometry.fitHeight)) * 100, LOTUS_EDITOR_ZOOM_MIN, LOTUS_EDITOR_ZOOM_MAX);
    }
    return 100;
  }

  _setEditorZoomPreset(mode) {
    if (!this._isEditMode() || this._activeTabLayoutMode() === "grid" || this._saveInProgress) return;
    const preset = ["width", "height"].includes(mode) ? mode : "fit";
    this._editorZoomMode = preset;
    this._editorZoom = Math.round(this._editorZoomForPreset(preset));
    this._statusMessage = preset === "width"
      ? "Image ajustée à la largeur de l’éditeur"
      : preset === "height"
        ? "Image ajustée à la hauteur de l’éditeur"
        : "Image complète affichée dans l’éditeur";
    this._statusKind = "";
    this._syncSceneFrame({ resetEditorScroll:true });
    this._updateToolbar();
  }

  _adjustEditorZoom(delta) {
    if (!this._isEditMode() || this._activeTabLayoutMode() === "grid" || this._saveInProgress) return;
    const next = clamp(Math.round((Number(this._editorZoom) || 100) + Number(delta || 0)), LOTUS_EDITOR_ZOOM_MIN, LOTUS_EDITOR_ZOOM_MAX);
    if (next === this._editorZoom) return;
    this._editorZoomMode = "manual";
    this._editorZoom = next;
    this._statusMessage = `Zoom éditeur : ${next} %`;
    this._statusKind = "";
    this._syncSceneFrame({ preserveEditorAnchor:true });
    this._updateToolbar();
  }

  _viewDisplayConfig() {
    const raw = this._currentViewConfig()?.[LOTUS_VIEW_META_KEY]?.[LOTUS_VIEW_DISPLAY_KEY];
    const configuredScroll = ["vertical", "horizontal"].includes(raw?.scroll) ? raw.scroll : "none";
    const scroll = ["none", "vertical", "horizontal"].includes(this._viewScrollModeOverride)
      ? this._viewScrollModeOverride
      : configuredScroll;
    const safeMargin = clamp(Number(raw?.safe_margin ?? 0), 0, 160);
    return { scroll, safe_margin:safeMargin };
  }

  async _setViewScrollMode(mode) {
    if (!this._isEditMode() || this._saveInProgress || this._dirty) return;
    const scroll = ["vertical", "horizontal"].includes(mode) ? mode : "none";
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Impossible d’enregistrer le mode de défilement de la vue.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    const previousScroll = this._viewDisplayConfig().scroll;
    if (previousScroll === scroll) return;

    try {
      this._viewScrollModeOverride = scroll;
      this._saveInProgress = true;
      this._statusMessage = "Enregistrement du mode d’affichage…";
      this._statusKind = "";
      this._updateToolbar();

      const newConfig = this._buildConfigWithWorkingLayouts();
      const view = newConfig?.views?.[this._index];
      if (!view) return;
      const meta = view[LOTUS_VIEW_META_KEY] && typeof view[LOTUS_VIEW_META_KEY] === "object"
        ? { ...view[LOTUS_VIEW_META_KEY] }
        : {};
      const display = meta[LOTUS_VIEW_DISPLAY_KEY] && typeof meta[LOTUS_VIEW_DISPLAY_KEY] === "object"
        ? { ...meta[LOTUS_VIEW_DISPLAY_KEY] }
        : {};

      if (scroll === "none") delete display.scroll;
      else display.scroll = scroll;
      if (Object.keys(display).length) meta[LOTUS_VIEW_DISPLAY_KEY] = display;
      else delete meta[LOTUS_VIEW_DISPLAY_KEY];
      if (Object.keys(meta).length) view[LOTUS_VIEW_META_KEY] = meta;
      else delete view[LOTUS_VIEW_META_KEY];

      await this._lovelace.saveConfig(newConfig);
      this._scrollspace.scrollTop = 0;
      this._scrollspace.scrollLeft = 0;
      this._statusMessage = scroll === "vertical"
        ? "Défilement vertical activé"
        : scroll === "horizontal"
          ? "Défilement horizontal activé"
          : "Vue ajustée entièrement à l’écran";
      this._statusKind = "success";
    } catch (error) {
      this._viewScrollModeOverride = previousScroll;
      lotusDebug("Unable to save scrolling mode", error);
      this._statusMessage = `Échec de l’enregistrement : ${error?.message || error}`;
      this._statusKind = "error";
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
      requestAnimationFrame(() => this._syncCanvasHeight());
    }
  }

  _createCard() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    this._pendingNewCardTabId = this._tabsEnabled() ? this._ensureActiveTab() : null;
    this._pendingNewCardLayerId = this._ensureActiveLayer();
    this._openAddCardMenu();
  }

  _openAddCardMenu() {
    // The first-level Lotus menu deliberately precedes Home Assistant's picker.
    // It is an authoring-tool selector, not a replacement card picker.
    document.querySelectorAll(".lotus-add-card-backdrop").forEach((node) => node.remove());

    const backdrop = document.createElement("div");
    backdrop.className = "lotus-add-card-backdrop";

    const style = document.createElement("style");
    style.textContent = `
      .lotus-add-card-backdrop {
        position:fixed; inset:0; z-index:100002;
        display:grid; place-items:center; padding:18px; box-sizing:border-box;
        background:rgba(0,0,0,.42);
      }
      .lotus-add-card-dialog {
        width:min(640px,96vw); max-height:min(760px,92vh); overflow:hidden;
        display:flex; flex-direction:column;
        border-radius:16px;
        background:var(--card-background-color,var(--ha-card-background,#fff));
        color:var(--primary-text-color,#212121);
        box-shadow:0 24px 70px rgba(0,0,0,.38);
      }
      .lotus-add-card-head {
        display:flex; align-items:center; gap:8px; flex:0 0 auto;
        min-height:52px; padding:6px 8px 6px 16px;
        border-bottom:1px solid var(--divider-color,rgba(127,127,127,.25));
      }
      .lotus-add-card-title { flex:1; font-size:16px; font-weight:650; }
      .lotus-add-card-close {
        width:40px; height:40px; display:grid; place-items:center; padding:0;
        border:0; border-radius:10px; background:transparent; color:inherit; cursor:pointer;
      }
      .lotus-add-card-close:hover { background:rgba(127,127,127,.12); }
      .lotus-add-card-options {
        display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:10px; padding:14px; overflow:auto;
      }
      .lotus-add-card-option {
        appearance:none; min-height:138px; padding:16px 14px;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
        border:1px solid var(--divider-color,rgba(127,127,127,.28));
        border-radius:14px;
        background:var(--card-background-color,var(--ha-card-background,#fff));
        color:inherit; cursor:pointer; text-align:center;
      }
      .lotus-add-card-option:hover, .lotus-add-card-option:focus-visible {
        outline:none;
        border-color:var(--primary-color,#03a9f4);
        background:color-mix(in srgb,var(--primary-color,#03a9f4) 8%,transparent);
      }
      .lotus-add-card-option ha-icon {
        --mdc-icon-size:36px; color:var(--primary-color,#03a9f4);
      }
      .lotus-add-card-option strong { font-size:14px; }
      .lotus-add-card-option span {
        color:var(--secondary-text-color,#727272); font-size:11px; line-height:1.4;
      }
      @media (max-width:520px) {
        .lotus-add-card-options { grid-template-columns:1fr; }
        .lotus-add-card-option { min-height:108px; }
      }
    `;

    const dialog = document.createElement("section");
    dialog.className = "lotus-add-card-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", lotusT("Ajouter une carte"));

    const header = document.createElement("header");
    header.className = "lotus-add-card-head";
    const title = document.createElement("div");
    title.className = "lotus-add-card-title";
    title.textContent = lotusT("Ajouter");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "lotus-add-card-close";
    closeButton.title = lotusT("Fermer");
    closeButton.setAttribute("aria-label", lotusT("Fermer"));
    const closeIcon = document.createElement("ha-icon");
    closeIcon.setAttribute("icon", "mdi:close");
    closeButton.appendChild(closeIcon);
    header.append(title, closeButton);

    const options = document.createElement("div");
    options.className = "lotus-add-card-options";
    for (const tool of LOTUS_CREATE_TOOLS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lotus-add-card-option";
      button.dataset.toolId = tool.id;
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", tool.icon);
      const strong = document.createElement("strong");
      strong.textContent = tool.title;
      const description = document.createElement("span");
      description.textContent = lotusT(tool.description);
      button.append(icon, strong, description);
      options.appendChild(button);
    }

    dialog.append(header, options);
    backdrop.append(style, dialog);

    const close = (clearPending = true) => {
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
      if (clearPending) { this._pendingNewCardTabId = null; this._pendingNewCardLayerId = null; }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    options.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".lotus-add-card-option");
      const toolId = button?.dataset?.toolId;
      if (!toolId) return;
      close(false);
      this._activateCreateTool(toolId);
    });
    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => options.querySelector(".lotus-add-card-option")?.focus());
  }

  _activateCreateTool(toolId) {
    if (toolId === "lotus-stack") {
      this._createLotusStack();
      return;
    }
    if (toolId === "lotus-slide") {
      this._createLotusSlide();
      return;
    }
    if (toolId === "lotus-digicode") {
      this._createLotusDigicode();
      return;
    }
    if (toolId === "home-assistant") {
      this._createHomeAssistantCard();
      return;
    }
    this._statusMessage = `Outil de création inconnu : ${toolId}`;
    this._statusKind = "error";
    this._updateToolbar();
  }

  _createHomeAssistantCard() {
    // Ordinary cards stay entirely in Home Assistant's native creation flow.
    fireEvent(this, "ll-create-card");
  }

  _createLotusStack() {
    // The special direct marker is consumed by lotus-direct-create-bridge.
    // Home Assistant still owns the native edit/save dialog; only its card
    // picker is skipped because the user already selected Lotus Stack here.
    registerLotusStackCard();
    fireEvent(this, "ll-create-card", {
      suggested: ["__lotus_direct__:lotus-visual-stack"],
    });
  }

  _createLotusSlide() {
    // Same direct-native flow as Stack: the Lotus menu has already selected
    // the card type, so opening HA's picker a second time would be redundant.
    registerLotusSlideCard();
    fireEvent(this, "ll-create-card", {
      suggested: ["__lotus_direct__:lotus-slide-card"],
    });
  }

  _createLotusDigicode() {
    registerLotusDigicodeCard();
    fireEvent(this, "ll-create-card", {
      suggested: ["__lotus_direct__:lotus-digicode-card"],
    });
  }

  _tabsConfig() {
    const raw = this._currentViewConfig()?.[LOTUS_VIEW_META_KEY]?.[LOTUS_VIEW_TABS_KEY];
    const items = Array.isArray(raw?.items)
      ? raw.items
          .filter((item) => item && typeof item === "object" && typeof item.id === "string" && item.id)
          .map((item) => ({
            ...item,
            layout:item.layout === "grid" ? "grid" : "canvas",
            edge_corners:["none","start","end","both"].includes(item.edge_corners) ? item.edge_corners : "none",
            edge_radius:clamp(Number(item.edge_radius ?? 50),0,50),
            edge_fill:Boolean(item.edge_fill),
            grid:{
              min_width:clamp(Number(item.grid?.min_width ?? LOTUS_TAB_GRID_DEFAULTS.min_width),140,800),
              gap:clamp(Number(item.grid?.gap ?? LOTUS_TAB_GRID_DEFAULTS.gap),0,64),
              padding:clamp(Number(item.grid?.padding ?? LOTUS_TAB_GRID_DEFAULTS.padding),0,64),
              max_columns:clamp(Math.round(Number(item.grid?.max_columns ?? LOTUS_TAB_GRID_DEFAULTS.max_columns)),1,12),
            },
          }))
      : [];
    return {
      enabled:Boolean(raw?.enabled && items.length),
      position:["top","bottom","left","right"].includes(raw?.position) ? raw.position : LOTUS_TABS_DEFAULTS.position,
      span:clamp(Number(raw?.span ?? LOTUS_TABS_DEFAULTS.span),20,100),
      thickness:clamp(Number(raw?.thickness ?? LOTUS_TABS_DEFAULTS.thickness),4,25),
      align:["start","center","end"].includes(raw?.align) ? raw.align : LOTUS_TABS_DEFAULTS.align,
      items,
    };
  }

  _tabsEnabled() { return this._tabsConfig().enabled; }
  _defaultTabId() { return this._tabsConfig().items[0]?.id || null; }

  _ensureActiveTab() {
    const tabs = this._tabsConfig();
    if (!tabs.enabled) {
      this._activeTabId = null;
      return null;
    }
    if (!tabs.items.some((item) => item.id === this._activeTabId)) {
      this._activeTabId = tabs.items[0]?.id || null;
    }
    return this._activeTabId;
  }

  _activeTab() {
    const tabs = this._tabsConfig();
    if (!tabs.enabled) return null;
    const id = this._ensureActiveTab();
    return tabs.items.find((item) => item.id === id) || tabs.items[0] || null;
  }

  _activeTabLayoutMode() {
    return this._tabsEnabled() && this._activeTab()?.layout === "grid" ? "grid" : "canvas";
  }

  _activeGridConfig() {
    const grid = this._activeTab()?.grid || {};
    return {
      min_width:clamp(Number(grid.min_width ?? LOTUS_TAB_GRID_DEFAULTS.min_width),140,800),
      gap:clamp(Number(grid.gap ?? LOTUS_TAB_GRID_DEFAULTS.gap),0,64),
      padding:clamp(Number(grid.padding ?? LOTUS_TAB_GRID_DEFAULTS.padding),0,64),
      max_columns:clamp(Math.round(Number(grid.max_columns ?? LOTUS_TAB_GRID_DEFAULTS.max_columns)),1,12),
    };
  }

  _storedCardTabId(index) {
    const viewLayout = this._cardConfig(index)?.view_layout || {};
    const legacyStored = LOTUS_LEGACY_LAYOUT_KEYS
      .map((key) => viewLayout[key])
      .find((value) => value && typeof value === "object") || {};
    const currentStored = viewLayout[LOTUS_LAYOUT_KEY];
    const stored = {
      ...legacyStored,
      ...(currentStored && typeof currentStored === "object" ? currentStored : {}),
    };
    return typeof stored.tab === "string" && stored.tab ? stored.tab : null;
  }

  _cardTabId(index) {
    if (!this._tabsEnabled()) return null;
    const working = this._workingLayouts.get(index);
    const candidate = working?.tab || this._storedCardTabId(index);
    const valid = new Set(this._tabsConfig().items.map((item) => item.id));
    return candidate && valid.has(candidate) ? candidate : this._defaultTabId();
  }

  _isCardVisibleInActiveTab(index) {
    if (!this._tabsEnabled()) return true;
    return this._cardTabId(index) === this._ensureActiveTab();
  }

  _effectiveBackground() {
    if (this._activeTabLayoutMode() === "grid") return undefined;
    const tab = this._activeTab();
    return tab?.background || this._currentViewConfig()?.background;
  }

  _effectiveFillColorValue() {
    const tab = this._activeTab();
    if (typeof tab?.fill_color === "string" && tab.fill_color && tab.fill_color !== "none") {
      return tab.fill_color;
    }
    const view = this._currentViewConfig();
    const meta = view?.[LOTUS_VIEW_META_KEY];
    const directValue = meta && typeof meta === "object" && !Array.isArray(meta)
      ? meta[LOTUS_VIEW_FILL_KEY]
      : undefined;
    const background = view?.background;
    const legacyValue = background && typeof background === "object" && !Array.isArray(background)
      ? background[LOTUS_VIEW_LEGACY_FILL_KEY]
      : undefined;
    return directValue ?? legacyValue;
  }

  _tabColorCss(value, fallback) {
    const color = String(value ?? "").trim();
    if (!color || color === "none" || color === "state") return fallback;
    if (HA_THEME_COLORS.has(color)) {
      if (color === "primary") return "var(--primary-color,#03a9f4)";
      if (color === "accent") return "var(--accent-color,var(--primary-color,#03a9f4))";
      return `var(--${color}-color,${fallback})`;
    }
    return color;
  }

  _tabMediaId(value) {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && typeof value.media_content_id === "string") return value.media_content_id;
    return "";
  }

  _openMoveCardToTabMenu() {
    if (this._selectedIndex === null || this._saveInProgress || this._dirty) return;
    const tabs = this._tabsConfig();
    if (!tabs.enabled || tabs.items.length < 2) return;

    document.querySelectorAll(".lotus-move-tab-backdrop").forEach((node) => node.remove());
    const selectedIndex = this._selectedIndex;
    const currentTabId = this._cardTabId(selectedIndex);
    const backdrop = document.createElement("div");
    backdrop.className = "lotus-move-tab-backdrop";

    const style = document.createElement("style");
    style.textContent = `
      .lotus-move-tab-backdrop {
        position:fixed; inset:0; z-index:100004;
        display:grid; place-items:center; padding:18px; box-sizing:border-box;
        background:rgba(0,0,0,.38);
      }
      .lotus-move-tab-dialog {
        width:min(520px,94vw); max-height:min(680px,88vh); overflow:hidden;
        display:flex; flex-direction:column;
        border-radius:16px;
        background:var(--card-background-color,var(--ha-card-background,#fff));
        color:var(--primary-text-color,#212121);
        box-shadow:0 20px 60px rgba(0,0,0,.34);
      }
      .lotus-move-tab-header {
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        padding:16px 18px; border-bottom:1px solid var(--divider-color,rgba(0,0,0,.12));
      }
      .lotus-move-tab-header strong { font-size:18px; }
      .lotus-move-tab-close {
        appearance:none; border:0; background:transparent; color:inherit;
        width:40px; height:40px; border-radius:50%; cursor:pointer;
        display:grid; place-items:center;
      }
      .lotus-move-tab-list {
        padding:10px; overflow:auto; display:grid; gap:8px;
      }
      .lotus-move-tab-item {
        appearance:none; width:100%; border:1px solid var(--divider-color,rgba(0,0,0,.14));
        background:var(--secondary-background-color,rgba(127,127,127,.08));
        color:inherit; border-radius:12px; padding:11px 12px; cursor:pointer;
        display:flex; align-items:center; gap:12px; text-align:left; font:inherit;
      }
      .lotus-move-tab-item:hover:not(:disabled) { background:color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent); }
      .lotus-move-tab-item:disabled { opacity:.48; cursor:default; }
      .lotus-move-tab-item ha-icon { --mdc-icon-size:24px; flex:0 0 auto; }
      .lotus-move-tab-image { width:32px; height:32px; flex:0 0 32px; overflow:hidden; border-radius:6px; }
      .lotus-move-tab-label { min-width:0; display:flex; flex-direction:column; gap:2px; }
      .lotus-move-tab-label span:first-child { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .lotus-move-tab-label small { color:var(--secondary-text-color,#666); }
    `;

    const dialog = document.createElement("div");
    dialog.className = "lotus-move-tab-dialog";
    const header = document.createElement("div");
    header.className = "lotus-move-tab-header";
    const title = document.createElement("strong");
    title.textContent = lotusT("Déplacer la carte vers un onglet");
    const close = document.createElement("button");
    close.type = "button";
    close.className = "lotus-move-tab-close";
    close.title = lotusT("Fermer");
    close.setAttribute("aria-label", lotusT("Fermer"));
    const closeIcon = document.createElement("ha-icon");
    closeIcon.setAttribute("icon", "mdi:close");
    close.appendChild(closeIcon);
    header.append(title, close);

    const list = document.createElement("div");
    list.className = "lotus-move-tab-list";
    tabs.items.forEach((tab, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lotus-move-tab-item";
      const current = tab.id === currentTabId;
      item.disabled = current;
      item.title = current ? lotusT("Onglet actuel") : `${lotusT("Déplacer vers")} ${tab.name || `${lotusT("Onglet")} ${index + 1}`}`;

      const image = this._tabMediaId(tab.image);
      if (image) {
        const huiImage = document.createElement("hui-image");
        huiImage.className = "lotus-move-tab-image";
        huiImage.hass = this._hass;
        huiImage.image = image;
        huiImage.fitMode = "contain";
        item.appendChild(huiImage);
      } else {
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", tab.icon || "mdi:tab");
        item.appendChild(icon);
      }

      const label = document.createElement("span");
      label.className = "lotus-move-tab-label";
      const name = document.createElement("span");
      name.textContent = tab.name || `${lotusT("Onglet")} ${index + 1}`;
      const detail = document.createElement("small");
      detail.textContent = current ? lotusT("Onglet actuel") : lotusT(tab.layout === "grid" ? "Grille responsive" : "Canvas libre");
      label.append(name, detail);
      item.appendChild(label);
      if (!current) {
        item.addEventListener("click", async () => {
          backdrop.remove();
          await this._moveSelectedToTab(tab.id);
        });
      }
      list.appendChild(item);
    });

    dialog.append(header, list);
    backdrop.append(style, dialog);
    const cleanup = () => {
      document.removeEventListener("keydown", onKeyDown, true);
      backdrop.remove();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") cleanup();
    };
    close.addEventListener("click", cleanup);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup();
    });
    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(backdrop);
  }

  async _moveSelectedToTab(tabId) {
    if (this._selectedIndex === null || this._saveInProgress || this._dirty) return;
    const tabs = this._tabsConfig();
    const destination = tabs.items.find((item) => item.id === tabId);
    if (!tabs.enabled || !destination) return;

    const index = this._selectedIndex;
    const currentTabId = this._cardTabId(index);
    if (currentTabId === tabId) return;
    const previous = { ...(this._workingLayouts.get(index) || this._readStoredLayout(index)) };
    this._workingLayouts.set(index, { ...previous, tab:tabId, layer:LOTUS_DEFAULT_LAYER_ID });
    this._markDirty();
    const saved = await this._applyChanges(`Carte déplacée vers « ${destination.name || "onglet"} »`);
    if (!saved) {
      this._workingLayouts.set(index, previous);
      this._dirty = false;
      this._renderCards();
      this._renderTabs();
      this._updateToolbar();
      return;
    }

    if (!this._isCardVisibleInActiveTab(index)) this._clearSelection();
    this._renderCards();
    this._renderTabs();
    this._updateToolbar();
  }

  _selectTab(tabId) {
    const tabs = this._tabsConfig();
    if (!tabs.enabled || !tabs.items.some((item) => item.id === tabId) || tabId === this._activeTabId) return;
    this._activeTabId = tabId;
    this._renamingLayerId = null;
    this._ensureActiveLayer(this._currentLayerScopeKey());
    this._sanitizeSelection();
    this._editorZoom = 100;
    this._editorZoomMode = "fit";
    if (this._scrollspace) { this._scrollspace.scrollTop = 0; this._scrollspace.scrollLeft = 0; }
    this._backgroundRatio = null;
    this._backgroundProbeKey = "";
    this._backgroundProbeSequence += 1;
    this._renderCards();
    this._renderTabs();
    this._syncViewBackground();
    requestAnimationFrame(() => this._syncCanvasHeight());
  }

  _renderTabs() {
    if (!this._tabsBar) return;
    const tabs = this._tabsConfig();
    this._ensureActiveTab();
    this._tabsBar.replaceChildren();
    this._tabsBar.dataset.visible = String(Boolean(tabs.enabled));
    this._tabsBar.dataset.position = tabs.position;
    if (!tabs.enabled) return;

    tabs.items.forEach((item,index) => {
      const active = item.id === this._activeTabId;
      const mode = item.edge_corners || "none";
      let neighbor;
      if (item.edge_fill && mode === "start" && index > 0) neighbor = tabs.items[index - 1];
      if (item.edge_fill && mode === "end" && index < tabs.items.length - 1) neighbor = tabs.items[index + 1];
      const neighborActive = neighbor?.id === this._activeTabId;
      const underlay = neighbor
        ? this._tabColorCss(neighborActive ? (neighbor.active_color || "accent") : (neighbor.color || "primary"), "var(--card-background-color,var(--ha-card-background,#fff))")
        : "transparent";
      const slot = document.createElement("div");
      slot.className = "lotus-view-tab-slot";
      slot.style.setProperty("--lotus-tab-underlay", underlay);
      if (neighbor) {
        slot.dataset.edgeFillSide = mode;
        const edgeSource = neighbor || item;
        const edgeSourceActive = edgeSource?.id === this._activeTabId;
        const edgeFg = this._tabColorCss(
          edgeSourceActive ? (edgeSource?.active_text_color || "white") : (edgeSource?.text_color || "white"),
          "var(--primary-text-color,#212121)",
        );
        slot.style.setProperty("--lotus-tab-edge-stroke", `color-mix(in srgb,${edgeFg} ${edgeSourceActive ? 35 : 18}%,transparent)`);
        const edgeWidth = edgeSourceActive ? 2 : 1;
        slot.dataset.edgeWidth = String(edgeWidth);
        slot.style.setProperty("--lotus-tab-edge-width", String(edgeWidth));
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "lotus-view-tab";
      button.dataset.active = String(active);
      button.dataset.edgeCorners = item.edge_corners || "none";
      button.dataset.edgeRadius = String(clamp(Number(item.edge_radius ?? 50),0,50));
      button.title = item.name || `${lotusT("Onglet")} ${index + 1}`;
      button.setAttribute("aria-label", button.title);
      button.style.setProperty("--lotus-tab-bg", this._tabColorCss(active ? (item.active_color || "accent") : (item.color || "primary"), "var(--card-background-color,var(--ha-card-background,#fff))"));
      button.style.setProperty("--lotus-tab-fg", this._tabColorCss(active ? (item.active_text_color || "white") : (item.text_color || "white"), "var(--primary-text-color,#212121)"));

      const image = this._tabMediaId(item.image);
      if (image) {
        const huiImage = document.createElement("hui-image");
        huiImage.className = "lotus-tab-image";
        huiImage.hass = this._hass;
        huiImage.image = image;
        huiImage.fitMode = "contain";
        button.appendChild(huiImage);
      } else if (item.icon) {
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", item.icon);
        button.appendChild(icon);
      }
      if (item.name) {
        const label = document.createElement("span");
        label.textContent = item.name;
        button.appendChild(label);
      }
      button.addEventListener("click", () => this._selectTab(item.id));
      slot.appendChild(button);
      if (neighbor) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("lotus-tab-edge-border");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svg.appendChild(path);
        slot.appendChild(svg);

        const dividerOwner = mode === "start"
          ? this._tabsBar.children[index - 1]?.querySelector(".lotus-view-tab")
          : button;
        if (dividerOwner) dividerOwner.dataset.suppressDivider = "true";
      }
      this._tabsBar.appendChild(slot);
    });
    this._updateTabEdgeBorders();
  }

  _updateTabEdgeBorders() {
    if (!this._tabsBar) return;
    const position = this._tabsBar.dataset.position || "top";
    const horizontal = position === "top" || position === "bottom";
    const barRect = this._tabsBar.getBoundingClientRect();
    const depth = horizontal ? barRect.height : barRect.width;
    if (!(depth > 0)) return;

    this._tabsBar.querySelectorAll(".lotus-view-tab-slot[data-edge-fill-side]").forEach((slot) => {
      const button = slot.querySelector(".lotus-view-tab");
      const svg = slot.querySelector(".lotus-tab-edge-border");
      const path = svg?.querySelector("path");
      if (!button || !svg || !path) return;
      const rect = slot.getBoundingClientRect();
      const radiusPct = clamp(Number(button.dataset.edgeRadius ?? 50),0,50);
      const radius = depth * radiusPct / 100;
      const edgeWidth = clamp(Number(slot.dataset.edgeWidth ?? 1), 0, 10);
      const d = lotusTabEdgeBorderPath(position, slot.dataset.edgeFillSide, rect.width, rect.height, radius, edgeWidth);
      if (!d) {
        svg.setAttribute("hidden", "");
        return;
      }
      svg.removeAttribute("hidden");
      svg.setAttribute("viewBox", `0 0 ${Math.max(1,rect.width)} ${Math.max(1,rect.height)}`);
      path.setAttribute("d", d);
    });
  }

  _syncTabsLayout() {
    if (!this._viewport || !this._scrollspace || !this._tabsBar) return;
    const tabs = this._tabsConfig();
    this._renderTabs();
    const reset = () => {
      this._scrollspace.style.inset = "0";
      this._tabsBar.removeAttribute("style");
    };
    if (!tabs.enabled) {
      reset();
      return;
    }

    const rect = this._viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const horizontal = tabs.position === "top" || tabs.position === "bottom";
    const depthBase = horizontal ? rect.height : rect.width;
    const depth = Math.max(32, depthBase * tabs.thickness / 100);
    const span = tabs.span;
    const offset = tabs.align === "start" ? 0 : tabs.align === "end" ? 100 - span : (100 - span) / 2;

    this._tabsBar.style.left = "auto";
    this._tabsBar.style.right = "auto";
    this._tabsBar.style.top = "auto";
    this._tabsBar.style.bottom = "auto";
    this._tabsBar.style.width = horizontal ? `${span}%` : `${depth}px`;
    this._tabsBar.style.height = horizontal ? `${depth}px` : `${span}%`;
    if (horizontal) this._tabsBar.style.left = `${offset}%`;
    else this._tabsBar.style.top = `${offset}%`;
    this._tabsBar.style[tabs.position] = "0px";
    [...this._tabsBar.querySelectorAll(".lotus-view-tab")].forEach((button) => {
      const radiusPct = clamp(Number(button.dataset.edgeRadius ?? 50),0,50);
      button.style.setProperty("--lotus-tab-edge-radius", `${Math.round(depth * radiusPct / 100 * 1000) / 1000}px`);
    });
    this._updateTabEdgeBorders();

    this._scrollspace.style.top = tabs.position === "top" ? `${depth}px` : "0px";
    this._scrollspace.style.bottom = tabs.position === "bottom" ? `${depth}px` : "0px";
    this._scrollspace.style.left = tabs.position === "left" ? `${depth}px` : "0px";
    this._scrollspace.style.right = tabs.position === "right" ? `${depth}px` : "0px";
  }

  _openTabsEditor() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    openLotusTabsEditor({
      hass:this._hass,
      lovelace:this._lovelace,
      viewIndex:this._index,
      activeTabId:this._activeTabId,
      onSaved:(activeTabId) => {
        this._activeTabId = activeTabId || null;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          this._captureBaselineLayouts(true);
          this._renderCards();
          this._syncCanvasHeight();
        }));
      },
    });
  }

  _toolbarGroup(...items) {
    const group = document.createElement("span");
    group.className = "toolbar-group";
    for (const item of items) {
      if (item) group.append(item);
    }
    return group;
  }

  _separator() {
    const sep = document.createElement("span");
    sep.className = "separator";
    sep.setAttribute("aria-hidden", "true");
    return sep;
  }

  _isEditMode() { return Boolean(this._lovelace?.editMode); }
  _currentViewConfig() { return this._lovelace?.config?.views?.[this._index] || this._config || {}; }

  _backgroundDescriptor() {
    const background = this._effectiveBackground();
    let source = null;
    let size = null;
    let alignment = "center";
    let repeat = "no-repeat";

    if (background && typeof background === "object") {
      const image = background.image;
      if (typeof image === "string") source = image;
      else if (image && typeof image === "object") source = image.media_content_id || null;
      size = String(background.size || "cover").toLowerCase();
      alignment = String(background.alignment || "center").toLowerCase();
      repeat = String(background.repeat || "no-repeat").toLowerCase();
    } else if (typeof background === "string") {
      const value = background.trim();
      const urlMatch = value.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
      if (urlMatch?.[2]) {
        source = urlMatch[2].trim();
      } else if (/^(?:media-source:\/\/|\/|https?:\/\/|data:|blob:)/i.test(value) && !/\s/.test(value)) {
        source = value;
      }

      if (/\bcontain\b/i.test(value)) size = "contain";
      else if (/\bcover\b/i.test(value)) size = "cover";

      const beforeSlash = value.split("/")[0].toLowerCase();
      const horizontal = /\bleft\b/.test(beforeSlash)
        ? "left"
        : /\bright\b/.test(beforeSlash)
          ? "right"
          : "center";
      const vertical = /\btop\b/.test(beforeSlash)
        ? "top"
        : /\bbottom\b/.test(beforeSlash)
          ? "bottom"
          : "center";
      alignment = `${vertical} ${horizontal}`;
      repeat = /\brepeat\b/i.test(value) && !/\bno-repeat\b/i.test(value)
        ? "repeat"
        : "no-repeat";
    }

    return { background, source, size, alignment, repeat };
  }

  _backgroundImageUrl(descriptor = this._backgroundDescriptor()) {
    let source = descriptor?.source;
    const resolved = this._viewBackground?.resolvedImage;
    if (source?.startsWith?.("media-source://")) {
      if (!resolved) return null;
      source = resolved;
    }
    if (!source) return null;
    if (/^(?:https?:\/\/|data:|blob:)/i.test(source)) return source;
    try {
      return typeof this._hass?.hassUrl === "function" ? this._hass.hassUrl(source) : source;
    } catch (_error) {
      return source;
    }
  }

  _scheduleBackgroundRatioProbe() {
    for (const timer of this._backgroundProbeTimers) clearTimeout(timer);
    this._backgroundProbeTimers = [];
    for (const delay of [0, 80, 250, 800]) {
      const timer = window.setTimeout(() => this._probeBackgroundRatio(), delay);
      this._backgroundProbeTimers.push(timer);
    }
  }

  _probeBackgroundRatio() {
    if (!this.isConnected || !this._canvas) return;
    const descriptor = this._backgroundDescriptor();

    // Coordinate locking to the image only makes geometric sense for a
    // non-repeated contain/cover background. Other CSS backgrounds keep the
    // historical full-viewport coordinate space.
    if (
      !descriptor.source
      || descriptor.repeat !== "no-repeat"
      || !["contain", "cover"].includes(descriptor.size)
    ) {
      const changed = this._backgroundRatio !== null || this._backgroundProbeKey !== "";
      this._backgroundRatio = null;
      this._backgroundProbeKey = "";
      if (changed) this._syncSceneFrame();
      return;
    }

    const url = this._backgroundImageUrl(descriptor);
    if (!url) return;

    const key = `${descriptor.size}|${descriptor.alignment}|${url}`;
    if (key === this._backgroundProbeKey && this._backgroundRatio) return;

    const sequence = ++this._backgroundProbeSequence;
    this._backgroundProbeKey = key;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (sequence !== this._backgroundProbeSequence) return;
      if (!image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      this._backgroundRatio = ratio;
      this._syncSceneFrame();
    };
    image.onerror = () => {
      if (sequence !== this._backgroundProbeSequence) return;
      this._backgroundRatio = null;
      this._syncSceneFrame();
    };
    image.src = url;
  }

  _sceneAlignmentOffset(available, scene, alignment, axis) {
    const delta = available - scene;
    if (axis === "x") {
      if (alignment.includes("left")) return 0;
      if (alignment.includes("right")) return delta;
      return delta / 2;
    }
    if (alignment.includes("top")) return 0;
    if (alignment.includes("bottom")) return delta;
    return delta / 2;
  }

  _computeSceneFrame(viewportWidth, viewportHeight) {
    const geometry = this._editorFitGeometry(viewportWidth, viewportHeight);
    const zoom = clamp(Number(this._editorZoom) || 100, LOTUS_EDITOR_ZOOM_MIN, LOTUS_EDITOR_ZOOM_MAX) / 100;
    const sceneWidth = Math.max(1, geometry.fitWidth * zoom);
    const sceneHeight = Math.max(1, geometry.fitHeight * zoom);
    const extents = this._sceneContentExtents(sceneWidth / Math.max(sceneHeight, 1));
    const contentWidth = Math.max(1, ((extents.maxRight - extents.minLeft) / 100) * sceneWidth);
    const contentHeight = Math.max(1, ((extents.maxBottom - extents.minTop) / 100) * sceneHeight);
    const alignment = this._backgroundDescriptor().alignment || "center";
    const alignX = contentWidth <= geometry.innerWidth
      ? this._sceneAlignmentOffset(geometry.innerWidth, contentWidth, alignment, "x")
      : 0;
    const alignY = contentHeight <= geometry.innerHeight
      ? this._sceneAlignmentOffset(geometry.innerHeight, contentHeight, alignment, "y")
      : 0;

    return {
      left:geometry.padding + alignX - (extents.minLeft / 100) * sceneWidth,
      top:geometry.padding + alignY - (extents.minTop / 100) * sceneHeight,
      width:sceneWidth,
      height:sceneHeight,
      imageLocked:geometry.imageLocked,
      contentWidth,
      contentHeight,
      minLeft:extents.minLeft,
      minTop:extents.minTop,
      maxRight:extents.maxRight,
      maxBottom:extents.maxBottom,
      editorPadding:geometry.padding,
    };
  }

  _sceneContentExtents(canvasRatio = null) {
    let minLeft = 0;
    let minTop = 0;
    let maxRight = 100;
    let maxBottom = 100;
    const canvasRect = this._canvas?.getBoundingClientRect();
    const fallbackRatio = canvasRect?.width > 0 && canvasRect?.height > 0
      ? canvasRect.width / canvasRect.height
      : 1;
    const effectiveCanvasRatio = Number.isFinite(Number(canvasRatio)) && Number(canvasRatio) > 0
      ? Number(canvasRatio)
      : fallbackRatio;

    for (let index = 0; index < this._cards.length; index += 1) {
      if (!this._isCardVisibleInActiveTab(index)) continue;
      const layout = this._workingLayouts.get(index) || this._readStoredLayout(index);
      if (!layout) continue;
      const ratio = this._stackRatio(index);
      let width = Number(layout.width || 0);
      let height = Number(layout.height || 0);
      if (ratio) {
        const effectiveSize = this._ratioSizeFromWidth(
          width,
          ratio,
          Math.max(1, effectiveCanvasRatio * 1000),
          1000,
        );
        width = effectiveSize.width;
        height = effectiveSize.height;
      }
      const x = Number(layout.x || 0);
      const y = Number(layout.y || 0);
      minLeft = Math.min(minLeft, x);
      minTop = Math.min(minTop, y);
      maxRight = Math.max(maxRight, x + width);
      maxBottom = Math.max(maxBottom, y + height);
    }
    return {
      minLeft:roundPct(clamp(minLeft, LOTUS_LAYOUT_POSITION_MIN, 0)),
      minTop:roundPct(clamp(minTop, LOTUS_LAYOUT_POSITION_MIN, 0)),
      maxRight:roundPct(clamp(maxRight, 100, LOTUS_LAYOUT_POSITION_MAX + 100)),
      maxBottom:roundPct(clamp(maxBottom, 100, LOTUS_LAYOUT_POSITION_MAX + 100)),
    };
  }

  _sceneSafetyInsets(canvasRatio = null, configuredMargin = 0) {
    const margin = clamp(Number(configuredMargin || 0), 0, 160);
    if (!margin) return { left:0, top:0, right:0, bottom:0 };

    const canvasRect = this._canvas?.getBoundingClientRect();
    const fallbackRatio = canvasRect?.width > 0 && canvasRect?.height > 0
      ? canvasRect.width / canvasRect.height
      : 1;
    const effectiveCanvasRatio = Number.isFinite(Number(canvasRatio)) && Number(canvasRatio) > 0
      ? Number(canvasRatio)
      : fallbackRatio;

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    let hasVisibleCard = false;

    for (let index = 0; index < this._cards.length; index += 1) {
      if (!this._isCardVisibleInActiveTab(index)) continue;
      const layout = this._workingLayouts.get(index) || this._readStoredLayout(index);
      if (!layout) continue;

      const ratio = this._stackRatio(index);
      let width = Number(layout.width || 0);
      let height = Number(layout.height || 0);
      if (ratio) {
        const effectiveSize = this._ratioSizeFromWidth(
          width,
          ratio,
          Math.max(1, effectiveCanvasRatio * 1000),
          1000,
        );
        width = effectiveSize.width;
        height = effectiveSize.height;
      }

      const x = Number(layout.x || 0);
      const y = Number(layout.y || 0);
      minLeft = Math.min(minLeft, x);
      minTop = Math.min(minTop, y);
      maxRight = Math.max(maxRight, x + width);
      maxBottom = Math.max(maxBottom, y + height);
      hasVisibleCard = true;
    }

    if (!hasVisibleCard) return { left:0, top:0, right:0, bottom:0 };

    // The safety margin protects interactive cards, not the background image.
    // A background aligned to "top" must therefore stay flush with the top of
    // the final view unless a card itself reaches that edge.  The same rule is
    // applied independently to the four sides.
    const epsilon = 0.001;
    return {
      left:minLeft <= epsilon ? margin : 0,
      top:minTop <= epsilon ? margin : 0,
      right:maxRight >= 100 - epsilon ? margin : 0,
      bottom:maxBottom >= 100 - epsilon ? margin : 0,
    };
  }

  _computeFinalSceneFrame(viewportWidth, viewportHeight) {
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const imageRatio = Number(this._backgroundRatio);
    const designRatio = Number.isFinite(imageRatio) && imageRatio > 0
      ? imageRatio
      : width / height;
    const extents = this._sceneContentExtents(designRatio);
    const spanXFactor = Math.max(1, (extents.maxRight - extents.minLeft) / 100);
    const spanYFactor = Math.max(1, (extents.maxBottom - extents.minTop) / 100);
    const display = this._viewDisplayConfig();
    const mode = display.scroll;
    const safeMargin = clamp(Number(display.safe_margin || 0), 0, 160);
    const requestedSafety = this._sceneSafetyInsets(designRatio, safeMargin);
    // Never allow the safety area itself to consume the whole viewport on a
    // very small display.  Keep the configured value when space permits, but
    // cap each opposing pair proportionally when required.
    const horizontalSafetyScale = Math.min(1, width / Math.max(1, requestedSafety.left + requestedSafety.right + 1));
    const verticalSafetyScale = Math.min(1, height / Math.max(1, requestedSafety.top + requestedSafety.bottom + 1));
    const safety = {
      left:requestedSafety.left * horizontalSafetyScale,
      right:requestedSafety.right * horizontalSafetyScale,
      top:requestedSafety.top * verticalSafetyScale,
      bottom:requestedSafety.bottom * verticalSafetyScale,
    };
    const innerWidth = Math.max(1, width - safety.left - safety.right);
    const innerHeight = Math.max(1, height - safety.top - safety.bottom);
    const alignment = this._backgroundDescriptor().alignment || "center";

    let sceneWidth;
    let sceneHeight;
    let contentWidth;
    let contentHeight;
    let left = 0;
    let top = 0;

    if (mode === "vertical") {
      sceneWidth = innerWidth / spanXFactor;
      sceneHeight = sceneWidth / Math.max(designRatio, 0.0001);
      contentWidth = sceneWidth * spanXFactor;
      contentHeight = sceneHeight * spanYFactor;
      left = safety.left + this._sceneAlignmentOffset(innerWidth, contentWidth, alignment, "x")
        - (extents.minLeft / 100) * sceneWidth;
      // Keep the scroll origin reachable when the content is taller than the
      // viewport. When it fits, honour the configured background alignment.
      top = safety.top + (contentHeight <= innerHeight
        ? this._sceneAlignmentOffset(innerHeight, contentHeight, alignment, "y")
        : 0) - (extents.minTop / 100) * sceneHeight;
    } else if (mode === "horizontal") {
      sceneHeight = innerHeight / spanYFactor;
      sceneWidth = sceneHeight * designRatio;
      contentWidth = sceneWidth * spanXFactor;
      contentHeight = sceneHeight * spanYFactor;
      left = safety.left + (contentWidth <= innerWidth
        ? this._sceneAlignmentOffset(innerWidth, contentWidth, alignment, "x")
        : 0) - (extents.minLeft / 100) * sceneWidth;
      top = safety.top + this._sceneAlignmentOffset(innerHeight, contentHeight, alignment, "y")
        - (extents.minTop / 100) * sceneHeight;
    } else {
      const unitHeight = Math.min(
        innerWidth / Math.max(designRatio * spanXFactor, 0.0001),
        innerHeight / Math.max(spanYFactor, 0.0001),
      );
      sceneHeight = Math.max(1, unitHeight);
      sceneWidth = Math.max(1, sceneHeight * designRatio);
      contentWidth = sceneWidth * spanXFactor;
      contentHeight = sceneHeight * spanYFactor;
      left = safety.left + this._sceneAlignmentOffset(innerWidth, contentWidth, alignment, "x")
        - (extents.minLeft / 100) * sceneWidth;
      top = safety.top + this._sceneAlignmentOffset(innerHeight, contentHeight, alignment, "y")
        - (extents.minTop / 100) * sceneHeight;
    }

    return {
      left,
      top,
      width:Math.max(1, sceneWidth),
      height:Math.max(1, sceneHeight),
      imageLocked:Boolean(Number.isFinite(imageRatio) && imageRatio > 0),
      contentWidth:Math.max(1, contentWidth),
      contentHeight:Math.max(1, contentHeight),
      minLeft:extents.minLeft,
      minTop:extents.minTop,
      maxRight:extents.maxRight,
      maxBottom:extents.maxBottom,
      safeMargin,
      safeInsets:safety,
    };
  }

  _syncGridLayout(viewportWidth = null) {
    if (!this._canvas || !this._scrollspace) return;
    const grid = this._activeGridConfig();
    const width = Math.max(1, Number(viewportWidth) || this._scrollspace.getBoundingClientRect().width || 1);
    const innerWidth = Math.max(1, width - (grid.padding * 2));
    const columnsByWidth = Math.max(1, Math.floor((innerWidth + grid.gap) / (grid.min_width + grid.gap)));
    const columns = Math.max(1, Math.min(grid.max_columns, columnsByWidth));
    this._canvas.style.setProperty("--lotus-grid-columns", String(columns));
    this._canvas.style.setProperty("--lotus-grid-gap", `${grid.gap}px`);
    this._canvas.style.setProperty("--lotus-grid-padding", `${grid.padding}px`);
    this._canvas.dataset.gridColumns = String(columns);
  }

  _syncSceneFrame(options = {}) {
    if (!this.isConnected || !this._canvas || !this._viewport) return;
    const editing = this._isEditMode();
    const previousFrame = this._sceneFrame && typeof this._sceneFrame === "object" ? { ...this._sceneFrame } : null;
    const previousScrollLeft = this._scrollspace?.scrollLeft || 0;
    const previousScrollTop = this._scrollspace?.scrollTop || 0;
    const viewportRect = (this._scrollspace || this._viewport).getBoundingClientRect();
    const viewportWidth = Math.max(1, this._scrollspace?.clientWidth || viewportRect.width || 1);
    const viewportHeight = Math.max(1, this._scrollspace?.clientHeight || viewportRect.height || 1);
    if (viewportWidth <= 0 || viewportHeight <= 0) return;

    const layoutMode = this._activeTabLayoutMode();
    const scrollMode = editing ? "editor" : layoutMode === "grid" ? "none" : this._viewDisplayConfig().scroll;
    this._scrollspace.dataset.scrollMode = scrollMode;

    if (layoutMode === "grid") {
      this._sceneFrame = { left:0, top:0, width:viewportWidth, height:viewportHeight, imageLocked:false };
      this._canvas.dataset.coordinateSpace = "responsive-grid";
      this._canvas.style.left = "0px";
      this._canvas.style.top = "0px";
      this._canvas.style.width = "100%";
      this._canvas.style.height = "auto";
      this._canvas.style.removeProperty("--lotus-scene-extent-left");
      this._canvas.style.removeProperty("--lotus-scene-extent-top");
      this._canvas.style.removeProperty("--lotus-scene-extent-width");
      this._canvas.style.removeProperty("--lotus-scene-extent-height");
      this._canvas.style.removeProperty("--lotus-scene-tail-x");
      this._canvas.style.removeProperty("--lotus-scene-tail-y");
      this._syncGridLayout(viewportWidth);
      this._syncViewBackground(false);
      requestAnimationFrame(() => {
        if (!this.isConnected || !this._canvas) return;
        for (let index = 0; index < this._cards.length; index += 1) this._applyLayoutToWrapper(index);
        this._updateToolbar();
      });
      return;
    }

    if (editing && ["fit", "width", "height"].includes(this._editorZoomMode)) {
      this._editorZoom = Math.round(this._editorZoomForPreset(this._editorZoomMode));
    }
    const frame = editing
      ? this._computeSceneFrame(viewportWidth, viewportHeight)
      : this._computeFinalSceneFrame(viewportWidth, viewportHeight);
    this._sceneFrame = frame;
    this._canvas.style.left = `${Math.round(frame.left * 1000) / 1000}px`;
    this._canvas.style.top = `${Math.round(frame.top * 1000) / 1000}px`;
    this._canvas.style.width = `${Math.round(frame.width * 1000) / 1000}px`;
    this._canvas.style.height = `${Math.round(frame.height * 1000) / 1000}px`;
    this._canvas.dataset.coordinateSpace = frame.imageLocked ? "background-image" : "viewport";

    const extents = this._sceneContentExtents(frame.width / Math.max(frame.height, 1));
    this._canvas.style.setProperty("--lotus-scene-extent-left", `${extents.minLeft}%`);
    this._canvas.style.setProperty("--lotus-scene-extent-top", `${extents.minTop}%`);
    this._canvas.style.setProperty("--lotus-scene-extent-width", `${extents.maxRight - extents.minLeft}%`);
    this._canvas.style.setProperty("--lotus-scene-extent-height", `${extents.maxBottom - extents.minTop}%`);
    const trailingX = editing ? Number(frame.editorPadding || 0) : Number(frame.safeInsets?.right || 0);
    const trailingY = editing ? Number(frame.editorPadding || 0) : Number(frame.safeInsets?.bottom || 0);
    this._canvas.style.setProperty("--lotus-scene-tail-x", `${Math.max(0, trailingX)}px`);
    this._canvas.style.setProperty("--lotus-scene-tail-y", `${Math.max(0, trailingY)}px`);

    if (editing && this._scrollspace) {
      const leftDelta = previousFrame ? frame.left - Number(previousFrame.left || 0) : 0;
      const topDelta = previousFrame ? frame.top - Number(previousFrame.top || 0) : 0;
      requestAnimationFrame(() => {
        if (!this.isConnected || !this._scrollspace) return;
        if (options.resetEditorScroll) {
          this._scrollspace.scrollLeft = 0;
          this._scrollspace.scrollTop = 0;
        } else if (options.preserveEditorAnchor || this._interaction) {
          this._scrollspace.scrollLeft = Math.max(0, previousScrollLeft + leftDelta);
          this._scrollspace.scrollTop = Math.max(0, previousScrollTop + topDelta);
        }
      });
    }

    this._syncViewBackground(false);

    requestAnimationFrame(() => {
      if (!this.isConnected || !this._canvas) return;
      for (let index = 0; index < this._cards.length; index += 1) {
        this._applyLayoutToWrapper(index);
      }
      this._updateToolbar();
    });
  }

  _syncViewFillColor() {
    this.style.setProperty("--lotus-view-fill", lotusViewFillCss(this._effectiveFillColorValue()));
  }

  _syncViewBackground(probe = true) {
    this._syncViewFillColor();
    if (!this._viewBackground) return;
    const gridMode = this._activeTabLayoutMode() === "grid";
    const descriptor = this._backgroundDescriptor();
    this._canvas.dataset.hasBackgroundImage = String(Boolean(!gridMode && descriptor.source));
    this._viewBackground.style.setProperty("display", gridMode ? "none" : "block", "important");
    try { this._viewBackground.hass = this._hass; } catch (_error) { /* defensive */ }
    try { this._viewBackground.background = gridMode ? undefined : this._effectiveBackground(); } catch (_error) { /* defensive */ }
    // A fixed Home Assistant background is deliberately confined to the Lotus
    // scene. The scene itself is fitted using the background image ratio, so
    // the image and percentage-positioned cards share the same coordinate box.
    this._viewBackground.style.setProperty("position", "absolute", "important");
    this._viewBackground.style.setProperty("inset", "0", "important");
    this._viewBackground.style.setProperty("width", "100%", "important");
    this._viewBackground.style.setProperty("height", "100%", "important");
    if (probe) this._scheduleBackgroundRatioProbe();
  }

  _cardConfig(index) { return this._currentViewConfig()?.cards?.[index] || this._config?.cards?.[index] || {}; }

  _designRatioFromConfig(config) {
    if (!config || typeof config !== "object") return null;

    // A native Home Assistant conditional card is only a wrapper. Keep the
    // Lotus design ratio attached to the nested card so wrapping a Stack does
    // not alter its responsive geometry in the view.
    if (isNativeConditionalConfig(config)) {
      return this._designRatioFromConfig(config.card);
    }

    const metaSize = config?.lotus_visual_stack?.size;
    if (Array.isArray(metaSize) && metaSize.length >= 2) {
      const width = Number(metaSize[0]);
      const height = Number(metaSize[1]);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return width / height;
      }
    }

    const frameWidth = Number(config?.frame_width);
    const frameHeight = Number(config?.frame_height);
    if (
      (config?.type === "custom:lotus-visual-stack" || config?.type === "custom:visual-stack-card")
      && Number.isFinite(frameWidth) && frameWidth > 0
      && Number.isFinite(frameHeight) && frameHeight > 0
    ) {
      return frameWidth / frameHeight;
    }

    if (config?.type === "custom:lotus-slide-card") {
      const defaultWidth = config?.orientation === "vertical" ? 18 : 100;
      const defaultHeight = config?.orientation === "vertical" ? 100 : 18;
      const width = Number(config?.design?.width ?? defaultWidth);
      const height = Number(config?.design?.height ?? defaultHeight);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return width / height;
      }
    }

    if (config?.type === "custom:lotus-digicode-card") {
      const width = Number(config?.design?.width ?? 62);
      const height = Number(config?.design?.height ?? 88);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        return width / height;
      }
    }

    const aspect = String(config?.aspect_ratio ?? "").trim();
    const match = aspect.match(/^\s*([0-9.]+)\s*[:/]\s*([0-9.]+)\s*$/);
    if (config?.lotus_visual_stack && match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) return width / height;
    }

    return null;
  }

  _stackRatio(index) {
    return this._designRatioFromConfig(this._cardConfig(index));
  }

  _ratioSizeFromWidth(widthPct, ratio, canvasWidth, canvasHeight) {
    const maxWidthByHeight = (100 * canvasHeight * ratio) / Math.max(canvasWidth, 1);
    const width = clamp(Number(widthPct) || 1, 1, Math.max(1, Math.min(100, maxWidthByHeight)));
    const height = (width * canvasWidth) / (ratio * Math.max(canvasHeight, 1));
    return {
      width: roundPct(width),
      height: roundPct(clamp(height, 1, 100)),
    };
  }

  _ratioSizeFromHeight(heightPct, ratio, canvasWidth, canvasHeight) {
    const maxHeightByWidth = (100 * canvasWidth) / (ratio * Math.max(canvasHeight, 1));
    const height = clamp(Number(heightPct) || 1, 1, Math.max(1, Math.min(100, maxHeightByWidth)));
    const width = (height * canvasHeight * ratio) / Math.max(canvasWidth, 1);
    return {
      width: roundPct(clamp(width, 1, 100)),
      height: roundPct(height),
    };
  }

  _effectiveLayout(index, layout, canvasWidth = null, canvasHeight = null) {
    const ratio = this._stackRatio(index);
    if (!ratio) return { ...layout };

    const rect = this._canvas?.getBoundingClientRect();
    const widthPx = Math.max(1, Number(canvasWidth) || rect?.width || 1);
    const heightPx = Math.max(1, Number(canvasHeight) || rect?.height || 1);
    const size = this._ratioSizeFromWidth(layout.width, ratio, widthPx, heightPx);

    return {
      ...layout,
      x: roundPct(clamp(layout.x, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      y: roundPct(clamp(layout.y, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      width: size.width,
      height: size.height,
    };
  }

  _normalizeRatioLayoutForConfig(config, layout) {
    const ratio = this._designRatioFromConfig(config);
    if (!ratio || !this._canvas) return { ...layout };

    const rect = this._canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { ...layout };

    const size = this._ratioSizeFromWidth(layout.width, ratio, rect.width, rect.height);
    return {
      ...layout,
      x: roundPct(clamp(layout.x, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      y: roundPct(clamp(layout.y, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      width: size.width,
      height: size.height,
    };
  }

  _readStoredLayout(index) {
    const viewLayout = this._cardConfig(index)?.view_layout || {};
    const legacyStored = LOTUS_LEGACY_LAYOUT_KEYS
      .map((key) => viewLayout[key])
      .find((value) => value && typeof value === "object") || {};
    const currentStored = viewLayout[LOTUS_LAYOUT_KEY];
    const stored = {
      ...legacyStored,
      ...(currentStored && typeof currentStored === "object" ? currentStored : {}),
    };
    if (!Object.keys(stored).length) return this._defaultLayoutForIndex(index);
    const width = clamp(Number(stored.width ?? DEFAULT_LAYOUT.width), 1, 100);
    const height = clamp(Number(stored.height ?? DEFAULT_LAYOUT.height), 1, 100);
    const tab = typeof stored.tab === "string" && stored.tab
      ? stored.tab
      : (this._tabsEnabled() ? this._defaultTabId() : null);
    const layer = typeof stored.layer === "string" && stored.layer ? stored.layer : LOTUS_DEFAULT_LAYER_ID;
    return {
      x: roundPct(clamp(Number(stored.x ?? DEFAULT_LAYOUT.x), LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      y: roundPct(clamp(Number(stored.y ?? DEFAULT_LAYOUT.y), LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      width: roundPct(width), height: roundPct(height), locked: Boolean(stored.locked),
      z: Math.max(0, Math.round(Number(stored.z ?? index + 1) || 0)),
      layer,
      ...(tab ? { tab } : {}),
    };
  }

  _defaultLayoutForIndex(index) {
    const narrow = this.clientWidth > 0 && this.clientWidth < 700;
    const width = narrow ? 94 : 30;
    const height = narrow ? 16 : 18;
    const columns = narrow ? 1 : 3;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const gap = narrow ? 3 : 2;
    const x = narrow ? 3 : 2 + column * (width + gap);
    const y = 2 + row * (height + gap);
    const tab = this._tabsEnabled() ? this._defaultTabId() : null;
    const layerScope = this._layerScopeKeyForTab(tab);
    return { x:roundPct(clamp(x,0,100-width)), y:roundPct(clamp(y,0,100-height)), width, height, locked:false, z:index+1, layer:this._ensureActiveLayer(layerScope), ...(tab ? { tab } : {}) };
  }

  _captureBaselineLayouts(force = false) {
    if (!force && this._baselineLayouts.size === this._cards.length) return;
    if (this._dirty && force) return;
    this._baselineLayouts.clear();
    this._workingLayouts.clear();
    for (let i=0; i<this._cards.length; i+=1) {
      const layout = this._readStoredLayout(i);
      this._baselineLayouts.set(i, { ...layout });
      this._workingLayouts.set(i, { ...layout });
    }
    this._dirty = false;
  }

  _ensureWorkingLayouts() {
    for (let i=0; i<this._cards.length; i+=1) {
      if (!this._workingLayouts.has(i)) this._workingLayouts.set(i, { ...this._readStoredLayout(i) });
      if (!this._baselineLayouts.has(i)) this._baselineLayouts.set(i, { ...this._readStoredLayout(i) });
    }
  }

  _runtimeVisibilityTarget(card) {
    // Home Assistant passes hui-card wrappers to custom views. For a native
    // conditional card the real visibility owner can therefore be the nested
    // hui-conditional-card rather than the outer hui-card. The inner element
    // is intentionally resolved through HA's runtime _element chain instead of
    // reimplementing Home Assistant conditions in Lotus.
    let current = card;
    const seen = new Set();
    for (let depth = 0; current && depth < 6; depth += 1) {
      if (seen.has(current)) break;
      seen.add(current);
      if (current.localName === "hui-conditional-card") return current;
      const nested = current._element;
      if (!nested || nested === current) break;
      current = nested;
    }
    return current || card;
  }

  _runtimeVisibilityForCard(card, explicitVisible = null) {
    if (this._isEditMode()) return true;
    if (typeof explicitVisible === "boolean") return explicitVisible;
    const target = this._runtimeVisibilityTarget(card);
    // For ordinary cards Home Assistant puts the native Visibility result on
    // the outer hui-card wrapper. Conditional cards can additionally expose a
    // hidden inner runtime element. Either one being hidden means the Lotus
    // wrapper must be hidden. Do not let an inner HTMLElement's default
    // hidden=false mask a true hidden state on the outer hui-card.
    return !Boolean(card?.hidden || target?.hidden);
  }

  _setWrapperRuntimeVisibility(index, wrapper, card, explicitVisible = null) {
    if (!wrapper) return;
    const visible = this._runtimeVisibilityForCard(card, explicitVisible);
    wrapper.dataset.runtimeVisible = String(visible);

    // Home Assistant owns the condition engine (hui-card visibility). Lotus only
    // mirrors the resulting state onto its absolutely positioned wrapper.
    // Merely disabling pointer events is not enough: a card whose HA Visibility
    // tab evaluates to false must also disappear visually from the final view.
    // Keep hidden cards visible while editing because _runtimeVisibilityForCard()
    // deliberately returns true in edit mode.
    wrapper.hidden = !visible;
    wrapper.style.setProperty("display", visible ? "" : "none", visible ? "" : "important");
    if (visible) {
      wrapper.style.removeProperty("display");
      wrapper.removeAttribute("aria-hidden");
    } else {
      wrapper.setAttribute("aria-hidden", "true");
    }
    this._syncModalBlocker();
  }

  _unbindCardRuntimeVisibility(wrapper) {
    const binding = wrapper?.__lotusRuntimeVisibilityBinding;
    if (!binding) return;
    for (const target of binding.targets || [binding.card]) {
      try { target?.removeEventListener?.("card-visibility-changed", binding.listener); } catch (_error) { /* defensive */ }
    }
    try { binding.observer?.disconnect?.(); } catch (_error) { /* defensive */ }
    delete wrapper.__lotusRuntimeVisibilityBinding;
  }

  _bindCardRuntimeVisibility(index, wrapper, card, onVisibility = null) {
    if (!wrapper || !card) return;
    const applyVisibility = (binding, explicit = null) => {
      const visible = this._runtimeVisibilityForCard(card, explicit);
      if (typeof binding.onVisibility === "function") binding.onVisibility(visible);
      this._setWrapperRuntimeVisibility(index, wrapper, card, visible);
      return visible;
    };

    const current = wrapper.__lotusRuntimeVisibilityBinding;
    if (current?.card !== card) {
      this._unbindCardRuntimeVisibility(wrapper);
    } else {
      current.onVisibility = onVisibility;
      // The callback can change when Lotus recreates/reuses the dedicated Stack
      // renderer. Reapply the current HA visibility immediately; otherwise a
      // Stack can remain visible when its condition was already false before
      // this render pass.
      applyVisibility(current);
      return;
    }

    const target = this._runtimeVisibilityTarget(card);
    const targets = [...new Set([card, target].filter(Boolean))];
    const binding = { card, targets, observer:null, listener:null, onVisibility };
    binding.listener = (event) => {
      const explicit = typeof event?.detail?.value === "boolean" ? event.detail.value : null;
      applyVisibility(binding, explicit);
    };
    for (const visibilityTarget of targets) {
      visibilityTarget.addEventListener("card-visibility-changed", binding.listener);
    }
    if (typeof MutationObserver === "function") {
      binding.observer = new MutationObserver(() => applyVisibility(binding));
      for (const visibilityTarget of targets) {
        binding.observer.observe(visibilityTarget, { attributes:true, attributeFilter:["hidden"] });
      }
    }
    wrapper.__lotusRuntimeVisibilityBinding = binding;

    const sync = () => {
      if (!wrapper.isConnected || wrapper.__lotusRuntimeVisibilityBinding !== binding) return;
      applyVisibility(binding);
    };
    // HA may finish the hui-card -> hui-conditional-card visibility propagation
    // after Lotus has moved the native card into the off-screen probe. Sync both
    // at microtask and frame boundaries so the initial false condition cannot be
    // missed even when no later state change occurs.
    queueMicrotask(sync);
    requestAnimationFrame(sync);
    card.updateComplete?.then?.(sync);
    target?.updateComplete?.then?.(sync);
  }

  _syncModalBlocker() {
    if (!this._modalBlocker || !this._canvas) return;
    const editMode = this._isEditMode();
    const candidates = editMode ? [] : [...this._canvas.querySelectorAll('.lotus-card[data-modal-blocker="true"][data-runtime-visible="true"]')];
    let active = null;
    let activeZ = -Infinity;
    for (const wrapper of candidates) {
      const index = Number(wrapper.dataset.index);
      const layout = this._workingLayouts.get(index) || this._readStoredLayout(index);
      const z = Number(layout?.z ?? index + 1) || 0;
      if (!active || z >= activeZ) {
        active = wrapper;
        activeZ = z;
      }
    }

    for (const wrapper of this._canvas.querySelectorAll('.lotus-card[data-modal-active="true"]')) {
      if (wrapper !== active) wrapper.dataset.modalActive = "false";
    }

    if (!active) {
      this._modalActiveIndex = null;
      this._modalBlocker.dataset.active = "false";
      if (this._tabsBar) this._tabsBar.style.removeProperty("pointer-events");
      return;
    }

    active.dataset.modalActive = "true";
    this._modalActiveIndex = Number(active.dataset.index);
    this._modalBlocker.dataset.active = "true";
    // Tabs sit above the isolated canvas. Disable them while a modal Lotus card
    // is active so no control outside that card can be triggered.
    if (this._tabsBar) this._tabsBar.style.pointerEvents = "none";
  }

  _renderCards() {
    if (!this._canvas) return;
    this.dataset.editMode = String(this._isEditMode());
    this._syncEditorGuideState();
    this._ensureActiveTab();
    const layoutMode = this._activeTabLayoutMode();
    this._canvas.dataset.layoutMode = layoutMode;
    this._scrollspace.dataset.layoutMode = layoutMode;
    if (layoutMode === "grid") this._syncGridLayout();
    this._syncTabsLayout();
    this._syncViewBackground();
    this._ensureWorkingLayouts();
    const visibleCount = this._cards.reduce((count,_card,index) => count + (this._isCardVisibleInActiveTab(index) ? 1 : 0), 0);
    this._canvas.dataset.empty = String(visibleCount === 0);
    const existing = new Map([...this._canvas.querySelectorAll(".lotus-card")].map((el) => [Number(el.dataset.index), el]));

    for (let index=0; index<this._cards.length; index+=1) {
      const card = this._cards[index];
      if (!this._isCardVisibleInActiveTab(index)) continue;
      let wrapper = existing.get(index);
      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "lotus-card";
        wrapper.dataset.index = String(index);
        wrapper.dataset.runtimeVisible = "true";
        wrapper.dataset.modalActive = "false";
        const content = document.createElement("div");
        content.className = "card-content";
        const overlay = document.createElement("div");
        overlay.className = "edit-overlay";
        overlay.setAttribute("role", "button");
        overlay.setAttribute("aria-label", lotusT("Sélectionner et déplacer cet élément"));
        overlay.addEventListener("pointerdown", (event) => this._beginMove(event,index));
        overlay.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const additive = this._multiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey;
          this._selectCard(index, { toggle:additive });
        });
        const resize = document.createElement("div");
        resize.className = "resize-handle";
        resize.setAttribute("role", "button");
        resize.setAttribute("aria-label", lotusT("Redimensionner cet élément"));
        resize.title = lotusT("Redimensionner");
        resize.addEventListener("pointerdown", (event) => this._beginResize(event,index,"se"));

        const edgeHandles = ["left", "right", "top", "bottom"].map((edge) => {
          const handle = document.createElement("div");
          handle.className = `resize-edge resize-edge-${edge}`;
          handle.dataset.edge = edge;
          handle.setAttribute("role", "button");
          handle.setAttribute("tabindex", "0");
          handle.title = lotusT(edge === "left"
            ? "Redimensionner par la gauche"
            : edge === "right"
              ? "Redimensionner par la droite"
              : edge === "top"
                ? "Redimensionner par le haut"
                : "Redimensionner par le bas");
          handle.setAttribute("aria-label", handle.title);
          handle.addEventListener("pointerdown", (event) => this._beginResize(event,index,edge));
          return handle;
        });

        const locked = document.createElement("div");
        locked.className = "locked-badge";
        locked.title = lotusT("Élément verrouillé");
        locked.innerHTML = `<ha-icon icon="mdi:lock"></ha-icon>`;
        wrapper.append(content, overlay, resize, ...edgeHandles, locked);
        this._canvas.appendChild(wrapper);
      }
      const content = wrapper.querySelector(".card-content");
      const cardConfig = this._cardConfig(index);
      wrapper.dataset.editorHidden = String(this._isEditMode() && this._hiddenLayerIds(this._layerScopeKeyForCard(index)).has(this._layerIdForCard(index)));
      wrapper.dataset.modalBlocker = String(modalBlockerEnabled(cardConfig));

      // The saved representation remains native picture-elements for YAML and
      // interoperability. Inside a Lotus View Studio view, however, render a Lotus
      // Stack with its own region renderer so the live card uses exactly the
      // same geometry as the editor preview. Native picture-elements positions
      // independent elements and cannot guarantee that images/text stay inside
      // arbitrary responsive cells.
      const nestedConditionalStack = conditionalLotusStackConfig(cardConfig);
      if (isLotusStackConfig(cardConfig)) {
        let runtime = content.querySelector('lotus-visual-stack[data-lotus-runtime="true"]');
        if (!runtime) {
          runtime = document.createElement("lotus-visual-stack");
          runtime.dataset.lotusRuntime = "true";
        }
        runtime.setConfig(cardConfig);
        runtime.hass = this._hass;
        runtime.preview = this._isEditMode();

        // A saved Lotus Stack is a native picture-elements card carrying
        // lotus_visual_stack metadata.  We replace its visual renderer with the
        // dedicated responsive Stack renderer, but Home Assistant's native
        // `visibility:` conditions still belong to the outer hui-card wrapper.
        // Keep that hui-card connected as an invisible probe whenever native
        // visibility is configured; otherwise the dedicated renderer would
        // bypass HA's condition engine and remain visible unconditionally.
        const hasNativeVisibility = Array.isArray(cardConfig?.visibility)
          && cardConfig.visibility.length > 0;
        if (hasNativeVisibility && card) {
          let probe = content.querySelector('.condition-probe');
          if (!probe) {
            probe = document.createElement("div");
            probe.className = "condition-probe";
          }
          if (runtime.parentElement !== content || probe.parentElement !== content) {
            content.replaceChildren(runtime, probe);
          }
          if (card.parentElement !== probe) probe.replaceChildren(card);
          try { card.hass = this._hass; } catch (_error) { /* defensive */ }
          try { card.preview = this._isEditMode(); } catch (_error) { /* defensive */ }
          this._bindCardRuntimeVisibility(index, wrapper, card, (visible) => {
            runtime.hidden = !visible;
            runtime.style.setProperty("display", visible ? "block" : "none", "important");
            runtime.setAttribute("aria-hidden", String(!visible));
          });
        } else {
          if (runtime.parentElement !== content || content.children.length !== 1) {
            content.replaceChildren(runtime);
          }
          runtime.hidden = false;
          runtime.style.removeProperty("display");
          runtime.removeAttribute("aria-hidden");
          this._unbindCardRuntimeVisibility(wrapper);
          this._setWrapperRuntimeVisibility(index, wrapper, null, true);
        }
      } else if (nestedConditionalStack && card) {
        // Home Assistant remains the condition engine. Its native conditional
        // card is kept connected as an invisible probe; Lotus only mirrors the
        // resulting visibility onto the same Stack renderer used elsewhere.
        let runtime = content.querySelector('lotus-visual-stack[data-lotus-runtime="true"]');
        let probe = content.querySelector('.condition-probe');
        if (!runtime) {
          runtime = document.createElement("lotus-visual-stack");
          runtime.dataset.lotusRuntime = "true";
        }
        if (!probe) {
          probe = document.createElement("div");
          probe.className = "condition-probe";
        }
        if (runtime.parentElement !== content || probe.parentElement !== content) {
          content.replaceChildren(runtime, probe);
        }
        runtime.setConfig(nestedConditionalStack);
        runtime.hass = this._hass;
        runtime.preview = this._isEditMode();

        if (card.parentElement !== probe) probe.replaceChildren(card);
        this._bindCardRuntimeVisibility(index, wrapper, card, (visible) => {
          // Do not rely on the browser's default [hidden] stylesheet here:
          // .card-content > * explicitly defines display:block for normal cards.
          // Force the dedicated Stack renderer to follow HA's conditional state.
          runtime.hidden = !visible;
          runtime.style.setProperty("display", visible ? "block" : "none", "important");
          runtime.setAttribute("aria-hidden", String(!visible));
        });
      } else if (card) {
        if (card.parentElement !== content) content.replaceChildren(card);
        this._bindCardRuntimeVisibility(index, wrapper, card);
      } else {
        this._unbindCardRuntimeVisibility(wrapper);
        this._setWrapperRuntimeVisibility(index, wrapper, card, true);
      }

      existing.delete(index);
      this._applyLayoutToWrapper(index, wrapper);
    }
    for (const stale of existing.values()) {
      this._unbindCardRuntimeVisibility(stale);
      stale.remove();
    }
    this._syncModalBlocker();
    this._sanitizeSelection();
    this._syncSelectionState();
    this._updateToolbar();
    requestAnimationFrame(() => this._syncCanvasHeight());
  }

  _applyLayoutToWrapper(index, wrapper = null) {
    const target = wrapper || this._canvas?.querySelector(`.lotus-card[data-index="${index}"]`);
    if (!target) return;

    const storedLayout = this._workingLayouts.get(index) || this._readStoredLayout(index);
    const ratio = this._stackRatio(index);

    if (this._activeTabLayoutMode() === "grid") {
      target.style.removeProperty("left");
      target.style.removeProperty("top");
      target.style.removeProperty("width");
      target.style.removeProperty("height");
      target.style.removeProperty("z-index");
      target.dataset.locked = "false";
      this._applySelectionDataset(target, index);
      target.dataset.ratioLocked = String(Boolean(ratio));
      target.dataset.gridRatio = String(Boolean(ratio));
      if (ratio) target.style.setProperty("--lotus-grid-aspect", String(ratio));
      else target.style.removeProperty("--lotus-grid-aspect");
      return;
    }

    target.dataset.gridRatio = "false";
    target.style.removeProperty("--lotus-grid-aspect");
    const layout = ratio
      ? this._effectiveLayout(index, storedLayout)
      : storedLayout;

    target.style.left = `${layout.x}%`;
    target.style.top = `${layout.y}%`;
    target.style.width = `${layout.width}%`;
    target.style.height = `${layout.height}%`;
    target.style.zIndex = String(this._effectiveLayerZ(index, layout));
    target.dataset.locked = String(Boolean(layout.locked || this._isLayerLocked(this._layerIdForCard(index))));
    this._applySelectionDataset(target, index);
    target.dataset.ratioLocked = String(Boolean(ratio));
  }

  _applySelectionDataset(target, index) {
    const selected = this._selectedIndices.includes(index);
    const primary = selected && index === this._selectedIndex;
    target.dataset.selected = String(selected);
    target.dataset.primary = String(primary);
    target.dataset.reference = String(primary && this._selectedIndices.length > 1);
  }

  _syncSelectionState() {
    if (!this._canvas) return;
    for (const wrapper of this._canvas.querySelectorAll(".lotus-card")) {
      this._applySelectionDataset(wrapper, Number(wrapper.dataset.index));
    }
  }

  _sanitizeSelection() {
    const seen = new Set();
    this._selectedIndices = this._selectedIndices.filter((index) => {
      if (!Number.isInteger(index) || index < 0 || index >= this._cards.length || seen.has(index)) return false;
      if (!this._isCardVisibleInActiveTab(index)) return false;
      if (this._isEditMode() && this._hiddenLayerIds(this._layerScopeKeyForCard(index)).has(this._layerIdForCard(index))) return false;
      seen.add(index);
      return true;
    });
    this._selectedIndex = this._selectedIndices[0] ?? null;
  }

  _clearSelection() {
    this._selectedIndices = [];
    this._selectedIndex = null;
    this._syncSelectionState();
  }

  _selectCard(index, { toggle = false } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= this._cards.length || !this._isCardVisibleInActiveTab(index)) return;
    if (this._isEditMode() && this._hiddenLayerIds(this._layerScopeKeyForCard(index)).has(this._layerIdForCard(index))) return;
    if (toggle) {
      const position = this._selectedIndices.indexOf(index);
      if (position >= 0) this._selectedIndices.splice(position, 1);
      else this._selectedIndices.push(index);
    } else {
      this._selectedIndices = [index];
    }
    this._selectedIndex = this._selectedIndices[0] ?? null;
    this._syncSelectionState();
    this._statusMessage = "";
    this._statusKind = "";
    this._updateToolbar();
    this._renderTabs();
  }

  _toggleMultiSelectMode() {
    if (!this._isEditMode() || this._saveInProgress) return;
    this._multiSelectMode = !this._multiSelectMode;
    this._statusMessage = this._multiSelectMode
      ? "Sélection multiple active : cliquez sur les cartes à ajouter ou retirer."
      : "Sélection multiple désactivée.";
    this._statusKind = "";
    this._updateToolbar();
  }

  _beginMove(event,index) {
    if (!this._isEditMode() || this._saveInProgress || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    if (this._multiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey) return;
    this._selectCard(index);
    if (this._activeTabLayoutMode() === "grid") return;
    const layout = { ...this._workingLayouts.get(index) };
    if (layout.locked || this._isLayerLocked(this._layerIdForCard(index))) return;
    const rect = this._canvas.getBoundingClientRect();
    const canvasWidth = Math.max(rect.width,1);
    const canvasHeight = Math.max(rect.height,1);
    const effectiveLayout = this._effectiveLayout(index, layout, canvasWidth, canvasHeight);
    this._interaction = {
      mode:"move",
      index,
      pointerId:event.pointerId,
      startClientX:event.clientX,
      startClientY:event.clientY,
      startScrollLeft:this._scrollspace?.scrollLeft || 0,
      startScrollTop:this._scrollspace?.scrollTop || 0,
      startLayout:layout,
      startEffectiveLayout:effectiveLayout,
      canvasWidth,
      canvasHeight,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this._bindInteraction();
  }

  _beginResize(event,index,handle = "se") {
    if (!this._isEditMode() || this._saveInProgress || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.stopPropagation();
    this._selectCard(index);
    if (this._activeTabLayoutMode() === "grid") return;

    const layout = { ...this._workingLayouts.get(index) };
    if (layout.locked || this._isLayerLocked(this._layerIdForCard(index))) return;

    const rect = this._canvas.getBoundingClientRect();
    const canvasWidth = Math.max(rect.width,1);
    const canvasHeight = Math.max(rect.height,1);
    const effectiveLayout = this._effectiveLayout(index, layout, canvasWidth, canvasHeight);

    this._interaction = {
      mode:"resize",
      handle,
      index,
      pointerId:event.pointerId,
      startClientX:event.clientX,
      startClientY:event.clientY,
      startLayout:layout,
      startEffectiveLayout:effectiveLayout,
      canvasWidth,
      canvasHeight,
      ratio:this._stackRatio(index),
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    this._bindInteraction();
  }

  _bindInteraction() {
    window.addEventListener("pointermove", this._pointerMoveHandler, { passive:false });
    window.addEventListener("pointerup", this._pointerUpHandler, { passive:false });
    window.addEventListener("pointercancel", this._pointerUpHandler, { passive:false });
  }

  _resizeFreeform(startLayout, handle, dx, dy) {
    const next = { ...startLayout };
    const minSize = 1;
    const right = startLayout.x + startLayout.width;
    const bottom = startLayout.y + startLayout.height;

    if (handle === "right" || handle === "se") {
      next.width = roundPct(clamp(startLayout.width + dx, minSize, 100));
    }
    if (handle === "bottom" || handle === "se") {
      next.height = roundPct(clamp(startLayout.height + dy, minSize, 100));
    }
    if (handle === "left") {
      const x = clamp(startLayout.x + dx, LOTUS_LAYOUT_POSITION_MIN, right - minSize);
      next.x = roundPct(x);
      next.width = roundPct(right - x);
    }
    if (handle === "top") {
      const y = clamp(startLayout.y + dy, LOTUS_LAYOUT_POSITION_MIN, bottom - minSize);
      next.y = roundPct(y);
      next.height = roundPct(bottom - y);
    }

    return next;
  }

  _resizeRatioLocked(interaction, dx, dy) {
    const {
      handle,
      startEffectiveLayout:start,
      canvasWidth,
      canvasHeight,
      ratio,
    } = interaction;

    if (!ratio) return this._resizeFreeform(interaction.startLayout, handle, dx, dy);

    const next = { ...start };
    const minWidth = 1;
    const minHeight = 1;
    const right = start.x + start.width;
    const bottom = start.y + start.height;

    const fromWidth = (width) =>
      this._ratioSizeFromWidth(width, ratio, canvasWidth, canvasHeight);
    const fromHeight = (height) =>
      this._ratioSizeFromHeight(height, ratio, canvasWidth, canvasHeight);

    if (handle === "right") {
      const maxWidth = Math.min(100, (100 * canvasHeight * ratio) / canvasWidth);
      const size = fromWidth(clamp(start.width + dx, minWidth, Math.max(minWidth, maxWidth)));
      next.x = start.x;
      next.width = size.width;
      next.height = size.height;
      next.y = roundPct(clamp(start.y + (start.height - size.height) / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      return next;
    }

    if (handle === "left") {
      const maxWidth = Math.min(100, (100 * canvasHeight * ratio) / canvasWidth);
      const requestedWidth = clamp(start.width - dx, minWidth, Math.max(minWidth, maxWidth));
      const size = fromWidth(requestedWidth);
      next.width = size.width;
      next.height = size.height;
      next.x = roundPct(clamp(right - size.width, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      next.y = roundPct(clamp(start.y + (start.height - size.height) / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      return next;
    }

    if (handle === "bottom") {
      const maxHeightByWidth = (100 * canvasWidth) / (ratio * canvasHeight);
      const maxHeight = Math.min(100, maxHeightByWidth);
      const size = fromHeight(clamp(start.height + dy, minHeight, Math.max(minHeight, maxHeight)));
      next.width = size.width;
      next.height = size.height;
      next.y = start.y;
      next.x = roundPct(clamp(start.x + (start.width - size.width) / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      return next;
    }

    if (handle === "top") {
      const maxHeightByWidth = (100 * canvasWidth) / (ratio * canvasHeight);
      const maxHeight = Math.min(100, maxHeightByWidth);
      const size = fromHeight(clamp(start.height - dy, minHeight, Math.max(minHeight, maxHeight)));
      next.width = size.width;
      next.height = size.height;
      next.y = roundPct(clamp(bottom - size.height, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      next.x = roundPct(clamp(start.x + (start.width - size.width) / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      return next;
    }

    const scaleX = (start.width + dx) / Math.max(start.width, 0.0001);
    const scaleY = (start.height + dy) / Math.max(start.height, 0.0001);
    let scale = Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY;

    const maxScaleX = 100 / Math.max(start.width, 0.0001);
    const maxScaleY = 100 / Math.max(start.height, 0.0001);
    const minScale = Math.max(
      minWidth / Math.max(start.width, 0.0001),
      minHeight / Math.max(start.height, 0.0001),
    );
    scale = clamp(scale, minScale, Math.min(maxScaleX, maxScaleY));

    const size = fromWidth(start.width * scale);
    next.x = start.x;
    next.y = start.y;
    next.width = size.width;
    next.height = size.height;
    return next;
  }

  _editingPlacementBounds() {
    // The background image remains the 0–100 % reference, but cards are allowed
    // to extend beyond it in every direction. The scrollable editor workspace is
    // then expanded from the union of the image bounds and the farthest cards.
    return {
      minX:LOTUS_LAYOUT_POSITION_MIN,
      minY:LOTUS_LAYOUT_POSITION_MIN,
      maxX:LOTUS_LAYOUT_POSITION_MAX,
      maxY:LOTUS_LAYOUT_POSITION_MAX,
    };
  }

  _autoScrollEditorDuringInteraction(event) {
    if (!this._scrollspace || !this._isEditMode() || this._activeTabLayoutMode() === "grid") return;
    const rect = this._scrollspace.getBoundingClientRect();
    const edge = Math.min(56, Math.max(28, Math.min(rect.width, rect.height) * 0.08));
    const maxStep = 28;
    const speed = (distance) => Math.ceil(maxStep * clamp(distance / Math.max(edge, 1), 0, 1));
    let dx = 0;
    let dy = 0;
    if (event.clientX < rect.left + edge) dx = -speed(rect.left + edge - event.clientX);
    else if (event.clientX > rect.right - edge) dx = speed(event.clientX - (rect.right - edge));
    if (event.clientY < rect.top + edge) dy = -speed(rect.top + edge - event.clientY);
    else if (event.clientY > rect.bottom - edge) dy = speed(event.clientY - (rect.bottom - edge));
    if (dx) this._scrollspace.scrollLeft = Math.max(0, this._scrollspace.scrollLeft + dx);
    if (dy) this._scrollspace.scrollTop = Math.max(0, this._scrollspace.scrollTop + dy);
  }

  _pointerMoveHandler = (event) => {
    if (!this._interaction || event.pointerId !== this._interaction.pointerId) return;
    event.preventDefault();

    const interaction = this._interaction;
    const {
      mode,
      index,
      startClientX,
      startClientY,
      startScrollLeft = 0,
      startScrollTop = 0,
      startLayout,
      startEffectiveLayout,
      canvasWidth,
      canvasHeight,
    } = interaction;

    const scrollDx = mode === "move" ? (this._scrollspace?.scrollLeft || 0) - startScrollLeft : 0;
    const scrollDy = mode === "move" ? (this._scrollspace?.scrollTop || 0) - startScrollTop : 0;
    const dx = ((event.clientX-startClientX + scrollDx)/canvasWidth)*100;
    const dy = ((event.clientY-startClientY + scrollDy)/canvasHeight)*100;
    let next = { ...startLayout };

    if (mode === "move") {
      const effective = startEffectiveLayout || startLayout;
      const bounds = this._editingPlacementBounds();
      next.x = roundPct(clamp(startLayout.x + dx, bounds.minX, Math.max(bounds.minX, bounds.maxX - effective.width)));
      next.y = roundPct(clamp(startLayout.y + dy, bounds.minY, Math.max(bounds.minY, bounds.maxY - effective.height)));
    } else if (interaction.ratio) {
      next = this._resizeRatioLocked(interaction, dx, dy);
    } else {
      next = this._resizeFreeform(startLayout, interaction.handle || "se", dx, dy);
    }

    this._workingLayouts.set(index,next);
    this._markDirty();
    this._applyLayoutToWrapper(index);
    // Expand the scrollable workspace immediately when a card crosses the image
    // boundary. Scroll anchoring keeps the dragged card under the pointer even
    // when the logical origin must move to expose negative coordinates.
    this._syncSceneFrame({ preserveEditorAnchor:true });
    if (mode === "move") requestAnimationFrame(() => this._autoScrollEditorDuringInteraction(event));
  };

  _pointerUpHandler = (event) => {
    if (!this._interaction || event.pointerId !== this._interaction.pointerId) return;
    event.preventDefault();
    const mode = this._interaction.mode;
    this._endInteraction();
    if (this._dirty) {
      void this._applyChanges(mode === "move" ? "Nouvelle position enregistrée" : "Nouvelle taille enregistrée");
    }
  };

  _endInteraction() {
    this._interaction = null;
    window.removeEventListener("pointermove", this._pointerMoveHandler);
    window.removeEventListener("pointerup", this._pointerUpHandler);
    window.removeEventListener("pointercancel", this._pointerUpHandler);
  }

  _markDirty() {
    this._dirty = true;
    this._statusMessage = "Enregistrement automatique après relâchement…";
    this._statusKind = "";
    this._updateToolbar();
  }

  _toggleSelectedLock() {
    if (this._selectedIndex === null || this._saveInProgress) return;
    const current = this._workingLayouts.get(this._selectedIndex);
    if (!current || this._isLayerLocked(this._layerIdForCard(this._selectedIndex))) return;
    const locked = !current.locked;
    this._workingLayouts.set(this._selectedIndex, { ...current, locked });
    this._markDirty();
    this._applyLayoutToWrapper(this._selectedIndex);
    void this._applyChanges(locked ? "Carte verrouillée" : "Carte déverrouillée");
  }

  _changeZ(delta) {
    if (this._selectedIndex === null || this._saveInProgress) return;
    const current = this._workingLayouts.get(this._selectedIndex);
    if (!current || this._isLayerLocked(this._layerIdForCard(this._selectedIndex))) return;
    this._workingLayouts.set(this._selectedIndex, { ...current, z:Math.max(0,(current.z || 0)+delta) });
    this._markDirty();
    this._applyLayoutToWrapper(this._selectedIndex);
    void this._applyChanges(delta > 0 ? "Ordre d’affichage enregistré" : "Ordre d’affichage enregistré");
  }

  _editSelectedCard() {
    if (this._selectedIndex === null) return;
    // Native card editing can cause Home Assistant to rebuild the view. Keep a
    // checkpoint of the editor layer state before handing control to HA.
    this._persistLayerEditorState();
    // Home Assistant owns the card dialog, GUI/YAML switching and save/cancel.
    // A narrow bridge in Lotus Stack supplies the Stack GUI editor when the
    // saved card is a native picture-elements card carrying Lotus metadata.
    fireEvent(this, "ll-edit-card", { path:[this._index, this._selectedIndex] });
  }

  async _makeSelectedConditional() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique de la position/taille.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (this._selectedIndex === null || this._saveInProgress) return;

    const currentCard = this._cardConfig(this._selectedIndex);
    if (isNativeConditionalConfig(currentCard)) {
      // The native conditional editor opens on its Conditions tab.
      this._editSelectedCard();
      return;
    }
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Enregistrement indisponible";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    try {
      this._saveInProgress = true;
      this._statusMessage = "Création de la condition…";
      this._statusKind = "";
      this._updateToolbar();

      const newConfig = this._buildConfigWithWorkingLayouts();
      const view = newConfig?.views?.[this._index];
      const source = view?.cards?.[this._selectedIndex];
      if (!view || !source) return;

      const nestedCard = deepClone(source);
      const outerViewLayout = nestedCard.view_layout
        ? deepClone(nestedCard.view_layout)
        : undefined;
      delete nestedCard.view_layout;

      const conditionalCard = {
        type: "conditional",
        conditions: [],
        card: nestedCard,
      };
      if (outerViewLayout) conditionalCard.view_layout = outerViewLayout;

      view.cards[this._selectedIndex] = conditionalCard;
      await this._lovelace.saveConfig(newConfig);

      this._statusMessage = "Carte conditionnelle créée";
      this._statusKind = "success";
      this._baselineLayouts.set(this._selectedIndex, { ...this._readStoredLayout(this._selectedIndex) });
      this._workingLayouts.set(this._selectedIndex, { ...this._readStoredLayout(this._selectedIndex) });

      // Give Home Assistant one render turn to rebuild the card at the same
      // Lovelace path, then open its native conditional-card editor.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fireEvent(this, "ll-edit-card", { path:[this._index, this._selectedIndex] });
      }));
    } catch (error) {
      lotusDebug("Conditional wrapper failed", error);
      this._statusMessage = `Échec : ${error?.message || error}`;
      this._statusKind = "error";
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
      this._renderTabs();
    }
  }

  async _removeSelectedConditional() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique de la position/taille.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (this._selectedIndex === null || this._saveInProgress) return;

    const currentCard = this._cardConfig(this._selectedIndex);
    if (!isNativeConditionalConfig(currentCard)) return;
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Enregistrement indisponible";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    try {
      this._saveInProgress = true;
      this._statusMessage = "Suppression du mode conditionnel…";
      this._statusKind = "";
      this._updateToolbar();

      const newConfig = this._buildConfigWithWorkingLayouts();
      const view = newConfig?.views?.[this._index];
      const source = view?.cards?.[this._selectedIndex];
      if (!view || !isNativeConditionalConfig(source)) return;

      view.cards[this._selectedIndex] = unwrapNativeConditionalConfig(source);
      await this._lovelace.saveConfig(newConfig);

      this._statusMessage = "Mode conditionnel retiré";
      this._statusKind = "success";
      this._baselineLayouts.set(this._selectedIndex, { ...this._readStoredLayout(this._selectedIndex) });
      this._workingLayouts.set(this._selectedIndex, { ...this._readStoredLayout(this._selectedIndex) });
    } catch (error) {
      lotusDebug("Conditional unwrap failed", error);
      this._statusMessage = `Échec : ${error?.message || error}`;
      this._statusKind = "error";
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
      this._renderTabs();
    }
  }

  _centerSelectedOnBackground(axis) {
    if (this._selectedIndices.length !== 1 || this._selectedIndex == null || this._saveInProgress || this._dirty) return;
    if (this._activeTabLayoutMode() === "grid") {
      this._statusMessage = "Le centrage sur l’image n’est pas disponible dans une grille responsive.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (axis !== "horizontal" && axis !== "vertical") return;

    const current = this._workingLayouts.get(this._selectedIndex);
    if (!current) return;
    if (current.locked) {
      this._statusMessage = "La carte est verrouillée.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const effective = this._effectiveLayout(this._selectedIndex, current);
    const next = { ...current };
    if (axis === "horizontal") {
      next.x = roundPct(clamp(50 - effective.width / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
    } else {
      next.y = roundPct(clamp(50 - effective.height / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
    }

    this._workingLayouts.set(this._selectedIndex, next);
    this._applyLayoutToWrapper(this._selectedIndex);
    this._markDirty();
    this._syncSceneFrame({ preserveEditorAnchor:true });
    void this._applyChanges(axis === "horizontal"
      ? "Carte centrée horizontalement sur l’image de fond"
      : "Carte centrée verticalement sur l’image de fond");
  }

  _applyBatchLayoutAction(action) {
    if (this._selectedIndices.length < 2 || this._saveInProgress || this._dirty) return;
    if (this._activeTabLayoutMode() === "grid") {
      this._statusMessage = "Les alignements manuels ne sont pas disponibles dans une grille responsive.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const referenceIndex = this._selectedIndices[0];
    const referenceStored = this._workingLayouts.get(referenceIndex);
    if (!referenceStored) return;
    const reference = this._effectiveLayout(referenceIndex, referenceStored);
    let changed = 0;
    let locked = 0;

    for (const index of this._selectedIndices.slice(1)) {
      const current = this._workingLayouts.get(index);
      if (!current) continue;
      if (current.locked) { locked += 1; continue; }

      const effective = this._effectiveLayout(index, current);
      const next = { ...current };
      if (action === "left") {
        next.x = roundPct(clamp(reference.x, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "hcenter") {
        next.x = roundPct(clamp(reference.x + reference.width / 2 - effective.width / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "right") {
        next.x = roundPct(clamp(reference.x + reference.width - effective.width, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "top") {
        next.y = roundPct(clamp(reference.y, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "vcenter") {
        next.y = roundPct(clamp(reference.y + reference.height / 2 - effective.height / 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "bottom") {
        next.y = roundPct(clamp(reference.y + reference.height - effective.height, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else if (action === "same-size") {
        next.width = roundPct(reference.width);
        next.height = roundPct(reference.height);
        const resized = this._effectiveLayout(index, next);
        next.x = roundPct(clamp(next.x, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
        next.y = roundPct(clamp(next.y, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      } else {
        return;
      }

      this._workingLayouts.set(index, next);
      this._applyLayoutToWrapper(index);
      changed += 1;
    }

    if (!changed) {
      this._statusMessage = locked ? "Aucune carte modifiée : les cartes cibles sont verrouillées." : "Aucune modification à appliquer.";
      this._statusKind = locked ? "error" : "";
      this._updateToolbar();
      return;
    }

    const messages = {
      left:"Alignement à gauche enregistré",
      hcenter:"Centrage horizontal enregistré",
      right:"Alignement à droite enregistré",
      top:"Alignement en haut enregistré",
      vcenter:"Centrage vertical enregistré",
      bottom:"Alignement en bas enregistré",
      "same-size":"Dimensions harmonisées sur la carte de référence",
    };
    this._markDirty();
    this._syncSelectionState();
    void this._applyChanges(`${messages[action]}${locked ? ` · ${locked} carte${locked > 1 ? "s" : ""} verrouillée${locked > 1 ? "s" : ""} ignorée${locked > 1 ? "s" : ""}` : ""}`);
  }

  _applyDistributionAction(axis) {
    if (this._selectedIndices.length < 3 || this._saveInProgress || this._dirty) return;
    if (this._activeTabLayoutMode() === "grid") {
      this._statusMessage = "La répartition manuelle n’est pas disponible dans une grille responsive.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const horizontal = axis === "horizontal";
    if (!horizontal && axis !== "vertical") return;

    const positionKey = horizontal ? "x" : "y";
    const sizeKey = horizontal ? "width" : "height";
    const entries = this._selectedIndices
      .map((index) => {
        const stored = this._workingLayouts.get(index);
        if (!stored) return null;
        return {
          index,
          stored,
          effective:this._effectiveLayout(index, stored),
        };
      })
      .filter(Boolean);

    if (entries.length < 3) return;

    const byStart = [...entries].sort((a, b) => {
      const delta = Number(a.effective[positionKey]) - Number(b.effective[positionKey]);
      if (Math.abs(delta) > 0.000001) return delta;
      return a.index - b.index;
    });
    const byEnd = [...entries].sort((a, b) => {
      const edgeA = Number(a.effective[positionKey]) + Number(a.effective[sizeKey]);
      const edgeB = Number(b.effective[positionKey]) + Number(b.effective[sizeKey]);
      if (Math.abs(edgeA - edgeB) > 0.000001) return edgeB - edgeA;
      return a.index - b.index;
    });

    // Les références sont les deux cartes qui définissent les limites physiques
    // les plus éloignées sur l'axe demandé : bord gauche/droit ou haut/bas.
    let first = byStart[0];
    let last = byEnd[0];

    // Cas pathologique : une carte très grande définit les deux extrêmes.
    // On revient alors aux deux cartes dont les positions sont les plus éloignées.
    if (first.index === last.index) {
      const byPosition = [...entries].sort((a, b) => {
        const centerA = Number(a.effective[positionKey]) + Number(a.effective[sizeKey]) / 2;
        const centerB = Number(b.effective[positionKey]) + Number(b.effective[sizeKey]) / 2;
        if (Math.abs(centerA - centerB) > 0.000001) return centerA - centerB;
        return a.index - b.index;
      });
      first = byPosition[0];
      last = byPosition[byPosition.length - 1];
    }

    const middleEntries = entries
      .filter((entry) => entry.index !== first.index && entry.index !== last.index)
      .sort((a, b) => {
        const delta = Number(a.effective[positionKey]) - Number(b.effective[positionKey]);
        if (Math.abs(delta) > 0.000001) return delta;
        return a.index - b.index;
      });

    // Les deux cartes extrêmes servent de bornes et ne sont jamais déplacées.
    // Une carte verrouillée entre les deux empêcherait mathématiquement de
    // garantir des espacements identiques : l'opération est donc annulée.
    const lockedMiddle = middleEntries.filter((entry) => entry.stored.locked);
    if (lockedMiddle.length) {
      this._statusMessage = `Répartition impossible : ${lockedMiddle.length} carte${lockedMiddle.length > 1 ? "s intermédiaires sont verrouillées" : " intermédiaire est verrouillée"}.`;
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const ordered = [first, ...middleEntries, last];
    const start = Number(first.effective[positionKey]);
    const end = Number(last.effective[positionKey]) + Number(last.effective[sizeKey]);
    const totalSize = ordered.reduce((sum, entry) => sum + Number(entry.effective[sizeKey]), 0);
    const spacing = (end - start - totalSize) / (ordered.length - 1);

    if (!Number.isFinite(spacing)) return;

    let cursor = start + Number(first.effective[sizeKey]) + spacing;
    let changed = 0;

    for (const entry of middleEntries) {
      const next = { ...entry.stored };
      const nextPosition = roundPct(clamp(cursor, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX));
      if (Math.abs(Number(next[positionKey]) - nextPosition) > 0.000001) {
        next[positionKey] = nextPosition;
        this._workingLayouts.set(entry.index, next);
        this._applyLayoutToWrapper(entry.index);
        changed += 1;
      }
      cursor = nextPosition + Number(entry.effective[sizeKey]) + spacing;
    }

    if (!changed) {
      this._statusMessage = horizontal
        ? "Les cartes sont déjà réparties horizontalement à égale distance."
        : "Les cartes sont déjà réparties verticalement à égale distance.";
      this._statusKind = "success";
      this._updateToolbar();
      return;
    }

    this._markDirty();
    this._syncSelectionState();
    void this._applyChanges(
      horizontal
        ? "Répartition horizontale à égale distance enregistrée"
        : "Répartition verticale à égale distance enregistrée",
    );
  }

  async _deleteSelectedCards() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique de la position/taille.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    const selected = [...this._selectedIndices];
    if (!selected.length) return;
    // Deleting a card may replace the Lovelace view element. Persist all layer
    // editor state first so the rebuilt editor resumes exactly where it was.
    this._persistLayerEditorState();

    if (selected.length === 1) {
      fireEvent(this,"ll-delete-card",{ path:[this._index, selected[0]], silent:false });
      return;
    }
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Suppression multiple indisponible";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const confirmed = window.confirm(lotusT("Supprimer {count} cartes sélectionnées ?", { count:selected.length }));
    if (!confirmed) return;

    try {
      this._saveInProgress = true;
      this._statusMessage = lotusT("Suppression de {count} cartes…", { count:selected.length });
      this._statusKind = "";
      this._updateToolbar();

      const newConfig = this._buildConfigWithWorkingLayouts();
      const view = newConfig?.views?.[this._index];
      if (!view || !Array.isArray(view.cards)) return;
      const selectedSet = new Set(selected);
      view.cards = view.cards.filter((_card, index) => !selectedSet.has(index));
      await this._lovelace.saveConfig(newConfig);

      this._dirty = false;
      this._clearSelection();
      this._statusMessage = lotusT("{count} cartes supprimées", { count:selected.length });
      this._statusKind = "success";
    } catch (error) {
      lotusDebug("Batch delete failed", error);
      this._statusMessage = `Échec de la suppression : ${error?.message || error}`;
      this._statusKind = "error";
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
    }
  }

  _openNativeYamlEditor() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (typeof this._lovelace?.enableFullEditMode === "function") {
      this._lovelace.enableFullEditMode();
      return;
    }
    this._statusMessage = "L’éditeur YAML natif Home Assistant n’est pas disponible dans ce contexte.";
    this._statusKind = "error";
    this._updateToolbar();
  }


  _serializedLayout(layout, index) {
    const result = {
      x:roundPct(layout.x),
      y:roundPct(layout.y),
      width:roundPct(layout.width),
      height:roundPct(layout.height),
    };
    if (layout.locked) result.locked = true;
    if (typeof layout.tab === "string" && layout.tab) result.tab = layout.tab;
    if (typeof layout.layer === "string" && layout.layer && layout.layer !== LOTUS_DEFAULT_LAYER_ID) result.layer = layout.layer;
    const defaultZ = index + 1;
    const z = Math.max(0, Math.round(Number(layout.z) || 0));
    if (z !== defaultZ) result.z = z;
    return result;
  }

  _withCleanLotusLayout(cardConfig, layout, index) {
    const nextCard = { ...cardConfig };
    const nextViewLayout = { ...(cardConfig.view_layout || {}) };

    for (const legacyKey of LOTUS_LEGACY_LAYOUT_KEYS) {
      delete nextViewLayout[legacyKey];
    }

    const normalizedLayout = this._normalizeRatioLayoutForConfig(cardConfig, layout);
    nextViewLayout[LOTUS_LAYOUT_KEY] = this._serializedLayout(normalizedLayout, index);
    nextCard.view_layout = nextViewLayout;
    return nextCard;
  }

  _copySelectedCard() {
    if (this._dirty || this._saveInProgress) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (this._selectedIndex === null || this._selectedIndices.length !== 1) return;

    const workingConfig = this._buildConfigWithWorkingLayouts();
    const view = workingConfig?.views?.[this._index];
    const card = view?.cards?.[this._selectedIndex];
    if (!card) {
      this._statusMessage = "Impossible de copier la carte.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const layout = this._workingLayouts.get(this._selectedIndex) || this._readStoredLayout(this._selectedIndex);
    const sourceView = this._currentViewConfig();
    const stored = saveLotusCardClipboard({
      schema:1,
      card:deepClone(card),
      layout:deepClone(layout),
      source:{
        title:typeof sourceView?.title === "string" ? sourceView.title : "",
        path:typeof sourceView?.path === "string" ? sourceView.path : "",
      },
      copiedAt:Date.now(),
    });

    this._statusMessage = stored ? "Carte copiée" : "Impossible de copier la carte.";
    this._statusKind = stored ? "success" : "error";
    this._updateToolbar();
  }

  async _pasteCopiedCard() {
    if (this._dirty || this._saveInProgress) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") return;

    const clipboard = loadLotusCardClipboard();
    if (!clipboard) {
      this._statusMessage = "Aucune carte copiée à coller.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }

    const scopeKey = this._currentLayerScopeKey();
    const targetLayerId = this._ensureActiveLayer(scopeKey);
    if (this._isLayerLocked(targetLayerId, scopeKey)) return;

    const newConfig = this._buildConfigWithWorkingLayouts();
    const view = newConfig?.views?.[this._index];
    if (!view || !Array.isArray(view.cards)) return;

    const insertedIndex = view.cards.length;
    const targetTabId = this._tabsEnabled() ? this._ensureActiveTab() : null;
    const sourceLayout = clipboard.layout || {};
    const fallbackLayout = this._defaultLayoutForIndex(insertedIndex);
    const copyLayout = {
      ...fallbackLayout,
      ...sourceLayout,
      x:roundPct(clamp(Number(sourceLayout.x ?? fallbackLayout.x), LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      y:roundPct(clamp(Number(sourceLayout.y ?? fallbackLayout.y), LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      width:roundPct(clamp(Number(sourceLayout.width ?? fallbackLayout.width), 1, 100)),
      height:roundPct(clamp(Number(sourceLayout.height ?? fallbackLayout.height), 1, 100)),
      z:insertedIndex + 1,
      layer:targetLayerId,
      ...(targetTabId ? { tab:targetTabId } : {}),
    };
    if (!targetTabId) delete copyLayout.tab;

    const cleanCopy = this._withCleanLotusLayout(deepClone(clipboard.card), copyLayout, insertedIndex);
    view.cards.push(cleanCopy);

    // The cards setter can be called by Home Assistant while saveConfig is
    // propagating. Keep the destination context explicit so this refresh can
    // never demote the pasted card to layer-1 or to another tab.
    this._pendingNewCardLayerId = targetLayerId;
    this._pendingNewCardTabId = targetTabId;

    try {
      this._saveInProgress = true;
      this._statusMessage = "Enregistrement automatique…";
      this._statusKind = "";
      this._updateToolbar();
      await this._lovelace.saveConfig(newConfig);
      this._dirty = false;
      this._selectedIndex = insertedIndex;
      this._selectedIndices = [insertedIndex];
      this._statusMessage = "Carte collée";
      this._statusKind = "success";
    } catch (error) {
      lotusDebug("Paste card failed", error);
      this._pendingNewCardLayerId = null;
      this._pendingNewCardTabId = null;
      this._statusMessage = "Impossible de coller la carte copiée.";
      this._statusKind = "error";
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
    }
  }

  async _duplicateSelected() {
    if (this._dirty) {
      this._statusMessage = "Attendez la fin de l’enregistrement automatique.";
      this._statusKind = "error";
      this._updateToolbar();
      return;
    }
    if (
      this._selectedIndex === null
      || !this._lovelace?.config
      || typeof this._lovelace?.saveConfig !== "function"
    ) return;

    const newConfig = this._buildConfigWithWorkingLayouts();
    const view = newConfig?.views?.[this._index];
    const original = view?.cards?.[this._selectedIndex];
    if (!view || !original) return;

    const copy = deepClone(original);
    const sourceLayout = this._readStoredLayout(this._selectedIndex);
    const width = sourceLayout.width;
    const height = sourceLayout.height;
    const insertedIndex = this._selectedIndex + 1;
    const copyLayout = {
      ...sourceLayout,
      x:roundPct(clamp(sourceLayout.x + 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      y:roundPct(clamp(sourceLayout.y + 2, LOTUS_LAYOUT_POSITION_MIN, LOTUS_LAYOUT_POSITION_MAX)),
      locked:false,
      z:insertedIndex + 1,
    };

    const cleanCopy = this._withCleanLotusLayout(copy, copyLayout, insertedIndex);
    view.cards.splice(insertedIndex, 0, cleanCopy);

    await this._lovelace.saveConfig(newConfig);
    this._dirty = false;
    this._selectedIndex = insertedIndex;
    this._selectedIndices = [insertedIndex];
    this._statusMessage = "Carte dupliquée";
    this._statusKind = "success";
    this._updateToolbar();
  }

  _cancelChanges() {
    this._workingLayouts = new Map([...this._baselineLayouts.entries()].map(([key,value]) => [key,{...value}]));
    this._dirty = false;
    this._statusMessage = "Modifications annulées";
    this._statusKind = "success";
    this._renderCards();
  }

  _buildConfigWithWorkingLayouts() {
    if (!this._lovelace?.config) return null;
    const newConfig = deepClone(this._lovelace.config);
    const view = newConfig?.views?.[this._index];
    if (!view || !Array.isArray(view.cards)) return newConfig;

    const meta = view[LOTUS_VIEW_META_KEY] && typeof view[LOTUS_VIEW_META_KEY] === "object"
      ? { ...view[LOTUS_VIEW_META_KEY] }
      : {};
    const layerStorage = this._layerStorageForSave(meta[LOTUS_VIEW_LAYERS_KEY]);
    if (this._tabsEnabled()) {
      // Card geometry/layer autosaves must never flatten the per-tab layer
      // catalogue. Materialize every tab scope so a card assigned to layer-2
      // remains in layer-2 after navigation, reload or an addon upgrade.
      for (const tab of this._tabsConfig().items) {
        layerStorage.tabs[tab.id] = this._serializeLayers(
          this._layersConfig(this._currentViewConfig(), tab.id),
        );
      }
    } else {
      layerStorage.global = this._serializeLayers(
        this._layersConfig(this._currentViewConfig(), LOTUS_GLOBAL_LAYER_SCOPE),
      );
    }
    // Include optimistic layer edits that may not yet have propagated back
    // into Home Assistant's lovelace.config object.
    for (const [scopeKey, layers] of this._layerConfigOverrides.entries()) {
      if (scopeKey === LOTUS_GLOBAL_LAYER_SCOPE || !this._tabsEnabled()) layerStorage.global = this._serializeLayers(layers);
      else layerStorage.tabs[scopeKey] = this._serializeLayers(layers);
    }
    meta[LOTUS_VIEW_LAYERS_KEY] = layerStorage;
    view[LOTUS_VIEW_META_KEY] = meta;

    view.cards = view.cards.map((cardConfig,index) => {
      const layout = this._workingLayouts.get(index);
      if (!layout) return cardConfig;
      return this._withCleanLotusLayout(cardConfig, layout, index);
    });
    return newConfig;
  }

  async _applyChanges(successMessage = "Position et taille enregistrées") {
    if (!this._dirty || this._saveInProgress) return false;
    if (!this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") {
      this._statusMessage = "Enregistrement automatique indisponible";
      this._statusKind = "error";
      this._updateToolbar();
      return false;
    }
    try {
      this._saveInProgress = true;
      this._statusMessage = "Enregistrement automatique…";
      this._statusKind = "";
      this._updateToolbar();
      const newConfig = this._buildConfigWithWorkingLayouts();
      await this._lovelace.saveConfig(newConfig);
      this._baselineLayouts = new Map([...this._workingLayouts.entries()].map(([key,value]) => [key,{...value}]));
      this._dirty = false;
      this._statusMessage = successMessage;
      this._statusKind = "success";
      return true;
    } catch (error) {
      lotusDebug("Save failed", error);
      this._statusMessage = `Échec de l’enregistrement automatique : ${error?.message || error}`;
      this._statusKind = "error";
      return false;
    } finally {
      this._saveInProgress = false;
      this._updateToolbar();
    }
  }

  _selectedCardName(index = this._selectedIndex) {
    if (index === null || index === undefined) return this._currentViewConfig()?.title || "Vue Lotus";
    const outerConfig = this._cardConfig(index);
    const config = isNativeConditionalConfig(outerConfig) ? outerConfig.card : outerConfig;
    if (typeof config?.name === "string" && config.name.trim()) return config.name.trim();
    if (typeof config?.title === "string" && config.title.trim()) return config.title.trim();
    const entityId = config?.entity;
    const friendly = entityId && this._hass?.states?.[entityId]?.attributes?.friendly_name;
    if (friendly) return friendly;
    if (entityId) return entityId;
    if (config?.type === "custom:lotus-layers-card") return lotusT("Calques Lotus");
    if (config?.type === "custom:lotus-visual-stack" || config?.lotus_visual_stack) return "Lotus Stack";
    if (config?.type === "custom:lotus-slide-card") return "Lotus Slide";
    if (config?.type === "custom:lotus-digicode-card") return "Lotus Digicode";
    return `${config?.type || lotusT("carte")} · ${index+1}`;
  }

  _updateToolbar() {
    if (!this._toolbar || !this._buttons) return;

    this._sanitizeSelection();
    const selectedCount = this._selectedIndices.length;
    const selected = selectedCount > 0;
    const multi = selectedCount > 1;
    const canDistribute = selectedCount >= 3;
    const layout = selected ? this._workingLayouts.get(this._selectedIndex) : null;
    const viewTitle = this._currentViewConfig()?.title || lotusT("Vue Lotus");
    this._toolbar.setAttribute("aria-label", lotusT("Outils de l’éditeur Lotus View Studio"));
    this._sideToolbar?.setAttribute("aria-label", lotusT("Calques et outils de sélection"));
    this._sideResizeHandle?.setAttribute("aria-label", lotusT("Redimensionner la barre latérale"));
    if (this._layersHeading) {
      const activeTab = this._activeTab();
      this._layersHeading.textContent = activeTab?.name
        ? `${lotusT("Calques")} · ${activeTab.name}`
        : lotusT("Calques");
    }
    if (this._selectionHeading) this._selectionHeading.textContent = lotusT("Sélection");
    if (this._cardLayerHeading) this._cardLayerHeading.textContent = lotusT("Calque");
    if (this._editHeading) this._editHeading.textContent = lotusT("Édition");
    if (this._positionHeading) this._positionHeading.textContent = lotusT("Position");

    // La barre horizontale décrit uniquement l’éditeur / la vue. Les détails
    // de sélection sont réservés à la barre verticale.
    this._selectedName.textContent = viewTitle;
    if (this._sideCardSection) this._sideCardSection.hidden = !selected;
    if (selected && this._sideSelectedName) {
      this._sideSelectedName.textContent = multi
        ? lotusT("{count} cartes sélectionnées", { count:selectedCount })
        : this._selectedCardName();
    }
    if (selected) {
      const referenceName = this._selectedCardName(this._selectedIndex);
      const displayedLayout = layout ? this._effectiveLayout(this._selectedIndex, layout) : null;
      const gridModeForMetrics = this._activeTabLayoutMode() === "grid";
      this._selectedMetrics.textContent = multi
        ? (displayedLayout
            ? `${lotusT("Référence")} : ${referenceName} · X ${displayedLayout.x.toFixed(2)} % · Y ${displayedLayout.y.toFixed(2)} % · ${lotusT("L")} ${displayedLayout.width.toFixed(2)} % · ${lotusT("H")} ${displayedLayout.height.toFixed(2)} %`
            : `${lotusT("Référence")} : ${referenceName}`)
        : (displayedLayout
            ? (gridModeForMetrics
                ? `${lotusT("Grille responsive")} · ${lotusT("position automatique")}${this._stackRatio(this._selectedIndex) ? ` · ${lotusT("ratio conservé")}` : ""}`
                : `X ${displayedLayout.x.toFixed(2)} % · Y ${displayedLayout.y.toFixed(2)} % · ${lotusT("L")} ${displayedLayout.width.toFixed(2)} % · ${lotusT("H")} ${displayedLayout.height.toFixed(2)} %${this._stackRatio(this._selectedIndex) ? ` · ${lotusT("ratio verrouillé")}` : ""}`)
            : "");
      const selectedLayers = [...new Set(this._selectedIndices.map((index) => this._layerIdForCard(index)))];
      const layerLabel = selectedLayers.length === 1
        ? this._layerById(selectedLayers[0])?.name
        : `${selectedLayers.length} ${lotusT("calques")}`;
      if (this._selectedCardLayer) this._selectedCardLayer.textContent = `${lotusT("Calque")} : ${layerLabel}`;
    } else {
      if (this._selectedMetrics) this._selectedMetrics.textContent = "";
      if (this._selectedCardLayer) this._selectedCardLayer.textContent = "";
    }

    this._status.textContent = lotusT(this._statusMessage);
    this._status.dataset.kind = this._statusKind;

    const gridMode = this._activeTabLayoutMode() === "grid";
    const scrollMode = this._viewDisplayConfig().scroll;
    this._syncEditorGuideState();
    this._buttons.guideGrid.disabled = gridMode || this._saveInProgress;
    this._buttons.guideFrame.disabled = gridMode || this._saveInProgress;
    this._buttons.guideScope.disabled = gridMode || this._saveInProgress || !this._showEditorGrid;
    this._buttons.guideGrid.dataset.active = String(this._showEditorGrid);
    this._buttons.guideFrame.dataset.active = String(this._showBackgroundFrame);
    this._buttons.guideScope.dataset.active = String(this._editorGridScope === "viewport");
    this._buttons.guideGrid.title = lotusT(this._showEditorGrid ? "Masquer la grille d’aide" : "Afficher la grille d’aide");
    this._buttons.guideFrame.title = lotusT(this._showBackgroundFrame
      ? "Masquer le contour de l’image de fond"
      : "Afficher le contour de l’image de fond");
    this._buttons.guideScope.title = lotusT(this._editorGridScope === "viewport"
      ? "Limiter la grille au cadre de l’image"
      : "Étendre la grille à toute la fenêtre d’édition");
    this._buttons.guideGrid.querySelector("ha-icon")?.setAttribute("icon", this._showEditorGrid ? "mdi:grid" : "mdi:grid-off");
    this._buttons.guideFrame.querySelector("ha-icon")?.setAttribute("icon", this._showBackgroundFrame ? "mdi:border-all" : "mdi:border-none");
    this._buttons.guideScope.querySelector("ha-icon")?.setAttribute("icon", this._editorGridScope === "viewport" ? "mdi:crop-free" : "mdi:image-outline");
    for (const button of [this._buttons.guideGrid, this._buttons.guideFrame, this._buttons.guideScope]) {
      button.setAttribute("aria-label", button.title);
    }
    const zoomDisabled = gridMode || this._saveInProgress;
    this._buttons.zoomOut.disabled = zoomDisabled || this._editorZoom <= LOTUS_EDITOR_ZOOM_MIN;
    this._buttons.zoomIn.disabled = zoomDisabled || this._editorZoom >= LOTUS_EDITOR_ZOOM_MAX;
    this._buttons.zoomFit.disabled = zoomDisabled;
    this._buttons.zoomWidth.disabled = zoomDisabled;
    this._buttons.zoomHeight.disabled = zoomDisabled;
    this._zoomValue.disabled = zoomDisabled;
    this._zoomValue.textContent = `${Math.round(this._editorZoom)} %`;
    this._buttons.zoomFit.dataset.active = String(this._editorZoomMode === "fit");
    this._buttons.zoomWidth.dataset.active = String(this._editorZoomMode === "width");
    this._buttons.zoomHeight.dataset.active = String(this._editorZoomMode === "height");
    this._buttons.viewFit.disabled = this._dirty || this._saveInProgress || gridMode;
    this._buttons.viewScrollVertical.disabled = this._dirty || this._saveInProgress || gridMode;
    this._buttons.viewScrollHorizontal.disabled = this._dirty || this._saveInProgress || gridMode;
    this._buttons.viewFit.dataset.active = String(scrollMode === "none");
    this._buttons.viewScrollVertical.dataset.active = String(scrollMode === "vertical");
    this._buttons.viewScrollHorizontal.dataset.active = String(scrollMode === "horizontal");
    this._buttons.add.disabled = this._dirty || this._saveInProgress;
    this._buttons.tabs.disabled = this._dirty || this._saveInProgress;
    this._buttons.multiSelect.disabled = this._saveInProgress;
    this._buttons.multiSelect.dataset.active = String(this._multiSelectMode);
    this._buttons.multiSelect.title = lotusT(this._multiSelectMode ? "Désactiver la sélection multiple" : "Activer la sélection multiple");
    this._buttons.multiSelect.setAttribute("aria-label", this._buttons.multiSelect.title);
    this._buttons.nativeYaml.disabled = this._dirty || this._saveInProgress;

    const clipboard = loadLotusCardClipboard();
    this._buttons.pasteCard.hidden = !clipboard;

    const layers = this._layersConfig();
    const activeLayerId = this._ensureActiveLayer();
    const activeLayerIndex = layers.findIndex((layer) => layer.id === activeLayerId);
    const activeLayerEmpty = this._layerCardIndices(activeLayerId).length === 0;
    this._buttons.layerAdd.disabled = this._dirty || this._saveInProgress;
    this._buttons.layerDelete.disabled = this._dirty || this._saveInProgress || layers.length <= 1 || activeLayerId === LOTUS_DEFAULT_LAYER_ID || !activeLayerEmpty;
    this._buttons.layerBackward.disabled = this._dirty || this._saveInProgress || activeLayerIndex <= 0;
    this._buttons.layerForward.disabled = this._dirty || this._saveInProgress || activeLayerIndex < 0 || activeLayerIndex >= layers.length - 1;
    this._buttons.pasteCard.disabled = !clipboard || this._dirty || this._saveInProgress || this._isLayerLocked(activeLayerId);
    this._buttons.pasteCard.title = lotusT("Coller la carte copiée");
    this._buttons.pasteCard.setAttribute("aria-label", this._buttons.pasteCard.title);

    // La zone d'actions contextuelles n'existe visuellement que lorsqu'au
    // moins une carte est sélectionnée.
    this._selectedActions.hidden = !selected;

    const selectedLayerId = selected ? this._layerIdForCard(this._selectedIndex) : null;
    const activeLayerLocked = selectedLayerId ? this._isLayerLocked(selectedLayerId) : false;
    const anySelectedEditorLocked = selected && this._selectedIndices.some((index) => this._isCardEditorLocked(index));
    const allInActiveLayer = selected && this._selectedIndices.every((index) => this._layerIdForCard(index) === activeLayerId);
    const allInBaseLayer = selected && this._selectedIndices.every((index) => this._layerIdForCard(index) === LOTUS_DEFAULT_LAYER_ID);
    this._buttons.cardAddToActiveLayer.disabled = !selected || this._saveInProgress || this._dirty || anySelectedEditorLocked || allInActiveLayer;
    this._buttons.cardRemoveFromLayer.disabled = !selected || this._saveInProgress || this._dirty || anySelectedEditorLocked || allInBaseLayer;
    this._buttons.cardMoveLayer.disabled = !selected || this._saveInProgress || this._dirty || anySelectedEditorLocked || layers.length < 2;

    const cardLayerTitles = multi
      ? {
          add:"Ajouter les cartes sélectionnées au calque de travail",
          remove:"Retirer les cartes sélectionnées de leur calque et les replacer dans le Calque 1",
          move:"Déplacer les cartes sélectionnées vers un autre calque",
        }
      : {
          add:"Ajouter la carte au calque de travail",
          remove:"Retirer la carte de son calque et la replacer dans le Calque 1",
          move:"Déplacer la carte vers un autre calque",
        };
    this._buttons.cardAddToActiveLayer.title = lotusT(cardLayerTitles.add);
    this._buttons.cardRemoveFromLayer.title = lotusT(cardLayerTitles.remove);
    this._buttons.cardMoveLayer.title = lotusT(cardLayerTitles.move);
    for (const button of [this._buttons.cardAddToActiveLayer, this._buttons.cardRemoveFromLayer, this._buttons.cardMoveLayer]) {
      button.setAttribute("aria-label", button.title);
    }

    if (this._editActionGroup) this._editActionGroup.hidden = !selected;
    if (this._positionActionGroup) this._positionActionGroup.hidden = !selected;
    if (this._cardLayerActionGroup) this._cardLayerActionGroup.hidden = !selected;

    // Les outils s'organisent toujours dans les mêmes sections. Leur visibilité
    // s'adapte simplement à une sélection simple ou multiple.
    this._buttons.edit.hidden = !selected || multi;
    this._buttons.lock.hidden = !selected || multi;
    this._buttons.duplicate.hidden = !selected || multi;
    this._buttons.copyCard.hidden = !selected || multi;
    this._buttons.centerOnImageHorizontal.hidden = !selected || multi;
    this._buttons.centerOnImageVertical.hidden = !selected || multi;

    this._buttons.edit.disabled = !selected || this._saveInProgress || activeLayerLocked;
    this._buttons.lock.disabled = !selected || this._saveInProgress || gridMode || activeLayerLocked;
    this._buttons.duplicate.disabled = !selected || this._saveInProgress || activeLayerLocked;
    // Copy is read-only: a locked card/layer may still be copied to another
    // Lotus View Studio view, but never while an autosave is in flight.
    this._buttons.copyCard.disabled = !selected || multi || this._saveInProgress || this._dirty;
    this._buttons.copyCard.title = lotusT("Copier la carte");
    this._buttons.copyCard.setAttribute("aria-label", this._buttons.copyCard.title);

    const tabs = this._tabsConfig();
    const canMoveToAnotherTab = Boolean(selected && !multi && tabs.enabled && tabs.items.length > 1);
    this._buttons.moveTab.hidden = !canMoveToAnotherTab;
    this._buttons.moveTab.disabled = !canMoveToAnotherTab || this._saveInProgress || this._dirty || activeLayerLocked;

    const singlePositionDisabled = !selected || multi || this._saveInProgress || this._dirty || gridMode || Boolean(layout?.locked) || activeLayerLocked;
    this._buttons.centerOnImageHorizontal.disabled = singlePositionDisabled;
    this._buttons.centerOnImageVertical.disabled = singlePositionDisabled;

    const batchButtons = [
      this._buttons.alignLeft,
      this._buttons.alignHCenter,
      this._buttons.alignRight,
      this._buttons.alignTop,
      this._buttons.alignVCenter,
      this._buttons.alignBottom,
      this._buttons.sameSize,
    ];
    for (const button of batchButtons) {
      button.hidden = !multi;
      button.disabled = !multi || this._saveInProgress || this._dirty || gridMode || this._selectedIndices.some((index) => this._isCardEditorLocked(index));
    }

    // Les outils de répartition n'ont de sens qu'à partir de trois cartes.
    // Ils ne doivent donc même pas apparaître pour une sélection de deux cartes.
    const distributionButtons = [
      this._buttons.distributeHorizontal,
      this._buttons.distributeVertical,
    ];
    for (const button of distributionButtons) {
      button.hidden = !canDistribute;
      button.disabled = !canDistribute || this._saveInProgress || this._dirty || gridMode || this._selectedIndices.some((index) => this._isCardEditorLocked(index));
    }

    // Supprimer est placé dans l’en-tête de sélection, à côté du nom et des
    // informations de position/taille, pour rester immédiatement identifiable.
    this._buttons.delete.hidden = !selected;
    this._buttons.delete.disabled = !selected || this._saveInProgress || anySelectedEditorLocked;
    this._buttons.delete.title = multi
      ? lotusT("Supprimer {count} cartes sélectionnées", { count:selectedCount })
      : lotusT("Supprimer la carte");
    this._buttons.delete.setAttribute("aria-label", this._buttons.delete.title);

    this._buttons.lock.title = lotusT(layout?.locked ? "Déverrouiller" : "Verrouiller");
    this._buttons.lock.setAttribute("aria-label", this._buttons.lock.title);
    this._buttons.lock.querySelector("ha-icon")?.setAttribute(
      "icon",
      layout?.locked ? "mdi:lock" : "mdi:lock-open-variant-outline",
    );
    this._renderLayersPanel();
  }

  _syncCanvasHeight() {
    if (!this.isConnected || !this._canvas || !this._viewport || !this._root) return;

    // The toolbar reserves height in edit mode, but the background image defines
    // the actual Lotus coordinate surface. The whole scene (background + cards)
    // is uniformly fitted into the remaining viewport, preserving the image
    // aspect ratio. Leaving edit mode enlarges the same scene without changing
    // x/y/width/height percentages.
    const rootRect = this._root.getBoundingClientRect();
    const totalAvailable = Math.max(300, window.innerHeight - rootRect.top - 8);
    this._root.style.height = `${Math.round(totalAvailable)}px`;

    const editing = this._isEditMode();
    const toolbarHeight = editing && this._toolbar
      ? Math.ceil(this._toolbar.getBoundingClientRect().height || this._toolbar.offsetHeight || 0)
      : 0;
    const viewportHeight = Math.max(220, totalAvailable - toolbarHeight);

    this._viewport.style.height = `${Math.round(viewportHeight)}px`;

    this._syncTabsLayout();
    this._syncViewBackground();
    this._syncSceneFrame();
  }

}

if (!customElements.get("lotus-visual-layout")) customElements.define("lotus-visual-layout",LotusVisualLayout);
