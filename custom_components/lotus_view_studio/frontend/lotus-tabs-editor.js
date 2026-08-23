import {
  LOTUS_LAYOUT_KEY,
  LOTUS_LEGACY_LAYOUT_KEYS,
  deepClone,
  lotusSlugify,
  lotusThemeCss,
  lotusTabEdgeBorderPath,
} from "./lotus-core.js?v=0.13.0b0";
import {
  lotusDebug,
  lotusLocalizeSelector,
  lotusSetHass,
  lotusT,
} from "./lotus-i18n.js?v=0.13.0b0";

const LOTUS_VIEW_META_KEY = "lotus_visual";
const LOTUS_TABS_KEY = "tabs";
const LOTUS_LAYERS_KEY = "layers";
const LOTUS_DEFAULT_LAYER_ID = "layer-1";
const LOTUS_VIEW_DISPLAY_KEY = "display";
const DEFAULTS = Object.freeze({
  enabled: true,
  position: "bottom",
  span: 100,
  thickness: 7,
  align: "center",
  layout: "canvas",
  edgeCorners: "none",
  edgeRadius: 50,
  gridMinWidth: 280,
  gridGap: 16,
  gridPadding: 16,
  gridMaxColumns: 4,
  safeMargin: 0,
});

const HA_THEME_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey",
  "grey", "dark-grey", "blue-grey", "black", "white",
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const round = (value) => Math.round(Number(value) * 1000) / 1000;
const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const colorCss = (value, fallback = "transparent") => {
  const color = String(value ?? "").trim();
  if (!color || color === "none" || color === "state") return fallback;
  if (HA_THEME_COLORS.has(color)) {
    if (color === "primary") return "var(--primary-color,#03a9f4)";
    if (color === "accent") return "var(--accent-color,var(--primary-color,#03a9f4))";
    return `var(--${color}-color,${fallback})`;
  }
  return color;
};

const mediaId = (value) => {
  if (typeof value === "string") return value;
  if (isObject(value) && typeof value.media_content_id === "string") return value.media_content_id;
  return "";
};

