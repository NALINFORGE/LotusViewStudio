/*
 * Lotus Digicode 1.3.7
 * Configurable keypad / PIN validation card for Lotus View Studio.
 *
 * Three PIN security levels are supported:
 * 1) Home Assistant numeric entity (legacy/frontend-visible),
 * 2) server-side plaintext PIN,
 * 3) application-layer RSA-OAEP transport + server-side salted PIN hash.
 */

import { deepClone, clamp } from "./lotus-core.js?v=0.13.0b3";
import { lotusDebug, lotusSetHass, lotusT } from "./lotus-i18n.js?v=0.13.0b3";

const LOTUS_DIGICODE_VERSION = "1.3.7";
const LOTUS_DIGICODE_TYPE = "custom:lotus-digicode-card";
const DIGICODE_SECURITY_MODES = Object.freeze({
  FRONTEND: "frontend_entity",
  SERVER_PLAIN: "server_plain",
  SERVER_ENCRYPTED: "server_encrypted",
});
const SERVER_SECURITY_MODES = new Set([
  DIGICODE_SECURITY_MODES.SERVER_PLAIN,
  DIGICODE_SECURITY_MODES.SERVER_ENCRYPTED,
]);
const FRONTEND_PIN_DOMAINS = new Set(["input_number"]);
const DIGICODE_VALIDITY_EVENT = "lotus-digicode-validity-changed";

const makePinId = () => {
  const suffix = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `digicode_${suffix}`;
};

const base64ToBytes = (value) => {
  const binary = atob(String(value ?? ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const bytesToBase64 = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

async function encryptedPinPayload(hass, pin) {
  if (!hass?.callWS) throw new Error(lotusT("Connexion WebSocket Home Assistant indisponible."));
  if (!globalThis.crypto?.subtle) throw new Error(lotusT("Web Crypto n’est pas disponible dans ce navigateur."));
  const response = await hass.callWS({ type: "lotus_view_studio/digicode/public_key" });
  const key = await globalThis.crypto.subtle.importKey(
    "spki",
    base64ToBytes(response?.spki),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const challenge = String(response?.challenge ?? "");
  if (!challenge) throw new Error(lotusT("Challenge de sécurité Lotus manquant."));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    key,
    new TextEncoder().encode(`${String(pin ?? "")}\n${challenge}`),
  );
  return { ciphertext: bytesToBase64(ciphertext), challenge };
}
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
  if (color === "theme") return "var(--ha-card-background, var(--card-background-color, #fff))";
  if (color === "secondary-background") return "var(--secondary-background-color, #f5f5f5)";
  if (color === "primary") return "var(--primary-color, #03a9f4)";
  if (color === "accent") return "var(--accent-color, var(--primary-color, #03a9f4))";
  if (color === "primary-text") return "var(--primary-text-color, #212121)";
  if (color === "secondary-text") return "var(--secondary-text-color, #727272)";
  if (color === "disabled") return "var(--disabled-text-color, #9e9e9e)";
  if (HA_THEME_COLORS.has(color)) return `var(--${color}-color, ${fallback})`;
  return color;
};

const digitLabels = () => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), String(i)]));
const digitVisualTypes = () => Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), "text"]));

