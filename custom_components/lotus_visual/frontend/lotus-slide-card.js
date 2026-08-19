/*
 * Lotus Slide 1.1.0
 * Slide-to-confirm Lovelace card for Lotus Visual.
 *
 * The card uses Home Assistant native ui_action configuration for the action
 * executed once the handle reaches the validation threshold and is released.
 */

import { deepClone, clamp } from "./lotus-core.js?v=0.9.6";
import { lotusLocalizeSelector, lotusSetHass, lotusT } from "./lotus-i18n.js?v=0.9.6";

const LOTUS_SLIDE_VERSION = "1.1.0";
const LOTUS_SLIDE_TYPE = "custom:lotus-slide-card";
const HA_THEME_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey",
  "grey", "dark-grey", "blue-grey", "black", "white", "primary-text",
  "secondary-text", "disabled",
]);

const clone = (value) => deepClone(value);
const num = (value, fallback, min, max) => {
  const parsed = Number(value);
  return clamp(Number.isFinite(parsed) ? parsed : fallback, min, max);
};

const colorCss = (value, fallback = "var(--primary-color, #03a9f4)") => {
  const color = String(value ?? "").trim();
  if (!color || color === "none") return fallback;
  if (color === "state") return fallback;
  if (color === "primary") return "var(--primary-color, #03a9f4)";
  if (color === "accent") return "var(--accent-color, var(--primary-color, #03a9f4))";
  if (color === "primary-text") return "var(--primary-text-color, #212121)";
  if (color === "secondary-text") return "var(--secondary-text-color, #727272)";
  if (color === "disabled") return "var(--disabled-text-color, #9e9e9e)";
  if (HA_THEME_COLORS.has(color)) return `var(--${color}-color, ${fallback})`;
  return color;
};

// Slider geometry: a rectangular body can be chamfered into an octagon.
// The editor exposes 0..50, but 50 maps to a safe 36% of the short side so
// every side keeps a visible straight segment (minimum 28% on a square thumb).
const SLIDER_CHAMFER_MAX_SHORT_FRACTION = 0.36;
const SLIDER_ROUND_MAX_EDGE_FRACTION = 0.36;

const pointDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pointTowards = (from, to, distance) => {
  const length = pointDistance(from, to);
  if (!(length > 0)) return [from[0], from[1]];
  const ratio = Math.min(1, Math.max(0, distance / length));
  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
  ];
};

const chamferedRectPoints = (width, height, bevelPercent) => {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const shortSide = Math.min(w, h);
  const safe = clamp(Number(bevelPercent) || 0, 0, 50) / 50;
  const bevel = Math.min(shortSide * SLIDER_CHAMFER_MAX_SHORT_FRACTION * safe, w / 2, h / 2);
  if (!(bevel > 0.01)) return [[0, 0], [w, 0], [w, h], [0, h]];
  return [
    [bevel, 0], [w - bevel, 0],
    [w, bevel], [w, h - bevel],
    [w - bevel, h], [bevel, h],
    [0, h - bevel], [0, bevel],
  ];
};

const roundedPolygonPath = (points, roundingPercent) => {
  const rounding = clamp(Number(roundingPercent) || 0, 0, 50) / 50;
  if (!Array.isArray(points) || points.length < 3 || rounding <= 0) return "";
  const corners = points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousLength = pointDistance(vertex, previous);
    const nextLength = pointDistance(vertex, next);
    const offset = rounding * SLIDER_ROUND_MAX_EDGE_FRACTION * Math.min(previousLength, nextLength);
    return {
      vertex,
      incoming: pointTowards(vertex, previous, Math.min(offset, previousLength * SLIDER_ROUND_MAX_EDGE_FRACTION)),
      outgoing: pointTowards(vertex, next, Math.min(offset, nextLength * SLIDER_ROUND_MAX_EDGE_FRACTION)),
    };
  });
  const fmt = (point) => `${point[0].toFixed(3)} ${point[1].toFixed(3)}`;
  let path = `M ${fmt(corners[0].outgoing)}`;
  for (let index = 1; index < corners.length; index += 1) {
    const corner = corners[index];
    path += ` L ${fmt(corner.incoming)} Q ${fmt(corner.vertex)} ${fmt(corner.outgoing)}`;
  }
  const first = corners[0];
  path += ` L ${fmt(first.incoming)} Q ${fmt(first.vertex)} ${fmt(first.outgoing)} Z`;
  return path;
};

const polygonMask = (points, roundingPercent, width, height) => {
  const path = roundedPolygonPath(points, roundingPercent);
  const d = path || `M ${points.map((point, index) => `${index ? "L" : ""} ${point[0].toFixed(3)} ${point[1].toFixed(3)}`).join(" ")} Z`;
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(3)} ${h.toFixed(3)}" preserveAspectRatio="none"><path fill="white" d="${d}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const applyChamferShape = (node, width, height, bevelPercent, roundingPercent, borderWidth = 0) => {
  if (!node) return false;
  const bevel = clamp(Number(bevelPercent) || 0, 0, 50);
  if (!(bevel > 0)) {
    node.removeAttribute("data-chamfered");
    node.style.removeProperty("clip-path");
    node.style.removeProperty("--slide-inner-mask");
    return false;
  }
  const points = chamferedRectPoints(width, height, bevel);
  const rounded = roundedPolygonPath(points, roundingPercent);
  const polygon = `polygon(${points.map((point) => `${point[0].toFixed(3)}px ${point[1].toFixed(3)}px`).join(",")})`;
  let clip = polygon;
  if (rounded) {
    const candidate = `path("${rounded}")`;
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function" || CSS.supports("clip-path", candidate)) clip = candidate;
  }
  node.style.clipPath = clip;
  node.dataset.chamfered = "true";

  const inset = Math.max(0, Number(borderWidth) || 0);
  const innerWidth = Math.max(1, width - 2 * inset);
  const innerHeight = Math.max(1, height - 2 * inset);
  const innerPoints = chamferedRectPoints(innerWidth, innerHeight, bevel);
  node.style.setProperty("--slide-inner-mask", polygonMask(innerPoints, roundingPercent, innerWidth, innerHeight));
  return true;
};

const defaultIcon = (icon = "", size = 42, start = "secondary-text", end = "primary", dynamic = true) => ({
  icon,
  size,
  dynamic,
  color_start: start,
  color_end: end,
});