const backgroundHasImage = (background) => {
  if (!background) return false;
  if (isObject(background)) return Boolean(mediaId(background.image));
  if (typeof background !== "string") return false;
  const value = background.trim();
  return /url\(/i.test(value) || /^(?:media-source:\/\/|\/|https?:\/\/|data:|blob:)/i.test(value);
};

const normalizeMedia = (value) => {
  if (!value) return undefined;
  if (isObject(value) && value.media_content_id) return deepClone(value);
  if (typeof value === "string" && value.trim()) {
    return { media_content_id: value.trim(), media_content_type: "image" };
  }
  return undefined;
};

const newTab = (index, existingIds = new Set()) => {
  const base = lotusSlugify(`onglet-${index + 1}`, `onglet-${index + 1}`);
  let id = base;
  let suffix = 2;
  while (existingIds.has(id)) id = `${base}-${suffix++}`;
  return {
    id,
    name: `${lotusT("Onglet")} ${index + 1}`,
    icon: "mdi:tab",
    color: "primary",
    text_color: "white",
    active_color: "accent",
    active_text_color: "white",
    fill_color: "none",
    layout: DEFAULTS.layout,
    edge_corners: DEFAULTS.edgeCorners,
    edge_radius: DEFAULTS.edgeRadius,
    edge_fill: false,
    grid: {
      min_width: DEFAULTS.gridMinWidth,
      gap: DEFAULTS.gridGap,
      padding: DEFAULTS.gridPadding,
      max_columns: DEFAULTS.gridMaxColumns,
    },
  };
};

const normalizeTab = (item, index, used) => {
  const fallback = newTab(index, used);
  let id = lotusSlugify(item?.id || item?.name || fallback.id, fallback.id);
  let suffix = 2;
  const base = id;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return {
    id,
    name: String(item?.name ?? fallback.name),
    icon: String(item?.icon ?? fallback.icon),
    image: item?.image ? deepClone(item.image) : undefined,
    color: String(item?.color ?? fallback.color),
    text_color: String(item?.text_color ?? fallback.text_color),
    active_color: String(item?.active_color ?? fallback.active_color),
    active_text_color: String(item?.active_text_color ?? fallback.active_text_color),
    fill_color: String(item?.fill_color ?? fallback.fill_color),
    background: isObject(item?.background) ? deepClone(item.background) : undefined,
    layout: item?.layout === "grid" ? "grid" : DEFAULTS.layout,
    edge_corners: ["none", "start", "end", "both"].includes(item?.edge_corners)
      ? item.edge_corners
      : DEFAULTS.edgeCorners,
    edge_radius: round(clamp(item?.edge_radius ?? DEFAULTS.edgeRadius, 0, 50)),
    edge_fill: Boolean(item?.edge_fill),
    grid: {
      min_width: Math.round(clamp(item?.grid?.min_width ?? DEFAULTS.gridMinWidth, 140, 800)),
      gap: Math.round(clamp(item?.grid?.gap ?? DEFAULTS.gridGap, 0, 64)),
      padding: Math.round(clamp(item?.grid?.padding ?? DEFAULTS.gridPadding, 0, 64)),
      max_columns: Math.round(clamp(item?.grid?.max_columns ?? DEFAULTS.gridMaxColumns, 1, 12)),
    },
  };
};

const normalizeTabs = (raw) => {
  const used = new Set();
  const sourceItems = Array.isArray(raw?.items) && raw.items.length ? raw.items : [newTab(0, used)];
  used.clear();
  const items = sourceItems.map((item, index) => normalizeTab(item, index, used));
  return {
    enabled: raw?.enabled !== false,
    position: ["top", "bottom", "left", "right"].includes(raw?.position) ? raw.position : DEFAULTS.position,
    span: round(clamp(raw?.span ?? DEFAULTS.span, 20, 100)),
    thickness: round(clamp(raw?.thickness ?? DEFAULTS.thickness, 4, 25)),
    align: ["start", "center", "end"].includes(raw?.align) ? raw.align : DEFAULTS.align,
    items,
  };
};

const compactTab = (item) => {
  const result = { id: item.id };
  if (item.name) result.name = item.name;
  if (item.icon) result.icon = item.icon;
  if (item.image) result.image = deepClone(item.image);
  if (item.color && item.color !== "primary") result.color = item.color;
  if (item.text_color && item.text_color !== "white") result.text_color = item.text_color;
  if (item.active_color && item.active_color !== "accent") result.active_color = item.active_color;
  if (item.active_text_color && item.active_text_color !== "white") result.active_text_color = item.active_text_color;
  if (item.fill_color && item.fill_color !== "none") result.fill_color = item.fill_color;
  if (isObject(item.background) && Object.keys(item.background).length) result.background = deepClone(item.background);
  if (item.layout === "grid") {
    result.layout = "grid";
    const grid = {};
    if (Number(item.grid?.min_width) !== DEFAULTS.gridMinWidth) grid.min_width = Math.round(item.grid.min_width);
    if (Number(item.grid?.gap) !== DEFAULTS.gridGap) grid.gap = Math.round(item.grid.gap);
    if (Number(item.grid?.padding) !== DEFAULTS.gridPadding) grid.padding = Math.round(item.grid.padding);
    if (Number(item.grid?.max_columns) !== DEFAULTS.gridMaxColumns) grid.max_columns = Math.round(item.grid.max_columns);
    if (Object.keys(grid).length) result.grid = grid;
  }
  if (item.edge_corners && item.edge_corners !== DEFAULTS.edgeCorners) result.edge_corners = item.edge_corners;
  if (item.edge_corners && item.edge_corners !== "none" && Number(item.edge_radius) !== DEFAULTS.edgeRadius) {
    result.edge_radius = round(item.edge_radius);
  }
  if (item.edge_fill) result.edge_fill = true;
  return result;
};

const compactTabs = (tabs) => {
  const result = { enabled: Boolean(tabs.enabled), items: tabs.items.map(compactTab) };
  if (tabs.position !== DEFAULTS.position) result.position = tabs.position;
  if (Number(tabs.span) !== DEFAULTS.span) result.span = round(tabs.span);
  if (Number(tabs.thickness) !== DEFAULTS.thickness) result.thickness = round(tabs.thickness);
  if (tabs.align !== DEFAULTS.align) result.align = tabs.align;
  return result;
};

const normalizeDisplay = (raw) => ({
  scroll: ["vertical", "horizontal"].includes(raw?.scroll) ? raw.scroll : "none",
  safe_margin: Math.round(clamp(raw?.safe_margin ?? DEFAULTS.safeMargin, 0, 160)),
});

const compactDisplay = (display) => {
  const result = {};
  if (["vertical", "horizontal"].includes(display?.scroll)) result.scroll = display.scroll;
  const safeMargin = Math.round(clamp(display?.safe_margin ?? DEFAULTS.safeMargin, 0, 160));
  if (safeMargin !== DEFAULTS.safeMargin) result.safe_margin = safeMargin;
  return result;
};

const getCardTab = (config, fallback) => {
  const viewLayout = isObject(config?.view_layout) ? config.view_layout : {};
  const legacyLayout = LOTUS_LEGACY_LAYOUT_KEYS
    .map((key) => viewLayout[key])
    .find((value) => isObject(value)) || {};
  const currentLayout = isObject(viewLayout[LOTUS_LAYOUT_KEY]) ? viewLayout[LOTUS_LAYOUT_KEY] : {};
  const layout = { ...legacyLayout, ...currentLayout };
  return typeof layout.tab === "string" && layout.tab ? layout.tab : fallback;
};

const createHaForm = ({ hass, data, schema, labels, helpers, onChange, className = "" }) => {
  const form = document.createElement("ha-form");
  form.className = className;
  form.hass = hass;
  form.data = data;
  form.schema = (schema || []).map((field) => ({
    ...field,
    selector: lotusLocalizeSelector(field?.selector),
  }));
  form.computeLabel = (field) => lotusT(labels?.[field?.name] || String(field?.name || ""));
  form.computeHelper = (field) => {
    const helper = helpers?.[field?.name];
    return helper ? lotusT(helper) : undefined;
  };
  form.addEventListener("value-changed", (event) => {
    event.stopPropagation();
    onChange?.(event.detail?.value || {});
  });
  return form;
};

class LotusTabsEditorOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._lovelace = null;
    this._viewIndex = 0;
    this._tabs = normalizeTabs(null);
    this._display = normalizeDisplay(null);
    this._assignments = [];
    this._selectedTabIndex = 0;
    this._previewTabId = this._tabs.items[0].id;
    this._viewBackground = undefined;
    this._onSaved = null;
    this._saving = false;
    this._leftScrollTop = 0;
  }

  open({ hass, lovelace, viewIndex, activeTabId, onSaved }) {
    lotusSetHass(hass);
    this._hass = hass;
    this._lovelace = lovelace;
    this._viewIndex = viewIndex;
    this._onSaved = onSaved;
    const view = lovelace?.config?.views?.[viewIndex] || {};
    this._viewBackground = deepClone(view?.background);
    const viewMeta = view?.[LOTUS_VIEW_META_KEY];
    this._tabs = normalizeTabs(viewMeta?.[LOTUS_TABS_KEY]);
    this._display = normalizeDisplay(viewMeta?.[LOTUS_VIEW_DISPLAY_KEY]);
    const validIds = new Set(this._tabs.items.map((item) => item.id));
    const fallback = this._tabs.items[0]?.id;
    this._assignments = (view.cards || []).map((config) => {
      const id = getCardTab(config, fallback);
      return validIds.has(id) ? id : fallback;
    });
    const initialId = validIds.has(activeTabId) ? activeTabId : fallback;
    this._selectedTabIndex = Math.max(0, this._tabs.items.findIndex((item) => item.id === initialId));
    this._previewTabId = initialId;
    this._render();
  }

  _selectedTab() {
    return this._tabs.items[this._selectedTabIndex] || this._tabs.items[0];
  }

  _captureScroll() {
    const left = this.shadowRoot?.querySelector(".left-pane");
    if (left) this._leftScrollTop = left.scrollTop;
  }

  _restoreScroll() {
    requestAnimationFrame(() => {
      const left = this.shadowRoot?.querySelector(".left-pane");
      if (left) left.scrollTop = this._leftScrollTop;
    });
  }

  _close() {
    this.remove();
  }

  _rerender() {
    this._captureScroll();
    this._render();
    this._restoreScroll();
  }

  _refreshPreview() {
    const right = this.shadowRoot?.querySelector(".right-pane");
    if (!right) return;
    right.querySelector(".screen-preview")?.remove();
    this._renderPreview(right);
    const screen = right.querySelector(".screen-preview");
    if (screen) screen.style.setProperty("--preview-depth", `${this._tabs.thickness}%`);
  }

  _addTab() {
    const ids = new Set(this._tabs.items.map((item) => item.id));
    this._tabs.items.push(newTab(this._tabs.items.length, ids));
    this._selectedTabIndex = this._tabs.items.length - 1;
    this._previewTabId = this._selectedTab().id;
    this._rerender();
  }

  _deleteTab(index) {
    if (this._tabs.items.length <= 1) return;
    const removed = this._tabs.items[index];
    this._tabs.items.splice(index, 1);
    this._selectedTabIndex = Math.min(this._selectedTabIndex, this._tabs.items.length - 1);
    const fallback = this._tabs.items[0].id;
    this._assignments = this._assignments.map((id) => id === removed.id ? fallback : id);
    if (this._previewTabId === removed.id) this._previewTabId = this._selectedTab().id;
    this._rerender();
  }

  _moveTab(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this._tabs.items.length) return;
    const [item] = this._tabs.items.splice(index, 1);
    this._tabs.items.splice(target, 0, item);
    this._selectedTabIndex = target;
    this._rerender();
  }

  async _save() {
    if (this._saving || !this._lovelace?.config || typeof this._lovelace?.saveConfig !== "function") return;
    this._saving = true;
    this._updateSaveState();
    try {
      const config = deepClone(this._lovelace.config);
      const view = config?.views?.[this._viewIndex];
      if (!view) throw new Error("Vue introuvable");
      const meta = isObject(view[LOTUS_VIEW_META_KEY]) ? { ...view[LOTUS_VIEW_META_KEY] } : {};
      meta[LOTUS_TABS_KEY] = compactTabs(this._tabs);
      const display = compactDisplay(this._display);
      if (Object.keys(display).length) meta[LOTUS_VIEW_DISPLAY_KEY] = display;
      else delete meta[LOTUS_VIEW_DISPLAY_KEY];
      view[LOTUS_VIEW_META_KEY] = meta;

      const validIds = new Set(this._tabs.items.map((item) => item.id));
      const fallback = this._tabs.items[0]?.id;

      // Layer sets belong to tabs. Remove data from deleted tabs while keeping
      // the global fallback used when tabs are disabled.
      const layerStorage = meta[LOTUS_LAYERS_KEY];
      if (layerStorage && typeof layerStorage === "object" && !Array.isArray(layerStorage) && layerStorage.tabs && typeof layerStorage.tabs === "object") {
        const nextTabs = {};
        for (const [tabId, layers] of Object.entries(layerStorage.tabs)) {
          if (validIds.has(tabId) && Array.isArray(layers)) nextTabs[tabId] = deepClone(layers);
        }
        meta[LOTUS_LAYERS_KEY] = { ...layerStorage, tabs:nextTabs };
      }

      view.cards = (view.cards || []).map((card, index) => {
        const next = deepClone(card);
        const viewLayout = isObject(next.view_layout) ? { ...next.view_layout } : {};
        const legacyLotus = LOTUS_LEGACY_LAYOUT_KEYS
          .map((key) => viewLayout[key])
          .find((value) => isObject(value)) || {};
        const currentLotus = isObject(viewLayout[LOTUS_LAYOUT_KEY]) ? viewLayout[LOTUS_LAYOUT_KEY] : {};
        // Never replace a legacy geometry record with a partial {tab, layer}
        // record. Merging here preserves custom x/y/width/height across addon
        // upgrades and when tabs/layers are edited for the first time.
        const lotus = { ...deepClone(legacyLotus), ...deepClone(currentLotus) };
        const previousTab = typeof lotus.tab === "string" && lotus.tab ? lotus.tab : fallback;
        const assigned = validIds.has(this._assignments[index]) ? this._assignments[index] : fallback;
        if (assigned) lotus.tab = assigned;
        // A layer identifier has meaning only inside its tab. Moving a card to
        // another tab therefore places it in that tab's base layer.
        if (assigned && previousTab !== assigned) lotus.layer = LOTUS_DEFAULT_LAYER_ID;
        viewLayout[LOTUS_LAYOUT_KEY] = lotus;
        for (const legacyKey of LOTUS_LEGACY_LAYOUT_KEYS) delete viewLayout[legacyKey];
        next.view_layout = viewLayout;
        return next;
      });

      await this._lovelace.saveConfig(config);
      const active = validIds.has(this._previewTabId) ? this._previewTabId : fallback;
      this._onSaved?.(active);
      this._close();
    } catch (error) {
      lotusDebug("Tabs save failed", error);
      const status = this.shadowRoot?.querySelector(".save-status");
      if (status) status.textContent = lotusT(`Échec : ${error?.message || error}`);
    } finally {
      this._saving = false;
      this._updateSaveState();
    }
  }

  _updateSaveState() {
    const button = this.shadowRoot?.querySelector(".save");
    if (button) button.disabled = this._saving;
  }

  _edgeCornerOptions() {
    return [
      { value: "none", label: "Aucun" },
      { value: "start", label: "Coin au début de la barre" },
      { value: "end", label: "Coin à la fin de la barre" },
      { value: "both", label: "Les deux coins" },
    ];
  }

  _applyPreviewEdgeCorners(button, item) {
    const mode = item?.edge_corners || "none";
    const radius = clamp(item?.edge_radius ?? DEFAULTS.edgeRadius, 0, 50);
    button.dataset.edgeCorners = mode;
    button.dataset.edgeRadius = String(radius);
    button.style.setProperty("--tab-edge-radius", `${Math.round(radius * 0.28)}px`);
  }

  _renderTabVisual(container, item, active, vertical = false, underlay = "transparent", edgeFillSide = "", edgeStroke = "", edgeWidth = 1) {
    const slot = document.createElement("div");
    slot.className = "tab-preview-slot";
    slot.style.setProperty("--tab-underlay", underlay || "transparent");
    if (edgeFillSide) {
      slot.dataset.edgeFillSide = edgeFillSide;
      slot.style.setProperty("--tab-edge-stroke", edgeStroke || "var(--divider-color,rgba(127,127,127,.24))");
      slot.dataset.edgeWidth = String(edgeWidth || 1);
      slot.style.setProperty("--tab-edge-width", String(edgeWidth || 1));
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-preview-button";
    button.dataset.active = String(active);
    button.style.setProperty("--tab-bg", colorCss(active ? item.active_color : item.color, "var(--card-background-color,#fff)"));
    button.style.setProperty("--tab-fg", colorCss(active ? item.active_text_color : item.text_color, "var(--primary-text-color,#212121)"));
    button.classList.toggle("vertical", vertical);
    this._applyPreviewEdgeCorners(button, item);

    const image = mediaId(item.image);
    if (image) {
      const hui = document.createElement("hui-image");
      hui.className = "tab-media";
      hui.hass = this._hass;
      hui.image = image;
      hui.fitMode = "contain";
      button.appendChild(hui);
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
    slot.appendChild(button);
    if (edgeFillSide) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("tab-edge-border");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      svg.appendChild(path);
      slot.appendChild(svg);
    }
    container.appendChild(slot);
    return button;
  }

  _updatePreviewEdgeBorders(bar) {
    if (!bar) return;
    const position = bar.dataset.position || "top";
    const horizontal = position === "top" || position === "bottom";
    const depth = horizontal ? bar.clientHeight : bar.clientWidth;
    if (!(depth > 0)) return;

    bar.querySelectorAll(".tab-preview-slot[data-edge-fill-side]").forEach((slot) => {
      const button = slot.querySelector(".tab-preview-button");
      const svg = slot.querySelector(".tab-edge-border");
      const path = svg?.querySelector("path");
      if (!button || !svg || !path) return;
      const rect = slot.getBoundingClientRect();
      const radiusPct = clamp(Number(button.dataset.edgeRadius ?? DEFAULTS.edgeRadius), 0, 50);
      const previewRadius = Number.parseFloat(button.style.getPropertyValue("--tab-edge-radius"));
      const radius = Number.isFinite(previewRadius) && previewRadius > 0
        ? previewRadius
        : depth * radiusPct / 100;
      const edgeWidth = clamp(Number(slot.dataset.edgeWidth ?? 1), 0, 10);
      const d = lotusTabEdgeBorderPath(position, slot.dataset.edgeFillSide, rect.width, rect.height, radius, edgeWidth);
      if (!d) {
        svg.setAttribute("hidden", "");
        return;
      }
      svg.removeAttribute("hidden");
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
      path.setAttribute("d", d);
    });
  }

  _renderPreview(preview) {
    const screen = document.createElement("div");
    screen.className = "screen-preview";
    const selected = this._tabs.items.find((item) => item.id === this._previewTabId) || this._tabs.items[0];
    screen.style.setProperty("--scene-fill", colorCss(selected?.fill_color, "var(--primary-background-color,#fafafa)"));

    const scene = document.createElement("div");
    scene.className = "scene-preview";
    scene.dataset.layout = selected?.layout === "grid" ? "grid" : "canvas";
    if (selected?.layout === "grid") {
      const grid = document.createElement("div");
      grid.className = "grid-layout-preview";
      grid.style.setProperty("--grid-gap", `${Math.max(2, Math.round((selected.grid?.gap ?? DEFAULTS.gridGap) / 4))}px`);
      const columns = Math.max(1, Math.min(4, Number(selected.grid?.max_columns ?? DEFAULTS.gridMaxColumns)));
      grid.style.setProperty("--grid-columns", String(columns));
      for (let i = 0; i < 7; i += 1) {
        const tile = document.createElement("div");
        tile.className = "grid-layout-tile";
        tile.innerHTML = `<ha-icon icon="mdi:card-outline"></ha-icon>`;
        grid.appendChild(tile);
      }
      scene.appendChild(grid);
    } else {
      const effectiveBackground = selected?.background || this._viewBackground;
      if (effectiveBackground) {
        const background = document.createElement("hui-view-background");
        background.className = "scene-background";
        background.hass = this._hass;
        background.background = effectiveBackground;
        scene.appendChild(background);

        if (backgroundHasImage(effectiveBackground)) {
          const backgroundGuide = document.createElement("div");
          backgroundGuide.className = "scene-background-guide";
          backgroundGuide.setAttribute("aria-hidden", "true");
          scene.appendChild(backgroundGuide);
        }
      }
      const info = document.createElement("div");
      info.className = "scene-info";
      info.innerHTML = `<ha-icon icon="mdi:vector-square"></ha-icon><span>${selected?.name || lotusT("Onglet")}</span>`;
      scene.appendChild(info);
    }

    const bar = document.createElement("div");
    bar.className = "tabs-preview-bar";
    const horizontal = ["top", "bottom"].includes(this._tabs.position);
    bar.dataset.position = this._tabs.position;
    bar.style.setProperty("--span", `${this._tabs.span}%`);
    bar.style.setProperty("--thickness", `${this._tabs.thickness}%`);
    const offset = this._tabs.align === "start" ? 0 : this._tabs.align === "end" ? 100 - this._tabs.span : (100 - this._tabs.span) / 2;
    bar.style.setProperty("--offset", `${offset}%`);
    this._tabs.items.forEach((item, index) => {
      const mode = item.edge_corners || "none";
      let neighbor;
      if (item.edge_fill && mode === "start" && index > 0) neighbor = this._tabs.items[index - 1];
      if (item.edge_fill && mode === "end" && index < this._tabs.items.length - 1) neighbor = this._tabs.items[index + 1];
      const neighborActive = neighbor?.id === selected?.id;
      const underlay = neighbor
        ? colorCss(neighborActive ? neighbor.active_color : neighbor.color, "var(--card-background-color,#fff)")
        : "transparent";
      const edgeSource = neighbor || item;
      const edgeSourceActive = edgeSource?.id === selected?.id;
      const edgeFg = colorCss(
        edgeSourceActive ? edgeSource?.active_text_color : edgeSource?.text_color,
        "var(--primary-text-color,#212121)",
      );
      const edgeStroke = `color-mix(in srgb,${edgeFg} ${edgeSourceActive ? 36 : 18}%,transparent)`;
      const button = this._renderTabVisual(
        bar,
        item,
        item.id === selected?.id,
        !horizontal,
        underlay,
        neighbor ? mode : "",
        edgeStroke,
        edgeSourceActive ? 2 : 1,
      );
      if (neighbor) {
        const dividerOwner = mode === "start"
          ? bar.children[index - 1]?.querySelector(".tab-preview-button")
          : button;
        if (dividerOwner) dividerOwner.dataset.suppressDivider = "true";
      }
      button.addEventListener("click", () => {
        this._previewTabId = item.id;
        this._selectedTabIndex = this._tabs.items.findIndex((tab) => tab.id === item.id);
        this._rerender();
      });
    });

    screen.append(scene, bar);
    screen.dataset.position = this._tabs.position;
    screen.dataset.enabled = String(Boolean(this._tabs.enabled));
    preview.appendChild(screen);
    requestAnimationFrame(() => this._updatePreviewEdgeBorders(bar));
  }

  _render() {
    if (!this.shadowRoot) return;
    const view = this._lovelace?.config?.views?.[this._viewIndex] || {};
    const selected = this._selectedTab();

    const root = document.createElement("div");
    root.className = "overlay";
    const dialog = document.createElement("div");
    dialog.className = "dialog";
    const header = document.createElement("div");
    header.className = "header";
    header.innerHTML = `<div class="title">${lotusT("Onglets Lotus")}</div><div class="subtitle">${lotusT("Organisez une seule vue en plusieurs espaces de cartes.")}</div>`;
    const close = document.createElement("button");
    close.className = "icon-button close";
    close.title = lotusT("Fermer");
    close.innerHTML = `<ha-icon icon="mdi:close"></ha-icon>`;
    close.addEventListener("click", () => this._close());
    header.appendChild(close);

    const content = document.createElement("div");
    content.className = "content";
    const left = document.createElement("div");
    left.className = "left-pane";
    const right = document.createElement("div");
    right.className = "right-pane";

    const globalSection = document.createElement("section");
    globalSection.innerHTML = `<h3>${lotusT("Disposition")}</h3><p>${lotusT("Les onglets ont tous la même taille et se répartissent sur une portion de l’écran définie en pourcentage.")}</p>`;
    const globalForm = createHaForm({
      hass: this._hass,
      data: {
        enabled: this._tabs.enabled,
        position: this._tabs.position,
        span: this._tabs.span,
        thickness: this._tabs.thickness,
        align: this._tabs.align,
        safe_margin: this._display.safe_margin,
      },
      schema: [
        { name: "enabled", selector: { boolean: {} } },
        { name: "position", selector: { select: { mode: "dropdown", options: [
          { value: "top", label: "En haut" }, { value: "bottom", label: "En bas" },
          { value: "left", label: "À gauche" }, { value: "right", label: "À droite" },
        ] } } },
        { name: "span", selector: { number: { min: 20, max: 100, step: 1, mode: "slider", unit_of_measurement: "%" } } },
        { name: "thickness", selector: { number: { min: 4, max: 25, step: 1, mode: "slider", unit_of_measurement: "%" } } },
        { name: "align", selector: { select: { mode: "dropdown", options: [
          { value: "start", label: "Début" }, { value: "center", label: "Centré" }, { value: "end", label: "Fin" },
        ] } } },
        { name: "safe_margin", selector: { number: { min: 0, max: 160, step: 2, mode: "slider", unit_of_measurement: "px" } } },
      ],
      labels: {
        enabled: "Afficher les onglets",
        position: "Position",
        span: "Étendue de la barre",
        thickness: "Profondeur des onglets",
        align: "Position de la barre",
        safe_margin: "Marge de sécurité de la vue",
      },
      helpers: {
        span: "Pourcentage de la largeur (haut/bas) ou de la hauteur (gauche/droite).",
        thickness: "Pourcentage de la dimension perpendiculaire. La valeur reste identique quand la barre change de côté.",
        safe_margin: "Rendu final uniquement : réserve de l’espace entre les cartes extrêmes et les bords de l’écran. L’image de fond conserve son alignement (par exemple top reste collé en haut). 0 px désactive cette marge.",
      },
      onChange: (value) => {
        this._tabs.enabled = value.enabled !== false;
        this._tabs.position = value.position || DEFAULTS.position;
        this._tabs.span = round(clamp(value.span ?? DEFAULTS.span, 20, 100));
        this._tabs.thickness = round(clamp(value.thickness ?? DEFAULTS.thickness, 4, 25));
        this._tabs.align = value.align || DEFAULTS.align;
        this._display.safe_margin = Math.round(clamp(value.safe_margin ?? DEFAULTS.safeMargin, 0, 160));
        this._refreshPreview();
      },
    });
    globalSection.appendChild(globalForm);
    left.appendChild(globalSection);

    const tabsSection = document.createElement("section");
    const tabsHead = document.createElement("div");
    tabsHead.className = "section-head";
    tabsHead.innerHTML = `<div><h3>${lotusT("Onglets")}</h3><p>${lotusT("Le premier onglet est celui affiché par défaut.")}</p></div>`;
    const add = document.createElement("button");
    add.className = "icon-button primary";
    add.title = lotusT("Ajouter un onglet");
    add.innerHTML = `<ha-icon icon="mdi:plus"></ha-icon>`;
    add.addEventListener("click", () => this._addTab());
    tabsHead.appendChild(add);
    tabsSection.appendChild(tabsHead);

    const tabList = document.createElement("div");
    tabList.className = "tab-list";
    this._tabs.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "tab-row";
      row.dataset.selected = String(index === this._selectedTabIndex);
      const select = document.createElement("button");
      select.className = "tab-select";
      select.innerHTML = `<ha-icon icon="${item.icon || "mdi:tab"}"></ha-icon><span>${item.name || `${lotusT("Onglet")} ${index + 1}`}</span>`;
      select.addEventListener("click", () => {
        this._selectedTabIndex = index;
        this._previewTabId = item.id;
        this._rerender();
      });
      const up = document.createElement("button");
      up.className = "mini-button";
      up.title = lotusT("Monter");
      up.disabled = index === 0;
      up.innerHTML = `<ha-icon icon="mdi:chevron-up"></ha-icon>`;
      up.addEventListener("click", () => this._moveTab(index, -1));
      const down = document.createElement("button");
      down.className = "mini-button";
      down.title = lotusT("Descendre");
      down.disabled = index === this._tabs.items.length - 1;
      down.innerHTML = `<ha-icon icon="mdi:chevron-down"></ha-icon>`;
      down.addEventListener("click", () => this._moveTab(index, 1));
      const del = document.createElement("button");
      del.className = "mini-button danger";
      del.title = lotusT("Supprimer");
      del.disabled = this._tabs.items.length <= 1;
      del.innerHTML = `<ha-icon icon="mdi:delete-outline"></ha-icon>`;
      del.addEventListener("click", () => this._deleteTab(index));
      row.append(select, up, down, del);
      tabList.appendChild(row);
    });
    tabsSection.appendChild(tabList);
    left.appendChild(tabsSection);

    if (selected) {
      const selectedSection = document.createElement("section");
      selectedSection.innerHTML = `<h3>${lotusT("Onglet sélectionné")}</h3><p>${lotusT("Texte et icône peuvent être combinés. Une image remplace l’icône mais le texte peut rester affiché.")}</p>`;
      const tabForm = createHaForm({
        hass: this._hass,
        data: {
          name: selected.name,
          icon: selected.icon || undefined,
          image: normalizeMedia(selected.image),
          color: selected.color || "primary",
          text_color: selected.text_color || "white",
          active_color: selected.active_color || "accent",
          active_text_color: selected.active_text_color || "white",
          edge_corners: selected.edge_corners || DEFAULTS.edgeCorners,
          edge_radius: selected.edge_radius ?? DEFAULTS.edgeRadius,
          edge_fill: Boolean(selected.edge_fill),
        },
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "icon", selector: { icon: {} } },
          { name: "image", selector: { media: { accept: ["image/*"], clearable: true, image_upload: true, hide_content_type: true } } },
          { name: "color", selector: { ui_color: { include_none: true, include_state: false } } },
          { name: "text_color", selector: { ui_color: { include_none: true, include_state: false } } },
          { name: "active_color", selector: { ui_color: { include_none: true, include_state: false } } },
          { name: "active_text_color", selector: { ui_color: { include_none: true, include_state: false } } },
          { name: "edge_corners", selector: { select: { mode: "dropdown", options: this._edgeCornerOptions() } } },
          { name: "edge_radius", selector: { number: { min: 0, max: 50, step: 1, mode: "slider", unit_of_measurement: "%" } } },
          ...(((selected.edge_corners === "start" && this._selectedTabIndex > 0)
            || (selected.edge_corners === "end" && this._selectedTabIndex < this._tabs.items.length - 1))
            ? [{ name: "edge_fill", selector: { boolean: {} } }]
            : []),
        ],
        labels: {
          name: "Texte",
          icon: "Icône",
          image: "Image de l’onglet",
          color: "Couleur de l’onglet",
          text_color: "Couleur du texte / icône",
          active_color: "Couleur de l’onglet actif",
          active_text_color: "Couleur du texte / icône actif",
          edge_corners: "Coins arrondis côté écran",
          edge_radius: "Arrondi des coins",
          edge_fill: selected.edge_corners === "start"
            ? "Remplir avec l’onglet précédent"
            : "Remplir avec l’onglet suivant",
        },
        helpers: {
          edge_fill: "La couleur de l’onglet voisin est placée derrière l’arrondi, sans modifier les dimensions ni les zones cliquables.",
        },
        onChange: (value) => {
          selected.name = String(value.name ?? "");
          selected.icon = String(value.icon ?? "");
          selected.image = value.image ? deepClone(value.image) : undefined;
          selected.color = String(value.color ?? "none");
          selected.text_color = String(value.text_color ?? "none");
          selected.active_color = String(value.active_color ?? "none");
          selected.active_text_color = String(value.active_text_color ?? "none");
          const previousEdgeCorners = selected.edge_corners;
          selected.edge_corners = ["none", "start", "end", "both"].includes(value.edge_corners)
            ? value.edge_corners
            : DEFAULTS.edgeCorners;
          selected.edge_radius = round(clamp(value.edge_radius ?? DEFAULTS.edgeRadius, 0, 50));
          if (Object.prototype.hasOwnProperty.call(value, "edge_fill")) selected.edge_fill = Boolean(value.edge_fill);
          this._previewTabId = selected.id;
          const rowLabel = this.shadowRoot?.querySelector(`.tab-row[data-selected="true"] .tab-select span`);
          if (rowLabel) rowLabel.textContent = selected.name || `${lotusT("Onglet")} ${this._selectedTabIndex + 1}`;
          if (previousEdgeCorners !== selected.edge_corners) this._rerender();
          else this._refreshPreview();
        },
      });
      selectedSection.appendChild(tabForm);
      left.appendChild(selectedSection);

      const layoutSection = document.createElement("section");
      layoutSection.innerHTML = `<h3>${lotusT("Disposition des cartes")}</h3><p>${lotusT("Canvas libre conserve le positionnement en pourcentage sur un fond. Grille range automatiquement les cartes en tuiles responsives.")}</p>`;
      const layoutForm = createHaForm({
        hass: this._hass,
        data: { layout: selected.layout || DEFAULTS.layout },
        schema: [{ name: "layout", selector: { select: { mode: "dropdown", options: [
          { value: "canvas", label: "Canvas libre — fond + positionnement libre" },
          { value: "grid", label: "Grille responsive — cartes en tuiles" },
        ] } } }],
        labels: { layout: "Mode de l’onglet" },
        onChange: (value) => {
          const nextLayout = value.layout === "grid" ? "grid" : "canvas";
          if (nextLayout === selected.layout) return;
          selected.layout = nextLayout;
          this._previewTabId = selected.id;
          this._rerender();
        },
      });
      layoutSection.appendChild(layoutForm);
      left.appendChild(layoutSection);

      if (selected.layout === "grid") {
        const gridSection = document.createElement("section");
        gridSection.innerHTML = `<h3>${lotusT("Grille responsive")}</h3><p>${lotusT("Le nombre de colonnes s’adapte à la largeur disponible. Les cartes restent des cartes Home Assistant normales.")}</p>`;
        const gridForm = createHaForm({
          hass: this._hass,
          data: {
            min_width: selected.grid?.min_width ?? DEFAULTS.gridMinWidth,
            max_columns: selected.grid?.max_columns ?? DEFAULTS.gridMaxColumns,
            gap: selected.grid?.gap ?? DEFAULTS.gridGap,
            padding: selected.grid?.padding ?? DEFAULTS.gridPadding,
          },
          schema: [
            { name: "min_width", selector: { number: { min: 140, max: 800, step: 10, mode: "slider", unit_of_measurement: "px" } } },
            { name: "max_columns", selector: { number: { min: 1, max: 12, step: 1, mode: "slider" } } },
            { name: "gap", selector: { number: { min: 0, max: 64, step: 2, mode: "slider", unit_of_measurement: "px" } } },
            { name: "padding", selector: { number: { min: 0, max: 64, step: 2, mode: "slider", unit_of_measurement: "px" } } },
          ],
          labels: {
            min_width: "Largeur minimale d’une tuile",
            max_columns: "Nombre maximal de colonnes",
            gap: "Espacement entre les cartes",
            padding: "Marge autour de la grille",
          },
          helpers: {
            min_width: "Quand la largeur disponible devient insuffisante, Lotus réduit automatiquement le nombre de colonnes.",
          },
          onChange: (value) => {
            selected.grid = {
              min_width: Math.round(clamp(value.min_width ?? DEFAULTS.gridMinWidth, 140, 800)),
              max_columns: Math.round(clamp(value.max_columns ?? DEFAULTS.gridMaxColumns, 1, 12)),
              gap: Math.round(clamp(value.gap ?? DEFAULTS.gridGap, 0, 64)),
              padding: Math.round(clamp(value.padding ?? DEFAULTS.gridPadding, 0, 64)),
            };
            this._previewTabId = selected.id;
            this._refreshPreview();
          },
        });
        gridSection.appendChild(gridForm);
        left.appendChild(gridSection);
      }

      const canvasBackground = selected.layout !== "grid";
      const bgSection = document.createElement("section");
      bgSection.innerHTML = canvasBackground
        ? `<h3>${lotusT("Arrière-plan de cet onglet")}</h3><p>${lotusT("La couleur est facultative et s’affiche derrière l’image, ou seule si aucune image n’est définie. Les paramètres d’image restent ceux de Home Assistant.")}</p>`
        : `<h3>${lotusT("Arrière-plan de cet onglet")}</h3><p>${lotusT("En mode grille, la couleur de fond reste active. L’image d’arrière-plan est conservée mais n’est utilisée que lorsque l’onglet repasse en Canvas libre.")}</p>`;
      const bg = {
        fill_color: selected.fill_color || "none",
        image: normalizeMedia(selected.background?.image),
        opacity: Number(selected.background?.opacity ?? 100),
        attachment: selected.background?.attachment || "scroll",
        size: selected.background?.size || "cover",
        alignment: selected.background?.alignment || "center",
        repeat: selected.background?.repeat || "no-repeat",
      };
      const backgroundSchema = [
        { name: "fill_color", selector: { ui_color: { include_none: true, include_state: false } } },
        ...(canvasBackground ? [
          { name: "image", selector: { media: { accept: ["image/*"], clearable: true, image_upload: true, hide_content_type: true } } },
          { name: "opacity", selector: { number: { min: 0, max: 100, step: 10, mode: "slider", unit_of_measurement: "%" } } },
          { name: "attachment", selector: { select: { mode: "dropdown", options: [
            { value: "scroll", label: "Défilement" }, { value: "fixed", label: "Fixe" },
          ] } } },
          { name: "size", selector: { select: { mode: "dropdown", options: [
            { value: "auto", label: "Automatique" }, { value: "cover", label: "Couvrir" }, { value: "contain", label: "Contenir" },
          ] } } },
          { name: "alignment", selector: { select: { mode: "dropdown", options: [
            "top left", "top center", "top right", "center left", "center", "center right", "bottom left", "bottom center", "bottom right",
          ] } } },
          { name: "repeat", selector: { select: { mode: "dropdown", options: [
            { value: "no-repeat", label: "Ne pas répéter" }, { value: "repeat", label: "Répéter" },
          ] } } },
        ] : []),
      ];
      const bgForm = createHaForm({
        hass: this._hass,
        data: bg,
        schema: backgroundSchema,
        labels: {
          fill_color: "Couleur de fond",
          image: "Image d’arrière-plan",
          opacity: "Opacité",
          attachment: "Déplacement",
          size: "Dimensionnement",
          alignment: "Alignement",
          repeat: "Répétition",
        },
        helpers: {
          fill_color: "Facultative. Elle remplit l’espace de l’onglet derrière l’image ou sans image.",
        },
        onChange: (value) => {
          selected.fill_color = String(value.fill_color ?? "none");
          if (canvasBackground) {
            const image = value.image ? deepClone(value.image) : undefined;
            if (!image) {
              selected.background = undefined;
            } else {
              selected.background = {
                image,
                opacity: Number(value.opacity ?? 100),
                attachment: value.attachment || "scroll",
                size: value.size || "cover",
                alignment: value.alignment || "center",
                repeat: value.repeat || "no-repeat",
              };
            }
          }
          this._previewTabId = selected.id;
          this._refreshPreview();
        },
      });
      bgSection.appendChild(bgForm);
      left.appendChild(bgSection);
    }


    const previewTitle = document.createElement("div");
    previewTitle.className = "preview-title";
    previewTitle.textContent = lotusT("Aperçu des onglets");
    right.appendChild(previewTitle);
    this._renderPreview(right);

    content.append(left, right);
    const footer = document.createElement("div");
    footer.className = "footer";
    const status = document.createElement("div");
    status.className = "save-status";
    const cancel = document.createElement("button");
    cancel.className = "text-button";
    cancel.textContent = lotusT("Annuler");
    cancel.addEventListener("click", () => this._close());
    const save = document.createElement("button");
    save.className = "text-button save primary";
    save.textContent = lotusT("Enregistrer");
    save.addEventListener("click", () => this._save());
    footer.append(status, cancel, save);

    dialog.append(header, content, footer);
    root.appendChild(dialog);

    const style = document.createElement("style");
    style.textContent = `
      ${lotusThemeCss}
      :host { position:fixed; inset:0; z-index:100004; display:block; font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif); }
      .overlay { position:absolute; inset:0; display:grid; place-items:center; padding:18px; box-sizing:border-box; background:rgba(0,0,0,.48); }
      .dialog { width:min(1180px,96vw); height:min(860px,94vh); display:grid; grid-template-rows:auto minmax(0,1fr) auto; overflow:hidden; border-radius:20px; background:var(--card-background-color,var(--ha-card-background,#fff)); color:var(--primary-text-color,#212121); box-shadow:0 24px 80px rgba(0,0,0,.42); }
      .header { position:relative; padding:18px 62px 14px 22px; border-bottom:1px solid var(--divider-color,rgba(127,127,127,.25)); }
      .title { font-size:20px; font-weight:700; }
      .subtitle { margin-top:3px; color:var(--secondary-text-color,#727272); font-size:12px; }
      .close { position:absolute; right:12px; top:11px; }
      .content { display:grid; grid-template-columns:minmax(480px,3fr) minmax(330px,2fr); gap:18px; min-height:0; padding:14px; }
      .left-pane { min-height:0; overflow-y:auto; overflow-x:hidden; padding-right:8px; scrollbar-gutter:stable; }
      .right-pane { min-width:0; min-height:0; position:relative; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--divider-color,rgba(127,127,127,.25)); border-radius:16px; background:var(--secondary-background-color,#f5f5f5); }
      section { padding:14px 4px 18px; border-bottom:1px solid var(--divider-color,rgba(127,127,127,.22)); }
      section:first-child { padding-top:2px; }
      section h3 { margin:0 0 4px; font-size:16px; }
      section p { margin:0 0 10px; color:var(--secondary-text-color,#727272); font-size:12px; line-height:1.4; }
      .section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .section-head > div { flex:1; }
      .tab-list { display:grid; gap:6px; }
      .tab-row { display:grid; grid-template-columns:minmax(0,1fr) 34px 34px 34px; gap:4px; align-items:center; border:1px solid var(--divider-color,rgba(127,127,127,.24)); border-radius:10px; padding:4px; }
      .tab-row[data-selected="true"] { border-color:var(--primary-color,#03a9f4); box-shadow:0 0 0 1px color-mix(in srgb,var(--primary-color,#03a9f4) 35%,transparent); }
      .tab-select { appearance:none; min-width:0; min-height:38px; display:flex; align-items:center; gap:8px; padding:6px 8px; border:0; border-radius:8px; background:transparent; color:inherit; cursor:pointer; text-align:left; }
      .tab-select span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .mini-button,.icon-button { appearance:none; display:grid; place-items:center; padding:0; border:0; border-radius:9px; background:transparent; color:inherit; cursor:pointer; }
      .mini-button { width:34px; height:34px; }
      .icon-button { width:40px; height:40px; }
      .mini-button:hover:not(:disabled),.icon-button:hover:not(:disabled) { background:rgba(127,127,127,.12); }
      .mini-button:disabled { opacity:.28; cursor:default; }
      .danger:hover:not(:disabled) { color:var(--error-color,#db4437); }
      .primary { background:var(--primary-color,#03a9f4)!important; color:var(--text-primary-color,#fff)!important; }
      .preview-title { flex:0 0 auto; padding:10px 12px; text-align:center; font-size:12px; font-weight:700; color:var(--secondary-text-color,#727272); }
      .screen-preview { position:relative; flex:1 1 auto; min-height:0; margin:0 10px 10px; overflow:hidden; border-radius:12px; background:var(--scene-fill,var(--primary-background-color,#fafafa)); }
      .scene-preview { position:absolute; overflow:hidden; background:var(--scene-fill,var(--primary-background-color,#fafafa)); }
      .scene-background { position:absolute!important; inset:0!important; width:100%!important; height:100%!important; pointer-events:none; }
      .scene-background-guide {
        position:absolute; inset:0; z-index:2; box-sizing:border-box; pointer-events:none;
        border:2px dashed #ffb300;
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), inset 0 0 0 3px rgba(255,255,255,.72);
      }
      .scene-info { position:absolute; inset:0; z-index:3; display:grid; place-items:center; align-content:center; gap:8px; color:var(--secondary-text-color,#727272); pointer-events:none; }
      .scene-info ha-icon { --mdc-icon-size:42px; opacity:.5; }
      .grid-layout-preview { position:absolute; inset:12px; display:grid; grid-template-columns:repeat(var(--grid-columns,3),minmax(0,1fr)); grid-auto-rows:minmax(42px,1fr); gap:var(--grid-gap,4px); align-content:start; overflow:hidden; }
      .grid-layout-tile { min-width:0; min-height:42px; display:grid; place-items:center; border:1px solid color-mix(in srgb,var(--primary-color,#03a9f4) 28%,var(--divider-color,rgba(127,127,127,.24))); border-radius:8px; background:var(--card-background-color,#fff); color:var(--secondary-text-color,#727272); box-shadow:0 1px 3px rgba(0,0,0,.06); }
      .grid-layout-tile ha-icon { --mdc-icon-size:22px; opacity:.55; }
      .tabs-preview-bar { position:absolute; z-index:4; display:flex; gap:0; }
      .screen-preview[data-enabled="false"] .tabs-preview-bar { display:none; }
      .screen-preview[data-enabled="false"] .scene-preview { inset:0; }
      .screen-preview[data-position="top"] .scene-preview { left:0; right:0; top:var(--preview-depth,7%); bottom:0; }
      .screen-preview[data-position="bottom"] .scene-preview { left:0; right:0; top:0; bottom:var(--preview-depth,7%); }
      .screen-preview[data-position="left"] .scene-preview { left:var(--preview-depth,7%); right:0; top:0; bottom:0; }
      .screen-preview[data-position="right"] .scene-preview { left:0; right:var(--preview-depth,7%); top:0; bottom:0; }
      .tabs-preview-bar[data-position="top"],.tabs-preview-bar[data-position="bottom"] { width:var(--span); height:max(34px,var(--thickness)); flex-direction:row; left:var(--offset); }
      .tabs-preview-bar[data-position="top"] { top:0; }
      .tabs-preview-bar[data-position="bottom"] { bottom:0; }
      .tabs-preview-bar[data-position="left"],.tabs-preview-bar[data-position="right"] { width:max(42px,var(--thickness)); height:var(--span); flex-direction:column; top:var(--offset); }
      .tabs-preview-bar[data-position="left"] { left:0; }
      .tabs-preview-bar[data-position="right"] { right:0; }
      .tab-preview-slot { position:relative; flex:1 1 0; min-width:0; min-height:0; display:flex; background:var(--tab-underlay,transparent); }
      .tab-preview-button { appearance:none; position:relative; z-index:1; flex:1 1 auto; width:100%; height:100%; min-width:0; min-height:0; display:flex; align-items:center; justify-content:center; gap:5px; padding:4px 6px; overflow:hidden; border:0; border-right:1px solid color-mix(in srgb,var(--tab-fg) 18%,transparent); background:var(--tab-bg); color:var(--tab-fg); cursor:pointer; font-size:11px; }
      .tab-preview-button.vertical { flex-direction:column; border-right:0; border-bottom:1px solid color-mix(in srgb,var(--tab-fg) 18%,transparent); }
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-suppress-divider="true"],
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-suppress-divider="true"] { border-right:0; }
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-suppress-divider="true"],
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-suppress-divider="true"] { border-bottom:0; }
      .tab-edge-border { position:absolute; z-index:3; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; fill:none; }
      .tab-edge-border path { fill:none; stroke:var(--tab-edge-stroke,var(--divider-color,rgba(127,127,127,.24))); stroke-width:var(--tab-edge-width,1); vector-effect:non-scaling-stroke; stroke-linecap:butt; stroke-linejoin:round; }
      .tab-preview-button[data-active="true"] {
        --tab-active-outline:color-mix(in srgb,var(--tab-fg) 36%,transparent);
        box-shadow:inset 0 2px 0 var(--tab-active-outline), inset 0 -2px 0 var(--tab-active-outline), inset 2px 0 0 var(--tab-active-outline), inset -2px 0 0 var(--tab-active-outline);
      }
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-active="true"][data-suppress-divider="true"],
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-active="true"][data-suppress-divider="true"] {
        box-shadow:inset 0 2px 0 var(--tab-active-outline), inset 0 -2px 0 var(--tab-active-outline), inset 2px 0 0 var(--tab-active-outline);
      }
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-active="true"][data-suppress-divider="true"],
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-active="true"][data-suppress-divider="true"] {
        box-shadow:inset 0 2px 0 var(--tab-active-outline), inset 2px 0 0 var(--tab-active-outline), inset -2px 0 0 var(--tab-active-outline);
      }
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-edge-corners="start"],
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-edge-corners="both"] { border-top-left-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-edge-corners="end"],
      .tabs-preview-bar[data-position="top"] .tab-preview-button[data-edge-corners="both"] { border-top-right-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-edge-corners="start"],
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-edge-corners="both"] { border-bottom-left-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-edge-corners="end"],
      .tabs-preview-bar[data-position="bottom"] .tab-preview-button[data-edge-corners="both"] { border-bottom-right-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-edge-corners="start"],
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-edge-corners="both"] { border-top-left-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-edge-corners="end"],
      .tabs-preview-bar[data-position="left"] .tab-preview-button[data-edge-corners="both"] { border-bottom-left-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-edge-corners="start"],
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-edge-corners="both"] { border-top-right-radius:var(--tab-edge-radius); }
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-edge-corners="end"],
      .tabs-preview-bar[data-position="right"] .tab-preview-button[data-edge-corners="both"] { border-bottom-right-radius:var(--tab-edge-radius); }
      .tab-preview-button span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .tab-media { display:block; width:24px; height:24px; flex:0 0 24px; border-radius:4px; overflow:hidden; }
      .footer { min-height:64px; display:flex; align-items:center; justify-content:flex-end; gap:8px; padding:8px 14px; border-top:1px solid var(--divider-color,rgba(127,127,127,.25)); }
      .save-status { margin-right:auto; color:var(--error-color,#db4437); font-size:12px; }
      .text-button { appearance:none; min-height:40px; padding:0 16px; border:0; border-radius:20px; background:transparent; color:var(--primary-color,#03a9f4); font-weight:650; cursor:pointer; }
      .text-button:hover:not(:disabled) { background:rgba(127,127,127,.1); }
      .text-button:disabled { opacity:.45; cursor:default; }
      @media (max-width:900px) {
        .dialog { width:98vw; height:96vh; }
        .content { grid-template-columns:1fr; }
        .right-pane { order:-1; min-height:260px; max-height:36vh; }
      }
    `;

    this.shadowRoot.replaceChildren(style, root);
    const screen = this.shadowRoot.querySelector(".screen-preview");
    if (screen) screen.style.setProperty("--preview-depth", `${this._tabs.thickness}%`);
    this._updateSaveState();
  }
}

if (!customElements.get("lotus-tabs-editor-overlay")) {
  customElements.define("lotus-tabs-editor-overlay", LotusTabsEditorOverlay);
}

export const openLotusTabsEditor = (params) => {
  document.querySelectorAll("lotus-tabs-editor-overlay").forEach((node) => node.remove());
  const overlay = document.createElement("lotus-tabs-editor-overlay");
  document.body.appendChild(overlay);
  overlay.open(params);
  return overlay;
};