const DIGIT_TOKENS = Object.freeze(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const DEFAULT_KEY_ORDER = Object.freeze([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "backspace", "0", "clear",
]);
const VALID_KEY_TOKENS = new Set([...DIGIT_TOKENS, "backspace", "clear"]);

const normalizeKeyOrder = (value) => {
  const requested = Array.isArray(value) ? value.map((item) => String(item ?? "").trim()) : [];
  const seen = new Set();
  const result = [];
  for (const token of requested) {
    if (!VALID_KEY_TOKENS.has(token) || seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  for (const token of DEFAULT_KEY_ORDER) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
};

const randomIndex = (upperExclusive) => {
  const upper = Math.max(1, Math.floor(Number(upperExclusive) || 1));
  if (globalThis.crypto?.getRandomValues) {
    // Rejection sampling avoids modulo bias while keeping the shuffle local
    // to the frontend. The fallback is only for very old browsers.
    const limit = Math.floor(0x100000000 / upper) * upper;
    const bucket = new Uint32Array(1);
    do globalThis.crypto.getRandomValues(bucket); while (bucket[0] >= limit);
    return bucket[0] % upper;
  }
  return Math.floor(Math.random() * upper);
};

const shuffledDigits = () => {
  const values = [...DIGIT_TOKENS];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

const KEY_SHAPES = new Set([
  "rounded", "square", "circle", "diamond",
  "triangle-up", "triangle-down", "triangle-left", "triangle-right",
  "pentagon", "hexagon", "octagon",
]);

const KEY_SHAPE_CLIPS = {
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  "triangle-up": "polygon(50% 0%, 100% 100%, 0% 100%)",
  "triangle-down": "polygon(0% 0%, 100% 0%, 50% 100%)",
  "triangle-left": "polygon(0% 50%, 100% 0%, 100% 100%)",
  "triangle-right": "polygon(0% 0%, 100% 50%, 0% 100%)",
  pentagon: "polygon(50% 0%, 97% 35%, 79% 100%, 21% 100%, 3% 35%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
};

const KEY_SHAPE_POINTS = {
  square: [[0, 0], [100, 0], [100, 100], [0, 100]],
  diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
  "triangle-up": [[50, 0], [100, 100], [0, 100]],
  "triangle-down": [[0, 0], [100, 0], [50, 100]],
  "triangle-left": [[0, 50], [100, 0], [100, 100]],
  "triangle-right": [[0, 0], [100, 50], [0, 100]],
  pentagon: [[50, 0], [97, 35], [79, 100], [21, 100], [3, 35]],
  hexagon: [[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]],
  octagon: [[30, 0], [70, 0], [100, 30], [100, 70], [70, 100], [30, 100], [0, 70], [0, 30]],
};

// A rounded polygon must keep a visible straight segment on every side.
// Even at the maximum editor value, each rounded corner may consume at most
// 36% of either adjacent edge, leaving at least 28% of an edge straight.
const KEY_CORNER_MAX_EDGE_FRACTION = 0.36;
const KEY_RECT_MAX_RADIUS_PERCENT = 36;

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

const roundedPolygonPath = (points, roundingPercent, width = 100, height = 100) => {
  const rounding = clamp(Number(roundingPercent) || 0, 0, 50) / 50;
  if (!Array.isArray(points) || points.length < 3 || rounding <= 0) return "";
  const corners = points.map((vertex, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const previousLength = pointDistance(vertex, previous);
    const nextLength = pointDistance(vertex, next);
    const offset = rounding * KEY_CORNER_MAX_EDGE_FRACTION * Math.min(previousLength, nextLength);
    return {
      vertex,
      incoming: pointTowards(vertex, previous, Math.min(offset, previousLength * KEY_CORNER_MAX_EDGE_FRACTION)),
      outgoing: pointTowards(vertex, next, Math.min(offset, nextLength * KEY_CORNER_MAX_EDGE_FRACTION)),
    };
  });
  const sx = Math.max(0.001, Number(width) || 100) / 100;
  const sy = Math.max(0.001, Number(height) || 100) / 100;
  const fmt = (point) => `${(point[0] * sx).toFixed(3)} ${(point[1] * sy).toFixed(3)}`;
  let path = `M ${fmt(corners[0].outgoing)}`;
  for (let index = 1; index < corners.length; index += 1) {
    const corner = corners[index];
    path += ` L ${fmt(corner.incoming)} Q ${fmt(corner.vertex)} ${fmt(corner.outgoing)}`;
  }
  const first = corners[0];
  path += ` L ${fmt(first.incoming)} Q ${fmt(first.vertex)} ${fmt(first.outgoing)} Z`;
  return path;
};

const roundedPolygonMask = (points, roundingPercent) => {
  const path = roundedPolygonPath(points, roundingPercent, 100, 100);
  if (!path) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="white" d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const looksLikeImageSource = (value) => {
  const source = String(value ?? "").trim().toLowerCase();
  return source.startsWith("media-source://")
    || source.startsWith("/local/")
    || source.startsWith("/api/")
    || source.startsWith("http://")
    || source.startsWith("https://")
    || source.startsWith("data:image/");
};

const baseConfig = () => ({
  type: LOTUS_DIGICODE_TYPE,
  name: "",
  code_entity: "",
  security: { mode: DIGICODE_SECURITY_MODES.FRONTEND, pin_id: "", revision: 0 },
  interaction: { modal_blocker: false },
  design: { width: 62, height: 88 },
  frame: {
    background_color: "theme",
    border_color: "primary",
    border_width: 1,
    radius: 12,
    padding: 6,
  },
  display: {
    background_color: "secondary-background",
    border_color: "grey",
    border_width: 1,
    radius: 12,
    mask: "dot",
    custom_mask: "●",
    color: "primary-text",
    font_size: 24,
    height: 18,
  },
  keys: {
    rows: 4,
    last_row_align: "center",
    gap: 5,
    background_color: "primary",
    pressed_color: "accent",
    border_color: "primary",
    border_width: 0,
    radius: 18,
    corner_radius: 0,
    shape: "rounded",
    order: [...DEFAULT_KEY_ORDER],
    randomize_digits: false,
    label_color: "white",
    label_size: 22,
  },
  symbols: {
    enabled: false,
    labels: digitLabels(),
    types: digitVisualTypes(),
  },
  backspace: {
    enabled: true,
    icon: "mdi:backspace-outline",
  },
  clear: {
    enabled: true,
    icon: "mdi:delete-sweep-outline",
  },
  error: {
    mode: "message",
    message: "Code incorrect",
    icon: "mdi:alert-circle-outline",
    color: "red",
    delay: 1200,
  },
  success: {
    mode: "icon",
    message: "Code valide",
    icon: "mdi:check-circle-outline",
    color: "green",
    delay: 450,
  },
  action: { action: "none" },
});

function normalize(raw) {
  const defaults = baseConfig();
  const source = raw && typeof raw === "object" ? raw : {};
  const frame = source.frame && typeof source.frame === "object" ? source.frame : {};
  const display = source.display && typeof source.display === "object" ? source.display : {};
  const keys = source.keys && typeof source.keys === "object" ? source.keys : {};
  const symbols = source.symbols && typeof source.symbols === "object" ? source.symbols : {};
  const labels = symbols.labels && typeof symbols.labels === "object" ? symbols.labels : {};
  const symbolTypes = symbols.types && typeof symbols.types === "object" ? symbols.types : {};
  const backspace = source.backspace && typeof source.backspace === "object" ? source.backspace : {};
  const clear = source.clear && typeof source.clear === "object" ? source.clear : {};
  const error = source.error && typeof source.error === "object" ? source.error : {};
  const success = source.success && typeof source.success === "object" ? source.success : {};
  const design = source.design && typeof source.design === "object" ? source.design : {};
  const security = source.security && typeof source.security === "object" ? source.security : {};
  const interaction = source.interaction && typeof source.interaction === "object" ? source.interaction : {};

  const normalizedLabels = {};
  const normalizedSymbolTypes = {};
  for (let i = 0; i <= 9; i += 1) {
    const digit = String(i);
    const label = String(labels[digit] ?? digit);
    normalizedLabels[digit] = label;
    const requestedType = String(symbolTypes[digit] ?? "").trim();
    normalizedSymbolTypes[digit] = ["text", "icon", "image"].includes(requestedType)
      ? requestedType
      : label.startsWith("mdi:")
        ? "icon"
        : looksLikeImageSource(label)
          ? "image"
          : "text";
  }

  return {
    ...defaults,
    ...clone(source),
    type: LOTUS_DIGICODE_TYPE,
    name: String(source.name ?? "").trim(),
    code_entity: String(source.code_entity ?? ""),
    security: {
      mode: Object.values(DIGICODE_SECURITY_MODES).includes(String(security.mode ?? ""))
        ? String(security.mode)
        : defaults.security.mode,
      pin_id: String(security.pin_id ?? "").trim(),
      // Non-secret marker incremented after a successful server PIN replacement.
      // This lets Home Assistant consider the card modified without ever
      // storing the PIN itself in Lovelace YAML.
      revision: Math.max(0, Math.trunc(Number(security.revision) || 0)),
    },
    interaction: {
      modal_blocker: interaction.modal_blocker === true,
    },
    design: {
      width: num(design.width, defaults.design.width, 20, 200),
      height: num(design.height, defaults.design.height, 20, 200),
    },
    frame: {
      background_color: String(frame.background_color ?? defaults.frame.background_color),
      border_color: String(frame.border_color ?? defaults.frame.border_color),
      border_width: num(frame.border_width, defaults.frame.border_width, 0, 16),
      radius: num(frame.radius, defaults.frame.radius, 0, 50),
      padding: num(frame.padding, defaults.frame.padding, 0, 18),
    },
    display: {
      background_color: String(display.background_color ?? defaults.display.background_color),
      border_color: String(display.border_color ?? defaults.display.border_color),
      border_width: num(display.border_width, defaults.display.border_width, 0, 12),
      radius: num(display.radius, defaults.display.radius, 0, 50),
      mask: ["asterisk", "dot", "square", "diamond", "custom"].includes(display.mask)
        ? display.mask
        : defaults.display.mask,
      custom_mask: String(display.custom_mask ?? defaults.display.custom_mask),
      color: String(display.color ?? defaults.display.color),
      font_size: num(display.font_size, defaults.display.font_size, 10, 48),
      height: num(display.height, defaults.display.height, 10, 32),
    },
    keys: {
      rows: Math.round(num(keys.rows, defaults.keys.rows, 2, 4)),
      last_row_align: ["left", "center", "right", "stretch"].includes(keys.last_row_align)
        ? keys.last_row_align
        : defaults.keys.last_row_align,
      gap: num(keys.gap, defaults.keys.gap, 0, 12),
      background_color: String(keys.background_color ?? defaults.keys.background_color),
      pressed_color: String(keys.pressed_color ?? defaults.keys.pressed_color),
      border_color: String(keys.border_color ?? defaults.keys.border_color),
      border_width: num(keys.border_width, defaults.keys.border_width, 0, 12),
      radius: num(keys.radius, defaults.keys.radius, 0, KEY_RECT_MAX_RADIUS_PERCENT),
      corner_radius: num(keys.corner_radius, defaults.keys.corner_radius, 0, 50),
      shape: KEY_SHAPES.has(String(keys.shape ?? "")) ? String(keys.shape) : defaults.keys.shape,
      order: normalizeKeyOrder(keys.order),
      randomize_digits: keys.randomize_digits === true,
      label_color: String(keys.label_color ?? defaults.keys.label_color),
      label_size: num(keys.label_size, defaults.keys.label_size, 10, 42),
    },
    symbols: {
      enabled: symbols.enabled === true,
      labels: normalizedLabels,
      types: normalizedSymbolTypes,
    },
    backspace: {
      enabled: backspace.enabled !== false,
      icon: String(backspace.icon ?? defaults.backspace.icon),
    },
    clear: {
      enabled: clear.enabled !== false,
      icon: String(clear.icon ?? defaults.clear.icon),
    },
    error: {
      mode: ["message", "icon", "both", "none"].includes(error.mode) ? error.mode : defaults.error.mode,
      message: String(error.message ?? defaults.error.message),
      icon: String(error.icon ?? defaults.error.icon),
      color: String(error.color ?? defaults.error.color),
      delay: num(error.delay, defaults.error.delay, 200, 5000),
    },
    success: {
      mode: ["message", "icon", "both", "none"].includes(success.mode) ? success.mode : defaults.success.mode,
      message: String(success.message ?? defaults.success.message),
      icon: String(success.icon ?? defaults.success.icon),
      color: String(success.color ?? defaults.success.color),
      delay: num(success.delay, defaults.success.delay, 0, 5000),
    },
    action: source.action && typeof source.action === "object" ? clone(source.action) : { action: "none" },
  };
}

function integerCodeFromState(hass, entityId) {
  if (!entityId) return { code: null, reason: "Aucune entité de code sélectionnée." };
  const stateObj = hass?.states?.[entityId];
  if (!stateObj) return { code: null, reason: "Entité de code indisponible." };
  const raw = String(stateObj.state ?? "").trim();
  if (!/^\d+(?:\.0+)?$/.test(raw)) {
    return { code: null, reason: "La valeur du code doit être un nombre entier positif." };
  }
  const code = raw.replace(/\.0+$/, "");
  return { code, reason: "" };
}

function maskCharacter(config) {
  switch (config.display.mask) {
    case "asterisk": return "*";
    case "square": return "■";
    case "diamond": return "◆";
    case "custom": return config.display.custom_mask || "●";
    case "dot":
    default: return "●";
  }
}

function visualContent(config, digit) {
  if (!config.symbols.enabled) return { type: "text", value: digit };
  const value = String(config.symbols.labels?.[digit] ?? "").trim();
  const type = String(config.symbols.types?.[digit] ?? "text");
  if (!value) return { type: "text", value: digit };
  if (type === "icon") return { type: "icon", value };
  if (type === "image") return { type: "image", value };
  return { type: "text", value };
}

function appendVisualLabel(node, label) {
  const value = String(label ?? "");
  if (value.startsWith("mdi:")) {
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", value);
    node.appendChild(icon);
  } else {
    node.textContent = value;
  }
}

class LotusDigicodeCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("lotus-digicode-card-editor");
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
    this._input = "";
    this._feedback = null;
    this._busy = false;
    this._timer = 0;
    this._mediaImageCache = new Map();
    this._mediaImagePending = new Set();
    this._digitPermutation = [...DIGIT_TOKENS];
    this._serverSecurity = { loaded: false, configured: false, length: 0, mode: null, error: "" };
    this._securityStatusToken = 0;
    this._visibilityInitialized = false;
    this._visibleInViewport = false;
    this._resizeObserver = new ResizeObserver(() => this._updateResponsiveLayout());
    this._visibilityObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver((entries) => this._handleVisibilityEntries(entries), { threshold: [0, 0.01] })
      : null;
  }

  connectedCallback() {
    // A card can be reused by a popup without receiving setConfig() again.
    // Treat each DOM appearance as a fresh keypad session.
    this._startAppearance(false);
    this._render();
    this._resizeObserver.observe(this);
    this._visibilityInitialized = false;
    this._visibleInViewport = false;
    this._visibilityObserver?.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
    this._visibilityObserver?.unobserve(this);
    this._visibilityInitialized = false;
    this._visibleInViewport = false;
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = 0;
    }
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration Lotus Digicode manquante.");
    this._config = normalize(config);
    this._input = "";
    this._feedback = null;
    this._resetDigitPermutation();
    this._serverSecurity = { loaded: false, configured: false, length: 0, mode: null, error: "" };
    this._render();
    this._loadServerSecurityStatus();
  }

  set hass(hass) {
    const firstHass = !this._hass;
    this._hass = hass;
    lotusSetHass(hass);
    if (firstHass) this._loadServerSecurityStatus();
    this._refreshSourceStatus();
    this._refreshSymbolImages();
  }
  get hass() { return this._hass; }

  set preview(value) {
    const next = Boolean(value);
    const changed = next !== this._preview;
    this._preview = next;
    if (changed && this._usesServerSecurity() && this._hass) this._loadServerSecurityStatus();
    if (changed) this._refreshSourceStatus();
  }
  get preview() { return this._preview; }

  getCardSize() {
    const ratio = this._config.design.height / Math.max(1, this._config.design.width);
    return Math.max(2, Math.ceil(4 * ratio));
  }

  getGridOptions() {
    const ratio = this._config.design.height / Math.max(1, this._config.design.width);
    return {
      columns: 4,
      rows: Math.max(3, Math.round(5 * ratio)),
      min_columns: 2,
      max_columns: 12,
      min_rows: 2,
    };
  }

  _hasDialogAncestor() {
    let node = this;
    const seen = new Set();
    while (node && !seen.has(node)) {
      seen.add(node);
      if (node instanceof Element) {
        const tag = String(node.localName || "").toLowerCase();
        const role = String(node.getAttribute?.("role") || "").toLowerCase();
        if (tag === "dialog" || tag.includes("dialog") || role === "dialog") return true;
      }
      if (node.parentElement) {
        node = node.parentElement;
        continue;
      }
      const root = node.getRootNode?.();
      node = root?.host || null;
    }
    return false;
  }

  _handleVisibilityEntries(entries) {
    const entry = entries.find((item) => item.target === this);
    if (!entry) return;
    const visible = Boolean(entry.isIntersecting && entry.intersectionRatio > 0);
    if (!this._visibilityInitialized) {
      this._visibilityInitialized = true;
      this._visibleInViewport = visible;
      return;
    }
    const becameVisible = visible && !this._visibleInViewport;
    this._visibleInViewport = visible;
    // A Digicode can be shown again either by a popup/dialog or by a native
    // conditional card inside Lotus View Studio. Every genuine hidden -> visible
    // transition starts a fresh keypad session, so randomized digits are
    // reshuffled on every appearance, not only inside dialog implementations.
    if (becameVisible) this._startAppearance(true);
  }

  _startAppearance(render = true) {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = 0;
    }
    this._busy = false;
    this._input = "";
    this._feedback = null;
    if (this._config.keys.randomize_digits) this._resetDigitPermutation(true);
    else this._digitPermutation = [...DIGIT_TOKENS];
    if (render && this.isConnected) this._render();
  }

  _securityMode() {
    return this._config.security?.mode || DIGICODE_SECURITY_MODES.FRONTEND;
  }

  _usesServerSecurity() {
    return SERVER_SECURITY_MODES.has(this._securityMode());
  }

  _expectedCode() {
    // The preview validates the real configured source. Actions remain disabled
    // in preview mode, so testing a PIN cannot trigger the protected action.
    if (this._usesServerSecurity()) return { code: null, reason: "Validation côté serveur." };
    return integerCodeFromState(this._hass, this._config.code_entity);
  }

  _sourceInfo() {
    if (!this._usesServerSecurity()) {
      const source = integerCodeFromState(this._hass, this._config.code_entity);
      return { ready: Boolean(source.code), length: source.code?.length || 0, code: source.code, reason: source.reason };
    }
    const pinId = String(this._config.security?.pin_id ?? "").trim();
    if (!pinId) return { ready: false, length: 0, code: null, reason: "Identifiant serveur du digicode manquant." };
    if (!this._serverSecurity.loaded) return { ready: false, length: 0, code: null, reason: "Configuration de sécurité en cours de chargement." };
    if (!this._serverSecurity.configured) return { ready: false, length: 0, code: null, reason: this._serverSecurity.error || "PIN serveur non configuré." };
    if (this._serverSecurity.mode !== this._securityMode()) return { ready: false, length: 0, code: null, reason: "Le niveau de sécurité enregistré sur le serveur ne correspond pas à la carte." };
    return { ready: true, length: Number(this._serverSecurity.length) || 0, code: null, reason: "" };
  }

  async _loadServerSecurityStatus() {
    if (!this._usesServerSecurity()) {
      this._serverSecurity = { loaded: true, configured: false, length: 0, mode: null, error: "" };
      this._refreshSourceStatus();
      return;
    }
    const pinId = String(this._config.security?.pin_id ?? "").trim();
    if (!this._hass?.callWS || !pinId) {
      this._serverSecurity = { loaded: Boolean(this._hass), configured: false, length: 0, mode: null, error: pinId ? "WebSocket Home Assistant indisponible." : "Identifiant serveur manquant." };
      this._refreshSourceStatus();
      return;
    }
    const token = ++this._securityStatusToken;
    try {
      const status = await this._hass.callWS({ type: "lotus_view_studio/digicode/status", pin_id: pinId });
      if (token !== this._securityStatusToken) return;
      this._serverSecurity = {
        loaded: true,
        configured: status?.configured === true,
        length: Number(status?.length) || 0,
        mode: status?.mode || null,
        error: "",
      };
    } catch (error) {
      if (token !== this._securityStatusToken) return;
      this._serverSecurity = { loaded: true, configured: false, length: 0, mode: null, error: String(error?.message || error || "Erreur serveur") };
    }
    this._refreshSourceStatus();
  }

  async _validateServerPin() {
    const mode = this._securityMode();
    const pinId = String(this._config.security?.pin_id ?? "").trim();
    this._busy = true;
    this._updateInteractiveState();
    try {
      const message = {
        type: "lotus_view_studio/digicode/validate",
        pin_id: pinId,
        mode,
        preview: this._preview === true,
      };
      if (mode === DIGICODE_SECURITY_MODES.SERVER_ENCRYPTED) {
        const encrypted = await encryptedPinPayload(this._hass, this._input);
        message.ciphertext = encrypted.ciphertext;
        message.challenge = encrypted.challenge;
      } else {
        message.pin = this._input;
      }
      const result = await this._hass.callWS(message);
      if (result?.valid) {
        this._feedback = { kind: "success", text: this._config.success.message };
        this._updateInteractiveState();
        if (!this._preview && result.client_action === true) await this._executeAction(this._config.action);
        this._scheduleReset(this._config.success.delay);
        return;
      }
      const lockedText = result?.locked
        ? `Trop de tentatives. Réessayez dans ${Number(result.retry_after) || 30} s.`
        : this._config.error.message;
      this._feedback = { kind: "error", text: lockedText };
      this._updateInteractiveState();
      this._scheduleReset(result?.locked ? Math.max(1000, (Number(result.retry_after) || 30) * 1000) : this._config.error.delay);
    } catch (error) {
      this._feedback = { kind: "error", text: "Validation serveur indisponible" };
      this._updateInteractiveState();
      this._scheduleReset(this._config.error.delay);
    }
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
    if (!this._hass || this._preview) return;
    const config = actionConfig && typeof actionConfig === "object" ? actionConfig : { action: "none" };
    const action = String(config.action ?? "none");
    if (!action || action === "none") return;

    const entityId = config.entity;
    if (action === "more-info") {
      this._fireMoreInfo(entityId);
      return;
    }
    if (action === "toggle") {
      if (entityId) await this._hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
      return;
    }
    if (action === "navigate") {
      const path = String(config.navigation_path ?? "").trim();
      if (path) {
        window.history.pushState(null, "", path);
        window.dispatchEvent(new Event("location-changed"));
      }
      return;
    }
    if (action === "url") {
      const url = String(config.url_path ?? config.url ?? "").trim();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "perform-action" || action === "call-service") {
      const serviceName = String(config.perform_action ?? config.service ?? "").trim();
      if (!serviceName.includes(".")) return;
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

  _resetDigitPermutation(forceDifferent = false) {
    if (!this._config.keys.randomize_digits) {
      this._digitPermutation = [...DIGIT_TOKENS];
      return;
    }
    const previous = Array.isArray(this._digitPermutation) ? this._digitPermutation.join("") : "";
    let next = shuffledDigits();
    if (forceDifferent && previous && next.join("") === previous) {
      // The probability is tiny (1 / 10!), but an enabled security feature
      // must visibly change the layout on every new appearance.
      next = [...next.slice(1), next[0]];
    }
    this._digitPermutation = next;
  }

  reshuffleDigits() {
    if (!this._config.keys.randomize_digits) return;
    this._resetDigitPermutation(true);
    if (this.isConnected) this._render();
  }

  _items() {
    const order = normalizeKeyOrder(this._config.keys.order);
    const randomized = this._config.keys.randomize_digits;
    const digitValues = randomized ? this._digitPermutation : null;
    let digitSlot = 0;
    const items = [];
    for (const token of order) {
      if (DIGIT_TOKENS.includes(token)) {
        const digit = randomized ? digitValues[digitSlot] : token;
        digitSlot += 1;
        items.push({ kind: "digit", digit, slot: token });
        continue;
      }
      if (token === "backspace" && this._config.backspace.enabled) items.push({ kind: "backspace" });
      if (token === "clear" && this._config.clear.enabled) items.push({ kind: "clear" });
    }
    return items;
  }

  _rows() {
    const items = this._items();
    const requestedRows = Math.max(2, Math.min(4, this._config.keys.rows));
    const perRow = Math.max(2, Math.ceil(items.length / requestedRows));
    const rows = [];
    for (let index = 0; index < items.length; index += perRow) {
      rows.push(items.slice(index, index + perRow));
    }
    return { rows, perRow };
  }

  _press(item) {
    if (this._busy) return;
    this._feedback = null;
    if (item.kind === "backspace") {
      this._input = this._input.slice(0, -1);
      this._updateInteractiveState();
      return;
    }
    if (item.kind === "clear") {
      this._input = "";
      this._updateInteractiveState();
      return;
    }

    const source = this._sourceInfo();
    if (!source.ready || !(source.length > 0)) {
      this._showFeedback("error", source.reason || "Code indisponible.", true);
      return;
    }
    if (this._input.length >= source.length) return;
    this._input += item.digit;
    this._updateInteractiveState();
    if (this._input.length === source.length) {
      if (this._usesServerSecurity()) this._validateServerPin();
      else this._validate(source.code);
    }
  }

  _validate(expected) {
    if (this._input === expected) {
      this._busy = true;
      this._feedback = { kind: "success", text: this._config.success.message };
      this._updateInteractiveState();
      Promise.resolve(this._executeAction(this._config.action)).finally(() => {
        this._scheduleReset(this._config.success.delay);
      });
      return;
    }
    this._busy = true;
    this._feedback = { kind: "error", text: this._config.error.message };
    this._updateInteractiveState();
    this._scheduleReset(this._config.error.delay);
  }

  _showFeedback(kind, text, reset = false) {
    this._feedback = { kind, text };
    this._updateInteractiveState();
    if (reset) this._scheduleReset(this._config.error.delay);
  }

  _scheduleReset(delay) {
    if (this._timer) window.clearTimeout(this._timer);
    this._timer = window.setTimeout(() => {
      this._timer = 0;
      this._busy = false;
      this._input = "";
      this._feedback = null;
      if (this._config.keys.randomize_digits) {
        this._resetDigitPermutation(true);
        this._render();
      } else {
        this._updateInteractiveState();
      }
    }, Math.max(0, Number(delay) || 0));
  }

  _feedbackConfig() {
    if (!this._feedback) return null;
    return this._feedback.kind === "success" ? this._config.success : this._config.error;
  }

  _renderDisplayContent(display) {
    display.replaceChildren();
    const feedbackConfig = this._feedbackConfig();
    if (feedbackConfig && feedbackConfig.mode !== "none") {
      display.classList.add("feedback", this._feedback.kind);
      display.style.color = colorCss(feedbackConfig.color, "var(--error-color,#db4437)");
      if ((feedbackConfig.mode === "icon" || feedbackConfig.mode === "both") && feedbackConfig.icon) {
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", feedbackConfig.icon);
        icon.className = "feedback-icon";
        display.appendChild(icon);
      }
      if (feedbackConfig.mode === "message" || feedbackConfig.mode === "both") {
        const text = document.createElement("span");
        text.className = "feedback-message";
        text.textContent = this._feedback.text || feedbackConfig.message;
        display.appendChild(text);
      }
      return;
    }

    display.classList.remove("feedback", "success", "error");
    display.style.color = colorCss(this._config.display.color, "var(--primary-text-color,#212121)");
    const char = maskCharacter(this._config);
    for (let index = 0; index < this._input.length; index += 1) {
      const mask = document.createElement("span");
      mask.className = "mask-char";
      mask.textContent = char;
      display.appendChild(mask);
    }
  }

  _updateInteractiveState() {
    const display = this.shadowRoot?.querySelector(".code-display");
    if (display) this._renderDisplayContent(display);
    for (const button of this.shadowRoot?.querySelectorAll(".key") || []) {
      button.disabled = this._busy;
    }
    requestAnimationFrame(() => this._applyResponsiveTypography());
  }

  _refreshSourceStatus() {
    const shell = this.shadowRoot?.querySelector(".digicode-shell");
    if (!shell) return;
    const source = this._sourceInfo();
    shell.toggleAttribute("source-invalid", !source.ready);
  }

  _applyMeasuredRadii() {
    const root = this.shadowRoot;
    if (!root) return;
    const apply = (selector, pct) => {
      for (const node of root.querySelectorAll(selector)) {
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const radius = Math.min(rect.width, rect.height) * (Number(pct) / 100);
        node.style.borderRadius = `${Math.max(0, radius)}px`;
      }
    };
    apply(".digicode-shell", this._config.frame.radius);
    apply(".code-display", this._config.display.radius);

    const shape = this._config.keys.shape;
    const shapePoints = KEY_SHAPE_POINTS[shape];
    for (const key of root.querySelectorAll(".key")) {
      const node = key.querySelector(".key-surface");
      if (!node) continue;
      node.removeAttribute("data-rounded-polygon");
      node.style.removeProperty("--key-shape-mask");
      if (shape === "circle") {
        node.style.clipPath = "none";
        node.style.borderRadius = "50%";
        continue;
      }
      if (shape === "rounded") {
        node.style.clipPath = "none";
        const rect = key.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const requested = clamp(Number(this._config.keys.radius) || 0, 0, KEY_RECT_MAX_RADIUS_PERCENT);
        const radius = Math.min(rect.width, rect.height) * (requested / 100);
        node.style.borderRadius = `${Math.max(0, radius)}px`;
        continue;
      }

      node.style.borderRadius = "0px";
      const rounding = Number(this._config.keys.corner_radius) || 0;
      if (shapePoints && rounding > 0) {
        const rect = key.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const path = roundedPolygonPath(shapePoints, rounding, rect.width, rect.height);
          const clip = path ? `path("${path}")` : "";
          if (clip && typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("clip-path", clip)) {
            node.style.clipPath = clip;
            node.dataset.roundedPolygon = "true";
            node.style.setProperty("--key-shape-mask", roundedPolygonMask(shapePoints, rounding));
            continue;
          }
        }
      }
      node.style.clipPath = KEY_SHAPE_CLIPS[shape] || "none";
    }
  }

  _fitNodeText(node, maxSize) {
    if (!node) return;
    const maxPx = Math.max(1, Number(maxSize) || 1);
    node.style.fontSize = `${maxPx}px`;
    const css = getComputedStyle(node);
    const width = Math.max(0, node.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0));
    const height = Math.max(0, node.clientHeight - (parseFloat(css.paddingTop) || 0) - (parseFloat(css.paddingBottom) || 0));
    if (!(width > 0) || !(height > 0)) {
      node.style.fontSize = "1px";
      return;
    }
    const naturalWidth = Math.max(1, node.scrollWidth);
    const naturalHeight = Math.max(1, node.scrollHeight);
    const scale = Math.min(1, width / naturalWidth, height / naturalHeight);
    node.style.fontSize = `${Math.max(1, maxPx * scale)}px`;
    const width2 = Math.max(1, node.scrollWidth);
    if (width2 > width) {
      const current = Math.max(1, parseFloat(node.style.fontSize) || 1);
      node.style.fontSize = `${Math.max(1, current * width / width2)}px`;
    }
  }

  _applyResponsiveTypography() {
    const root = this.shadowRoot;
    if (!root) return;
    const display = root.querySelector(".code-display");
    if (display) {
      const rect = display.getBoundingClientRect();
      const geometricMax = Math.max(1, Math.min(rect.width, rect.height) * 0.65);
      this._fitNodeText(display, Math.min(this._config.display.font_size, geometricMax));
    }
    for (const key of root.querySelectorAll(".key")) {
      const rect = key.getBoundingClientRect();
      const geometricMax = Math.max(1, Math.min(rect.width, rect.height) * 0.62);
      const content = key.querySelector(".key-content");
      if (content && !content.querySelector("img")) {
        this._fitNodeText(content, Math.min(this._config.keys.label_size, geometricMax));
      }
    }
  }

  _applyRegularKeyGeometry() {
    const root = this.shadowRoot;
    if (!root || this._config.keys.shape === "rounded") return;
    for (const row of root.querySelectorAll(".key-row")) {
      const keys = [...row.querySelectorAll(":scope > .key")];
      if (!keys.length) continue;
      const rowRect = row.getBoundingClientRect();
      const gap = Math.max(0, parseFloat(getComputedStyle(row).columnGap) || 0);
      const slotCount = Math.max(1, Number(row.dataset.slotCount) || keys.length);
      const slotWidth = Math.max(1, (rowRect.width - gap * Math.max(0, slotCount - 1)) / slotCount);
      const size = Math.max(1, Math.min(slotWidth, rowRect.height));
      for (const key of keys) {
        key.style.width = `${size}px`;
        key.style.height = `${size}px`;
        key.style.alignSelf = "center";
        if (row.classList.contains("incomplete") && !row.classList.contains("stretch")) {
          key.style.flex = `0 0 ${size}px`;
        } else {
          key.style.justifySelf = "center";
        }
      }
    }
  }

  _updateResponsiveLayout() {
    this._applyRegularKeyGeometry();
    this._applyMeasuredRadii();
    this._applyResponsiveTypography();
  }

  _displayImageUrl(value) {
    const source = String(value ?? "").trim();
    if (!source) return "";
    if (!source.startsWith("media-source://")) {
      if (source.startsWith("/") && typeof this._hass?.hassUrl === "function") return this._hass.hassUrl(source);
      return source;
    }

    const cached = this._mediaImageCache.get(source);
    if (cached) return cached;
    if (this._hass && !this._mediaImagePending.has(source)) {
      this._mediaImagePending.add(source);
      this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: source,
      }).then((result) => {
        const url = String(result?.url ?? "").trim();
        if (url) {
          this._mediaImageCache.set(
            source,
            typeof this._hass?.hassUrl === "function" ? this._hass.hassUrl(url) : url,
          );
        }
      }).catch((error) => {
        lotusDebug("Unable to resolve keypad image", source, error);
      }).finally(() => {
        this._mediaImagePending.delete(source);
        if (this.isConnected) this._refreshSymbolImages();
      });
    }
    return "";
  }

  _refreshSymbolImages() {
    const root = this.shadowRoot;
    if (!root) return;
    for (const image of root.querySelectorAll("img.key-symbol-image[data-source]")) {
      const source = image.dataset.source || "";
      const url = this._displayImageUrl(source);
      if (url && image.getAttribute("src") !== url) image.setAttribute("src", url);
    }
  }

  _appendDigitVisual(container, digit) {
    const visual = visualContent(this._config, digit);
    if (visual.type === "icon") {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", visual.value);
      container.appendChild(icon);
      return;
    }
    if (visual.type === "image") {
      const image = document.createElement("img");
      image.className = "key-symbol-image";
      image.dataset.source = visual.value;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      const url = this._displayImageUrl(visual.value);
      if (url) image.src = url;
      container.appendChild(image);
      return;
    }
    container.textContent = visual.value;
  }

  _renderKey(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${item.kind}`;
    button.disabled = this._busy;
    button.style.setProperty("--key-bg", colorCss(this._config.keys.background_color));
    button.style.setProperty("--key-pressed", colorCss(this._config.keys.pressed_color));
    button.style.setProperty("--key-border", colorCss(this._config.keys.border_color));
    button.style.setProperty("--key-label", colorCss(this._config.keys.label_color, "#fff"));
    button.style.setProperty("--key-border-width", `${this._config.keys.border_width}px`);
    const shape = this._config.keys.shape;
    button.dataset.shape = shape;
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("pointerup", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      this._press(item);
    });

    // Keep the semantic button rectangular and fully clickable. Geometry is
    // visual only: clip-path/border-radius live on this pointer-transparent
    // surface, so clipped polygons can never shrink the hit-test area.
    const surface = document.createElement("span");
    surface.className = "key-surface";
    surface.dataset.shape = shape;
    surface.style.clipPath = KEY_SHAPE_CLIPS[shape] || "none";

    const content = document.createElement("span");
    content.className = "key-content";
    if (item.kind === "digit") {
      this._appendDigitVisual(content, item.digit);
      button.setAttribute("aria-label", String(item.digit));
    } else {
      const iconName = item.kind === "backspace" ? this._config.backspace.icon : this._config.clear.icon;
      if (iconName) appendVisualLabel(content, iconName);
      button.setAttribute("aria-label", lotusT(item.kind === "backspace" ? "Effacer le dernier chiffre" : "Effacer le code saisi"));
    }
    button.append(surface, content);
    return button;
  }

  _render() {
    if (!this.shadowRoot) return;
    const config = this._config;
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display:block;
        width:100%;
        height:auto;
        min-width:0;
        min-height:0;
        aspect-ratio:${config.design.width} / ${config.design.height};
        box-sizing:border-box;
      }
      ha-card { display:block; width:100%; height:100%; min-height:0; box-sizing:border-box; overflow:hidden; background:transparent; box-shadow:none; }
      .digicode-shell {
        width:100%; height:100%; min-height:0; box-sizing:border-box; overflow:hidden;
        display:flex; flex-direction:column;
        gap:min(${config.keys.gap}px, 2cqw, 2cqh);
        padding:min(${config.frame.padding}px, 3cqw, 3cqh);
        background:${colorCss(config.frame.background_color, "var(--ha-card-background,var(--card-background-color,#fff))")};
        border:${config.frame.border_width}px solid ${colorCss(config.frame.border_color)};
      }
      .code-display {
        flex:0 0 ${config.display.height}%; min-height:0; box-sizing:border-box;
        position:relative; z-index:1; pointer-events:none;
        display:flex; align-items:center; justify-content:center; gap:.28em;
        overflow:hidden; white-space:nowrap; padding:min(6px,2cqh) min(10px,3cqw);
        background:${colorCss(config.display.background_color, "var(--secondary-background-color,#f5f5f5)")};
        border:${config.display.border_width}px solid ${colorCss(config.display.border_color, "var(--divider-color,#9e9e9e)")};
        color:${colorCss(config.display.color, "var(--primary-text-color,#212121)")};
        font-size:${config.display.font_size}px; font-weight:700; letter-spacing:.05em;
      }
      .code-display.feedback { gap:min(8px,2cqw,2cqh); letter-spacing:0; font-size:${config.display.font_size}px; }
      .feedback-icon { --mdc-icon-size:1.4em; }
      .feedback-message { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .keys-area { flex:1 1 auto; min-height:0; position:relative; z-index:2; pointer-events:auto; display:flex; flex-direction:column; gap:min(${config.keys.gap}px,2cqw,2cqh); }
      .key-row { flex:1 1 0; min-height:0; position:relative; z-index:1; display:grid; gap:min(${config.keys.gap}px,2cqw,2cqh); }
      .key-row.incomplete { display:flex; }
      .key-row.incomplete.left { justify-content:flex-start; }
      .key-row.incomplete.center { justify-content:center; }
      .key-row.incomplete.right { justify-content:flex-end; }
      .key-row.incomplete.stretch { display:grid; }
      .key {
        appearance:none; min-width:0; min-height:0; height:100%; box-sizing:border-box;
        position:relative; z-index:2; display:grid; place-items:center; overflow:visible; cursor:pointer; user-select:none;
        background:transparent; color:var(--key-label); border:0; padding:0;
        font:inherit; font-size:${config.keys.label_size}px; font-weight:700;
        transition:opacity .08s ease;
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation; pointer-events:auto; isolation:isolate;
      }
      .key-surface {
        position:absolute; z-index:0; pointer-events:none; inset:0; display:block; box-sizing:border-box;
        background:var(--key-border); transform-origin:center; transition:transform .08s ease;
      }
      .key-surface::before {
        content:""; position:absolute; z-index:0; pointer-events:none;
        inset:var(--key-border-width); background:var(--key-bg);
        clip-path:inherit; border-radius:inherit; transition:background .08s ease;
      }
      .key-surface[data-rounded-polygon="true"]::before {
        clip-path:none; border-radius:0;
        -webkit-mask-image:var(--key-shape-mask); mask-image:var(--key-shape-mask);
        -webkit-mask-size:100% 100%; mask-size:100% 100%;
        -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
        -webkit-mask-position:center; mask-position:center;
      }
      .key:active:not(:disabled) .key-surface { transform:scale(.97); }
      .key:active:not(:disabled) .key-surface::before { background:var(--key-pressed); }
      .key:disabled { opacity:.62; cursor:default; }
      .key-content {
        position:relative; z-index:1; width:100%; height:100%; min-width:0; min-height:0;
        display:grid; place-items:center; box-sizing:border-box; padding:8%; line-height:1; pointer-events:none;
      }
      .key[data-shape^="triangle-"] .key-content { padding:20%; }
      .key[data-shape="triangle-up"] .key-content { transform:translateY(9%); }
      .key[data-shape="triangle-down"] .key-content { transform:translateY(-9%); }
      .key[data-shape="triangle-left"] .key-content { transform:translateX(9%); }
      .key[data-shape="triangle-right"] .key-content { transform:translateX(-9%); }
      .key ha-icon { --mdc-icon-size:1em; width:1em; height:1em; }
      .key-symbol-image { display:block; max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; }

    `;

    const card = document.createElement("ha-card");
    const shell = document.createElement("div");
    shell.className = "digicode-shell";
    shell.style.containerType = "size";

    const display = document.createElement("div");
    display.className = "code-display";
    this._renderDisplayContent(display);

    const keysArea = document.createElement("div");
    keysArea.className = "keys-area";
    const { rows, perRow } = this._rows();
    rows.forEach((items, rowIndex) => {
      const row = document.createElement("div");
      const incomplete = items.length < perRow;
      row.className = `key-row${incomplete ? ` incomplete ${config.keys.last_row_align}` : ""}`;
      row.dataset.slotCount = String(incomplete && config.keys.last_row_align !== "stretch" ? perRow : items.length);
      if (!incomplete || config.keys.last_row_align === "stretch") {
        row.style.gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;
      } else {
        const width = `calc((100% - ${(perRow - 1) * config.keys.gap}px) / ${perRow})`;
        for (const item of items) {
          const key = this._renderKey(item);
          key.style.flex = `0 0 ${width}`;
          row.appendChild(key);
        }
        keysArea.appendChild(row);
        return;
      }
      for (const item of items) row.appendChild(this._renderKey(item));
      keysArea.appendChild(row);
    });

    shell.append(display, keysArea);
    card.appendChild(shell);
    this.shadowRoot.replaceChildren(style, card);
    requestAnimationFrame(() => {
      this._updateResponsiveLayout();
      this._refreshSourceStatus();
    });
  }
}

class LotusDigicodeCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = normalize(baseConfig());
    this._restoreScrollTop = null;
    this._previewResizeObserver = new ResizeObserver(() => this._layoutPreviewShell());
    this._activeResize = null;
    this._pendingServerPin = "";
    this._serverSecurityStatus = { loaded: false, configured: false, length: 0, mode: null, pin_id: "", error: "" };
    this._serverStatusToken = 0;
    this._lastSaveValiditySignature = "";
    this._validityEventRaf = 0;
    this._pendingValidityDetail = null;
  }

  connectedCallback() {
    this._render();
    this._notifySaveValidity();
  }

  disconnectedCallback() {
    this._previewResizeObserver.disconnect();
    this._stopResizeListeners();
    if (this._validityEventRaf) cancelAnimationFrame(this._validityEventRaf);
    this._validityEventRaf = 0;
    this._pendingValidityDetail = null;
  }

  set hass(hass) {
    const firstHass = !this._hass;
    this._hass = hass;
    lotusSetHass(hass);

    // Home Assistant may call setConfig() before assigning hass. In that case
    // all editor controls were previously created with hass === undefined and
    // never received the real instance afterwards. Rebuild once on the first
    // hass assignment, then only refresh bindings on subsequent state updates.
    if (firstHass && this.isConnected) {
      this._render();
    } else {
      this.shadowRoot?.querySelectorAll("ha-form, ha-selector").forEach((field) => {
        field.hass = hass;
      });
      this._syncPreview();
    }

    if (firstHass) this._loadEditorServerStatus();
    this._updateCodeStatus();
    this._notifySaveValidity();
  }
  get hass() { return this._hass; }

  setConfig(config) {
    this._config = normalize(config);
    this._render();
    this._notifySaveValidity();
    this._loadEditorServerStatus();
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

  _commit(mutator) {
    this._captureScroll();
    const next = normalize(this._config);
    mutator(next);
    this._config = normalize(next);
    this._emit();
    this._render();
    this._notifySaveValidity();
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
    // 0.9.13: connect directly to Home Assistant's selector component.
    //
    // The former ha-form wrapper nests the selected value in a temporary
    // { value: ... } form object and re-emits a second value-changed event.
    // That indirection made the Digicode controls vulnerable to frontend/form
    // changes introduced while the i18n layer was added.  ha-selector is the
    // native component used by ha-form internally and exposes the technical
    // value directly. Translation therefore touches the visible label only.
    if (customElements.get("ha-selector")) {
      const field = document.createElement("ha-selector");
      field.className = "native-field";
      field.hass = this._hass;
      field.selector = selector;
      field.value = value;
      field.label = lotusT(label);
      field.required = false;
      if (context) field.context = context;
      field.dataset.fieldPath = path;
      field.addEventListener("value-changed", (event) => {
        // Do not let a raw selector event escape the card editor. Home
        // Assistant must receive only Lotus' config-changed event from _commit.
        event.stopPropagation();
        onChange(event.detail?.value);
      });
      parent.appendChild(field);
      return field;
    }

    // Compatibility fallback for frontends where ha-selector has not yet been
    // registered but ha-form is available. Keep the legacy, proven contract.
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field";
      form.hass = this._hass;
      form.data = { value };
      form.schema = [{ name: "value", required: false, selector }];
      if (context) form.context = context;
      form.computeLabel = () => lotusT(label);
      form.dataset.fieldPath = path;
      form.addEventListener("value-changed", (event) => {
        event.stopPropagation();
        onChange(event.detail?.value?.value);
      });
      parent.appendChild(form);
      return form;
    }

    // Last-resort HTML fallback. Selectors remain usable even if Home
    // Assistant's custom elements are temporarily unavailable while loading.
    const wrap = document.createElement("label");
    wrap.className = "fallback-field";
    wrap.dataset.fieldPath = path;
    const span = document.createElement("span");
    span.textContent = lotusT(label);

    if (selector?.select?.options) {
      const input = document.createElement("select");
      for (const option of selector.select.options) {
        const item = typeof option === "object"
          ? option
          : { value: String(option), label: String(option) };
        const node = document.createElement("option");
        node.value = String(item.value ?? "");
        node.textContent = String(item.label ?? item.value ?? "");
        input.appendChild(node);
      }
      input.value = value ?? "";
      input.addEventListener("change", () => onChange(input.value));
      wrap.append(span, input);
      parent.appendChild(wrap);
      return wrap;
    }

    if (selector?.entity) {
      const input = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      input.appendChild(empty);
      const filters = Array.isArray(selector.entity.filter)
        ? selector.entity.filter
        : selector.entity.filter ? [selector.entity.filter] : [];
      const domains = new Set(filters.flatMap((filter) => {
        const domain = filter?.domain;
        return Array.isArray(domain) ? domain : domain ? [domain] : [];
      }));
      const ids = Object.keys(this._hass?.states || {})
        .filter((entityId) => !domains.size || domains.has(entityId.split(".", 1)[0]))
        .sort((a, b) => a.localeCompare(b));
      for (const entityId of ids) {
        const node = document.createElement("option");
        node.value = entityId;
        node.textContent = this._hass?.states?.[entityId]?.attributes?.friendly_name
          ? `${this._hass.states[entityId].attributes.friendly_name} (${entityId})`
          : entityId;
        input.appendChild(node);
      }
      input.value = value ?? "";
      input.addEventListener("change", () => onChange(input.value));
      wrap.append(span, input);
      parent.appendChild(wrap);
      return wrap;
    }

    const input = document.createElement("input");
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    wrap.append(span, input);
    parent.appendChild(wrap);
    return wrap;
  }

  _nativeSelectField(parent, path, label, value, options, onChange) {
    // Critical configuration fields use a browser-native select. This keeps
    // their technical values completely outside Home Assistant's ha-form /
    // ha-selector event machinery while retaining Lotus translations for the
    // visible labels. It is intentionally simple and deterministic.
    const wrap = document.createElement("label");
    wrap.className = "fallback-field lotus-native-select-field";
    wrap.dataset.fieldPath = path;

    const span = document.createElement("span");
    span.textContent = lotusT(label);

    const input = document.createElement("select");
    input.dataset.fieldPath = path;
    for (const [technicalValue, visibleLabel] of options) {
      const option = document.createElement("option");
      option.value = String(technicalValue ?? "");
      option.textContent = lotusT(String(visibleLabel ?? technicalValue ?? ""));
      input.appendChild(option);
    }
    input.value = String(value ?? "");
    input.addEventListener("change", (event) => {
      event.stopPropagation();
      const nextValue = String(input.value ?? "");
      onChange(nextValue);
    });

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
    // Même principe que Stack et Slide : ne pas reconstruire l'éditeur pendant
    // la frappe. La valeur est propagée seulement lorsque le champ est quitté.
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

  _color(parent, path, label, value, onChange) {
    return this._formField(parent, path, label, {
      ui_color: { include_none: false, include_state: false, default_color: String(value || "primary") },
    }, value, (next) => onChange(String(next ?? "primary")));
  }

  _icon(parent, path, label, value, onChange) {
    return this._formField(parent, path, label, { icon: {} }, value, (next) => onChange(String(next ?? "")));
  }

  _image(parent, path, label, value, onChange) {
    const current = String(value ?? "").trim();
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field lotus-image-picker";
      form.hass = this._hass;
      form.data = {
        image: current
          ? { media_content_id: current, media_content_type: "image/*" }
          : undefined,
      };
      form.schema = [{
        name: "image",
        required: false,
        selector: {
          media: {
            accept: ["image/*"],
            clearable: true,
            image_upload: true,
            hide_content_type: true,
          },
        },
      }];
      form.computeLabel = () => lotusT(label);
      form.dataset.fieldPath = path;
      form.addEventListener("value-changed", (event) => {
        const picked = event.detail?.value?.image;
        const next = typeof picked === "string" ? picked : String(picked?.media_content_id ?? "");
        if (next !== current) onChange(next);
      });
      parent.appendChild(form);
      return form;
    }
    return this._text(parent, path, label, current, onChange);
  }

  _securityMode() {
    return this._config.security?.mode || DIGICODE_SECURITY_MODES.FRONTEND;
  }

  _usesServerSecurity() {
    return SERVER_SECURITY_MODES.has(this._securityMode());
  }

  getSaveValidation() {
    const mode = this._securityMode();

    if (mode === DIGICODE_SECURITY_MODES.FRONTEND) {
      const entityId = String(this._config.code_entity ?? "").trim();
      if (!entityId) {
        return { valid: false, pending: false, reason: "Sélectionnez l’entrée Nombre Home Assistant qui contient le PIN." };
      }
      const domain = entityId.split(".", 1)[0];
      if (!FRONTEND_PIN_DOMAINS.has(domain)) {
        return { valid: false, pending: false, reason: "Le niveau 1 exige une entrée Home Assistant de type Nombre (input_number)." };
      }
      if (!this._hass?.states) {
        return { valid: false, pending: true, reason: "Vérification de l’entrée Nombre Home Assistant en cours." };
      }
      if (!this._hass.states[entityId]) {
        return { valid: false, pending: false, reason: `L’entrée ${entityId} n’existe pas dans les états Home Assistant.` };
      }
      const result = integerCodeFromState(this._hass, entityId);
      if (!result.code) {
        return { valid: false, pending: false, reason: result.reason || "La valeur de l’entrée Nombre ne contient pas un PIN entier valide." };
      }
      return { valid: true, pending: false, reason: `PIN niveau 1 détecté dans ${entityId} (${result.code.length} chiffre${result.code.length > 1 ? "s" : ""}).` };
    }

    const pinId = String(this._config.security?.pin_id ?? "").trim();
    if (!pinId) {
      return { valid: false, pending: false, reason: "Identifiant serveur du Digicode manquant." };
    }
    if (this._pendingServerPin) {
      return { valid: false, pending: false, reason: "Un nouveau PIN est saisi mais n’a pas encore été enregistré sur le serveur." };
    }
    const status = this._serverSecurityStatus || {};
    if (String(status.pin_id ?? "") !== pinId) {
      return { valid: false, pending: true, reason: "Vérification du PIN réellement enregistré sur le serveur en cours." };
    }
    if (!status.loaded) {
      return { valid: false, pending: true, reason: "Vérification du PIN réellement enregistré sur le serveur en cours." };
    }
    if (status.error) {
      return { valid: false, pending: false, reason: `Impossible de vérifier le PIN serveur : ${status.error}` };
    }
    if (!status.configured || !(Number(status.length) > 0)) {
      return { valid: false, pending: false, reason: "Aucun PIN n’est enregistré côté serveur pour ce Digicode." };
    }
    if (status.mode !== mode) {
      return { valid: false, pending: false, reason: "Le PIN serveur existe mais n’a pas été enregistré avec le niveau de sécurité actuellement sélectionné." };
    }
    return { valid: true, pending: false, reason: `PIN serveur configuré (${Number(status.length)} chiffre${Number(status.length) > 1 ? "s" : ""}).` };
  }

  _notifySaveValidity() {
    const validation = this.getSaveValidation();
    const signature = JSON.stringify(validation);
    this._updateSaveGuard(null, validation);
    if (signature === this._lastSaveValiditySignature) return validation;
    this._lastSaveValiditySignature = signature;

    // IMPORTANT: never force the Home Assistant edit dialog to update in the
    // same JavaScript turn as config-changed. HuiElementEditor first stores the
    // new custom-card config, then propagates it to hui-dialog-edit-card from
    // its Lit updateComplete promise. A synchronous validity event can make our
    // dialog bridge request a render while the dialog still owns the previous
    // config; HA then calls setConfig(oldConfig) on this editor and the security
    // selector appears to jump back to level 1. Defer/coalesce validity events
    // to the next animation frame, after HA's config propagation microtasks.
    this._pendingValidityDetail = validation;
    if (!this._validityEventRaf) {
      this._validityEventRaf = requestAnimationFrame(() => {
        this._validityEventRaf = 0;
        const detail = this._pendingValidityDetail || this.getSaveValidation();
        this._pendingValidityDetail = null;
        if (!this.isConnected) return;
        this.dispatchEvent(new CustomEvent(DIGICODE_VALIDITY_EVENT, {
          bubbles: true,
          composed: true,
          detail,
        }));
      });
    }
    return validation;
  }

  _updateSaveGuard(explicitNode = null, validation = null) {
    const node = explicitNode || this.shadowRoot?.querySelector('[data-save-guard="1"]');
    if (!node) return;
    const result = validation || this.getSaveValidation();
    if (result.valid) {
      node.textContent = lotusT(`Enregistrement autorisé — ${result.reason}`);
      node.dataset.kind = "ok";
    } else if (result.pending) {
      node.textContent = lotusT(`Enregistrement bloqué — ${result.reason}`);
      node.dataset.kind = "info";
    } else {
      node.textContent = lotusT(`Enregistrement bloqué — ${result.reason}`);
      node.dataset.kind = "error";
    }
  }

  _renderSaveGuard(parent) {
    const guard = document.createElement("div");
    guard.className = "save-guard";
    guard.dataset.saveGuard = "1";
    parent.appendChild(guard);
    this._updateSaveGuard(guard);
  }

  _passwordField(parent, label) {
    const wrap = document.createElement("label");
    wrap.className = "fallback-field lotus-pin-field";
    const span = document.createElement("span");
    span.textContent = lotusT(label);
    const input = document.createElement("input");
    input.type = "password";
    input.inputMode = "numeric";
    input.autocomplete = "new-password";
    input.maxLength = 12;
    input.placeholder = lotusT("PIN (1 à 12 chiffres)");
    input.value = this._pendingServerPin;
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 12);
      this._pendingServerPin = input.value;
      const status = this.shadowRoot?.querySelector('[data-code-status="1"]');
      if (status && this._pendingServerPin) {
        status.textContent = lotusT("Nouveau PIN saisi mais pas encore enregistré sur le serveur.");
        status.dataset.kind = "info";
      } else {
        this._updateCodeStatus(status);
      }
      this._notifySaveValidity();
    });
    wrap.append(span, input);
    parent.appendChild(wrap);
    return input;
  }

  _securityHelp(parent, title, lines, kind = "info") {
    const box = document.createElement("div");
    box.className = `security-help ${kind}`;
    const heading = document.createElement("strong");
    heading.textContent = lotusT(title);
    box.appendChild(heading);
    const list = document.createElement("ol");
    for (const line of lines) {
      const item = document.createElement("li");
      item.textContent = line;
      list.appendChild(item);
    }
    box.appendChild(list);
    parent.appendChild(box);
  }

  async _loadEditorServerStatus() {
    if (!this._usesServerSecurity()) {
      this._serverSecurityStatus = { loaded: true, configured: false, length: 0, mode: null, pin_id: "", error: "" };
      this._updateCodeStatus();
      this._notifySaveValidity();
      return;
    }
    const pinId = String(this._config.security?.pin_id ?? "").trim();
    if (!this._hass?.callWS || !pinId) {
      this._serverSecurityStatus = { loaded: Boolean(this._hass), configured: false, length: 0, mode: null, pin_id: pinId, error: pinId ? "WebSocket Home Assistant indisponible." : "Identifiant serveur manquant." };
      this._updateCodeStatus();
      this._notifySaveValidity();
      return;
    }
    const token = ++this._serverStatusToken;
    try {
      const status = await this._hass.callWS({ type: "lotus_view_studio/digicode/status", pin_id: pinId });
      if (token !== this._serverStatusToken) return;
      this._serverSecurityStatus = {
        loaded: true,
        configured: status?.configured === true,
        length: Number(status?.length) || 0,
        mode: status?.mode || null,
        pin_id: pinId,
        error: "",
      };
    } catch (error) {
      if (token !== this._serverStatusToken) return;
      this._serverSecurityStatus = { loaded: true, configured: false, length: 0, mode: null, pin_id: pinId, error: String(error?.message || error || "Erreur serveur") };
    }
    this._updateCodeStatus();
    this._notifySaveValidity();
  }

  async _saveServerPin(button) {
    const mode = this._securityMode();
    const pinId = String(this._config.security?.pin_id ?? "").trim();
    const pin = String(this._pendingServerPin ?? "");
    const status = this.shadowRoot?.querySelector('[data-code-status="1"]');
    if (!pinId) {
      if (status) { status.textContent = lotusT("Identifiant serveur manquant."); status.dataset.kind = "error"; }
      return;
    }
    if (!/^\d{1,12}$/.test(pin)) {
      if (status) { status.textContent = lotusT("Le PIN doit contenir de 1 à 12 chiffres."); status.dataset.kind = "error"; }
      return;
    }
    if (!this._hass?.callWS) {
      if (status) { status.textContent = lotusT("Connexion WebSocket Home Assistant indisponible."); status.dataset.kind = "error"; }
      return;
    }
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = lotusT("Enregistrement…");
    try {
      const message = {
        type: "lotus_view_studio/digicode/save",
        pin_id: pinId,
        mode,
        action: clone(this._config.action),
      };
      if (mode === DIGICODE_SECURITY_MODES.SERVER_ENCRYPTED) {
        const encrypted = await encryptedPinPayload(this._hass, pin);
        message.ciphertext = encrypted.ciphertext;
        message.challenge = encrypted.challenge;
      } else {
        message.pin = pin;
      }
      const result = await this._hass.callWS(message);
      this._pendingServerPin = "";
      const input = this.shadowRoot?.querySelector(".lotus-pin-field input");
      if (input) input.value = "";
      this._serverSecurityStatus = {
        loaded: true,
        configured: result?.configured === true,
        length: Number(result?.length) || pin.length,
        mode: result?.mode || mode,
        pin_id: pinId,
        error: "",
      };

      // Mark a successful server PIN replacement as a real (non-secret) card
      // configuration change. Only this revision enters YAML, never the PIN.
      const next = normalize(this._config);
      next.security.revision = Math.max(0, Math.trunc(Number(next.security.revision) || 0)) + 1;
      this._config = normalize(next);
      this._emit();

      // Reload the preview immediately so the newly stored PIN works without
      // closing and reopening the Home Assistant card editor.
      const preview = this.shadowRoot?.querySelector("lotus-digicode-card");
      if (preview) {
        preview.preview = true;
        preview.hass = this._hass;
        preview.setConfig(this._config);
      }
      this._updateCodeStatus();
      this._notifySaveValidity();
    } catch (error) {
      if (status) {
        status.textContent = lotusT(`Échec de l’enregistrement serveur : ${String(error?.message || error || "erreur inconnue")}`);
        status.dataset.kind = "error";
      }
      this._notifySaveValidity();
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  _renderSecuritySource(parent) {
    this._nativeSelectField(parent, "security.mode", "Niveau de sécurité du PIN", this._securityMode(), [
      [DIGICODE_SECURITY_MODES.FRONTEND, "Niveau 1 — Entité Home Assistant (compatibilité)"],
      [DIGICODE_SECURITY_MODES.SERVER_PLAIN, "Niveau 2 — PIN côté serveur, stocké en clair"],
      [DIGICODE_SECURITY_MODES.SERVER_ENCRYPTED, "Niveau 3 — PIN chiffré navigateur → serveur + hash au repos"],
    ], (value) => {
      this._pendingServerPin = "";
      this._commit((config) => {
        config.security.mode = String(value || DIGICODE_SECURITY_MODES.FRONTEND);
        if (SERVER_SECURITY_MODES.has(config.security.mode) && !config.security.pin_id) config.security.pin_id = makePinId();
      });
      queueMicrotask(() => this._loadEditorServerStatus());
    });

    const mode = this._securityMode();
    if (mode === DIGICODE_SECURITY_MODES.FRONTEND) {
      this._securityHelp(parent, "Comment enregistrer le code dans Home Assistant", [
        "Ouvrez Paramètres → Appareils et services → Entrées (Helpers).",
        "Créez une entrée de type Nombre et réglez-la avec un pas de 1.",
        "Placez la valeur du Nombre sur le PIN souhaité, puis sélectionnez cette entité ci-dessous.",
        "Ce mode ne permet pas un PIN commençant par 0 et la valeur reste lisible par le frontend Home Assistant.",
      ], "warning");
      this._codeEntity(parent);
      return;
    }

    this._text(parent, "security.pin_id", "Identifiant serveur du digicode", this._config.security.pin_id, (value) => {
      this._commit((config) => { config.security.pin_id = String(value || "").trim(); });
      queueMicrotask(() => this._loadEditorServerStatus());
    });

    if (mode === DIGICODE_SECURITY_MODES.SERVER_PLAIN) {
      this._securityHelp(parent, "Comment enregistrer le code dans Home Assistant", [
        "Aucun Helper Nombre n’est nécessaire.",
        "Saisissez le PIN dans le champ ci-dessous.",
        "Cliquez sur « Enregistrer le PIN et l’action sur le serveur ».",
        "Le PIN est alors conservé par l’intégration Lotus View Studio côté serveur et n’apparaît ni dans le YAML de la carte ni dans les états Home Assistant.",
      ], "warning");
      const note = document.createElement("p");
      note.className = "security-note warning";
      note.textContent = location.protocol === "https:"
        ? "Le PIN est envoyé comme donnée applicative en clair dans le WebSocket, mais le transport HTTPS/WSS le chiffre sur le réseau. Il reste stocké en clair côté serveur."
        : "Attention : cette instance est ouverte en HTTP. Le PIN de niveau 2 peut donc être observable sur le réseau local en plus d’être stocké en clair côté serveur.";
      parent.appendChild(note);
    } else {
      this._securityHelp(parent, "Comment enregistrer le code dans Home Assistant", [
        "Aucun Helper Nombre n’est nécessaire.",
        "Saisissez le PIN dans le champ ci-dessous.",
        "Cliquez sur « Enregistrer le PIN et l’action sur le serveur ».",
        "Le navigateur chiffre immédiatement le PIN avec la clé publique éphémère de Lotus View Studio avant l’envoi.",
        "Le serveur déchiffre le PIN uniquement en mémoire puis conserve seulement un hash PBKDF2-SHA256 salé. Le PIN n’est jamais enregistré en clair.",
      ], "ok");
      const note = document.createElement("p");
      note.className = "security-note";
      note.textContent = lotusT("Le PIN existe nécessairement quelques instants dans la mémoire du navigateur pendant votre saisie. Ce niveau protège son transport applicatif et son stockage serveur, mais ne peut pas protéger un navigateur déjà compromis par une extension ou un logiciel espion.");
      parent.appendChild(note);
    }

    this._passwordField(parent, "PIN à enregistrer côté serveur");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "server-pin-save";
    button.textContent = lotusT("Enregistrer le PIN et l’action sur le serveur");
    button.addEventListener("click", () => this._saveServerPin(button));
    parent.appendChild(button);

    const status = document.createElement("div");
    status.className = "code-status";
    status.dataset.codeStatus = "1";
    parent.appendChild(status);
    this._updateCodeStatus(status);
  }

  _codeEntity(parent) {
    const current = String(this._config.code_entity ?? "");
    const options = [["", "—"]];
    const states = this._hass?.states || {};
    const inputNumbers = Object.keys(states)
      .filter((entityId) => entityId.startsWith("input_number."))
      .sort((a, b) => {
        const an = String(states[a]?.attributes?.friendly_name || a);
        const bn = String(states[b]?.attributes?.friendly_name || b);
        return an.localeCompare(bn);
      });

    // Preserve an already configured entity even if it is temporarily
    // unavailable, so opening the editor can never silently clear the PIN
    // source.
    if (current && !inputNumbers.includes(current)) inputNumbers.unshift(current);

    for (const entityId of inputNumbers) {
      const friendlyName = states[entityId]?.attributes?.friendly_name;
      options.push([
        entityId,
        friendlyName ? `${friendlyName} (${entityId})` : entityId,
      ]);
    }

    this._nativeSelectField(
      parent,
      "code_entity",
      "Nombre Home Assistant contenant le code",
      current,
      options,
      (value) => {
        this._commit((config) => { config.code_entity = String(value ?? ""); });
      },
    );
    const status = document.createElement("div");
    status.className = "code-status";
    status.dataset.codeStatus = "1";
    parent.appendChild(status);
    this._updateCodeStatus(status);
  }

  _updateCodeStatus(explicitNode = null) {
    const status = explicitNode || this.shadowRoot?.querySelector('[data-code-status="1"]');
    if (!status) return;
    const mode = this._securityMode();
    if (mode === DIGICODE_SECURITY_MODES.FRONTEND) {
      const result = integerCodeFromState(this._hass, this._config.code_entity);
      if (!this._config.code_entity) {
        status.textContent = lotusT("Sélectionnez un nombre. Sa valeur entière devient le code et définit automatiquement sa longueur.");
        status.dataset.kind = "info";
        return;
      }
      if (!result.code) {
        status.textContent = result.reason;
        status.dataset.kind = "error";
        return;
      }
      status.textContent = lotusT(`Code détecté : ${result.code.length} chiffre${result.code.length > 1 ? "s" : ""}. La valeur elle-même n’est pas affichée dans l’éditeur Lotus.`);
      status.dataset.kind = "ok";
      return;
    }

    if (this._pendingServerPin) {
      status.textContent = lotusT("Nouveau PIN saisi mais pas encore enregistré sur le serveur.");
      status.dataset.kind = "info";
      return;
    }

    if (!this._config.security.pin_id) {
      status.textContent = lotusT("Définissez un identifiant serveur pour ce digicode.");
      status.dataset.kind = "error";
      return;
    }
    if (!this._serverSecurityStatus.loaded) {
      status.textContent = lotusT("Vérification de la configuration serveur…");
      status.dataset.kind = "info";
      return;
    }
    if (this._serverSecurityStatus.error) {
      status.textContent = this._serverSecurityStatus.error;
      status.dataset.kind = "error";
      return;
    }
    if (!this._serverSecurityStatus.configured) {
      status.textContent = lotusT("Aucun PIN n’est encore enregistré pour cet identifiant serveur.");
      status.dataset.kind = "info";
      return;
    }
    if (this._serverSecurityStatus.mode !== mode) {
      status.textContent = lotusT("Un PIN existe, mais il a été enregistré avec un autre niveau de sécurité. Enregistrez-le de nouveau pour appliquer ce niveau.");
      status.dataset.kind = "error";
      return;
    }
    status.textContent = lotusT(`PIN serveur configuré : ${this._serverSecurityStatus.length} chiffre${this._serverSecurityStatus.length > 1 ? "s" : ""}. Le PIN lui-même n’est jamais renvoyé à l’éditeur. L’aperçu teste ce PIN réel sans exécuter l’action.`);
    status.dataset.kind = "ok";
  }

  _renderAction(parent) {
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field action-field";
      form.hass = this._hass;
      form.data = { action: clone(this._config.action) };
      form.schema = [{ name: "action", required: false, selector: { ui_action: { default_action: "none" } } }];
      form.computeLabel = () => lotusT("Action exécutée lorsque le code est correct");
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

  _renderSymbolFields(parent) {
    const grid = document.createElement("div");
    grid.className = "symbol-grid";
    for (let i = 0; i <= 9; i += 1) {
      const digit = String(i);
      const cell = document.createElement("div");
      cell.className = "symbol-cell";
      const type = this._config.symbols.types[digit] || "text";
      this._select(
        cell,
        `symbols.types.${digit}`,
        `Visuel de la touche ${digit}`,
        type,
        [["text", "Texte / caractère"], ["icon", "Icône Home Assistant"], ["image", "Image / dessin"]],
        (value) => this._commit((c) => { c.symbols.types[digit] = value; }),
      );
      if (type === "icon") {
        this._icon(cell, `symbols.labels.${digit}`, `Icône de la touche ${digit}`, this._config.symbols.labels[digit], (value) => {
          this._commit((c) => { c.symbols.labels[digit] = value; });
        });
      } else if (type === "image") {
        this._image(cell, `symbols.labels.${digit}`, `Image de la touche ${digit}`, this._config.symbols.labels[digit], (value) => {
          this._commit((c) => { c.symbols.labels[digit] = value; });
        });
      } else {
        this._text(cell, `symbols.labels.${digit}`, `Texte de la touche ${digit}`, this._config.symbols.labels[digit], (value) => {
          this._commit((c) => { c.symbols.labels[digit] = value; });
        });
      }
      grid.appendChild(cell);
    }
    parent.appendChild(grid);
    const note = document.createElement("p");
    note.className = "field-note";
    note.textContent = lotusT("Le contenu affiché peut être un texte, une icône Home Assistant ou une image. La touche conserve toujours sa valeur numérique réelle pour la saisie du code.");
    parent.appendChild(note);
  }

  _orderTokenLabel(token) {
    if (token === "backspace") return "Supprimer";
    if (token === "clear") return "Annuler";
    return token;
  }

  _moveOrderToken(token, delta) {
    const order = normalizeKeyOrder(this._config.keys.order);
    const from = order.indexOf(token);
    if (from < 0) return;
    const to = Math.max(0, Math.min(order.length - 1, from + delta));
    if (from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    this._commit((config) => { config.keys.order = next; });
  }

  _dropOrderToken(sourceToken, targetToken) {
    const order = normalizeKeyOrder(this._config.keys.order);
    const from = order.indexOf(sourceToken);
    const to = order.indexOf(targetToken);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    this._commit((config) => { config.keys.order = next; });
  }

  _renderOrderEditor(parent) {
    this._boolean(
      parent,
      "keys.randomize_digits",
      "Placement aléatoire des chiffres 0 à 9",
      this._config.keys.randomize_digits,
      (value) => this._commit((config) => { config.keys.randomize_digits = value; }),
    );

    const note = document.createElement("p");
    note.className = "field-note";
    note.textContent = this._config.keys.randomize_digits
      ? "L’ordre ci-dessous fixe les emplacements. Supprimer et Annuler restent à la place choisie ; seuls les dix chiffres sont redistribués entre les emplacements numériques à chaque nouvelle tentative."
      : "Faites glisser les touches ou utilisez les flèches pour définir leur ordre. Cet ordre est celui du digicode lorsque le placement aléatoire est désactivé.";
    parent.appendChild(note);

    const grid = document.createElement("div");
    grid.className = "order-grid";
    const order = normalizeKeyOrder(this._config.keys.order);
    order.forEach((token, index) => {
      const slot = document.createElement("div");
      slot.className = `order-slot${token === "backspace" || token === "clear" ? " control" : " digit"}`;
      if ((token === "backspace" && !this._config.backspace.enabled) || (token === "clear" && !this._config.clear.enabled)) {
        slot.classList.add("disabled-control");
      }
      slot.draggable = true;
      slot.dataset.token = token;
      slot.title = lotusT("Glisser pour déplacer cette touche");
      slot.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", token);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        slot.classList.add("dragging");
      });
      slot.addEventListener("dragend", () => slot.classList.remove("dragging"));
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("drag-over");
        const source = event.dataTransfer?.getData("text/plain") || "";
        this._dropOrderToken(source, token);
      });

      const position = document.createElement("span");
      position.className = "order-position";
      position.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "order-label";
      label.textContent = this._orderTokenLabel(token);

      const controls = document.createElement("span");
      controls.className = "order-controls";
      const previous = document.createElement("button");
      previous.type = "button";
      previous.textContent = "←";
      previous.title = lotusT("Déplacer d’une position vers le début");
      previous.disabled = index === 0;
      previous.addEventListener("click", (event) => { event.stopPropagation(); this._moveOrderToken(token, -1); });
      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "→";
      next.title = lotusT("Déplacer d’une position vers la fin");
      next.disabled = index === order.length - 1;
      next.addEventListener("click", (event) => { event.stopPropagation(); this._moveOrderToken(token, 1); });
      controls.append(previous, next);
      slot.append(position, label, controls);
      grid.appendChild(slot);
    });
    parent.appendChild(grid);

    if (this._config.keys.randomize_digits) {
      const reshuffle = document.createElement("button");
      reshuffle.type = "button";
      reshuffle.className = "preview-shuffle";
      reshuffle.textContent = lotusT("Mélanger à nouveau l’aperçu");
      reshuffle.addEventListener("click", () => {
        const preview = this.shadowRoot?.querySelector("lotus-digicode-card");
        preview?.reshuffleDigits?.();
      });
      parent.appendChild(reshuffle);
    }
  }

  _layoutPreviewShell() {
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const shell = this.shadowRoot?.querySelector(".preview-shell");
    if (!frame || !shell || this._activeResize) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 20 || rect.height <= 20) return;
    const pad = 42;
    const availW = Math.max(60, rect.width - pad * 2);
    const availH = Math.max(90, rect.height - pad * 2);
    const ratio = this._config.design.width / Math.max(1, this._config.design.height);
    let width = availW;
    let height = width / ratio;
    if (height > availH) {
      height = availH;
      width = height * ratio;
    }
    width = Math.max(100, Math.min(width, availW));
    height = Math.max(140, Math.min(height, availH));
    shell.style.width = `${width}px`;
    shell.style.height = `${height}px`;
    shell.style.left = `${(rect.width - width) / 2}px`;
    shell.style.top = `${(rect.height - height) / 2}px`;
  }

  _startResize(edge, event) {
    event.preventDefault();
    event.stopPropagation();
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const shell = this.shadowRoot?.querySelector(".preview-shell");
    if (!frame || !shell) return;
    const frameRect = frame.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    this._activeResize = {
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      frameRect,
      left: shellRect.left - frameRect.left,
      top: shellRect.top - frameRect.top,
      width: shellRect.width,
      height: shellRect.height,
      designWidth: this._config.design.width,
      designHeight: this._config.design.height,
    };
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", this._onResizeMove, true);
    window.addEventListener("pointerup", this._onResizeEnd, true);
    window.addEventListener("pointercancel", this._onResizeEnd, true);
  }

  _onResizeMove = (event) => {
    const state = this._activeResize;
    if (!state || event.pointerId !== state.pointerId) return;
    const shell = this.shadowRoot?.querySelector(".preview-shell");
    if (!shell) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const minW = 100;
    const minH = 140;
    const maxW = Math.max(minW, state.frameRect.width - 24);
    const maxH = Math.max(minH, state.frameRect.height - 24);
    let { left, top, width, height } = state;

    if (state.edge === "right") width = clamp(state.width + dx, minW, maxW - state.left);
    if (state.edge === "left") {
      width = clamp(state.width - dx, minW, state.width + state.left - 12);
      left = state.left + (state.width - width);
    }
    if (state.edge === "bottom") height = clamp(state.height + dy, minH, maxH - state.top);
    if (state.edge === "top") {
      height = clamp(state.height - dy, minH, state.height + state.top - 12);
      top = state.top + (state.height - height);
    }

    shell.style.left = `${left}px`;
    shell.style.top = `${top}px`;
    shell.style.width = `${width}px`;
    shell.style.height = `${height}px`;

    const preview = shell.querySelector("lotus-digicode-card");
    if (preview) {
      const temp = normalize(this._config);
      temp.design.width = state.edge === "left" || state.edge === "right"
        ? clamp(state.designWidth * (width / state.width), 20, 200)
        : state.designWidth;
      temp.design.height = state.edge === "top" || state.edge === "bottom"
        ? clamp(state.designHeight * (height / state.height), 20, 200)
        : state.designHeight;
      preview.setConfig(temp);
      preview.hass = this._hass;
      preview.preview = true;
      shell.dataset.liveWidth = temp.design.width.toFixed(1);
      shell.dataset.liveHeight = temp.design.height.toFixed(1);
    }
  };

  _onResizeEnd = (event) => {
    const state = this._activeResize;
    if (!state || event.pointerId !== state.pointerId) return;
    const shell = this.shadowRoot?.querySelector(".preview-shell");
    const rect = shell?.getBoundingClientRect();
    this._stopResizeListeners();
    this._activeResize = null;
    if (!rect) return;
    const next = normalize(this._config);
    if (state.edge === "left" || state.edge === "right") {
      next.design.width = clamp(state.designWidth * (rect.width / state.width), 20, 200);
    } else {
      next.design.height = clamp(state.designHeight * (rect.height / state.height), 20, 200);
    }
    this._config = normalize(next);
    this._emit();
    this._render();
  };

  _stopResizeListeners() {
    window.removeEventListener("pointermove", this._onResizeMove, true);
    window.removeEventListener("pointerup", this._onResizeEnd, true);
    window.removeEventListener("pointercancel", this._onResizeEnd, true);
  }

  _render() {
    if (!this.shadowRoot) return;
    this._previewResizeObserver.disconnect();

    const root = document.createElement("div");
    root.className = "editor-grid";
    const pane = document.createElement("div");
    pane.className = "config-pane";
    const previewPane = document.createElement("div");
    previewPane.className = "preview-pane";

    const identity = this._section("Nom");
    this._text(identity, "name", "Nom", this._config.name, (value) => this._commit((c) => { c.name = value; }));
    pane.appendChild(identity);

    const source = this._section("Code et sécurité", "Choisissez où le PIN est conservé et comment il est validé. Les niveaux 2 et 3 effectuent la validation côté serveur Lotus View Studio.");
    this._renderSecuritySource(source);
    this._renderSaveGuard(source);
    pane.appendChild(source);

    const format = this._section("Format responsive", "Le rapport largeur/hauteur sert de référence à Lotus View Studio. Vous pouvez aussi tirer directement sur les quatre côtés de l’aperçu.");
    this._number(format, "design.width", "Largeur de référence", this._config.design.width, 20, 200, 1, (value) => this._commit((c) => { c.design.width = Number(value); }), "box");
    this._number(format, "design.height", "Hauteur de référence", this._config.design.height, 20, 200, 1, (value) => this._commit((c) => { c.design.height = Number(value); }), "box");
    pane.appendChild(format);

    const interaction = this._section(
      "Interaction",
      "En mode blocage, lorsqu’un Digicode est visible dans une vue Lotus View Studio, les cartes et commandes situées derrière deviennent inaccessibles jusqu’à la disparition du Digicode. Le Digicode reste le seul élément interactif."
    );
    this._boolean(
      interaction,
      "interaction.modal_blocker",
      "Bloquer tous les clics autour du digicode pendant son affichage",
      this._config.interaction.modal_blocker,
      (value) => this._commit((c) => { c.interaction.modal_blocker = value; }),
    );
    pane.appendChild(interaction);

    const frame = this._section("Contour du digicode");
    this._color(frame, "frame.background_color", "Couleur de fond", this._config.frame.background_color === "theme" ? "white" : this._config.frame.background_color, (value) => this._commit((c) => { c.frame.background_color = value; }));
    this._number(frame, "frame.border_width", "Épaisseur du contour (px)", this._config.frame.border_width, 0, 16, 1, (value) => this._commit((c) => { c.frame.border_width = Number(value); }));
    this._color(frame, "frame.border_color", "Couleur du contour", this._config.frame.border_color, (value) => this._commit((c) => { c.frame.border_color = value; }));
    this._number(frame, "frame.radius", "Arrondi (% du petit côté)", this._config.frame.radius, 0, 50, 1, (value) => this._commit((c) => { c.frame.radius = Number(value); }));
    this._number(frame, "frame.padding", "Marge intérieure (px)", this._config.frame.padding, 0, 18, 1, (value) => this._commit((c) => { c.frame.padding = Number(value); }));
    pane.appendChild(frame);

    const matrix = this._section("Matrice des touches", "Le nombre de lignes peut être 2, 3 ou 4. Une dernière ligne incomplète peut être alignée ou étirée.");
    this._select(matrix, "keys.rows", "Nombre de lignes", String(this._config.keys.rows), [["2", "2 lignes"], ["3", "3 lignes"], ["4", "4 lignes"]], (value) => this._commit((c) => { c.keys.rows = Number(value); }));
    this._select(matrix, "keys.last_row_align", "Dernière ligne incomplète", this._config.keys.last_row_align, [["left", "Aligner à gauche"], ["center", "Centrer"], ["right", "Aligner à droite"], ["stretch", "Ajuster à la largeur"]], (value) => this._commit((c) => { c.keys.last_row_align = value; }));
    this._number(matrix, "keys.gap", "Espacement entre les touches (px)", this._config.keys.gap, 0, 12, 1, (value) => this._commit((c) => { c.keys.gap = Number(value); }));
    pane.appendChild(matrix);

    const order = this._section("Ordre et placement des touches", "L’ordre définit les emplacements de toutes les touches. Le mélange aléatoire, s’il est activé, ne déplace jamais Supprimer ni Annuler : seuls les chiffres 0 à 9 changent entre les emplacements numériques.");
    this._renderOrderEditor(order);
    pane.appendChild(order);

    const keys = this._section("Touches");
    this._select(keys, "keys.shape", "Forme des touches", this._config.keys.shape, [
      ["rounded", "Rectangle arrondi"],
      ["square", "Carré"],
      ["circle", "Cercle / ellipse"],
      ["diamond", "Losange"],
      ["triangle-up", "Triangle vers le haut"],
      ["triangle-down", "Triangle vers le bas"],
      ["triangle-left", "Triangle vers la gauche"],
      ["triangle-right", "Triangle vers la droite"],
      ["pentagon", "Pentagone"],
      ["hexagon", "Hexagone"],
      ["octagon", "Octogone"],
    ], (value) => this._commit((c) => { c.keys.shape = value; }));
    this._color(keys, "keys.background_color", "Couleur des touches", this._config.keys.background_color, (value) => this._commit((c) => { c.keys.background_color = value; }));
    this._color(keys, "keys.pressed_color", "Couleur à l’appui", this._config.keys.pressed_color, (value) => this._commit((c) => { c.keys.pressed_color = value; }));
    this._number(keys, "keys.border_width", "Épaisseur du contour (px)", this._config.keys.border_width, 0, 12, 1, (value) => this._commit((c) => { c.keys.border_width = Number(value); }));
    this._color(keys, "keys.border_color", "Couleur du contour", this._config.keys.border_color, (value) => this._commit((c) => { c.keys.border_color = value; }));
    if (this._config.keys.shape === "rounded") {
      this._number(keys, "keys.radius", "Arrondi des coins (% du petit côté, limité pour conserver des côtés droits)", this._config.keys.radius, 0, KEY_RECT_MAX_RADIUS_PERCENT, 1, (value) => this._commit((c) => { c.keys.radius = Number(value); }));
    } else if (this._config.keys.shape !== "circle") {
      this._number(keys, "keys.corner_radius", "Arrondi des sommets (%)", this._config.keys.corner_radius, 0, 50, 1, (value) => this._commit((c) => { c.keys.corner_radius = Number(value); }));
    }
    this._color(keys, "keys.label_color", "Couleur des chiffres / symboles", this._config.keys.label_color, (value) => this._commit((c) => { c.keys.label_color = value; }));
    this._number(keys, "keys.label_size", "Taille des chiffres / symboles (px)", this._config.keys.label_size, 10, 42, 1, (value) => this._commit((c) => { c.keys.label_size = Number(value); }));
    pane.appendChild(keys);

    const symbols = this._section("Contenu des touches", "Les touches continuent à saisir 0–9, mais leur contenu visuel peut être remplacé par du texte, une icône Home Assistant ou une image/dessin.");
    this._boolean(symbols, "symbols.enabled", "Personnaliser le contenu des touches numériques", this._config.symbols.enabled, (value) => this._commit((c) => { c.symbols.enabled = value; }));
    if (this._config.symbols.enabled) this._renderSymbolFields(symbols);
    pane.appendChild(symbols);

    const display = this._section("Cadran de saisie");
    this._select(display, "display.mask", "Caractère de masquage", this._config.display.mask, [["asterisk", "Astérisque *"], ["dot", "Point ●"], ["square", "Carré ■"], ["diamond", "Losange ◆"], ["custom", "Personnalisé"]], (value) => this._commit((c) => { c.display.mask = value; }));
    if (this._config.display.mask === "custom") this._text(display, "display.custom_mask", "Caractère personnalisé", this._config.display.custom_mask, (value) => this._commit((c) => { c.display.custom_mask = value; }));
    this._color(display, "display.background_color", "Couleur du cadran", this._config.display.background_color, (value) => this._commit((c) => { c.display.background_color = value; }));
    this._number(display, "display.border_width", "Épaisseur du contour (px)", this._config.display.border_width, 0, 12, 1, (value) => this._commit((c) => { c.display.border_width = Number(value); }));
    this._color(display, "display.border_color", "Couleur du contour", this._config.display.border_color, (value) => this._commit((c) => { c.display.border_color = value; }));
    this._number(display, "display.radius", "Arrondi (% du petit côté)", this._config.display.radius, 0, 50, 1, (value) => this._commit((c) => { c.display.radius = Number(value); }));
    this._color(display, "display.color", "Couleur du masquage", this._config.display.color, (value) => this._commit((c) => { c.display.color = value; }));
    this._number(display, "display.font_size", "Taille du masquage (px)", this._config.display.font_size, 10, 48, 1, (value) => this._commit((c) => { c.display.font_size = Number(value); }));
    this._number(display, "display.height", "Hauteur du cadran (%)", this._config.display.height, 10, 32, 1, (value) => this._commit((c) => { c.display.height = Number(value); }));
    pane.appendChild(display);

    const controls = this._section("Correction de saisie");
    this._boolean(controls, "backspace.enabled", "Bouton : effacer le dernier chiffre", this._config.backspace.enabled, (value) => this._commit((c) => { c.backspace.enabled = value; }));
    if (this._config.backspace.enabled) this._icon(controls, "backspace.icon", "Icône retour arrière", this._config.backspace.icon, (value) => this._commit((c) => { c.backspace.icon = value; }));
    this._boolean(controls, "clear.enabled", "Bouton : effacer tout le code saisi", this._config.clear.enabled, (value) => this._commit((c) => { c.clear.enabled = value; }));
    if (this._config.clear.enabled) this._icon(controls, "clear.icon", "Icône effacement complet", this._config.clear.icon, (value) => this._commit((c) => { c.clear.icon = value; }));
    pane.appendChild(controls);

    const error = this._section("Retour en cas d’erreur");
    this._select(error, "error.mode", "Affichage", this._config.error.mode, [["message", "Message"], ["icon", "Icône"], ["both", "Icône + message"], ["none", "Aucun"]], (value) => this._commit((c) => { c.error.mode = value; }));
    if (this._config.error.mode === "message" || this._config.error.mode === "both") this._text(error, "error.message", "Message", this._config.error.message, (value) => this._commit((c) => { c.error.message = value; }));
    if (this._config.error.mode === "icon" || this._config.error.mode === "both") this._icon(error, "error.icon", "Icône", this._config.error.icon, (value) => this._commit((c) => { c.error.icon = value; }));
    this._color(error, "error.color", "Couleur", this._config.error.color, (value) => this._commit((c) => { c.error.color = value; }));
    this._number(error, "error.delay", "Délai avant réinitialisation (ms)", this._config.error.delay, 200, 5000, 50, (value) => this._commit((c) => { c.error.delay = Number(value); }), "box");
    pane.appendChild(error);

    const success = this._section("Retour en cas de code correct");
    this._select(success, "success.mode", "Affichage", this._config.success.mode, [["message", "Message"], ["icon", "Icône"], ["both", "Icône + message"], ["none", "Aucun"]], (value) => this._commit((c) => { c.success.mode = value; }));
    if (this._config.success.mode === "message" || this._config.success.mode === "both") this._text(success, "success.message", "Message", this._config.success.message, (value) => this._commit((c) => { c.success.message = value; }));
    if (this._config.success.mode === "icon" || this._config.success.mode === "both") this._icon(success, "success.icon", "Icône", this._config.success.icon, (value) => this._commit((c) => { c.success.icon = value; }));
    this._color(success, "success.color", "Couleur", this._config.success.color, (value) => this._commit((c) => { c.success.color = value; }));
    this._number(success, "success.delay", "Délai avant réinitialisation (ms)", this._config.success.delay, 0, 5000, 50, (value) => this._commit((c) => { c.success.delay = Number(value); }), "box");
    pane.appendChild(success);

    const actionDescription = this._usesServerSecurity()
      ? "Pour les actions de service/toggle, l’action est exécutée côté serveur après validation du PIN. Après toute modification de cette action, réenregistrez le PIN dans la section Code et sécurité afin de mettre à jour l’action autorisée côté serveur."
      : "L’action est exécutée automatiquement dès que le dernier chiffre rend le code correct.";
    const action = this._section("Action Home Assistant", actionDescription);
    this._renderAction(action);
    pane.appendChild(action);

    const previewTitle = document.createElement("div");
    previewTitle.className = "preview-title";
    previewTitle.textContent = `Lotus Digicode · ${LOTUS_DIGICODE_VERSION}`;
    const previewFrame = document.createElement("div");
    previewFrame.className = "preview-frame";
    const shell = document.createElement("div");
    shell.className = "preview-shell";
    shell.dataset.liveWidth = this._config.design.width.toFixed(1);
    shell.dataset.liveHeight = this._config.design.height.toFixed(1);
    const preview = document.createElement("lotus-digicode-card");
    preview.className = "digicode-preview";
    preview.setConfig(this._config);
    preview.hass = this._hass;
    preview.preview = true;
    shell.appendChild(preview);

    for (const edge of ["top", "right", "bottom", "left"]) {
      const handle = document.createElement("div");
      handle.className = `resize-handle ${edge}`;
      const edgeLabel = { top:"Haut", right:"Droite", bottom:"Bas", left:"Gauche" }[edge];
      handle.title = `${lotusT("Redimensionner")} · ${lotusT(edgeLabel)}`;
      handle.addEventListener("pointerdown", (event) => this._startResize(edge, event));
      shell.appendChild(handle);
    }
    const sizeBadge = document.createElement("div");
    sizeBadge.className = "size-badge";
    sizeBadge.textContent = `${lotusT("L")} ${this._config.design.width.toFixed(0)} · ${lotusT("H")} ${this._config.design.height.toFixed(0)}`;
    shell.appendChild(sizeBadge);

    previewFrame.appendChild(shell);
    previewPane.append(previewTitle, previewFrame);
    root.append(pane, previewPane);

    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; height:100%; max-height:100%; min-height:0; overflow:hidden; color:var(--primary-text-color,#212121); }
      .editor-grid { display:grid; grid-template-columns:minmax(460px,3fr) minmax(300px,2fr); gap:20px; min-height:0; height:100%; overflow:hidden; }
      .config-pane { height:100%; min-height:0; overflow-y:auto; overflow-x:hidden; padding-right:10px; scrollbar-gutter:stable; }
      .preview-pane { min-width:0; min-height:0; height:100%; position:relative; display:flex; overflow:hidden; }
      .preview-title { position:absolute; top:8px; left:12px; right:12px; z-index:4; font-size:12px; font-weight:700; color:var(--secondary-text-color,#727272); text-align:center; pointer-events:none; }
      .preview-frame { position:relative; flex:1 1 auto; width:100%; height:100%; min-height:0; border:1px solid var(--divider-color,rgba(127,127,127,.25)); border-radius:16px; background:var(--secondary-background-color,#f5f5f5); overflow:hidden; }
      .preview-shell { position:absolute; box-sizing:border-box; min-width:100px; min-height:140px; }
      .digicode-preview { display:block; width:100%; height:100%; }
      .resize-handle { position:absolute; z-index:5; background:transparent; touch-action:none; }
      .resize-handle.top { left:14px; right:14px; top:-7px; height:14px; cursor:ns-resize; }
      .resize-handle.bottom { left:14px; right:14px; bottom:-7px; height:14px; cursor:ns-resize; }
      .resize-handle.left { top:14px; bottom:14px; left:-7px; width:14px; cursor:ew-resize; }
      .resize-handle.right { top:14px; bottom:14px; right:-7px; width:14px; cursor:ew-resize; }
      .resize-handle::after { content:""; position:absolute; background:var(--primary-color,#03a9f4); opacity:.65; border-radius:2px; }
      .resize-handle.top::after,.resize-handle.bottom::after { left:35%; right:35%; top:6px; height:2px; }
      .resize-handle.left::after,.resize-handle.right::after { top:35%; bottom:35%; left:6px; width:2px; }
      .size-badge { position:absolute; left:50%; bottom:-24px; transform:translateX(-50%); padding:2px 7px; border-radius:8px; background:var(--primary-color,#03a9f4); color:var(--text-primary-color,#fff); font-size:10px; white-space:nowrap; pointer-events:none; }
      .editor-section { padding:14px 0 18px; border-bottom:1px solid var(--divider-color,rgba(127,127,127,.22)); }
      .editor-section:first-child { padding-top:0; }
      .editor-section h3 { margin:0 0 6px; font-size:16px; }
      .editor-section > p,.field-note { margin:0 0 12px; color:var(--secondary-text-color,#727272); font-size:12px; line-height:1.4; }
      .native-field { display:block; width:100%; margin:10px 0; }
      .fallback-field { display:grid; gap:5px; margin:10px 0; font-size:12px; }
      .fallback-field input { box-sizing:border-box; width:100%; min-height:40px; border:1px solid var(--divider-color); border-radius:8px; padding:8px; background:var(--card-background-color,#fff); color:inherit; }
      .lotus-native-select-field select { box-sizing:border-box; width:100%; min-height:44px; border:1px solid var(--divider-color,rgba(127,127,127,.35)); border-radius:8px; padding:8px 10px; background:var(--card-background-color,#fff); color:var(--primary-text-color,#212121); font:inherit; }
      .lotus-native-select-field select:focus { outline:2px solid var(--primary-color,#03a9f4); outline-offset:1px; }
      .security-help { margin:10px 0; padding:10px 12px; border-radius:10px; background:var(--secondary-background-color,#f5f5f5); font-size:12px; line-height:1.45; }
      .security-help strong { display:block; margin-bottom:5px; color:var(--primary-text-color,#212121); }
      .security-help ol { margin:0; padding-left:20px; }
      .security-help.warning { border-left:4px solid var(--warning-color,#ff9800); }
      .security-help.ok { border-left:4px solid var(--success-color,#2e7d32); }
      .security-note { margin:8px 0; font-size:12px; line-height:1.4; color:var(--secondary-text-color,#727272); }
      .security-note.warning { color:var(--warning-color,#ef6c00); }
      .lotus-pin-field input { font-family:monospace; letter-spacing:.18em; }
      .server-pin-save { width:100%; margin-top:8px; min-height:40px; border:0; border-radius:10px; padding:9px 12px; cursor:pointer; background:var(--primary-color,#03a9f4); color:var(--text-primary-color,#fff); font-weight:600; }
      .server-pin-save:disabled { opacity:.55; cursor:wait; }
      .code-status { margin:8px 0 0; padding:9px 11px; border-radius:10px; font-size:12px; background:var(--secondary-background-color,#f5f5f5); color:var(--secondary-text-color,#727272); }
      .code-status[data-kind="ok"] { color:var(--success-color,#2e7d32); }
      .code-status[data-kind="error"] { color:var(--error-color,#db4437); }
      .save-guard { margin:10px 0 0; padding:10px 12px; border-radius:10px; font-size:12px; font-weight:600; line-height:1.4; background:var(--secondary-background-color,#f5f5f5); border:1px solid var(--divider-color,rgba(127,127,127,.25)); color:var(--secondary-text-color,#727272); }
      .save-guard[data-kind="ok"] { color:var(--success-color,#2e7d32); border-color:color-mix(in srgb,var(--success-color,#2e7d32) 45%,transparent); }
      .save-guard[data-kind="error"] { color:var(--error-color,#db4437); border-color:color-mix(in srgb,var(--error-color,#db4437) 45%,transparent); }
      .order-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:10px 0 12px; }
      .order-slot { display:grid; grid-template-columns:24px minmax(0,1fr) auto; align-items:center; gap:7px; min-height:42px; padding:6px 7px; box-sizing:border-box; border:1px solid var(--divider-color,rgba(127,127,127,.28)); border-radius:9px; background:var(--card-background-color,#fff); cursor:grab; user-select:none; }
      .order-slot.control { border-color:color-mix(in srgb,var(--primary-color,#03a9f4) 55%,var(--divider-color)); }
      .order-slot.disabled-control { opacity:.5; }
      .order-slot.dragging { opacity:.4; }
      .order-slot.drag-over { outline:2px solid var(--primary-color,#03a9f4); outline-offset:1px; }
      .order-position { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:var(--secondary-background-color,#f5f5f5); color:var(--secondary-text-color,#727272); font-size:10px; font-weight:700; }
      .order-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:600; }
      .order-controls { display:flex; gap:3px; }
      .order-controls button,.preview-shuffle { border:1px solid var(--divider-color,rgba(127,127,127,.3)); border-radius:7px; background:var(--secondary-background-color,#f5f5f5); color:var(--primary-text-color,#212121); cursor:pointer; }
      .order-controls button { width:26px; height:26px; padding:0; line-height:1; }
      .order-controls button:disabled { opacity:.3; cursor:default; }
      .preview-shuffle { min-height:36px; padding:6px 10px; margin:0 0 6px; }
      .symbol-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .symbol-cell { min-width:0; padding:10px; border:1px solid var(--divider-color,rgba(127,127,127,.18)); border-radius:10px; }
      @media (max-width:980px) {
        :host { height:auto; max-height:none; overflow:visible; }
        .editor-grid { grid-template-columns:1fr; height:auto; overflow:visible; }
        .config-pane { height:auto; overflow:visible; padding-right:0; }
        .preview-pane { order:-1; height:auto; min-height:420px; overflow:visible; display:block; }
        .preview-title { position:static; margin:0 0 10px; }
        .preview-frame { height:420px; }
        .order-grid { grid-template-columns:1fr 1fr; }
      }
    `;

    this.shadowRoot.replaceChildren(style, root);
    this._previewResizeObserver.observe(previewFrame);
    requestAnimationFrame(() => this._layoutPreviewShell());
    this._restoreScroll();
    this._notifySaveValidity();
  }

  _syncPreview() {
    const preview = this.shadowRoot?.querySelector("lotus-digicode-card");
    if (preview) {
      preview.hass = this._hass;
      preview.preview = true;
    }
    this._updateCodeStatus();
  }
}

if (!customElements.get("lotus-digicode-card-editor")) customElements.define("lotus-digicode-card-editor", LotusDigicodeCardEditor);
if (!customElements.get("lotus-digicode-card")) customElements.define("lotus-digicode-card", LotusDigicodeCard);

window.LotusDigicode = Object.assign(window.LotusDigicode || {}, {
  version: LOTUS_DIGICODE_VERSION,
  type: LOTUS_DIGICODE_TYPE,
  getStubConfig: () => clone(baseConfig()),
});