const baseConfig = () => ({
  type: LOTUS_SLIDE_TYPE,
  orientation: "horizontal",
  reverse: false,
  entity: "",
  threshold: 90,
  reset_delay: 650,
  design: { width: 100, height: 18 },
  track: {
    thickness: 72,
    background_color: "light-grey",
    fill_color: "primary",
    border_color: "primary",
    border_width: 1,
    radius: 50,
    bevel: 0,
  },
  thumb: {
    size: 88,
    background_color: "primary",
    border_color: "white",
    border_width: 2,
    radius: 50,
  },
  icons: {
    start: defaultIcon("mdi:lock-outline", 42, "secondary-text", "primary", true),
    end: defaultIcon("mdi:lock-open-variant-outline", 42, "secondary-text", "green", true),
    thumb: defaultIcon("mdi:chevron-double-right", 46, "white", "white", false),
  },
  text: {
    label: "Glisser pour valider",
    success_label: "Relâcher pour valider",
    color: "primary-text",
    success_color: "primary",
    font_size: 14,
  },
  action: { action: "none" },
});

const normalizeIcon = (source, fallback) => ({
  icon: String(source?.icon ?? fallback.icon ?? ""),
  size: num(source?.size, fallback.size, 12, 100),
  dynamic: source?.dynamic !== false,
  color_start: String(source?.color_start ?? fallback.color_start),
  color_end: String(source?.color_end ?? fallback.color_end),
});

const normalize = (raw) => {
  const defaults = baseConfig();
  const orientation = raw?.orientation === "vertical" ? "vertical" : "horizontal";
  const defaultDesign = orientation === "vertical" ? { width: 18, height: 100 } : { width: 100, height: 18 };
  const sourceDesign = raw?.design && typeof raw.design === "object" ? raw.design : {};
  const sourceTrack = raw?.track && typeof raw.track === "object" ? raw.track : {};
  const sourceThumb = raw?.thumb && typeof raw.thumb === "object" ? raw.thumb : {};
  const sourceIcons = raw?.icons && typeof raw.icons === "object" ? raw.icons : {};
  const sourceText = raw?.text && typeof raw.text === "object" ? raw.text : {};

  let designWidth = num(sourceDesign.width, defaultDesign.width, 5, 200);
  let designHeight = num(sourceDesign.height, defaultDesign.height, 5, 200);
  // A slider body must remain elongated: the travel axis is always strictly
  // longer than the cross axis, even after a manual YAML edit.
  if (orientation === "horizontal" && designWidth <= designHeight) {
    if (designHeight < 200) designWidth = designHeight + 1;
    else designHeight = Math.max(5, designWidth - 1);
  } else if (orientation === "vertical" && designHeight <= designWidth) {
    if (designWidth < 200) designHeight = designWidth + 1;
    else designWidth = Math.max(5, designHeight - 1);
  }

  return {
    ...defaults,
    ...clone(raw || {}),
    type: LOTUS_SLIDE_TYPE,
    orientation,
    reverse: raw?.reverse === true,
    entity: String(raw?.entity ?? ""),
    threshold: num(raw?.threshold, 90, 55, 100),
    reset_delay: num(raw?.reset_delay, 650, 0, 5000),
    design: {
      width: designWidth,
      height: designHeight,
    },
    track: {
      thickness: num(sourceTrack.thickness, 72, 18, 100),
      background_color: String(sourceTrack.background_color ?? defaults.track.background_color),
      fill_color: String(sourceTrack.fill_color ?? defaults.track.fill_color),
      border_color: String(sourceTrack.border_color ?? defaults.track.border_color),
      border_width: num(sourceTrack.border_width, 1, 0, 12),
      radius: num(sourceTrack.radius, 50, 0, 50),
      bevel: num(sourceTrack.bevel, defaults.track.bevel, 0, 50),
    },
    thumb: {
      size: num(sourceThumb.size, 88, 35, 160),
      background_color: String(sourceThumb.background_color ?? defaults.thumb.background_color),
      border_color: String(sourceThumb.border_color ?? defaults.thumb.border_color),
      border_width: num(sourceThumb.border_width, 2, 0, 12),
      radius: num(sourceThumb.radius, 50, 0, 50),
    },
    icons: {
      start: normalizeIcon(sourceIcons.start, defaults.icons.start),
      end: normalizeIcon(sourceIcons.end, defaults.icons.end),
      thumb: normalizeIcon(sourceIcons.thumb, defaults.icons.thumb),
    },
    text: {
      label: String(sourceText.label ?? defaults.text.label),
      success_label: String(sourceText.success_label ?? defaults.text.success_label),
      color: String(sourceText.color ?? defaults.text.color),
      success_color: String(sourceText.success_color ?? defaults.text.success_color),
      font_size: num(sourceText.font_size, 14, 8, 36),
    },
    action: raw?.action && typeof raw.action === "object" ? clone(raw.action) : { action: "none" },
  };
};

class LotusSlideCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("lotus-slide-card-editor");
  }

  static getStubConfig() {
    return baseConfig();
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = normalize(baseConfig());
    this._hass = undefined;
    this._preview = false;
    this._progress = 0;
    this._dragging = false;
    this._busy = false;
    this._resizeObserver = new ResizeObserver(() => this._updateGeometry());
  }

  connectedCallback() {
    this._render();
    this._resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration Lotus Slide manquante.");
    this._config = normalize(config);
    this._progress = 0;
    this._render();
  }

  set hass(hass) {
    lotusSetHass(hass);
    this._hass = hass;
  }
  get hass() { return this._hass; }

  set preview(value) {
    this._preview = Boolean(value);
  }
  get preview() { return this._preview; }

  getCardSize() {
    const ratio = this._config.design.height / Math.max(1, this._config.design.width);
    return Math.max(1, Math.ceil(3 * ratio));
  }

  getGridOptions() {
    const ratio = this._config.design.height / Math.max(1, this._config.design.width);
    return {
      columns: this._config.orientation === "vertical" ? 2 : 6,
      rows: Math.max(1, Math.round(6 * ratio)),
      min_columns: 1,
      max_columns: 12,
      min_rows: 1,
    };
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  async _executeAction(actionConfig) {
    if (!this._hass || this._preview || this._busy) return;
    const config = actionConfig && typeof actionConfig === "object" ? actionConfig : { action: "none" };
    const action = String(config.action ?? "none");
    if (!action || action === "none") return;

    const entityId = config.entity || this._config.entity;
    this._busy = true;
    this.setAttribute("busy", "");
    try {
      if (action === "more-info") {
        this._fireMoreInfo(entityId);
      } else if (action === "toggle") {
        if (entityId) await this._hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
      } else if (action === "navigate") {
        const path = String(config.navigation_path ?? "").trim();
        if (path) {
          window.history.pushState(null, "", path);
          window.dispatchEvent(new Event("location-changed"));
        }
      } else if (action === "url") {
        const url = String(config.url_path ?? config.url ?? "").trim();
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      } else if (action === "perform-action" || action === "call-service") {
        const serviceName = String(config.perform_action ?? config.service ?? "").trim();
        if (serviceName.includes(".")) {
          const dot = serviceName.indexOf(".");
          const domain = serviceName.slice(0, dot);
          const service = serviceName.slice(dot + 1);
          const data = config.data ?? config.service_data ?? {};
          const target = config.target && typeof config.target === "object"
            ? config.target
            : entityId ? { entity_id: entityId } : {};
          await this._hass.callService(domain, service, data, target);
        }
      }
    } finally {
      const delay = this._config.reset_delay;
      window.setTimeout(() => {
        this._busy = false;
        this.removeAttribute("busy");
        this._setProgress(0);
      }, delay);
    }
  }

  _trackFraction(event) {
    const track = this.shadowRoot?.querySelector(".slide-track");
    if (!track) return this._progress;
    const rect = track.getBoundingClientRect();
    let value;
    if (this._config.orientation === "vertical") {
      value = 1 - ((event.clientY - rect.top) / Math.max(1, rect.height));
    } else {
      value = (event.clientX - rect.left) / Math.max(1, rect.width);
    }
    if (this._config.reverse) value = 1 - value;
    return clamp(value, 0, 1);
  }

  _setProgress(value) {
    this._progress = clamp(Number(value) || 0, 0, 1);
    this._updateGeometry();
  }

  _startDrag(event) {
    if (this._busy) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this._dragging = true;
    this.setAttribute("dragging", "");
    const thumb = event.currentTarget;
    thumb.setPointerCapture?.(event.pointerId);
    this._setProgress(this._trackFraction(event));
  }

  _moveDrag(event) {
    if (!this._dragging) return;
    event.preventDefault();
    this._setProgress(this._trackFraction(event));
  }

  _endDrag(event) {
    if (!this._dragging) return;
    event.preventDefault();
    this._dragging = false;
    this.removeAttribute("dragging");
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const accepted = this._progress * 100 >= this._config.threshold;
    if (accepted) {
      this._setProgress(1);
      if (this._preview) {
        window.setTimeout(() => this._setProgress(0), 450);
      } else {
        this._executeAction(this._config.action);
      }
    } else {
      this._setProgress(0);
    }
  }

  _keyDown(event) {
    if (this._busy) return;
    const step = event.shiftKey ? 0.1 : 0.05;
    const horizontal = this._config.orientation === "horizontal";
    const positive = horizontal ? "ArrowRight" : "ArrowUp";
    const negative = horizontal ? "ArrowLeft" : "ArrowDown";
    if (event.key === positive || event.key === negative) {
      event.preventDefault();
      let direction = event.key === positive ? 1 : -1;
      if (this._config.reverse) direction *= -1;
      this._setProgress(this._progress + direction * step);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      this._setProgress(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      this._setProgress(1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && this._progress * 100 >= this._config.threshold) {
      event.preventDefault();
      if (this._preview) window.setTimeout(() => this._setProgress(0), 450);
      else this._executeAction(this._config.action);
    }
  }

  _iconElement(kind, semanticClass) {
    const conf = this._config.icons[kind];
    const zone = document.createElement("div");
    zone.className = `slide-icon-zone ${semanticClass}`;
    zone.dataset.iconKind = kind;
    if (!conf.icon) {
      zone.classList.add("empty");
      return zone;
    }
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", conf.icon);
    icon.className = "slide-side-icon";
    zone.appendChild(icon);
    return zone;
  }

  _render() {
    if (!this.shadowRoot) return;
    const c = this._config;
    const isVertical = c.orientation === "vertical";
    const start = this._iconElement("start", "semantic-start");
    const end = this._iconElement("end", "semantic-end");

    const shell = document.createElement("div");
    shell.className = `slide-shell ${isVertical ? "vertical" : "horizontal"} ${c.reverse ? "reverse" : "normal"}`;

    const track = document.createElement("div");
    track.className = "slide-track";
    const fill = document.createElement("div");
    fill.className = "slide-fill";
    const label = document.createElement("div");
    label.className = "slide-label";
    const thumb = document.createElement("div");
    thumb.className = "slide-thumb";
    thumb.setAttribute("role", "slider");
    thumb.setAttribute("tabindex", "0");
    thumb.setAttribute("aria-valuemin", "0");
    thumb.setAttribute("aria-valuemax", "100");
    thumb.setAttribute("aria-label", c.text.label || "Glisser pour valider");

    if (c.icons.thumb.icon) {
      const thumbIcon = document.createElement("ha-icon");
      thumbIcon.setAttribute("icon", c.icons.thumb.icon);
      thumbIcon.className = "slide-thumb-icon";
      thumb.appendChild(thumbIcon);
    }

    thumb.addEventListener("pointerdown", (event) => this._startDrag(event));
    thumb.addEventListener("pointermove", (event) => this._moveDrag(event));
    thumb.addEventListener("pointerup", (event) => this._endDrag(event));
    thumb.addEventListener("pointercancel", (event) => this._endDrag(event));
    thumb.addEventListener("keydown", (event) => this._keyDown(event));

    track.append(fill, label, thumb);

    if (isVertical) {
      if (c.reverse) shell.append(start, track, end);
      else shell.append(end, track, start);
    } else {
      if (c.reverse) shell.append(end, track, start);
      else shell.append(start, track, end);
    }

    const card = document.createElement("ha-card");
    card.className = "slide-card";
    card.appendChild(shell);

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display:block;
        width:100%;
        height:100%;
        min-height:0;
        box-sizing:border-box;
        touch-action:none;
        container-type:size;
      }
      .slide-card {
        width:100%; height:100%; min-height:0; box-sizing:border-box;
        background:transparent; box-shadow:none; border:none; overflow:visible;
        aspect-ratio:${c.design.width} / ${c.design.height};
      }
      .slide-shell { width:100%; height:100%; min-height:0; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
      .slide-shell.horizontal { flex-direction:row; }
      .slide-shell.vertical { flex-direction:column; }
      .slide-icon-zone { flex:0 0 auto; display:grid; place-items:center; box-sizing:border-box; pointer-events:none; }
      .horizontal .slide-icon-zone { width:14%; height:100%; }
      .vertical .slide-icon-zone { width:100%; height:14%; }
      .slide-icon-zone.empty { width:0; height:0; }
      .slide-track {
        position:relative; flex:1 1 auto; min-width:0; min-height:0; box-sizing:border-box;
        background:${colorCss(c.track.background_color, "var(--secondary-background-color, #e5e7eb)")};
        border:${c.track.border_width}px solid ${colorCss(c.track.border_color)};
        overflow:hidden; isolation:isolate;
      }
      .slide-track[data-chamfered="true"] {
        border:0; background:${colorCss(c.track.border_color)};
      }
      .slide-track[data-chamfered="true"]::before {
        content:""; position:absolute; z-index:0; pointer-events:none;
        inset:${c.track.border_width}px;
        background:${colorCss(c.track.background_color, "var(--secondary-background-color, #e5e7eb)")};
        -webkit-mask-image:var(--slide-inner-mask); mask-image:var(--slide-inner-mask);
        -webkit-mask-size:100% 100%; mask-size:100% 100%;
        -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
        -webkit-mask-position:center; mask-position:center;
      }
      .horizontal .slide-track { height:${c.track.thickness}%; }
      .vertical .slide-track { width:${c.track.thickness}%; }
      .slide-fill { position:absolute; z-index:1; background:${colorCss(c.track.fill_color)}; pointer-events:none; }
      .slide-label {
        position:absolute; z-index:2; inset:0; display:grid; place-items:center; text-align:center; pointer-events:none;
        min-width:0; min-height:0; overflow:hidden; white-space:nowrap;
        padding:min(6px, 4cqw, 4cqh); box-sizing:border-box; font-size:${c.text.font_size}px; line-height:1.15; font-weight:600;
        color:${colorCss(c.text.color, "var(--primary-text-color,#212121)")};
        transition:color .12s ease;
      }
      .slide-thumb {
        position:absolute; display:grid; place-items:center; box-sizing:border-box; z-index:3;
        background:${colorCss(c.thumb.background_color)};
        border:${c.thumb.border_width}px solid ${colorCss(c.thumb.border_color, "#fff")};
        box-shadow:0 2px 8px rgba(0,0,0,.22); cursor:grab; user-select:none; -webkit-user-select:none;
        outline:none; transition:box-shadow .12s ease, transform .12s ease;
      }
      .slide-thumb[data-chamfered="true"] {
        border:0; background:${colorCss(c.thumb.border_color, "#fff")};
        isolation:isolate;
      }
      .slide-thumb[data-chamfered="true"]::before {
        content:""; position:absolute; z-index:0; pointer-events:none;
        inset:${c.thumb.border_width}px;
        background:${colorCss(c.thumb.background_color)};
        -webkit-mask-image:var(--slide-inner-mask); mask-image:var(--slide-inner-mask);
        -webkit-mask-size:100% 100%; mask-size:100% 100%;
        -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
        -webkit-mask-position:center; mask-position:center;
      }
      .slide-thumb-icon { position:relative; z-index:1; }
      :host([dragging]) .slide-thumb { cursor:grabbing; box-shadow:0 3px 12px rgba(0,0,0,.3); }
      .slide-thumb:focus-visible { box-shadow:0 0 0 3px color-mix(in srgb, var(--primary-color,#03a9f4) 35%, transparent), 0 2px 8px rgba(0,0,0,.22); }
      :host([busy]) .slide-thumb { opacity:.72; cursor:wait; }

      .slide-side-icon, .slide-thumb-icon { display:block; }
      .horizontal .slide-side-icon { --mdc-icon-size:min(${c.icons.start.size}cqh, ${c.icons.start.size}cqw); }
      .vertical .slide-side-icon { --mdc-icon-size:min(${c.icons.start.size}cqh, ${c.icons.start.size}cqw); }
    `;

    this.shadowRoot.replaceChildren(style, card);
    requestAnimationFrame(() => this._updateGeometry());
  }

  _applyIconStyle(kind, progress) {
    const conf = this._config.icons[kind];
    const target = kind === "thumb"
      ? this.shadowRoot?.querySelector(".slide-thumb-icon")
      : this.shadowRoot?.querySelector(`.slide-icon-zone[data-icon-kind="${kind}"] .slide-side-icon`);
    if (!target) return;
    const start = colorCss(conf.color_start, "var(--secondary-text-color,#727272)");
    const end = colorCss(conf.color_end, start);
    target.style.color = conf.dynamic
      ? `color-mix(in srgb, ${start} ${(1 - progress) * 100}%, ${end} ${progress * 100}%)`
      : start;
    const sizeBase = conf.size;
    const parentRect = target.parentElement?.getBoundingClientRect?.();
    const parentShortSide = Math.max(0, Math.min(Number(parentRect?.width) || 0, Number(parentRect?.height) || 0));
    if (parentShortSide > 0) {
      const px = Math.max(1, parentShortSide * (sizeBase / 100));
      target.style.setProperty("--mdc-icon-size", `${px}px`);
      target.style.width = `${px}px`;
      target.style.height = `${px}px`;
    }
  }

  _fitLabel(label) {
    if (!label) return;
    const maxSize = Math.max(1, Number(this._config.text.font_size) || 14);
    label.style.fontSize = `${maxSize}px`;
    const width = Math.max(0, label.clientWidth - 2 * (parseFloat(getComputedStyle(label).paddingLeft) || 0));
    const height = Math.max(0, label.clientHeight - 2 * (parseFloat(getComputedStyle(label).paddingTop) || 0));
    if (!(width > 0) || !(height > 0)) {
      label.style.fontSize = "1px";
      return;
    }
    const naturalWidth = Math.max(1, label.scrollWidth);
    const naturalHeight = Math.max(1, label.scrollHeight);
    const scale = Math.min(1, width / naturalWidth, height / naturalHeight);
    label.style.fontSize = `${Math.max(1, maxSize * scale)}px`;
    const secondWidth = Math.max(1, label.scrollWidth);
    if (secondWidth > width) {
      const current = Math.max(1, parseFloat(label.style.fontSize) || 1);
      label.style.fontSize = `${Math.max(1, current * width / secondWidth)}px`;
    }
  }

  _updateGeometry() {
    const root = this.shadowRoot;
    const track = root?.querySelector(".slide-track");
    const fill = root?.querySelector(".slide-fill");
    const thumb = root?.querySelector(".slide-thumb");
    const label = root?.querySelector(".slide-label");
    if (!track || !fill || !thumb || !label) return;

    const rect = track.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const vertical = this._config.orientation === "vertical";
    const cross = vertical ? rect.width : rect.height;
    const main = vertical ? rect.height : rect.width;
    const thumbExtent = Math.max(1, cross * (this._config.thumb.size / 100));

    // Existing 0.8.30 configurations keep their native rounded rectangle /
    // capsule geometry while bevel=0. As soon as bevel>0, the rail becomes an
    // eight-sided chamfered rectangle. The thumb receives the exact same side
    // count automatically; only its corner roundness remains independently
    // adjustable. Rounded chamfers are capped so no side can disappear.
    const trackShortSide = Math.max(0, Math.min(rect.width, rect.height));
    const bevel = Number(this._config.track.bevel) || 0;
    const trackChamfered = applyChamferShape(
      track, rect.width, rect.height, bevel, this._config.track.radius, this._config.track.border_width
    );
    const thumbChamfered = applyChamferShape(
      thumb, thumbExtent, thumbExtent, bevel, this._config.thumb.radius, this._config.thumb.border_width
    );

    if (!trackChamfered) {
      const trackRadiusPx = trackShortSide * (this._config.track.radius / 100);
      track.style.borderRadius = `${Math.min(trackShortSide / 2, trackRadiusPx)}px`;
    } else {
      track.style.borderRadius = "0px";
    }
    if (!thumbChamfered) {
      const thumbRadiusPx = thumbExtent * (this._config.thumb.radius / 100);
      thumb.style.borderRadius = `${Math.min(thumbExtent / 2, thumbRadiusPx)}px`;
    } else {
      thumb.style.borderRadius = "0px";
    }

    const travel = Math.max(0, main - thumbExtent);
    const p = clamp(this._progress, 0, 1);

    // p is always the semantic progress: 0 = start icon, 1 = end icon.
    // Horizontal coordinates grow left -> right, whereas the default vertical
    // direction grows bottom -> top. Convert the semantic progress to the
    // physical coordinate of the thumb centre for the current orientation.
    const visualP = vertical
      ? (this._config.reverse ? p : 1 - p)
      : (this._config.reverse ? 1 - p : p);
    const center = thumbExtent / 2 + visualP * travel;

    thumb.style.width = `${thumbExtent}px`;
    thumb.style.height = `${thumbExtent}px`;
    const fillInset = trackChamfered ? Math.max(0, Number(this._config.track.border_width) || 0) : 0;
    if (vertical) {
      thumb.style.left = "50%";
      thumb.style.top = `${center}px`;
      thumb.style.transform = "translate(-50%, -50%)";
      fill.style.left = `${fillInset}px`;
      fill.style.right = `${fillInset}px`;

      // The coloured progression ends exactly at the thumb centre. With a
      // chamfered body the fill stays inside the custom border so the complete
      // eight-sided outline remains visible.
      if (this._config.reverse) {
        fill.style.top = `${fillInset}px`;
        fill.style.bottom = "auto";
        fill.style.height = `${Math.max(0, Math.min(main - 2 * fillInset, center - fillInset))}px`;
      } else {
        fill.style.bottom = `${fillInset}px`;
        fill.style.top = "auto";
        fill.style.height = `${Math.max(0, Math.min(main - 2 * fillInset, main - center - fillInset))}px`;
      }
      fill.style.width = "auto";
    } else {
      thumb.style.top = "50%";
      thumb.style.left = `${center}px`;
      thumb.style.transform = "translate(-50%, -50%)";
      fill.style.top = `${fillInset}px`;
      fill.style.bottom = `${fillInset}px`;

      // Same rule horizontally: progression is anchored on the semantic start
      // edge and its other edge is the exact centre of the thumb.
      if (this._config.reverse) {
        fill.style.right = `${fillInset}px`;
        fill.style.left = "auto";
        fill.style.width = `${Math.max(0, Math.min(main - 2 * fillInset, main - center - fillInset))}px`;
      } else {
        fill.style.left = `${fillInset}px`;
        fill.style.right = "auto";
        fill.style.width = `${Math.max(0, Math.min(main - 2 * fillInset, center - fillInset))}px`;
      }
      fill.style.height = "auto";
    }

    const ready = p * 100 >= this._config.threshold;
    label.textContent = ready ? this._config.text.success_label : this._config.text.label;
    label.style.color = colorCss(ready ? this._config.text.success_color : this._config.text.color, "var(--primary-text-color,#212121)");
    thumb.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    thumb.setAttribute("aria-valuetext", ready ? this._config.text.success_label : `${Math.round(p * 100)} %`);

    this._fitLabel(label);
    this._applyIconStyle("start", p);
    this._applyIconStyle("end", p);
    this._applyIconStyle("thumb", p);
  }
}

class LotusSlideCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = normalize(baseConfig());
    this._restoreScrollTop = null;
    this._hostDialogStyle = null;
    this._hostDialogSyncRaf = 0;
  }

  connectedCallback() {
    this._scheduleHostDialogSinglePreview();
  }

  disconnectedCallback() {
    if (this._hostDialogSyncRaf) {
      cancelAnimationFrame(this._hostDialogSyncRaf);
      this._hostDialogSyncRaf = 0;
    }
    this._restoreHostDialogPreview();
  }

  _findHostEditDialog() {
    let node = this;
    const visited = new Set();
    while (node && !visited.has(node)) {
      visited.add(node);
      if (node.localName === "hui-dialog-edit-card") return node;
      const root = node.getRootNode?.();
      if (root?.host && root.host !== node) {
        node = root.host;
        continue;
      }
      node = node.parentElement;
    }
    return null;
  }

  _scheduleHostDialogSinglePreview() {
    if (this._hostDialogSyncRaf) cancelAnimationFrame(this._hostDialogSyncRaf);
    let attempts = 0;
    const sync = () => {
      this._hostDialogSyncRaf = 0;
      if (!this.isConnected) return;
      if (this._applyHostDialogSinglePreview()) return;
      attempts += 1;
      if (attempts < 12) this._hostDialogSyncRaf = requestAnimationFrame(sync);
    };
    this._hostDialogSyncRaf = requestAnimationFrame(sync);
  }

  _applyHostDialogSinglePreview() {
    const dialog = this._findHostEditDialog();
    const root = dialog?.shadowRoot;
    if (!root) return false;

    let style = root.querySelector('style[data-lotus-slide-single-preview="1"]');
    if (!style) {
      style = document.createElement("style");
      style.dataset.lotusSlideSinglePreview = "1";
      style.textContent = `
        /* Lotus Slide already owns its 60/40 live preview. Hide HA's duplicate. */
        .element-preview { display: none !important; }
        .content {
          height: var(--code-mirror-max-height) !important;
          max-height: var(--code-mirror-max-height) !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .content > .element-editor {
          flex-basis: 100% !important;
          flex-grow: 1 !important;
          flex-shrink: 1 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
          padding-inline-end: var(--ha-space-2) !important;
        }
        .content > .element-editor > hui-card-element-editor {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        @media (max-width: 980px), (max-height: 500px) {
          .content {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .content > .element-editor,
          .content > .element-editor > hui-card-element-editor {
            height: auto !important;
            overflow: visible !important;
          }
        }
      `;
      root.appendChild(style);
    }
    this._hostDialogStyle = style;
    return true;
  }

  _restoreHostDialogPreview() {
    if (this._hostDialogStyle?.isConnected) {
      this._hostDialogStyle.remove();
    } else {
      this._findHostEditDialog()?.shadowRoot
        ?.querySelector('style[data-lotus-slide-single-preview="1"]')
        ?.remove();
    }
    this._hostDialogStyle = null;
  }

  set hass(hass) {
    lotusSetHass(hass);
    this._hass = hass;
    this._syncPreview();
  }
  get hass() { return this._hass; }

  setConfig(config) {
    this._config = normalize(config);
    this._render();
  }

  _captureScroll() {
    const pane = this.shadowRoot?.querySelector(".config-pane");
    if (pane) this._restoreScrollTop = pane.scrollTop;
  }

  _restoreScroll() {
    const top = this._restoreScrollTop;
    if (top === null || top === undefined) return;
    const restore = () => {
      const pane = this.shadowRoot?.querySelector(".config-pane");
      if (pane) pane.scrollTop = top;
    };
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
    this._restoreScrollTop = null;
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: clone(this._config) },
    }));
  }

  _commit(mutator, { orientationChanged = false } = {}) {
    this._captureScroll();
    const next = normalize(this._config);
    mutator(next);
    if (orientationChanged) {
      const w = next.design.width;
      next.design.width = next.design.height;
      next.design.height = w;
      const thumbIcon = next.icons.thumb;
      if (thumbIcon?.icon === "mdi:chevron-double-right" && next.orientation === "vertical") thumbIcon.icon = "mdi:chevron-double-up";
      else if (thumbIcon?.icon === "mdi:chevron-double-up" && next.orientation === "horizontal") thumbIcon.icon = "mdi:chevron-double-right";
    }
    this._config = normalize(next);
    this._emit();
    this._render();
  }

  _section(title, description = "") {
    const section = document.createElement("section");
    section.className = "editor-section";
    const heading = document.createElement("h3");
    heading.textContent = lotusT(title);
    section.appendChild(heading);
    if (description) {
      const text = document.createElement("p");
      text.textContent = lotusT(description);
      section.appendChild(text);
    }
    return section;
  }

  _formField(parent, path, label, selector, value, onChange, context = undefined) {
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field";
      form.hass = this._hass;
      form.data = { value };
      form.schema = [{ name: "value", required: false, selector: lotusLocalizeSelector(selector) }];
      if (context) form.context = context;
      form.computeLabel = () => lotusT(label);
      form.dataset.fieldPath = path;
      form.addEventListener("value-changed", (event) => onChange(event.detail?.value?.value));
      parent.appendChild(form);
      return form;
    }

    const wrap = document.createElement("label");
    wrap.className = "fallback-field";
    const span = document.createElement("span");
    span.textContent = lotusT(label);
    const input = document.createElement("input");
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    wrap.append(span, input);
    parent.appendChild(wrap);
    return wrap;
  }

  _select(parent, path, label, value, options, onChange) {
    return this._formField(parent, path, label, {
      select: { options: options.map(([v, l]) => ({ value: v, label: lotusT(l) })), mode: "dropdown" },
    }, value, onChange);
  }

  _number(parent, path, label, value, min, max, step, onChange, mode = "slider") {
    return this._formField(parent, path, label, { number: { min, max, step, mode } }, value, onChange);
  }

  _boolean(parent, path, label, value, onChange) {
    return this._formField(parent, path, label, { boolean: {} }, Boolean(value), (next) => onChange(Boolean(next)));
  }

  _text(parent, path, label, value, onChange) {
    // Un champ texte est conservé jusqu'au changement de focus. Utiliser le
    // ha-form ici provoquerait un value-changed à chaque caractère et donc un
    // rerender complet de l'éditeur.
    const wrap = document.createElement("label");
    wrap.className = "fallback-field lotus-text-field";
    wrap.dataset.fieldPath = path;
    const span = document.createElement("span");
    span.textContent = lotusT(label);
    const input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(String(input.value ?? "")));
    wrap.append(span, input);
    parent.appendChild(wrap);
    return wrap;
  }

  _color(parent, path, label, value, onChange, includeState = false) {
    return this._formField(parent, path, label, {
      ui_color: { include_none: false, include_state: includeState, default_color: String(value || "primary") },
    }, value, (next) => onChange(String(next ?? "primary")));
  }

  _icon(parent, path, label, value, onChange) {
    return this._formField(parent, path, label, { icon: {} }, value, (next) => onChange(String(next ?? "")));
  }

  _entity(parent) {
    this._formField(parent, "entity", "Entité de contexte (facultatif)", { entity: {} }, this._config.entity || undefined, (value) => {
      this._commit((config) => { config.entity = String(value ?? ""); });
    });
  }

  _renderIconGroup(parent, kind, title) {
    const conf = this._config.icons[kind];
    const group = document.createElement("div");
    group.className = "subgroup";
    const h4 = document.createElement("h4");
    h4.textContent = lotusT(title);
    group.appendChild(h4);
    this._icon(group, `icons.${kind}.icon`, "Icône", conf.icon, (value) => this._commit((c) => { c.icons[kind].icon = value; }));
    this._number(group, `icons.${kind}.size`, "Taille de l’icône (%)", conf.size, 12, 100, 1, (value) => this._commit((c) => { c.icons[kind].size = Number(value); }));
    this._boolean(group, `icons.${kind}.dynamic`, "Couleur liée à la position du curseur", conf.dynamic, (value) => this._commit((c) => { c.icons[kind].dynamic = value; }));
    this._color(group, `icons.${kind}.color_start`, "Couleur au départ", conf.color_start, (value) => this._commit((c) => { c.icons[kind].color_start = value; }));
    if (conf.dynamic) {
      this._color(group, `icons.${kind}.color_end`, "Couleur à l’arrivée", conf.color_end, (value) => this._commit((c) => { c.icons[kind].color_end = value; }));
    }
    parent.appendChild(group);
  }

  _renderAction(parent) {
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field action-field";
      form.hass = this._hass;
      form.data = { action: clone(this._config.action) };
      form.context = this._config.entity ? { entity_id: this._config.entity } : undefined;
      form.schema = [{ name: "action", required: false, selector: { ui_action: { default_action: "none" } } }];
      form.computeLabel = () => lotusT("Action exécutée après validation");
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.action;
        this._commit((config) => { config.action = value && typeof value === "object" ? clone(value) : { action: "none" }; });
      });
      parent.appendChild(form);
    } else {
      const warning = document.createElement("p");
      warning.textContent = lotusT("L’éditeur d’action Home Assistant n’est pas disponible sur ce frontend.");
      parent.appendChild(warning);
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    const root = document.createElement("div");
    root.className = "editor-grid";
    const pane = document.createElement("div");
    pane.className = "config-pane";
    const previewPane = document.createElement("div");
    previewPane.className = "preview-pane";

    const general = this._section("Comportement", "Le curseur doit atteindre le seuil puis être relâché pour exécuter l’action.");
    this._select(general, "orientation", "Orientation", this._config.orientation, [["horizontal", "Horizontale"], ["vertical", "Verticale"]], (value) => {
      this._commit((config) => { config.orientation = value === "vertical" ? "vertical" : "horizontal"; }, { orientationChanged: true });
    });
    this._boolean(general, "reverse", this._config.orientation === "vertical" ? "Inverser le sens (haut → bas)" : "Inverser le sens (droite → gauche)", this._config.reverse, (value) => this._commit((c) => { c.reverse = value; }));
    this._number(general, "threshold", "Seuil de validation (%)", this._config.threshold, 55, 100, 1, (value) => this._commit((c) => { c.threshold = Number(value); }));
    this._number(general, "reset_delay", "Délai avant retour au départ (ms)", this._config.reset_delay, 0, 5000, 50, (value) => this._commit((c) => { c.reset_delay = Number(value); }), "box");
    this._entity(general);
    pane.appendChild(general);

    const format = this._section("Format responsive", "Le rapport largeur/hauteur sert de référence à Lotus Visual pour conserver les proportions de la carte.");
    this._number(format, "design.width", "Largeur de référence", this._config.design.width, 5, 200, 1, (value) => this._commit((c) => { c.design.width = Number(value); }), "box");
    this._number(format, "design.height", "Hauteur de référence", this._config.design.height, 5, 200, 1, (value) => this._commit((c) => { c.design.height = Number(value); }), "box");
    pane.appendChild(format);

    const track = this._section(
      "Corps / glissière du slider",
      "Le corps reste toujours allongé. Le biseau transforme le rectangle en octogone et peut être combiné avec un arrondi. Le bouton reprend automatiquement le même nombre de côtés."
    );
    this._number(track, "track.thickness", "Épaisseur du rail (%)", this._config.track.thickness, 18, 100, 1, (value) => this._commit((c) => { c.track.thickness = Number(value); }));
    this._color(track, "track.background_color", "Couleur du rail", this._config.track.background_color, (value) => this._commit((c) => { c.track.background_color = value; }));
    this._color(track, "track.fill_color", "Couleur de progression", this._config.track.fill_color, (value) => this._commit((c) => { c.track.fill_color = value; }));
    this._number(track, "track.border_width", "Épaisseur du contour (px)", this._config.track.border_width, 0, 12, 1, (value) => this._commit((c) => { c.track.border_width = Number(value); }));
    this._color(track, "track.border_color", "Couleur du contour", this._config.track.border_color, (value) => this._commit((c) => { c.track.border_color = value; }));
    this._number(track, "track.bevel", "Biseau des coins (0 = rectangle, 50 = octogone au biseau maximal sûr)", this._config.track.bevel, 0, 50, 1, (value) => this._commit((c) => { c.track.bevel = Number(value); }));
    this._number(
      track,
      "track.radius",
      this._config.track.bevel > 0
        ? "Arrondi des 8 sommets (sans supprimer les côtés)"
        : "Arrondi du rail (% du petit côté, max. demi-cercle)",
      this._config.track.radius, 0, 50, 1,
      (value) => this._commit((c) => { c.track.radius = Number(value); })
    );
    pane.appendChild(track);

    const thumb = this._section(
      "Bouton du slider",
      this._config.track.bevel > 0
        ? "Le bouton reprend automatiquement les 8 côtés du corps. Son arrondi reste réglable indépendamment."
        : "Lorsque le corps est biseauté, le bouton adopte automatiquement le même nombre de côtés."
    );
    this._number(thumb, "thumb.size", "Taille du bouton (%)", this._config.thumb.size, 35, 160, 1, (value) => this._commit((c) => { c.thumb.size = Number(value); }));
    this._color(thumb, "thumb.background_color", "Couleur du bouton", this._config.thumb.background_color, (value) => this._commit((c) => { c.thumb.background_color = value; }));
    this._number(thumb, "thumb.border_width", "Épaisseur du contour (px)", this._config.thumb.border_width, 0, 12, 1, (value) => this._commit((c) => { c.thumb.border_width = Number(value); }));
    this._color(thumb, "thumb.border_color", "Couleur du contour", this._config.thumb.border_color, (value) => this._commit((c) => { c.thumb.border_color = value; }));
    this._number(
      thumb,
      "thumb.radius",
      this._config.track.bevel > 0
        ? "Arrondi des 8 sommets du bouton (sans le transformer en cercle)"
        : "Arrondi du bouton (% du petit côté, max. demi-cercle)",
      this._config.thumb.radius, 0, 50, 1,
      (value) => this._commit((c) => { c.thumb.radius = Number(value); })
    );
    pane.appendChild(thumb);

    const icons = this._section("Icônes", "Chaque icône peut conserver une couleur fixe ou évoluer progressivement avec la position du curseur.");
    const startLabel = this._config.orientation === "vertical" ? "Icône de départ" : "Icône gauche / départ";
    const endLabel = this._config.orientation === "vertical" ? "Icône d’arrivée" : "Icône droite / arrivée";
    this._renderIconGroup(icons, "start", startLabel);
    this._renderIconGroup(icons, "end", endLabel);
    this._renderIconGroup(icons, "thumb", "Icône du bouton");
    pane.appendChild(icons);

    const text = this._section("Texte");
    this._text(text, "text.label", "Texte au repos", this._config.text.label, (value) => this._commit((c) => { c.text.label = value; }));
    this._text(text, "text.success_label", "Texte lorsque le seuil est atteint", this._config.text.success_label, (value) => this._commit((c) => { c.text.success_label = value; }));
    this._color(text, "text.color", "Couleur du texte", this._config.text.color, (value) => this._commit((c) => { c.text.color = value; }));
    this._color(text, "text.success_color", "Couleur du texte au seuil", this._config.text.success_color, (value) => this._commit((c) => { c.text.success_color = value; }));
    this._number(text, "text.font_size", "Taille du texte (px)", this._config.text.font_size, 8, 36, 1, (value) => this._commit((c) => { c.text.font_size = Number(value); }));
    pane.appendChild(text);

    const action = this._section("Action Home Assistant", "Lotus utilise ici l’éditeur d’action natif Home Assistant.");
    this._renderAction(action);
    pane.appendChild(action);

    const previewTitle = document.createElement("div");
    previewTitle.className = "preview-title";
    previewTitle.textContent = `Lotus Slide · ${LOTUS_SLIDE_VERSION}`;
    const previewFrame = document.createElement("div");
    previewFrame.className = `preview-frame ${this._config.orientation}`;
    const preview = document.createElement("lotus-slide-card");
    preview.className = "slide-preview";
    preview.setConfig(this._config);
    preview.hass = this._hass;
    preview.preview = true;
    previewFrame.appendChild(preview);
    previewPane.append(previewTitle, previewFrame);

    root.append(pane, previewPane);

    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; height:100%; max-height:100%; min-height:0; overflow:hidden; color:var(--primary-text-color,#212121); }
      .editor-grid { display:grid; grid-template-columns:minmax(460px,3fr) minmax(300px,2fr); gap:20px; min-height:0; height:100%; overflow:hidden; }
      .config-pane { height:100%; min-height:0; max-height:none; overflow-y:auto; overflow-x:hidden; padding-right:10px; scroll-behavior:auto; scrollbar-gutter:stable; }
      .preview-pane { min-width:0; min-height:0; height:100%; position:relative; display:flex; overflow:hidden; }
      .preview-title { position:absolute; top:8px; left:12px; right:12px; z-index:2; font-size:12px; font-weight:700; color:var(--secondary-text-color,#727272); text-align:center; pointer-events:none; }
      .preview-frame { position:relative; flex:1 1 auto; width:100%; height:100%; min-height:0; display:grid; place-items:center; padding:24px; box-sizing:border-box; border:1px solid var(--divider-color,rgba(127,127,127,.25)); border-radius:16px; background:var(--secondary-background-color,#f5f5f5); overflow:hidden; }
      .preview-frame.horizontal .slide-preview { width:min(100%,560px); height:auto; aspect-ratio:${this._config.design.width}/${this._config.design.height}; }
      .preview-frame.vertical .slide-preview { height:min(62vh,560px); width:auto; aspect-ratio:${this._config.design.width}/${this._config.design.height}; }
      .editor-section { padding:14px 0 18px; border-bottom:1px solid var(--divider-color,rgba(127,127,127,.22)); }
      .editor-section:first-child { padding-top:0; }
      .editor-section h3 { margin:0 0 6px; font-size:16px; }
      .editor-section > p { margin:0 0 12px; color:var(--secondary-text-color,#727272); font-size:12px; line-height:1.4; }
      .native-field { display:block; width:100%; margin:10px 0; }
      .subgroup { margin:12px 0; padding:12px; border:1px solid var(--divider-color,rgba(127,127,127,.22)); border-radius:12px; }
      .subgroup h4 { margin:0 0 8px; font-size:13px; }
      .fallback-field { display:grid; gap:5px; margin:10px 0; font-size:12px; }
      .fallback-field input { box-sizing:border-box; width:100%; min-height:40px; border:1px solid var(--divider-color); border-radius:8px; padding:8px; background:var(--card-background-color,#fff); color:inherit; }
      @media (max-width:980px) {
        :host { height:auto; max-height:none; overflow:visible; }
        .editor-grid { grid-template-columns:1fr; height:auto; overflow:visible; }
        .config-pane { height:auto; max-height:none; overflow:visible; padding-right:0; }
        .preview-pane { order:-1; height:auto; overflow:visible; display:block; }
        .preview-title { position:static; margin:0 0 10px; }
        .preview-frame { position:relative; height:auto; min-height:220px; flex:none; padding:24px; }
      }
    `;

    this.shadowRoot.replaceChildren(style, root);
    this._restoreScroll();
    this._scheduleHostDialogSinglePreview();
  }

  _syncPreview() {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card");
    if (preview) {
      preview.hass = this._hass;
      preview.preview = true;
    }
  }
}

if (!customElements.get("lotus-slide-card-editor")) customElements.define("lotus-slide-card-editor", LotusSlideCardEditor);
if (!customElements.get("lotus-slide-card")) customElements.define("lotus-slide-card", LotusSlideCard);

window.LotusSlide = Object.assign(window.LotusSlide || {}, {
  version: LOTUS_SLIDE_VERSION,
  type: LOTUS_SLIDE_TYPE,
  getStubConfig: () => clone(baseConfig()),
});

console.info(
  `%c LOTUS SLIDE %c v${LOTUS_SLIDE_VERSION} `,
  "color:white;background:#1565c0;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px;",
  "color:#1565c0;background:#e3f2fd;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0;",
);
