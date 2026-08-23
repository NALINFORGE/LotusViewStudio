import { registerLotusStackCard } from "./lotus-card-registry.js?v=0.12.2";
import { lotusDebug, lotusLocalizeSelector, lotusSetHass, lotusT } from "./lotus-i18n.js?v=0.12.2";


/*
 * Lotus Stack for Home Assistant
 * Version 1.1.46
 * Freeform visual card composer using rectangular regions.
 *
 * Design principles:
 * - no fixed row/column count
 * - split one region horizontally or vertically
 * - merge any rectangular contiguous selection
 * - outer frame is directly resizable and also has responsive reference values
 * - saved card remains a native Home Assistant picture-elements card
 */
const VISUAL_STACK_CARD_VERSION = "1.1.46";
const VISUAL_STACK_CARD_MAX_GRID = 50;
const VISUAL_STACK_CARD_MAX_IMAGES = 50;
const LOTUS_VISUAL_STACK_TYPE = "custom:lotus-visual-stack";
const LOTUS_VISUAL_STACK_LEGACY_TYPE = "custom:visual-stack-card";
const LOTUS_VISUAL_STACK_NATIVE_TYPE = "picture-elements";
const LOTUS_VISUAL_STACK_META_KEY = "lotus_visual_stack";
const LOTUS_VISUAL_STACK_STATIC_TEXT_TYPE = "custom:lotus-static-text-element";
const LOTUS_VISUAL_STACK_DYNAMIC_IMAGE_TYPE = "custom:lotus-dynamic-image-element";
const LOTUS_VISUAL_STACK_DYNAMIC_ICON_TYPE = "custom:lotus-dynamic-icon-element";
const LOTUS_VISUAL_STACK_SCHEMA_VERSION = 3;
const VSC_NATIVE_OWNED_KEYS = new Set([
  "type",
  "title",
  "image",
  "aspect_ratio",
  "elements",
  LOTUS_VISUAL_STACK_META_KEY,
]);

const vscNativePassthrough = (input) => {
  if (!input || typeof input !== "object") return {};
  const passthrough = {};
  for (const [key, value] of Object.entries(input)) {
    if (!VSC_NATIVE_OWNED_KEYS.has(key)) passthrough[key] = vscClone(value);
  }
  return passthrough;
};

const vscMergeNativePassthrough = (nativeConfig, passthrough) => ({
  ...(passthrough && typeof passthrough === "object" ? vscClone(passthrough) : {}),
  ...nativeConfig,
});
const vscClone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const vscDefaultItem = (id, entity = "") => ({
  id,
  type: id % 2 === 0 ? "button" : "info",
  entity,
  name: "",
  value_source: "",
  value_entity: "",
  attribute: "",
  unit: "",
  visual_type: "icon",
  icon: "",
  icon_size: 20,
  icon_color: "state",
  // 0.8.42: dynamic icons keep the historical fixed icon as fallback.
  // "binary" maps two arbitrary states/conditions; "integer" maps exact
  // integer values, mirroring the integer-image editor.
  icon_mode: "static",
  icon_binary_state_1: "off",
  icon_binary_1: "",
  icon_binary_color_1: "state",
  icon_binary_state_2: "on",
  icon_binary_2: "",
  icon_binary_color_2: "state",
  icon_value_count: 0,
  icon_values: [],
  visual_background: true,
  interaction_feedback: true,
  // L’indicateur d’action (main/chevron) est volontairement opt-in.
  // Une cellule interactive ne doit pas afficher de pictogramme supplémentaire
  // tant que l’utilisateur ne l’a pas explicitement demandé.
  show_affordance: false,
  image_mode: "binary",
  image_binary_state_1: "off",
  image_binary_1: "",
  image_binary_state_2: "on",
  image_binary_2: "",
  image_default: "",
  image_value_count: 0,
  image_values: [],
  image_fit: "contain",
  image_active_background: false,

  // Anciennes propriétés conservées uniquement pour migration.
  text_font_family: "",
  text_font_size: 0,
  text_align: "left",
  text_weight: "normal",

  // Nom de l'élément.
  name_font_family: "",
  name_font_size: 0,
  name_align: "left",
  name_bold: false,
  name_italic: false,
  name_underline: false,
  name_color: "",

  // État / valeur.
  value_font_family: "",
  value_font_size: 0,
  value_align: "left",
  value_bold: false,
  value_italic: false,
  value_underline: false,
  value_color: "",

  show_icon: true,
  show_name: true,
  show_state: true,
  action: "auto",
  navigation_path: "",
  url: "",
  service: "",

  // Actions Lovelace natives. Les anciens champs ci-dessus restent lisibles
  // uniquement pour la migration des configurations Lotus antérieures.
  tap_action: undefined,
  hold_action: undefined,
  double_tap_action: undefined,

  // Native Home Assistant Lovelace conditions controlling the visibility of
  // this logical cell. The editor delegates configuration to HA's own
  // ha-card-conditions-editor and the saved picture-elements card delegates
  // evaluation to HA's native conditional picture-element.
  visibility_conditions: [],
});

// Native picture-elements cannot represent every Lotus-only state (for example
// a literal name without an entity). Store only values that differ from the
// item defaults so reopening the editor is lossless without bloating the YAML.
const vscItemMetadataSnapshot = (source) => {
  const id = Number(source?.id);
  const defaults = vscDefaultItem(id);
  const snapshot = { id };
  for (const [key, value] of Object.entries(source || {})) {
    if (key === "id" || value === undefined) continue;
    const baseline = defaults[key];
    if (JSON.stringify(value) !== JSON.stringify(baseline)) snapshot[key] = vscClone(value);
  }
  return snapshot;
};

const vscPositiveInt = (value, fallback, max = VISUAL_STACK_CARD_MAX_GRID) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
};

const vscDividerSize = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(20, number));
};

const vscCardBorderWidth = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 2;
  return Math.max(1, Math.min(16, Math.round(number)));
};

const vscCardBorderRadius = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 12;
  return Math.max(0, Math.min(80, Math.round(number)));
};

const vscCardBorderStyle = (value) =>
  ["solid", "double", "dashed", "dotted"].includes(value) ? value : "solid";

const vscCardBorderColor = (value) => {
  const color = String(value ?? "primary").trim() || "primary";
  if (VSC_THEME_COLORS?.has?.(color)) return `var(--${color}-color)`;
  return color;
};

const vscIconSize = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 20;
  return Math.max(8, Math.min(100, Math.round(number)));
};

const VSC_THEME_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo",
  "blue", "light-blue", "cyan", "teal", "green", "light-green", "lime",
  "yellow", "amber", "orange", "deep-orange", "brown", "light-grey", "grey",
  "dark-grey", "blue-grey", "black", "white",
]);

const vscIconCssColor = (value) => {
  const color = String(value ?? "state").trim();
  if (!color || color === "state") return "";
  if (color === "none") return "var(--secondary-text-color)";
  if (VSC_THEME_COLORS.has(color)) return `var(--${color}-color)`;
  return color;
};

const vscTextSize = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.max(6, Math.min(120, Math.round(number)));
};

const vscHasConfiguredImage = (item) => {
  if (!item || item.visual_type !== "image") return false;
  if (String(item.image_default ?? "").trim()) return true;
  if (String(item.image_binary_1 ?? "").trim()) return true;
  if (String(item.image_binary_2 ?? "").trim()) return true;
  return Array.isArray(item.image_values) && item.image_values.some((entry) => String(entry?.image ?? "").trim());
};

const vscVisualEnabled = (item) => item?.show_icon !== false || vscHasConfiguredImage(item);

const vscIsNativeVisualStackConfig = (config) => Boolean(
  config &&
  config.type === LOTUS_VISUAL_STACK_NATIVE_TYPE &&
  config[LOTUS_VISUAL_STACK_META_KEY] &&
  typeof config[LOTUS_VISUAL_STACK_META_KEY] === "object",
);

const vscPct = (value) => {
  const rounded = Math.round(Number(value) * 10000) / 10000;
  return `${rounded}%`;
};

const vscEncodeSvg = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)
  .replace(/%20/g, " ")
  .replace(/%27/g, "'")
  .replace(/%22/g, "'")}`;

const vscTransparentSvg = (columns = 1, rows = 1) => vscEncodeSvg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${columns} ${rows}'></svg>`,
);

const vscResolvedActionName = (item) => {
  if (item?.action && item.action !== "auto") return item.action;
  if (item?.type !== "button") return "more-info";
  const domain = String(item?.entity ?? "").split(".")[0];
  if (domain === "input_button") return "input_button_press";
  if (domain === "button") return "button_press";
  if (domain === "scene") return "scene_turn_on";
  if (domain === "script") return "script_turn_on";
  return "toggle";
};

const vscNativeTapAction = (item) => {
  if (item?.tap_action && typeof item.tap_action === "object") {
    return vscClone(item.tap_action);
  }
  const action = vscResolvedActionName(item);
  if (action === "none") return { action: "none" };
  if (action === "more-info") return { action: "more-info" };
  if (action === "toggle") return { action: "toggle" };
  if (action === "navigate") {
    return item.navigation_path
      ? { action: "navigate", navigation_path: item.navigation_path }
      : { action: "none" };
  }
  if (action === "url") {
    return item.url ? { action: "url", url_path: item.url } : { action: "none" };
  }

  let performAction = "";
  if (action === "input_button_press") performAction = "input_button.press";
  else if (action === "button_press") performAction = "button.press";
  else if (action === "scene_turn_on") performAction = "scene.turn_on";
  else if (action === "script_turn_on") performAction = "script.turn_on";
  else if (action === "service") performAction = String(item.service ?? "").trim();

  if (!performAction) return { action: "none" };
  const native = { action: "perform-action", perform_action: performAction };
  if (item.entity) native.target = { entity_id: item.entity };
  return native;
};

const vscOptionalNativeAction = (actionConfig) =>
  actionConfig && typeof actionConfig === "object" ? vscClone(actionConfig) : undefined;

const vscItemFromNativeAction = (item, actionConfig) => {
  if (!actionConfig || typeof actionConfig !== "object") return;
  item.tap_action = vscClone(actionConfig);
  const action = actionConfig.action;
  if (action === "none") item.action = "none";
  else if (action === "more-info") item.action = "more-info";
  else if (action === "toggle") item.action = "toggle";
  else if (action === "navigate") {
    item.action = "navigate";
    item.navigation_path = actionConfig.navigation_path ?? "";
  } else if (action === "url") {
    item.action = "url";
    item.url = actionConfig.url_path ?? actionConfig.url ?? "";
  } else if (action === "perform-action" || action === "call-service") {
    item.action = "service";
    item.service = actionConfig.perform_action ?? actionConfig.service ?? "";
  }
};

const vscMarkerStyle = (item, role, style = {}) => ({
  ...style,
  "--lotus-vs": `${item.id}:${role}`,
});

const vscAttachItemMetadata = (element, item, role) => {
  const style = element?.style;
  if (!style || !item) return;
  if (item.type === "button") style["--lotus-vs-kind"] = "button";
  if ((!item.tap_action || typeof item.tap_action !== "object") && (item.action === "auto" || !item.action)) {
    style["--lotus-vs-action"] = "auto";
  }

  // Keep the requested visual type even before an image path has been entered.
  // Home Assistant immediately feeds the emitted native YAML back to the editor;
  // without this marker an empty image slot is seen again as a state-icon and the
  // editor jumps back to “Icône”, making it impossible to configure the image(s).
  if ((role === "visual" || role === "placeholder") && item.visual_type === "image") {
    style["--lotus-vs-visual-type"] = "image";
  }

  // The circular icon background is a Lotus presentation choice, not a native
  // Home Assistant requirement. Store only the non-default value so existing
  // YAML stays compact and older cards keep their current appearance.
  if ((role === "visual" || role === "placeholder") && item.visual_background === false) {
    style["--lotus-vs-visual-background"] = "none";
  }

  // Optional interaction feedback for the whole cell. Home Assistant/browser
  // focus, hover and tap feedback can otherwise leave a visible veil over
  // transparent floor-plan buttons. Store only the non-default value.
  if (item.interaction_feedback === false) {
    style["--lotus-vs-interaction-feedback"] = "none";
  }

  // The action affordance (gesture/chevron icon) is opt-in. Persist it only
  // when explicitly enabled so older or newly-created cards stay visually clean.
  if (item.show_affordance === true) {
    style["--lotus-vs-affordance"] = "show";
  }

  if (role === "visual" && item.visual_type !== "image") {
    const iconSize = vscIconSize(item.icon_size);
    const iconColor = String(item.icon_color ?? "state").trim() || "state";
    if (iconSize !== 20) style["--lotus-vs-icon-size"] = String(iconSize);
    if (iconColor !== "state") style["--lotus-vs-icon-color"] = iconColor;
  }

  if (String(item.name ?? "").trim() && !element.title) element.title = String(item.name).trim();
};

const vscApplyNativeTextStyle = (style, item, prefix) => {
  const family = String(item?.[`${prefix}_font_family`] ?? "").trim();
  const size = vscTextSize(item?.[`${prefix}_font_size`]);
  const align = ["left", "center", "right"].includes(item?.[`${prefix}_align`])
    ? item[`${prefix}_align`]
    : "left";
  const color = String(item?.[`${prefix}_color`] ?? "").trim();
  if (family) style["font-family"] = family;
  if (size) style["font-size"] = `${size}px`;
  style["text-align"] = align;
  if (item?.[`${prefix}_bold`] === true) style["font-weight"] = "700";
  if (item?.[`${prefix}_italic`] === true) style["font-style"] = "italic";
  if (item?.[`${prefix}_underline`] === true) style["text-decoration"] = "underline";
  if (color) style.color = color;
  return style;
};

const vscReadNativeTextStyle = (item, prefix, style = {}) => {
  if (style["font-family"]) item[`${prefix}_font_family`] = style["font-family"];
  if (style["font-size"]) item[`${prefix}_font_size`] = vscTextSize(parseFloat(style["font-size"]));
  if (["left", "center", "right"].includes(style["text-align"])) item[`${prefix}_align`] = style["text-align"];
  item[`${prefix}_bold`] = ["600", "700", "bold"].includes(String(style["font-weight"] ?? ""));
  item[`${prefix}_italic`] = String(style["font-style"] ?? "") === "italic";
  item[`${prefix}_underline`] = String(style["text-decoration"] ?? "").includes("underline");
  if (style.color) item[`${prefix}_color`] = style.color;
};

const vscExactStateKey = (condition) => {
  const text = String(condition ?? "").trim();
  if (!text || /^(<=|>=|!=|==|=|<|>)/.test(text)) return "";
  return text;
};

// 0.8.28: Home Assistant exposes numeric entity states as strings. An integer
// configured as 2 can therefore arrive as "2", "2.0", "2.00", etc.
// Native picture-elements state_image uses exact string keys, so provide the
// equivalent decimal forms while keeping the canonical integer key.
const vscIntegerStateKeys = (value) => {
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isInteger(numeric)) return [];
  const keys = new Set([String(numeric)]);
  for (let decimals = 1; decimals <= 6; decimals += 1) keys.add(numeric.toFixed(decimals));
  return [...keys];
};

const vscAreaGeometry = (area, rows, columns) => {
  const left = (area.column / columns) * 100;
  const top = (area.row / rows) * 100;
  const width = (area.columnSpan / columns) * 100;
  const height = (area.rowSpan / rows) * 100;
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
};

const vscNativeElementPositions = (item, area, rows, columns) => {
  const g = vscAreaGeometry(area, rows, columns);
  const showVisual = vscVisualEnabled(item);
  const showName = item.show_name !== false;
  const showState = item.show_state !== false;
  const onlyVisual = showVisual && !showName && !showState;
  const textCount = Number(showName) + Number(showState);
  const textX = showVisual ? g.left + g.width * 0.68 : g.centerX;
  const visualX = textCount ? g.left + g.width * 0.28 : g.centerX;
  return {
    geometry: g,
    onlyVisual,
    visual: { left: visualX, top: g.centerY },
    name: {
      left: textX,
      top: textCount === 2 ? g.centerY - g.height * 0.10 : g.centerY,
    },
    state: {
      left: textX,
      top: textCount === 2 ? g.centerY + g.height * 0.10 : g.centerY,
    },
  };
};



const VSC_EPSILON = 0.0001;
const VSC_MIN_REGION_SIZE = 2;
const vscClamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const vscRound = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const vscFrameValue = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? vscRound(vscClamp(number, 10, 200), 2) : fallback;
};
const vscRegionNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? vscRound(number, 4) : fallback;
};
const vscRegion = (id, x = 0, y = 0, width = 100, height = 100) => ({
  id: Number(id),
  x: vscRegionNumber(x),
  y: vscRegionNumber(y),
  width: vscRegionNumber(width, 100),
  height: vscRegionNumber(height, 100),
});
const vscRegionArea = (region) => Number(region.width) * Number(region.height);
const vscRegionRight = (region) => Number(region.x) + Number(region.width);
const vscRegionBottom = (region) => Number(region.y) + Number(region.height);
const vscSame = (a, b) => Math.abs(Number(a) - Number(b)) <= VSC_EPSILON;

const vscNormalizeRegions = (regions) => {
  const normalized = [];
  const ids = new Set();
  for (const source of Array.isArray(regions) ? regions : []) {
    const id = Number(Array.isArray(source) ? source[0] : source?.id);
    if (!Number.isInteger(id) || id < 1 || ids.has(id)) continue;
    const x = vscClamp(Array.isArray(source) ? source[1] : source?.x, 0, 100);
    const y = vscClamp(Array.isArray(source) ? source[2] : source?.y, 0, 100);
    const width = vscClamp(Array.isArray(source) ? source[3] : source?.width, 0.01, 100 - x);
    const height = vscClamp(Array.isArray(source) ? source[4] : source?.height, 0.01, 100 - y);
    normalized.push(vscRegion(id, x, y, width, height));
    ids.add(id);
  }
  if (!normalized.length) normalized.push(vscRegion(1));
  return normalized.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.id - b.id));
};

const vscGridRegions = (rows, columns, cells) => {
  const ids = [...new Set(cells.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const regions = [];
  for (const id of ids) {
    const positions = [];
    for (let index = 0; index < cells.length; index += 1) {
      if (Number(cells[index]) !== id) continue;
      positions.push({ row: Math.floor(index / columns), column: index % columns });
    }
    if (!positions.length) continue;
    const minRow = Math.min(...positions.map((p) => p.row));
    const maxRow = Math.max(...positions.map((p) => p.row));
    const minCol = Math.min(...positions.map((p) => p.column));
    const maxCol = Math.max(...positions.map((p) => p.column));
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (Number(cells[row * columns + col]) !== id) {
          throw new Error(`La zone ${id} de l'ancienne grille n'est pas rectangulaire.`);
        }
      }
    }
    regions.push(vscRegion(
      id,
      minCol / columns * 100,
      minRow / rows * 100,
      (maxCol - minCol + 1) / columns * 100,
      (maxRow - minRow + 1) / rows * 100,
    ));
  }
  return vscNormalizeRegions(regions);
};

const vscLegacyLayout = (config, count) => {
  const layout = config.layout ?? "auto";
  let rows = 1;
  let columns = Math.max(1, count);
  let cells = Array.from({ length: count }, (_, index) => index + 1);
  if (layout === "vertical") {
    rows = count;
    columns = 1;
  } else if ((layout === "grid" || (layout === "auto" && count > 2)) && count === 3) {
    rows = 2; columns = 2; cells = [1, 1, 2, 3];
  } else if (layout === "grid" || (layout === "auto" && count > 2)) {
    columns = Math.min(2, Math.max(1, count));
    rows = Math.ceil(count / columns);
    while (cells.length < rows * columns) cells.push(cells[cells.length - 1] ?? 1);
  } else if (["hero-top", "hero-bottom", "hero-left", "hero-right"].includes(layout) && count >= 3) {
    rows = 2; columns = 2;
    if (layout === "hero-top") cells = [1, 1, 2, 3];
    else if (layout === "hero-bottom") cells = [2, 3, 1, 1];
    else if (layout === "hero-left") cells = [1, 2, 1, 3];
    else cells = [2, 1, 3, 1];
  }
  return { rows, columns, cells };
};

const vscFrameFromRatio = (widthRatio, heightRatio) => {
  const w = Math.max(0.01, Number(widthRatio) || 1);
  const h = Math.max(0.01, Number(heightRatio) || 1);
  if (w >= h) return { frame_width: 100, frame_height: vscRound(100 * h / w, 2) };
  return { frame_width: vscRound(100 * w / h, 2), frame_height: 100 };
};

const vscItemHasMeaningfulContent = (item) => {
  if (!item) return false;
  if (String(item.entity ?? "").trim()) return true;
  if (String(item.name ?? "").trim()) return true;
  if (String(item.icon ?? "").trim()) return true;
  if (vscHasConfiguredImage(item)) return true;
  if (String(item.value_entity ?? "").trim()) return true;
  if (String(item.attribute ?? "").trim() || String(item.unit ?? "").trim()) return true;
  if (item.action && item.action !== "auto") return true;
  if (item.tap_action && typeof item.tap_action === "object") return true;
  if (item.hold_action && typeof item.hold_action === "object") return true;
  if (item.double_tap_action && typeof item.double_tap_action === "object") return true;
  return false;
};

const vscBaseConfig = () => ({
  type: LOTUS_VISUAL_STACK_TYPE,
  title: "",
  title_font_family: "",
  title_font_size: 0,
  title_align: "left",
  title_bold: true,
  title_italic: false,
  title_underline: false,
  title_color: "",
  frame_width: 100,
  frame_height: 60,
  regions: [vscRegion(1)],
  density: "normal",
  show_dividers: true,
  divider_size: 1,
  card_border_enabled: false,
  card_border_width: 2,
  card_border_style: "solid",
  card_border_color: "primary",
  card_border_radius: 12,
  state_color: true,
  background_mode: "theme",
  background_color: "#ffffff",
  primary_item: 1,
  items: [vscDefaultItem(1)],
});

const vscNormalizeItem = (source, id) => {
  const item = { ...vscDefaultItem(id), ...(source || {}), id };
  if (!Object.prototype.hasOwnProperty.call(source || {}, "name_font_family")) item.name_font_family = item.text_font_family ?? "";
  if (!Object.prototype.hasOwnProperty.call(source || {}, "value_font_family")) item.value_font_family = item.text_font_family ?? "";
  if (!Object.prototype.hasOwnProperty.call(source || {}, "name_font_size")) item.name_font_size = vscTextSize(item.text_font_size);
  if (!Object.prototype.hasOwnProperty.call(source || {}, "value_font_size")) item.value_font_size = vscTextSize(item.text_font_size);
  if (!Object.prototype.hasOwnProperty.call(source || {}, "name_align")) item.name_align = ["left","center","right"].includes(item.text_align) ? item.text_align : "left";
  if (!Object.prototype.hasOwnProperty.call(source || {}, "value_align")) item.value_align = ["left","center","right"].includes(item.text_align) ? item.text_align : "left";
  item.name_font_size = vscTextSize(item.name_font_size);
  item.value_font_size = vscTextSize(item.value_font_size);
  item.icon_size = vscIconSize(item.icon_size);
  item.icon_color = String(item.icon_color ?? "state").trim() || "state";
  item.icon_mode = ["static", "binary", "integer"].includes(item.icon_mode)
    ? item.icon_mode
    : "static";
  item.icon_binary_color_1 = String(item.icon_binary_color_1 ?? "state").trim() || "state";
  item.icon_binary_color_2 = String(item.icon_binary_color_2 ?? "state").trim() || "state";
  item.visibility_conditions = Array.isArray(item.visibility_conditions)
    ? vscClone(item.visibility_conditions).filter((condition) => condition && typeof condition === "object")
    : [];
  const iconValueCountRaw = Number(item.icon_value_count);
  const iconValues = Array.isArray(item.icon_values) ? item.icon_values : [];
  item.icon_value_count = Math.max(
    0,
    Math.min(
      VISUAL_STACK_CARD_MAX_IMAGES,
      Number.isFinite(iconValueCountRaw) ? Math.floor(iconValueCountRaw) : iconValues.length,
    ),
  );
  item.icon_values = Array.from({ length: item.icon_value_count }, (_, index) => {
    const entry = iconValues[index] ?? {};
    return {
      value: Number.isInteger(Number(entry?.value)) ? Number(entry.value) : index,
      icon: String(entry?.icon ?? ""),
      color: String(entry?.color ?? "state").trim() || "state",
    };
  });
  if (vscHasConfiguredImage(item)) item.show_icon = true;
  return item;
};

const vscInternalFromNativeV2 = (input) => {
  const config = vscClone(input || {});
  const meta = config[LOTUS_VISUAL_STACK_META_KEY] ?? {};
  const rawRegions = Array.isArray(meta.regions) ? meta.regions : [];
  const regions = vscNormalizeRegions(rawRegions);
  const ids = regions.map((r) => r.id);
  const surrogate = vscClone(config);
  surrogate[LOTUS_VISUAL_STACK_META_KEY] = {
    ...meta,
    version: 1,
    rows: 1,
    columns: Math.max(1, ids.length),
    cells: ids.length ? ids : [1],
  };
  const legacy = vscNativeToInternalLegacy(surrogate);
  return {
    ...legacy,
    ...vscFrameFromRatio(
      Array.isArray(meta.size) ? meta.size[0] : meta.frame_width,
      Array.isArray(meta.size) ? meta.size[1] : meta.frame_height,
    ),
    frame_width: vscFrameValue(Array.isArray(meta.size) ? meta.size[0] : meta.frame_width, 100),
    frame_height: vscFrameValue(Array.isArray(meta.size) ? meta.size[1] : meta.frame_height, 60),
    regions,
  };
};

const vscNormalizeConfig = (input = {}) => {
  const source = vscClone(input || {});
  let base = vscBaseConfig();

  if (vscIsNativeVisualStackConfig(source)) {
    const meta = source[LOTUS_VISUAL_STACK_META_KEY] ?? {};
    if (Number(meta.version) >= 2 && Array.isArray(meta.regions)) {
      base = { ...base, ...vscInternalFromNativeV2(source) };
    } else {
      const legacy = vscNativeToInternalLegacy(source);
      const rows = Math.max(1, Number(legacy.grid_rows) || 1);
      const columns = Math.max(1, Number(legacy.grid_columns) || 1);
      base = {
        ...base,
        ...legacy,
        ...vscFrameFromRatio(columns, rows),
        regions: vscGridRegions(rows, columns, legacy.grid_cells || [1]),
      };
    }
  } else if (Array.isArray(source.regions)) {
    base = { ...base, ...source, regions: vscNormalizeRegions(source.regions) };
  } else if (Array.isArray(source.items) && Array.isArray(source.grid_cells)) {
    const rows = Math.max(1, Number(source.grid_rows) || 1);
    const columns = Math.max(1, Number(source.grid_columns) || 1);
    base = {
      ...base,
      ...source,
      ...vscFrameFromRatio(columns, rows),
      regions: vscGridRegions(rows, columns, source.grid_cells),
    };
  } else {
    const count = Math.max(1, Math.min(100, Number(source.elements ?? 1) || 1));
    const legacyLayout = vscLegacyLayout(source, count);
    const items = [];
    for (let index = 1; index <= count; index += 1) {
      const p = `item_${index}`;
      items.push(vscNormalizeItem({
        ...vscDefaultItem(index),
        type: source[`${p}_type`] ?? (index % 2 === 0 ? "button" : "info"),
        entity: source[`${p}_entity`] ?? "",
        name: source[`${p}_name`] ?? "",
        icon: source[`${p}_icon`] ?? "",
        value_entity: source[`${p}_value_entity`] ?? "",
        attribute: source[`${p}_attribute`] ?? "",
        show_icon: source[`${p}_show_icon`] !== false,
        show_name: source[`${p}_show_name`] !== false,
        show_state: source[`${p}_show_state`] !== false,
        show_affordance: source[`${p}_show_affordance`] === true,
        action: source[`${p}_action`] ?? "auto",
        navigation_path: source[`${p}_navigation_path`] ?? "",
        url: source[`${p}_url`] ?? "",
        service: source[`${p}_service`] ?? "",
      }, index));
    }
    base = {
      ...base,
      ...source,
      ...vscFrameFromRatio(legacyLayout.columns, legacyLayout.rows),
      regions: vscGridRegions(legacyLayout.rows, legacyLayout.columns, legacyLayout.cells),
      items,
    };
  }

  base.type = LOTUS_VISUAL_STACK_TYPE;
  base.frame_width = vscFrameValue(base.frame_width, 100);
  base.frame_height = vscFrameValue(base.frame_height, 60);
  base.regions = vscNormalizeRegions(base.regions);
  base.density = ["compact","normal","large"].includes(base.density) ? base.density : "normal";
  base.show_dividers = base.show_dividers !== false;
  base.divider_size = vscDividerSize(base.divider_size);
  base.card_border_enabled = base.card_border_enabled === true;
  base.card_border_width = vscCardBorderWidth(base.card_border_width);
  base.card_border_style = vscCardBorderStyle(base.card_border_style);
  base.card_border_color = String(base.card_border_color ?? "primary").trim() || "primary";
  base.card_border_radius = vscCardBorderRadius(base.card_border_radius);
  base.state_color = base.state_color !== false;
  base.background_mode = ["theme","color","transparent"].includes(base.background_mode) ? base.background_mode : "theme";
  base.background_color = String(base.background_color || "#ffffff");
  const byId = new Map((Array.isArray(base.items) ? base.items : []).map((item) => [Number(item.id), item]));
  base.items = base.regions.map((region) => vscNormalizeItem(byId.get(region.id), region.id));
  const ids = new Set(base.regions.map((r) => r.id));
  base.primary_item = ids.has(Number(base.primary_item)) ? Number(base.primary_item) : base.regions[0].id;
  delete base.grid_rows;
  delete base.grid_columns;
  delete base.grid_cells;
  delete base.fill_direction;
  delete base.primary_position;
  return base;
};

const vscRegions = (config) => vscNormalizeRegions(config?.regions);

const vscRegionSelectionRect = (config, selectedIds) => {
  const regions = vscRegions(config).filter((r) => selectedIds.has(r.id));
  if (regions.length < 2) return null;
  const minX = Math.min(...regions.map((r) => r.x));
  const minY = Math.min(...regions.map((r) => r.y));
  const maxX = Math.max(...regions.map(vscRegionRight));
  const maxY = Math.max(...regions.map(vscRegionBottom));
  const sum = regions.reduce((total, region) => total + vscRegionArea(region), 0);
  const boxArea = (maxX - minX) * (maxY - minY);
  if (Math.abs(sum - boxArea) > 0.02) return null;
  return vscRegion(0, minX, minY, maxX - minX, maxY - minY);
};

const vscIntervalOverlap = (startA, endA, startB, endB) =>
  Math.min(Number(endA), Number(endB)) - Math.max(Number(startA), Number(startB));

const vscMergeDividerComponents = (pairs, orientation, position) => {
  const components = [];
  for (const pair of pairs) {
    const negativeId = Number(pair.negative.id);
    const positiveId = Number(pair.positive.id);
    const overlapping = components.filter((component) =>
      component.negativeIds.has(negativeId) || component.positiveIds.has(positiveId)
    );
    if (!overlapping.length) {
      components.push({
        orientation,
        position,
        negativeIds:new Set([negativeId]),
        positiveIds:new Set([positiveId]),
      });
      continue;
    }
    const target = overlapping[0];
    target.negativeIds.add(negativeId);
    target.positiveIds.add(positiveId);
    for (const extra of overlapping.slice(1)) {
      for (const id of extra.negativeIds) target.negativeIds.add(id);
      for (const id of extra.positiveIds) target.positiveIds.add(id);
      const index = components.indexOf(extra);
      if (index >= 0) components.splice(index, 1);
    }
  }
  return components;
};

const vscInternalDividers = (config) => {
  const regions = vscRegions(config);
  const dividers = [];

  const verticalPositions = [...new Set(regions.flatMap((region) => [region.x, vscRegionRight(region)])
    .filter((value) => value > VSC_EPSILON && value < 100 - VSC_EPSILON)
    .map((value) => vscRound(value, 4)))];

  for (const position of verticalPositions) {
    const negative = regions.filter((region) => vscSame(vscRegionRight(region), position));
    const positive = regions.filter((region) => vscSame(region.x, position));
    const pairs = [];
    for (const left of negative) {
      for (const right of positive) {
        if (vscIntervalOverlap(left.y, vscRegionBottom(left), right.y, vscRegionBottom(right)) > VSC_EPSILON) {
          pairs.push({ negative:left, positive:right });
        }
      }
    }
    for (const component of vscMergeDividerComponents(pairs, "vertical", position)) {
      const ids = new Set([...component.negativeIds, ...component.positiveIds]);
      const members = regions.filter((region) => ids.has(region.id));
      const start = Math.max(0, Math.min(...members.map((region) => region.y)));
      const end = Math.min(100, Math.max(...members.map(vscRegionBottom)));
      if (end - start > VSC_EPSILON) {
        dividers.push({ ...component, start:vscRound(start), end:vscRound(end) });
      }
    }
  }

  const horizontalPositions = [...new Set(regions.flatMap((region) => [region.y, vscRegionBottom(region)])
    .filter((value) => value > VSC_EPSILON && value < 100 - VSC_EPSILON)
    .map((value) => vscRound(value, 4)))];

  for (const position of horizontalPositions) {
    const negative = regions.filter((region) => vscSame(vscRegionBottom(region), position));
    const positive = regions.filter((region) => vscSame(region.y, position));
    const pairs = [];
    for (const top of negative) {
      for (const bottom of positive) {
        if (vscIntervalOverlap(top.x, vscRegionRight(top), bottom.x, vscRegionRight(bottom)) > VSC_EPSILON) {
          pairs.push({ negative:top, positive:bottom });
        }
      }
    }
    for (const component of vscMergeDividerComponents(pairs, "horizontal", position)) {
      const ids = new Set([...component.negativeIds, ...component.positiveIds]);
      const members = regions.filter((region) => ids.has(region.id));
      const start = Math.max(0, Math.min(...members.map((region) => region.x)));
      const end = Math.min(100, Math.max(...members.map(vscRegionRight)));
      if (end - start > VSC_EPSILON) {
        dividers.push({ ...component, start:vscRound(start), end:vscRound(end) });
      }
    }
  }

  return dividers;
};

const vscBackgroundImage = (config) => {
  const mode = ["theme","color","transparent"].includes(config.background_mode) ? config.background_mode : "theme";
  const fill = mode === "color" && String(config.background_color ?? "").trim()
    ? String(config.background_color).trim()
    : "";
  const divider = config.show_dividers !== false;
  const dividerSize = Math.max(0, Number(config.divider_size) || 0);
  if (!fill && (!divider || dividerSize <= 0)) return vscTransparentSvg(100, 100);
  const parts = ["<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>"];
  if (fill) parts.push(`<rect width='100' height='100' fill='${fill.replace(/'/g, "&apos;")}'/>`);
  if (divider && dividerSize > 0) {
    const stroke = Math.max(0.05, dividerSize / 10);
    parts.push(`<g fill='none' stroke='#808080' stroke-opacity='.28' stroke-width='${stroke}'>`);
    for (const region of vscRegions(config)) {
      parts.push(`<rect x='${region.x}' y='${region.y}' width='${region.width}' height='${region.height}'/>`);
    }
    parts.push("</g>");
  }
  parts.push("</svg>");
  return vscEncodeSvg(parts.join(""));
};

const vscNativeAreaForRegion = (region) => ({
  itemId: region.id,
  row: region.y,
  column: region.x,
  rowSpan: region.height,
  columnSpan: region.width,
  region,
});

const vscRegionAspectRatio = (config, region) => {
  const width = Math.max(0.01, region.width * config.frame_width);
  const height = Math.max(0.01, region.height * config.frame_height);
  return `${vscRound(width, 2)}:${vscRound(height, 2)}`;
};

const vscInternalToNative = (input, hass) => {
  const config = vscNormalizeConfig(input || {});
  const rows = 100;
  const columns = 100;
  const regions = vscRegions(config);
  const areas = regions.map(vscNativeAreaForRegion);
  const elements = [];

  for (const area of areas) {
    const item = {
      ...vscDefaultItem(area.itemId),
      ...(config.items?.find((candidate) => Number(candidate.id) === Number(area.itemId)) ?? {}),
      id: Number(area.itemId),
    };
    const positions = vscNativeElementPositions(item, area, rows, columns);
    const tapAction = vscNativeTapAction(item);
    const holdAction = vscOptionalNativeAction(item.hold_action);
    const doubleTapAction = vscOptionalNativeAction(item.double_tap_action);
    const showVisual = vscVisualEnabled(item);
    const elementStartIndex = elements.length;

    if (showVisual) {
      const visualStyle = vscMarkerStyle(item, "visual", {
        left: vscPct(positions.visual.left),
        top: vscPct(positions.visual.top),
        transform: "translate(-50%, -50%)",
      });

      if (item.visual_type === "image") {
        const stateImage = {};
        if (item.image_mode === "integer") {
          for (const entry of Array.isArray(item.image_values) ? item.image_values : []) {
            const keys = vscIntegerStateKeys(entry?.value);
            const image = String(entry?.image ?? "").trim();
            if (image) {
              for (const key of keys) stateImage[key] = image;
            }
          }
        } else {
          const state1 = String(item.image_binary_state_1 ?? "off").trim();
          const state2 = String(item.image_binary_state_2 ?? "on").trim();
          const image1 = String(item.image_binary_1 ?? "").trim();
          const image2 = String(item.image_binary_2 ?? "").trim();
          const key1 = vscExactStateKey(state1);
          const key2 = vscExactStateKey(state2);
          if (key1 && image1) stateImage[key1] = image1;
          if (key2 && image2) stateImage[key2] = image2;
          if (!key1 || !key2) {
            if (state1) visualStyle["--lotus-vs-binary-state-1"] = state1;
            if (image1) visualStyle["--lotus-vs-binary-image-1"] = image1;
            if (state2) visualStyle["--lotus-vs-binary-state-2"] = state2;
            if (image2) visualStyle["--lotus-vs-binary-image-2"] = image2;
          }
        }

        if (item.image_mode === "integer") visualStyle["--lotus-vs-image-mode"] = "integer";
        if (item.image_active_background === true) visualStyle["--lotus-vs-image-active-background"] = "true";
        const requestedImageFit = ["contain", "cover", "fill"].includes(item.image_fit) ? item.image_fit : "contain";
        // The marker is used by LotusLayers' direct native renderer. Current HA's
        // hui-image-element does not forward fit_mode to hui-image, so keeping the
        // information here also makes the editor round-trip lossless.
        visualStyle["--lotus-vs-image-fit"] = requestedImageFit;
        visualStyle["object-fit"] = requestedImageFit;
        visualStyle.display = "block";
        if (positions.onlyVisual) {
          visualStyle.left = vscPct(positions.geometry.centerX);
          visualStyle.top = vscPct(positions.geometry.centerY);
          visualStyle.width = vscPct(positions.geometry.width);
        } else {
          visualStyle.width = vscPct(Math.max(4, positions.geometry.width * 0.34));
        }

        const imageEntity = String(item.value_entity ?? "").trim() || String(item.entity ?? "").trim();
        if (String(item.value_entity ?? "").trim()) {
          visualStyle["--lotus-vs-value-entity"] = imageEntity;
          visualStyle["--lotus-vs-primary-entity"] = String(item.entity ?? "").trim() || "__none__";
        }

        // Integer-driven images use a tiny Lotus picture-element instead of
        // Home Assistant's exact-string state_image lookup. This keeps the
        // saved card inside picture-elements while comparing the source value
        // numerically at runtime (2, 2.0 and 2.00 are therefore identical).
        // Binary mode intentionally stays on HA's native image element.
        const native = item.image_mode === "integer"
          ? {
              type: LOTUS_VISUAL_STACK_DYNAMIC_IMAGE_TYPE,
              entity: imageEntity || undefined,
              action_entity: String(item.entity ?? "").trim() || undefined,
              // Integer image selection is always driven by the entity state.
              // Text-display value_source/attribute are intentionally omitted.
              image: String(item.image_default ?? "").trim() || undefined,
              image_values: (Array.isArray(item.image_values) ? item.image_values : [])
                .map((entry) => ({
                  value: Number(entry?.value),
                  image: String(entry?.image ?? "").trim(),
                }))
                .filter((entry) => Number.isInteger(entry.value) && entry.image),
              image_fit: requestedImageFit,
              aspect_ratio: vscRegionAspectRatio(config, area.region),
              tap_action: tapAction,
              hold_action: holdAction,
              double_tap_action: doubleTapAction,
              style: visualStyle,
            }
          : {
              type: "image",
              entity: imageEntity || undefined,
              image: String(item.image_default ?? "").trim() || (Object.keys(stateImage).length ? undefined : vscTransparentSvg(1, 1)),
              state_image: Object.keys(stateImage).length ? stateImage : undefined,
              filter: "none",
              aspect_ratio: vscRegionAspectRatio(config, area.region),
              tap_action: tapAction,
              hold_action: holdAction,
              double_tap_action: doubleTapAction,
              style: visualStyle,
            };
        if (!native.entity) delete native.entity;
        if (!native.action_entity) delete native.action_entity;
        if (!native.image) delete native.image;
        if (!native.state_image) delete native.state_image;
        elements.push(native);
      } else {
        const iconColor = String(item.icon_color ?? "state").trim() || "state";
        const manualIconColor = vscIconCssColor(iconColor);
        const iconSize = vscIconSize(item.icon_size);
        if (manualIconColor) visualStyle.color = manualIconColor;
        visualStyle["--lotus-vs-icon-size"] = String(iconSize);
        visualStyle["--lotus-vs-region-width"] = String(positions.geometry.width);
        visualStyle["--lotus-vs-region-height"] = String(positions.geometry.height);
        visualStyle["--lotus-vs-icon-only"] = positions.onlyVisual ? "true" : "false";

        // Native picture-elements normally renders state-icon at its intrinsic
        // badge size.  For an icon-only Lotus cell, make the native host span the
        // complete logical region.  The Lotus icon-size bridge then computes the
        // responsive glyph diameter from the smallest side of this host.
        if (positions.onlyVisual) {
          visualStyle.left = vscPct(positions.geometry.centerX);
          visualStyle.top = vscPct(positions.geometry.centerY);
          visualStyle.width = vscPct(positions.geometry.width);
          visualStyle.height = vscPct(positions.geometry.height);
          visualStyle.display = "grid";
          visualStyle["place-items"] = "center";
        }

        const iconMode = ["binary", "integer"].includes(item.icon_mode)
          ? item.icon_mode
          : "static";
        const iconEntity = String(item.value_entity ?? "").trim() || String(item.entity ?? "").trim();
        const native = iconMode === "static"
          ? {
              type: "state-icon",
              entity: item.entity || "sun.sun",
              state_color: iconColor === "state" && config.state_color !== false,
              tap_action: tapAction,
              hold_action: holdAction,
              double_tap_action: doubleTapAction,
              style: visualStyle,
            }
          : {
              type: LOTUS_VISUAL_STACK_DYNAMIC_ICON_TYPE,
              entity: iconEntity || undefined,
              action_entity: String(item.entity ?? "").trim() || undefined,
              mode: iconMode,
              icon: String(item.icon ?? "").trim() || undefined,
              color: iconColor,
              state_color: config.state_color !== false,
              icon_size: iconSize,
              binary_state_1: String(item.icon_binary_state_1 ?? "off").trim(),
              binary_icon_1: String(item.icon_binary_1 ?? "").trim() || undefined,
              binary_color_1: String(item.icon_binary_color_1 ?? "state").trim() || "state",
              binary_state_2: String(item.icon_binary_state_2 ?? "on").trim(),
              binary_icon_2: String(item.icon_binary_2 ?? "").trim() || undefined,
              binary_color_2: String(item.icon_binary_color_2 ?? "state").trim() || "state",
              icon_values: (Array.isArray(item.icon_values) ? item.icon_values : [])
                .map((entry) => ({
                  value: Number(entry?.value),
                  icon: String(entry?.icon ?? "").trim() || undefined,
                  color: String(entry?.color ?? "state").trim() || "state",
                }))
                .filter((entry) => Number.isInteger(entry.value)),
              tap_action: tapAction,
              hold_action: holdAction,
              double_tap_action: doubleTapAction,
              style: visualStyle,
            };
        if (iconMode === "static" && String(item.icon ?? "").trim()) native.icon = String(item.icon).trim();
        if (!native.entity) delete native.entity;
        if (!native.action_entity) delete native.action_entity;
        if (!native.icon) delete native.icon;
        elements.push(native);
      }
    }

    if (item.show_name !== false) {
      const customName = String(item.name ?? "").trim();
      if (customName) {
        // A literal name is valid even when no entity is selected. Native
        // state-label cannot display arbitrary static text, so use the small
        // Lotus picture-element below. It remains a normal picture-elements
        // child and therefore survives saving/reopening like every other item.
        const labelWidth = Math.max(4, positions.geometry.width * (showVisual ? 0.60 : 0.92));
        const labelHeight = Math.max(2, positions.geometry.height * (((item.show_state !== false) ? 0.28 : 0.55)));
        const style = vscApplyNativeTextStyle(vscMarkerStyle(item, "name", {
          left: vscPct(positions.name.left),
          top: vscPct(positions.name.top),
          width: vscPct(labelWidth),
          height: vscPct(labelHeight),
          transform: "translate(-50%, -50%)",
          display: "flex",
          "align-items": "center",
          "justify-content": item.name_align === "right" ? "flex-end" : item.name_align === "center" ? "center" : "flex-start",
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "clip",
          "pointer-events": "auto",
        }), item, "name");
        style["--lotus-vs-font-max"] = String(vscTextSize(item.name_font_size) || 14);
        style["--lotus-vs-region-width"] = String(positions.geometry.width);
        style["--lotus-vs-region-height"] = String(positions.geometry.height);
        style["--lotus-vs-text-lines"] = String((item.show_name !== false ? 1 : 0) + (item.show_state !== false ? 1 : 0));
        style["--lotus-vs-has-visual"] = showVisual ? "true" : "false";
        elements.push({
          type: LOTUS_VISUAL_STACK_STATIC_TEXT_TYPE,
          text: customName,
          entity: String(item.entity ?? "").trim() || undefined,
          tap_action: tapAction,
          hold_action: holdAction,
          double_tap_action: doubleTapAction,
          style,
        });
        if (!elements[elements.length - 1].entity) delete elements[elements.length - 1].entity;
      } else if (item.entity) {
        const style = vscApplyNativeTextStyle(vscMarkerStyle(item, "name", {
          left: vscPct(positions.name.left),
          top: vscPct(positions.name.top),
          transform: "translate(-50%, -50%)",
          "max-width": vscPct(Math.max(4, positions.geometry.width * (showVisual ? 0.60 : 0.92))),
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "clip",
        }), item, "name");
        style["--lotus-vs-font-max"] = String(vscTextSize(item.name_font_size) || 14);
        style["--lotus-vs-region-width"] = String(positions.geometry.width);
        style["--lotus-vs-region-height"] = String(positions.geometry.height);
        style["--lotus-vs-text-lines"] = String((item.show_name !== false ? 1 : 0) + (item.show_state !== false ? 1 : 0));
        style["--lotus-vs-has-visual"] = showVisual ? "true" : "false";
        elements.push({
          type: "state-label",
          entity: item.entity,
          attribute: "friendly_name",
          tap_action: tapAction,
          hold_action: holdAction,
          double_tap_action: doubleTapAction,
          style,
        });
      }
    }

    const valueEntity = String(item.value_entity ?? "").trim() || String(item.entity ?? "").trim();
    if (item.show_state !== false && valueEntity) {
      const style = vscApplyNativeTextStyle(vscMarkerStyle(item, "state", {
        left: vscPct(positions.state.left),
        top: vscPct(positions.state.top),
        transform: "translate(-50%, -50%)",
        "max-width": vscPct(Math.max(4, positions.geometry.width * (showVisual ? 0.60 : 0.92))),
        "white-space": "nowrap",
        overflow: "hidden",
        "text-overflow": "clip",
      }), item, "value");
      style["--lotus-vs-font-max"] = String(vscTextSize(item.value_font_size) || 12);
      style["--lotus-vs-region-width"] = String(positions.geometry.width);
      style["--lotus-vs-region-height"] = String(positions.geometry.height);
      style["--lotus-vs-text-lines"] = String((item.show_name !== false ? 1 : 0) + (item.show_state !== false ? 1 : 0));
      style["--lotus-vs-has-visual"] = showVisual ? "true" : "false";
      if (String(item.unit ?? "").trim()) style["--lotus-vs-unit"] = String(item.unit).trim();
      style["--lotus-vs-value-source"] = item.value_source === "attribute" || (!item.value_source && item.attribute) ? "attribute" : "state";
      if (String(item.value_entity ?? "").trim()) {
        style["--lotus-vs-value-entity"] = valueEntity;
        style["--lotus-vs-primary-entity"] = String(item.entity ?? "").trim() || "__none__";
      }
      const native = {
        type: "state-label",
        entity: valueEntity,
        tap_action: tapAction,
        hold_action: holdAction,
        double_tap_action: doubleTapAction,
        style,
      };
      const sourceIsAttribute = item.value_source === "attribute" || (!item.value_source && item.attribute);
      if (sourceIsAttribute && String(item.attribute ?? "").trim()) native.attribute = String(item.attribute).trim();

      const unit = String(item.unit ?? "").trim();
      const nativeUnit = hass?.states?.[valueEntity]?.attributes?.unit_of_measurement;
      if (unit && (!nativeUnit || String(nativeUnit).trim() !== unit)) native.suffix = ` ${unit}`;
      elements.push(native);
    }

    // Keep a zero-impact native marker when the logical area has no visible content.
    // This preserves the entity/name/action and visibility flags for a later Lotus edit,
    // while remaining completely harmless if Lotus Stack is not installed.
    if (elements.length === elementStartIndex) {
      const clickablePlaceholder = tapAction?.action && tapAction.action !== "none";
      const placeholderStyle = {
        left: vscPct(positions.geometry.centerX),
        top: vscPct(positions.geometry.centerY),
        opacity: "0",
        transform: "translate(-50%, -50%)",
      };

      if (clickablePlaceholder) {
        // Preserve the legacy behaviour of an invisible but fully clickable merged area.
        placeholderStyle.width = vscPct(positions.geometry.width);
      } else {
        placeholderStyle.width = "1px";
        placeholderStyle["pointer-events"] = "none";
      }

      const placeholder = {
        type: "image",
        entity: item.entity || undefined,
        image: vscTransparentSvg(1, 1),
        filter: "none",
        tap_action: tapAction,
        hold_action: holdAction,
        double_tap_action: doubleTapAction,
        style: vscMarkerStyle(item, "placeholder", placeholderStyle),
      };

      if (clickablePlaceholder) {
        placeholder.aspect_ratio = vscRegionAspectRatio(config, area.region);
      }
      if (!item.entity) delete placeholder.entity;
      elements.push(placeholder);
    }

    // Item-level metadata is stored only once, on the first native element of the area.
    // This keeps the generated YAML readable while preserving lossless re-editing.
    const primaryElement = elements[elementStartIndex];
    const primaryRole = String(primaryElement?.style?.["--lotus-vs"] ?? "").split(":")[1] || "placeholder";
    vscAttachItemMetadata(primaryElement, item, primaryRole);

    // Cell visibility is deliberately a native Home Assistant concern. The
    // generated picture-elements children for one logical Lotus cell are
    // grouped under HA's native conditional picture-element, so HA validates
    // and evaluates the exact same conditions as its Visibility editor.
    if (Array.isArray(item.visibility_conditions) && item.visibility_conditions.length) {
      const cellElements = elements.splice(elementStartIndex);
      elements.push({
        type: "conditional",
        conditions: vscClone(item.visibility_conditions),
        elements: cellElements,
      });
    }
  }

  const meta = {
    version: LOTUS_VISUAL_STACK_SCHEMA_VERSION,
    size: [config.frame_width, config.frame_height],
    regions: regions.map((region) => [
      region.id,
      vscRound(region.x),
      vscRound(region.y),
      vscRound(region.width),
      vscRound(region.height),
    ]),
    items: config.items.map(vscItemMetadataSnapshot),
  };
  const firstItem = regions[0]?.id ?? 1;
  if (Number(config.primary_item) && Number(config.primary_item) !== firstItem) meta.primary_item = Number(config.primary_item);
  if (["compact", "large"].includes(config.density)) meta.density = config.density;
  if (config.show_dividers !== false) meta.show_dividers = true;
  if (config.show_dividers !== false && vscDividerSize(config.divider_size) !== 1) meta.divider_size = vscDividerSize(config.divider_size);
  if (config.card_border_enabled === true) {
    meta.card_border = {
      enabled: true,
      width: vscCardBorderWidth(config.card_border_width),
      style: vscCardBorderStyle(config.card_border_style),
      color: String(config.card_border_color ?? "primary").trim() || "primary",
      radius: vscCardBorderRadius(config.card_border_radius),
    };
  }
  if (config.state_color === false) meta.state_color = false;
  if (["color", "transparent"].includes(config.background_mode)) meta.background_mode = config.background_mode;
  if (config.background_mode === "color" && String(config.background_color ?? "").trim()) meta.background_color = String(config.background_color).trim();

  const titleStyle = {};
  if (String(config.title_font_family ?? "").trim()) titleStyle.font_family = String(config.title_font_family).trim();
  if (vscTextSize(config.title_font_size)) titleStyle.font_size = vscTextSize(config.title_font_size);
  if (["center", "right"].includes(config.title_align)) titleStyle.align = config.title_align;
  if (config.title_bold === false) titleStyle.bold = false;
  if (config.title_italic === true) titleStyle.italic = true;
  if (config.title_underline === true) titleStyle.underline = true;
  if (String(config.title_color ?? "").trim()) titleStyle.color = String(config.title_color).trim();
  if (Object.keys(titleStyle).length) meta.title_style = titleStyle;

  const native = {
    type: LOTUS_VISUAL_STACK_NATIVE_TYPE,
    image: vscBackgroundImage(config),
    // Force Home Assistant to use the exact Lotus frame ratio immediately.
    // Without this, hui-image temporarily falls back to 16:9 and a nested
    // Visual Stack can be measured/clipped incorrectly by picture-elements.
    aspect_ratio: `${config.frame_width}:${config.frame_height}`,
    elements,
    [LOTUS_VISUAL_STACK_META_KEY]: meta,
  };
  if (String(config.title ?? "").trim()) native.title = String(config.title).trim();
  return native;
};


const vscFlattenNativePictureElements = (elements) => {
  const flattened = [];
  const visit = (element) => {
    if (!element || typeof element !== "object") return;
    if (element.type === "conditional" && Array.isArray(element.elements)) {
      for (const child of element.elements) visit(child);
      return;
    }
    flattened.push(element);
  };
  for (const element of Array.isArray(elements) ? elements : []) visit(element);
  return flattened;
};

const vscNativeToInternalLegacy = (input) => {
  const config = vscClone(input || {});
  const meta = config[LOTUS_VISUAL_STACK_META_KEY] ?? {};
  const rows = vscPositiveInt(meta.rows, 1);
  const columns = vscPositiveInt(meta.columns, 1);
  const required = rows * columns;
  const cells = Array.isArray(meta.cells) ? meta.cells.slice(0, required).map(Number) : [];
  while (cells.length < required) cells.push(cells.length + 1);

  const placedIds = [...new Set(cells.filter((id) => Number.isInteger(id) && id > 0))];
  const storedItems = new Map(
    (Array.isArray(meta.items) ? meta.items : [])
      .filter((entry) => Number.isInteger(Number(entry?.id)) && Number(entry.id) > 0)
      .map((entry) => [Number(entry.id), vscClone(entry)]),
  );
  const groups = new Map(placedIds.map((id) => [id, []]));
  for (const element of vscFlattenNativePictureElements(config.elements)) {
    const style = element?.style && typeof element.style === "object" ? element.style : {};
    const marker = String(style["--lotus-vs"] ?? "");
    const id = Number(marker.split(":")[0]);
    if (!Number.isInteger(id) || id < 1) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(element);
  }

  const items = placedIds.map((id) => {
    const stored = storedItems.get(id);
    const item = stored
      ? { ...vscDefaultItem(id), ...stored, id }
      : {
          ...vscDefaultItem(id),
          id,
          show_icon: false,
          show_name: false,
          show_state: false,
        };
    const group = groups.get(id) ?? [];
    const primaryElement = group[0];
    const markerStyle = primaryElement?.style ?? {};
    item.type = markerStyle["--lotus-vs-kind"] === "button" ? "button" : "info";
    item.name = typeof primaryElement?.title === "string" ? primaryElement.title : "";
    item.interaction_feedback = markerStyle["--lotus-vs-interaction-feedback"] !== "none";
    item.show_affordance = markerStyle["--lotus-vs-affordance"] === "show";
    const markedAction = String(markerStyle["--lotus-vs-action"] ?? "");

    let actionLoaded = false;
    let holdActionLoaded = false;
    let doubleTapActionLoaded = false;
    for (const element of group) {
      const style = element?.style && typeof element.style === "object" ? element.style : {};
      const role = String(style["--lotus-vs"] ?? "").split(":")[1] ?? "";
      if (!item.entity && element.entity) item.entity = element.entity;
      if (!actionLoaded && element.tap_action) {
        vscItemFromNativeAction(item, element.tap_action);
        actionLoaded = true;
      }
      if (!holdActionLoaded && element.hold_action) {
        item.hold_action = vscClone(element.hold_action);
        holdActionLoaded = true;
      }
      if (!doubleTapActionLoaded && element.double_tap_action) {
        item.double_tap_action = vscClone(element.double_tap_action);
        doubleTapActionLoaded = true;
      }

      if (role === "visual") {
        item.show_icon = true;
        const markedVisualValueEntity = String(style["--lotus-vs-value-entity"] ?? "").trim();
        if (markedVisualValueEntity) {
          item.value_entity = markedVisualValueEntity;
          const markedVisualPrimaryEntity = String(style["--lotus-vs-primary-entity"] ?? "").trim();
          item.entity = markedVisualPrimaryEntity === "__none__" ? "" : markedVisualPrimaryEntity;
        }
        const markedVisual = markerStyle["--lotus-vs-visual-type"] ?? style["--lotus-vs-visual-type"];
        item.visual_type = markedVisual === "image" || element.type === "image" || element.type === LOTUS_VISUAL_STACK_DYNAMIC_IMAGE_TYPE ? "image" : "icon";
        item.visual_background = style["--lotus-vs-visual-background"] !== "none";
        if (item.visual_type !== "image") {
          item.icon_size = vscIconSize(style["--lotus-vs-icon-size"] ?? markerStyle["--lotus-vs-icon-size"] ?? 20);
          item.icon_color = String(style["--lotus-vs-icon-color"] ?? markerStyle["--lotus-vs-icon-color"] ?? "state").trim() || "state";
        }
        if (element.icon) item.icon = element.icon;
        if (element.type === LOTUS_VISUAL_STACK_DYNAMIC_ICON_TYPE) {
          const dynamicActionEntity = String(element.action_entity ?? "").trim();
          const dynamicValueEntity = String(element.entity ?? "").trim();
          if (dynamicActionEntity) item.entity = dynamicActionEntity;
          if (dynamicValueEntity && dynamicValueEntity !== item.entity) item.value_entity = dynamicValueEntity;
          item.icon_mode = element.mode === "integer" ? "integer" : "binary";
          item.icon = String(element.icon ?? item.icon ?? "");
          item.icon_color = String(element.color ?? item.icon_color ?? "state").trim() || "state";
          item.icon_size = vscIconSize(element.icon_size ?? item.icon_size);
          item.icon_binary_state_1 = String(element.binary_state_1 ?? item.icon_binary_state_1 ?? "off");
          item.icon_binary_1 = String(element.binary_icon_1 ?? item.icon_binary_1 ?? "");
          item.icon_binary_color_1 = String(element.binary_color_1 ?? item.icon_binary_color_1 ?? "state").trim() || "state";
          item.icon_binary_state_2 = String(element.binary_state_2 ?? item.icon_binary_state_2 ?? "on");
          item.icon_binary_2 = String(element.binary_icon_2 ?? item.icon_binary_2 ?? "");
          item.icon_binary_color_2 = String(element.binary_color_2 ?? item.icon_binary_color_2 ?? "state").trim() || "state";
          if (item.icon_mode === "integer" && Array.isArray(element.icon_values)) {
            const mapped = element.icon_values
              .filter((entry) => Number.isInteger(Number(entry?.value)))
              .map((entry, index) => ({
                value: Number(entry.value),
                icon: String(entry?.icon ?? ""),
                color: String(entry?.color ?? "state").trim() || "state",
              }));
            if (!(stored && (Object.prototype.hasOwnProperty.call(stored, "icon_value_count") || Object.prototype.hasOwnProperty.call(stored, "icon_values")))) {
              item.icon_values = mapped;
              item.icon_value_count = mapped.length;
            }
          }
        }
        if (element.type === "image" || element.type === LOTUS_VISUAL_STACK_DYNAMIC_IMAGE_TYPE) {
          item.image_default = element.image ?? "";
          const storedFit = element.image_fit ?? style["--lotus-vs-image-fit"] ?? style["object-fit"];
          item.image_fit = ["contain", "cover", "fill"].includes(storedFit)
            ? storedFit
            : "contain";
          const dynamicMappings = Array.isArray(element.image_values)
            ? element.image_values
                .map((entry) => [String(entry?.value ?? ""), String(entry?.image ?? "")])
                .filter(([key, image]) => /^-?\d+$/.test(key) && image)
            : [];
          const mappings = dynamicMappings.length ? dynamicMappings : Object.entries(element.state_image ?? {});
          const mode = element.type === LOTUS_VISUAL_STACK_DYNAMIC_IMAGE_TYPE || style["--lotus-vs-image-mode"] === "integer" || (mappings.length > 2 && mappings.every(([key]) => /^-?\d+$/.test(key)))
            ? "integer"
            : "binary";
          item.image_mode = mode;
          // Dynamic image elements no longer own value_source/attribute.
          // Those fields are reserved for the optional textual state display.
          if (mode === "integer") {
            // 0.8.18: lotus_visual_stack.items is authoritative for the editor.
            // state_image deliberately omits mappings whose image is still empty.
            // Rebuilding image_value_count from state_image therefore used to
            // collapse e.g. 4 requested rows back to the 2 already configured rows
            // on Home Assistant's immediate config round-trip.
            const hasStoredIntegerMapping = Boolean(
              stored &&
              (
                Object.prototype.hasOwnProperty.call(stored, "image_value_count") ||
                Object.prototype.hasOwnProperty.call(stored, "image_values")
              )
            );

            if (hasStoredIntegerMapping) {
              const storedValues = Array.isArray(item.image_values)
                ? item.image_values.map((entry, index) => ({
                    value: Number.isInteger(Number(entry?.value)) ? Number(entry.value) : index,
                    image: String(entry?.image ?? ""),
                  }))
                : [];
              const storedCountRaw = Number(item.image_value_count);
              const storedCount = Math.max(
                0,
                Math.min(
                  VISUAL_STACK_CARD_MAX_IMAGES,
                  Number.isFinite(storedCountRaw)
                    ? Math.floor(storedCountRaw)
                    : storedValues.length,
                ),
              );

              item.image_value_count = storedCount;
              item.image_values = Array.from(
                { length: storedCount },
                (_, index) => storedValues[index] ?? { value: index, image: "" },
              );
            } else {
              const uniqueMappings = new Map();
              for (const [value, image] of mappings) {
                const numeric = Number(String(value).replace(",", "."));
                if (!Number.isInteger(numeric) || !String(image ?? "").trim()) continue;
                if (!uniqueMappings.has(numeric)) uniqueMappings.set(numeric, String(image));
              }
              item.image_values = [...uniqueMappings.entries()]
                .map(([value, image]) => ({ value, image }));
              item.image_value_count = item.image_values.length;
            }
          } else {
            const preferred = mappings.slice().sort(([a], [b]) => {
              if (a === "off") return -1;
              if (b === "off") return 1;
              if (a === "on") return -1;
              if (b === "on") return 1;
              return 0;
            });
            if (preferred[0]) {
              item.image_binary_state_1 = preferred[0][0];
              item.image_binary_1 = preferred[0][1];
            }
            if (preferred[1]) {
              item.image_binary_state_2 = preferred[1][0];
              item.image_binary_2 = preferred[1][1];
            }
            if (style["--lotus-vs-binary-state-1"]) item.image_binary_state_1 = style["--lotus-vs-binary-state-1"];
            if (style["--lotus-vs-binary-image-1"]) item.image_binary_1 = style["--lotus-vs-binary-image-1"];
            if (style["--lotus-vs-binary-state-2"]) item.image_binary_state_2 = style["--lotus-vs-binary-state-2"];
            if (style["--lotus-vs-binary-image-2"]) item.image_binary_2 = style["--lotus-vs-binary-image-2"];
          }
          item.image_active_background = style["--lotus-vs-image-active-background"] === "true";
        }
      } else if (role === "name") {
        item.show_name = true;
        if (element.type === LOTUS_VISUAL_STACK_STATIC_TEXT_TYPE && typeof element.text === "string") {
          item.name = element.text;
        } else if (!item.name && element.title) {
          item.name = element.title;
        }
        vscReadNativeTextStyle(item, "name", style);
      } else if (role === "state") {
        item.show_state = true;
        const markedValueEntity = String(style["--lotus-vs-value-entity"] ?? "").trim();
        if (markedValueEntity) {
          item.value_entity = markedValueEntity;
          const markedPrimaryEntity = String(style["--lotus-vs-primary-entity"] ?? "").trim();
          item.entity = markedPrimaryEntity === "__none__" ? "" : markedPrimaryEntity;
        } else if (element.entity && item.entity && element.entity !== item.entity) {
          // Compatibility with native YAML manually authored before this marker existed.
          item.value_entity = element.entity;
        }
        if (element.attribute) {
          item.value_source = "attribute";
          item.attribute = element.attribute;
        }
        if (style["--lotus-vs-unit"]) item.unit = String(style["--lotus-vs-unit"]).trim();
        else if (element.suffix) item.unit = String(element.suffix).trim();
        if (style["--lotus-vs-value-source"] === "state") item.value_source = "state";
        vscReadNativeTextStyle(item, "value", style);
      }
    }

    if (markedAction) {
      item.action = markedAction;
      if (markedAction === "auto") item.tap_action = undefined;
    }

    // Migration for 0.8.13 name-only cells: that version could leave only an
    // invisible placeholder carrying the custom name in its title. If that
    // marker survived Home Assistant normalization, restore the intended name
    // visibility instead of reopening the cell as empty.
    if (!stored && group.length && item.name && !item.show_icon && !item.show_name && !item.show_state) {
      item.show_name = true;
    }
    if (!group.length && !stored) {
      item.show_icon = true;
      item.show_name = true;
      item.show_state = true;
    }
    return item;
  });

  return {
    type: LOTUS_VISUAL_STACK_TYPE,
    title: typeof config.title === "string" ? config.title : "",
    title_font_family: typeof meta.title_style?.font_family === "string" ? meta.title_style.font_family : "",
    title_font_size: vscTextSize(meta.title_style?.font_size),
    title_align: ["left", "center", "right"].includes(meta.title_style?.align) ? meta.title_style.align : "left",
    title_bold: meta.title_style?.bold !== false,
    title_italic: meta.title_style?.italic === true,
    title_underline: meta.title_style?.underline === true,
    title_color: typeof meta.title_style?.color === "string" ? meta.title_style.color : "",
    grid_rows: rows,
    grid_columns: columns,
    grid_cells: cells,
    fill_direction: "horizontal",
    density: ["compact", "normal", "large"].includes(meta.density) ? meta.density : "normal",
    show_dividers: meta.show_dividers === true,
    divider_size: vscDividerSize(meta.divider_size ?? 1),
    card_border_enabled: meta.card_border?.enabled === true,
    card_border_width: vscCardBorderWidth(meta.card_border?.width ?? 2),
    card_border_style: vscCardBorderStyle(meta.card_border?.style ?? "solid"),
    card_border_color: typeof meta.card_border?.color === "string" && meta.card_border.color ? meta.card_border.color : "primary",
    card_border_radius: vscCardBorderRadius(meta.card_border?.radius ?? 12),
    state_color: meta.state_color !== false,
    background_mode: ["theme", "color", "transparent"].includes(meta.background_mode) ? meta.background_mode : "theme",
    background_color: typeof meta.background_color === "string" && meta.background_color ? meta.background_color : "#ffffff",
    primary_item: Number(meta.primary_item) || cells[0] || 1,
    primary_position: "custom",
    items,
  };
};


const vscConditionMatches = (rawValue, expression) => {
  const raw = rawValue === undefined || rawValue === null
    ? ""
    : String(rawValue).trim();

  const condition = String(expression ?? "").trim();
  if (!condition) return false;

  const comparison = condition.match(
    /^(<=|>=|!=|==|=|<|>)\s*(-?\d+(?:[\.,]\d+)?)$/,
  );

  if (comparison) {
    const operator = comparison[1];
    const expected = Number(comparison[2].replace(",", "."));
    const actual = Number(raw.replace(",", "."));

    if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
      return false;
    }

    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    if (operator === ">") return actual > expected;
    if (operator === ">=") return actual >= expected;
    if (operator === "!=") return actual !== expected;
    return actual === expected;
  }

  if (/^-?\d+(?:[\.,]\d+)?$/.test(condition)) {
    const actual = Number(raw.replace(",", "."));
    const expected = Number(condition.replace(",", "."));
    return Number.isFinite(actual) && actual === expected;
  }

  return raw === condition;
};


const vscBinaryIconConditionMatches = (rawValue, expression) => {
  const raw = String(rawValue ?? "").trim().toLowerCase();
  const condition = String(expression ?? "").trim().toLowerCase();
  const numeric = Number(raw.replace(",", "."));
  const offLike = raw === "off" || raw === "false" || (Number.isFinite(numeric) && numeric === 0);
  const onLike = raw === "on" || raw === "true" || (Number.isFinite(numeric) && numeric === 1);
  if (["off", "false", "0", "0.0"].includes(condition)) return offLike;
  if (["on", "true", "1", "1.0"].includes(condition)) return onLike;
  return vscConditionMatches(rawValue, expression);
};



class VisualStackCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("lotus-visual-stack-editor");
  }

  static getStubConfig() {
    return vscBaseConfig();
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._preview = false;
    this._mediaImageCache = new Map();
    this._mediaImagePending = new Set();
    // Home Assistant publishes a new `hass` value for every global state
    // change. Keep a compact snapshot of only the entities used by this Stack
    // so an unrelated light/sensor update does not rebuild the whole card.
    this._stateFingerprint = "";
    this._responsiveRaf = 0;
    this._resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => this._scheduleResponsiveContent())
      : null;
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    this._scheduleResponsiveContent();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    if (this._responsiveRaf) cancelAnimationFrame(this._responsiveRaf);
    this._responsiveRaf = 0;
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration manquante.");
    this._config = vscNormalizeConfig(config);
    this._stateFingerprint = "";
    this._render();
  }

  _stateDependencyFingerprint(hass = this._hass) {
    if (!this._config || !hass) return "";
    const rows = [];
    for (const item of Array.isArray(this._config.items) ? this._config.items : []) {
      const primaryId = String(item?.entity ?? "").trim();
      const valueId = String(item?.value_entity ?? "").trim() || primaryId;
      const append = (role, entityId) => {
        if (!entityId) return;
        const stateObj = hass?.states?.[entityId];
        const attributes = stateObj?.attributes || {};
        let selectedAttribute;
        if (String(item?.attribute ?? "").trim()) {
          selectedAttribute = attributes[String(item.attribute).trim()];
        }
        rows.push([
          Number(item?.id) || 0,
          role,
          entityId,
          stateObj?.state ?? null,
          attributes.friendly_name ?? null,
          attributes.icon ?? null,
          attributes.unit_of_measurement ?? null,
          selectedAttribute ?? null,
        ]);
      };
      append("primary", primaryId);
      if (valueId && valueId !== primaryId) append("value", valueId);
    }
    try {
      return JSON.stringify(rows);
    } catch (_error) {
      return rows.map((row) => row.map((value) => String(value ?? "")).join("\u0001")).join("\u0002");
    }
  }

  _propagateHassWithoutRebuild(hass) {
    if (!this.shadowRoot) return;
    // Only legacy/custom dynamic picture-elements need direct hass forwarding.
    // The Lotus Layout runtime itself is rebuilt only when one of this Stack's
    // dependent entities changes.
    for (const element of this.shadowRoot.querySelectorAll(
      'lotus-dynamic-image-element',
    )) {
      try { element.hass = hass; } catch (_error) { /* defensive */ }
    }
  }

  set hass(hass) {
    lotusSetHass(hass);
    const previousFingerprint = this._stateFingerprint;
    this._hass = hass;
    const nextFingerprint = this._stateDependencyFingerprint(hass);
    this._stateFingerprint = nextFingerprint;

    // Always forward the live Home Assistant object first. Integer-driven
    // images read hass.states directly and must never depend on a copied state
    // captured when their parent was rendered.
    this._propagateHassWithoutRebuild(hass);

    // Do not rebuild every Lotus Stack for an unrelated Home Assistant state
    // update. Rebuild only when one of this card's own source entities changed.
    if (!this.shadowRoot?.childElementCount || previousFingerprint !== nextFingerprint) {
      this._render();
    }
  }
  get hass() { return this._hass; }

  set preview(value) {
    const next = Boolean(value);
    if (next === this._preview) return;
    this._preview = next;
    this._render();
  }
  get preview() { return this._preview; }

  getCardSize() {
    const ratio = Math.max(0.2, this._config?.frame_height / Math.max(1, this._config?.frame_width) || 0.6);
    return Math.max(1, Math.ceil(3 * ratio));
  }

  getGridOptions() {
    const ratio = Math.max(0.2, this._config?.frame_height / Math.max(1, this._config?.frame_width) || 0.6);
    return {
      columns: 6,
      rows: Math.max(1, Math.round(6 * ratio)),
      min_columns: 1,
      max_columns: 12,
      min_rows: 1,
    };
  }

  _getItem(itemId) {
    const item = this._config?.items?.find((candidate) => Number(candidate.id) === Number(itemId));
    return item ? { ...vscDefaultItem(Number(itemId)), ...item, id: Number(itemId) } : vscDefaultItem(Number(itemId));
  }

  _isActive(stateObj) {
    if (!stateObj) return false;
    const activeStates = new Set([
      "on", "open", "opening", "home", "playing", "active", "heat", "cool",
      "heating", "cooling", "locked", "unlocked", "detected",
    ]);
    return activeStates.has(String(stateObj.state).toLowerCase());
  }

  _friendlyName(item, stateObj) {
    return item.name || stateObj?.attributes?.friendly_name || item.entity || `Cellule ${item.id}`;
  }

  _applyTextStyle(element, source, prefix, { defaultBold = false } = {}) {
    if (!element || !source) return;

    const family = String(source[`${prefix}_font_family`] ?? "").trim();
    const size = vscTextSize(source[`${prefix}_font_size`]);
    const align = ["left", "center", "right"].includes(source[`${prefix}_align`])
      ? source[`${prefix}_align`]
      : "left";
    const color = String(source[`${prefix}_color`] ?? "").trim();
    const fallbackSize = prefix === "name" ? 14 : prefix === "value" ? 12 : 14;

    element.style.width = "100%";
    element.style.textAlign = align;
    element.dataset.lotusMaxFontSize = String(size > 0 ? size : fallbackSize);

    if (family) element.style.fontFamily = family;
    if (size > 0) element.style.fontSize = `${size}px`;
    if (color) element.style.color = color;

    const bold = source[`${prefix}_bold`] === true ||
      (source[`${prefix}_bold`] === undefined && defaultBold);

    element.style.fontWeight = bold ? "700" : "400";
    element.style.fontStyle =
      source[`${prefix}_italic`] === true ? "italic" : "normal";
    element.style.textDecoration =
      source[`${prefix}_underline`] === true ? "underline" : "none";
  }

  _scheduleResponsiveContent() {
    if (this._responsiveRaf) cancelAnimationFrame(this._responsiveRaf);
    this._responsiveRaf = requestAnimationFrame(() => {
      this._responsiveRaf = 0;
      this._applyResponsiveContent();
    });
  }

  _applyResponsiveContent() {
    if (!this.shadowRoot) return;
    for (const item of this.shadowRoot.querySelectorAll(".vsc-item")) {
      const textBox = item.querySelector(".text");
      if (!textBox) continue;
      const lines = [...textBox.querySelectorAll(".name,.state")];
      if (!lines.length) continue;

      // The configured pixel size is treated as the maximum design size.
      // On a smaller rendered cell we shrink only as much as needed so the
      // complete line remains visible instead of being ellipsized/cropped.
      for (const line of lines) {
        const maxSize = Math.max(1, Number(line.dataset.lotusMaxFontSize) || (line.classList.contains("name") ? 14 : 12));
        line.style.fontSize = `${maxSize}px`;
      }

      const width = Math.max(0, textBox.clientWidth - 1);
      const itemStyle = getComputedStyle(item);
      const verticalPadding = (parseFloat(itemStyle.paddingTop) || 0) + (parseFloat(itemStyle.paddingBottom) || 0);
      const availableHeight = Math.max(0, item.clientHeight - verticalPadding);
      if (!(width > 0) || !(availableHeight > 0)) {
        for (const line of lines) line.style.fontSize = "1px";
        continue;
      }

      for (const line of lines) {
        const current = Math.max(1, parseFloat(line.style.fontSize) || 1);
        const naturalWidth = Math.max(1, line.scrollWidth);
        if (naturalWidth > width) {
          line.style.fontSize = `${Math.max(1, current * width / naturalWidth)}px`;
        }
      }

      const usedHeight = () => lines.reduce((sum, line) => {
        const rect = line.getBoundingClientRect();
        const css = getComputedStyle(line);
        return sum + rect.height + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
      }, 0);

      const totalHeight = usedHeight();
      if (totalHeight > availableHeight && totalHeight > 0) {
        const scale = availableHeight / totalHeight;
        for (const line of lines) {
          const current = Math.max(1, parseFloat(line.style.fontSize) || 1);
          line.style.fontSize = `${Math.max(1, current * scale)}px`;
        }
      }

      // A final width pass handles the small width change caused by the height fit.
      for (const line of lines) {
        const current = Math.max(1, parseFloat(line.style.fontSize) || 1);
        const naturalWidth = Math.max(1, line.scrollWidth);
        if (naturalWidth > width) {
          line.style.fontSize = `${Math.max(1, current * width / naturalWidth)}px`;
        }
      }
    }
  }

  _entityIcon(item, stateObj) {
    if (item.icon) return item.icon;
    if (stateObj?.attributes?.icon) return stateObj.attributes.icon;
    const domain = item.entity?.split(".")[0];
    const defaults = {
      light: "mdi:lightbulb",
      switch: "mdi:toggle-switch",
      sensor: "mdi:eye",
      binary_sensor: "mdi:radiobox-marked",
      climate: "mdi:thermostat",
      cover: "mdi:window-shutter",
      lock: "mdi:lock",
      media_player: "mdi:play-circle",
      person: "mdi:account",
      device_tracker: "mdi:map-marker-account",
      fan: "mdi:fan",
      alarm_control_panel: "mdi:shield-home",
      input_boolean: "mdi:toggle-switch",
      scene: "mdi:palette",
      script: "mdi:script-text",
      automation: "mdi:robot",
    };
    return defaults[domain] || "mdi:circle-outline";
  }

  _rawValue(item, stateObj) {
    if (!stateObj) return undefined;
    const source = item.value_source === "attribute" || (!item.value_source && item.attribute) ? "attribute" : "state";
    return source === "attribute" ? (item.attribute ? stateObj.attributes?.[item.attribute] : undefined) : stateObj.state;
  }

  _formatRawValue(value) {
    if (value === undefined || value === null || value === "") return "—";
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch (_err) { return String(value); }
    }
    return String(value);
  }

  _stateText(item, stateObj) {
    if (!stateObj) return (item.value_entity || item.entity) ? "Indisponible" : "Entité non définie";
    const source = item.value_source === "attribute" || (!item.value_source && item.attribute) ? "attribute" : "state";
    const customUnit = String(item.unit ?? "").trim();
    if (source === "state" && !customUnit) {
      try { if (this._hass?.formatEntityState) return this._hass.formatEntityState(stateObj); } catch (_err) {}
    }
    const formatted = this._formatRawValue(this._rawValue(item, stateObj));
    if (customUnit && formatted !== "—") return `${formatted} ${customUnit}`.trim();
    if (source === "state") {
      const nativeUnit = stateObj.attributes?.unit_of_measurement;
      return nativeUnit && formatted !== "—" ? `${formatted} ${nativeUnit}` : formatted;
    }
    return formatted;
  }

  _imageRawValue(_item, stateObj) {
    if (!stateObj) return undefined;
    // 0.8.28: integer image mapping is deliberately independent from the
    // textual value display. value_source/attribute belong to the text shown
    // by the cell and may remain hidden when show_state=false. Reusing them
    // here could therefore make an old invisible attribute drive the image.
    // “Valeur entière → image” always reads the raw entity state.
    return stateObj.state;
  }

  _iconRawValue(_item, stateObj) {
    if (!stateObj) return undefined;
    // Dynamic icon selection follows the raw state of the selected value
    // entity, independently from the optional textual attribute display.
    return stateObj.state;
  }

  _resolvedIcon(item, stateObj) {
    const fallback = {
      icon: this._entityIcon(item, stateObj),
      color: String(item.icon_color ?? "state").trim() || "state",
    };
    const mode = ["binary", "integer"].includes(item.icon_mode)
      ? item.icon_mode
      : "static";
    if (mode === "static") return fallback;

    const raw = this._iconRawValue(item, stateObj);
    if (mode === "integer") {
      const numeric = Number(String(raw ?? "").trim().replace(",", "."));
      if (!Number.isInteger(numeric)) return fallback;
      const match = (Array.isArray(item.icon_values) ? item.icon_values : []).find(
        (entry) => Number.isInteger(Number(entry?.value)) && Number(entry.value) === numeric,
      );
      if (!match) return fallback;
      return {
        icon: String(match?.icon ?? "").trim() || fallback.icon,
        color: String(match?.color ?? "state").trim() || fallback.color,
      };
    }

    const entries = [
      {
        condition: item.icon_binary_state_1 ?? "off",
        icon: item.icon_binary_1,
        color: item.icon_binary_color_1,
      },
      {
        condition: item.icon_binary_state_2 ?? "on",
        icon: item.icon_binary_2,
        color: item.icon_binary_color_2,
      },
    ];
    const match = entries.find((entry) => vscBinaryIconConditionMatches(raw, entry.condition));
    if (!match) return fallback;
    return {
      icon: String(match.icon ?? "").trim() || fallback.icon,
      color: String(match.color ?? "state").trim() || fallback.color,
    };
  }

  _resolvedImage(item, stateObj) {
    if (item.visual_type !== "image") return "";

    const raw = item.image_mode === "integer"
      ? this._imageRawValue(item, stateObj)
      : this._rawValue(item, stateObj);
    const fallback = String(item.image_default ?? "").trim();

    if (item.image_mode === "integer") {
      const numeric = Number(raw);

      if (Number.isInteger(numeric)) {
        const mappings = Array.isArray(item.image_values)
          ? item.image_values
          : [];

        const match = mappings.find(
          (entry) =>
            Number.isInteger(Number(entry?.value)) &&
            Number(entry.value) === numeric,
        );

        const image = String(match?.image ?? "").trim();
        if (image) return image;
      }

      return fallback;
    }

    if (vscConditionMatches(raw, item.image_binary_state_1 ?? "off")) {
      return String(item.image_binary_1 ?? "").trim() || fallback;
    }

    if (vscConditionMatches(raw, item.image_binary_state_2 ?? "on")) {
      return String(item.image_binary_2 ?? "").trim() || fallback;
    }

    return fallback;
  }

  _displayImageUrl(value) {
    const source = String(value ?? "").trim();
    if (!source) return "";
    if (!source.startsWith("media-source://")) return source;

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
        lotusDebug("Unable to resolve Stack image", source, error);
      }).finally(() => {
        this._mediaImagePending.delete(source);
        if (this.isConnected) this._render();
      });
    }

    return "";
  }

  _resolvedAction(item) {
    if (item.action && item.action !== "auto") return item.action;

    if (item.type !== "button") return "more-info";

    const domain = String(item.entity ?? "").split(".")[0];

    if (domain === "input_button") return "input_button_press";
    if (domain === "button") return "button_press";
    if (domain === "scene") return "scene_turn_on";
    if (domain === "script") return "script_turn_on";

    return "toggle";
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  async _executeActionConfig(item, actionConfig) {
    if (!this._hass || this._preview) return;

    const config = actionConfig && typeof actionConfig === "object"
      ? actionConfig
      : vscNativeTapAction(item);
    const action = String(config?.action ?? "none");
    if (!action || action === "none") return;

    const entityId = config.entity || item.entity;

    if (action === "more-info") {
      this._fireMoreInfo(entityId);
      return;
    }

    if (action === "toggle") {
      if (!entityId) return;
      await this._hass.callService("homeassistant", "toggle", {}, { entity_id: entityId });
      return;
    }

    if (action === "navigate") {
      const path = String(config.navigation_path ?? "").trim();
      if (!path) return;
      window.history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
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
        : entityId
          ? { entity_id: entityId }
          : {};
      await this._hass.callService(domain, service, data, target);
      return;
    }

    // Backwards-compatible Lotus actions are normalized here only for old cards.
    if (action === "input_button_press" && entityId) {
      await this._hass.callService("input_button", "press", {}, { entity_id: entityId });
      return;
    }
    if (action === "button_press" && entityId) {
      await this._hass.callService("button", "press", {}, { entity_id: entityId });
      return;
    }
    if (action === "scene_turn_on" && entityId) {
      await this._hass.callService("scene", "turn_on", {}, { entity_id: entityId });
      return;
    }
    if (action === "script_turn_on" && entityId) {
      await this._hass.callService("script", "turn_on", {}, { entity_id: entityId });
    }
  }

  _bindItemActions(element, item) {
    if (!element || this._preview) return;

    const tapAction = vscNativeTapAction(item);
    const holdAction = vscOptionalNativeAction(item.hold_action);
    const doubleTapAction = vscOptionalNativeAction(item.double_tap_action);
    const hasTap = tapAction?.action && tapAction.action !== "none";
    const hasHold = holdAction?.action && holdAction.action !== "none";
    const hasDouble = doubleTapAction?.action && doubleTapAction.action !== "none";
    if (!hasTap && !hasHold && !hasDouble) return;

    let holdTimer = 0;
    let tapTimer = 0;
    let held = false;

    const clearHold = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = 0;
    };
    const clearTap = () => {
      if (tapTimer) window.clearTimeout(tapTimer);
      tapTimer = 0;
    };

    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");

    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      held = false;
      clearHold();
      if (hasHold) {
        holdTimer = window.setTimeout(() => {
          held = true;
          this._executeActionConfig(item, holdAction);
        }, 500);
      }
    });

    element.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clearHold();
      if (held || !hasTap) return;
      if (hasDouble) {
        clearTap();
        tapTimer = window.setTimeout(() => {
          tapTimer = 0;
          this._executeActionConfig(item, tapAction);
        }, 260);
      } else {
        this._executeActionConfig(item, tapAction);
      }
    });

    element.addEventListener("pointercancel", clearHold);
    element.addEventListener("pointerleave", clearHold);

    if (hasDouble) {
      element.addEventListener("dblclick", (event) => {
        event.preventDefault();
        clearHold();
        clearTap();
        this._executeActionConfig(item, doubleTapAction);
      });
    }

    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (hasTap) this._executeActionConfig(item, tapAction);
      }
    });
  }

  async _handleAction(item) {
    return this._executeActionConfig(item, vscNativeTapAction(item));
  }

  _createItemElement(item, area) {
    const stateObj = item.entity ? this._hass?.states?.[item.entity] : undefined;
    const valueEntity = String(item.value_entity ?? "").trim() || String(item.entity ?? "").trim();
    const valueStateObj = valueEntity ? this._hass?.states?.[valueEntity] : stateObj;
    const action = this._resolvedAction(item);
    const interactive = !this._preview && action !== "none";
    const isPrimary = Number(this._config.primary_item) === Number(item.id);
    const showVisual = vscVisualEnabled(item);
    const visualOnly =
      showVisual &&
      item.show_name === false &&
      item.show_state === false;
    const imageOnly = visualOnly && item.visual_type === "image";

    const el = document.createElement("div");
    el.className = `vsc-item ${item.type} ${interactive ? "interactive" : ""} ${
      interactive && item.interaction_feedback === false ? "no-interaction-feedback" : ""
    } ${isPrimary ? "primary-item" : ""} ${visualOnly ? "visual-only" : ""} ${
      imageOnly ? "image-only" : ""
    } ${this._config?.state_color !== false && this._isActive(stateObj) ? "active" : ""}`;

    el.dataset.itemId = String(item.id);
    const region = area.region ?? area;
    el.style.position = "absolute";
    el.style.left = `${region.x}%`;
    el.style.top = `${region.y}%`;
    el.style.width = `${region.width}%`;
    el.style.height = `${region.height}%`;

    if (interactive) {
      this._bindItemActions(el, item);
    }

    if (showVisual) {
      const iconWrap = document.createElement("div");

      if (item.visual_type === "image") {
        const imageFit = ["contain", "cover", "fill"].includes(item.image_fit)
          ? item.image_fit
          : "contain";
        iconWrap.className = `icon-wrap image-wrap fit-${imageFit}`;
        if (item.visual_background === false) {
          iconWrap.classList.add("no-visual-background");
        }
        if (item.image_active_background === false) {
          iconWrap.classList.add("no-active-background");
        }

        if (item.image_mode === "integer") {
          // 0.8.28: keep the proven 0.8.27 Stack renderer and change only the
          // integer-image branch. The image source is selected numerically by
          // _resolvedImage() from the live Home Assistant state, then resolved
          // through the same media-source path already used by binary images.
          // This avoids the separate hui-image/state_image lifecycle that could
          // remain on image_default while Etat_Portail had already changed.
          const imageUrl = this._displayImageUrl(this._resolvedImage(item, valueStateObj));
          if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = item.show_name === false ? "" : this._friendlyName(item, stateObj);
            image.loading = "lazy";
            image.style.objectFit = imageFit;
            image.style.objectPosition = "center center";
            image.dataset.lotusIntegerImage = "true";
            image.dataset.lotusEntity = valueEntity || "";
            image.dataset.lotusState = valueStateObj?.state ?? "";
            iconWrap.appendChild(image);
          } else {
            const fallbackIcon = document.createElement("ha-icon");
            fallbackIcon.setAttribute("icon", this._entityIcon(item, stateObj));
            iconWrap.appendChild(fallbackIcon);
          }
        } else {
          const imageUrl = this._displayImageUrl(this._resolvedImage(item, valueStateObj));
          if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = item.show_name === false ? "" : this._friendlyName(item, stateObj);
            image.loading = "lazy";
            image.style.objectFit = imageFit;
            image.style.objectPosition = "center center";
            iconWrap.appendChild(image);
          } else {
            const fallbackIcon = document.createElement("ha-icon");
            fallbackIcon.setAttribute("icon", this._entityIcon(item, stateObj));
            iconWrap.appendChild(fallbackIcon);
          }
        }
      } else {
        iconWrap.className = "icon-wrap";
        if (item.visual_background === false) {
          iconWrap.classList.add("no-visual-background");
        }
        const iconSize = vscIconSize(item.icon_size);
        iconWrap.style.setProperty("--lotus-vs-runtime-icon-size", `${iconSize}cqw`);
        iconWrap.style.setProperty("--lotus-vs-runtime-icon-size-h", `${iconSize}cqh`);
        const resolvedIcon = this._resolvedIcon(item, valueStateObj);
        const iconColor = vscIconCssColor(resolvedIcon.color);
        if (iconColor) {
          iconWrap.style.color = iconColor;
        } else if (["binary", "integer"].includes(item.icon_mode)) {
          // For a dynamic icon using "state" color, bind the color to the
          // source/value entity rather than to the action entity of the cell.
          iconWrap.style.color = this._isActive(valueStateObj)
            ? "var(--state-icon-active-color, var(--primary-color))"
            : "var(--state-icon-color, var(--secondary-text-color))";
        }
        const icon = document.createElement("ha-icon");
        icon.setAttribute("icon", resolvedIcon.icon);
        iconWrap.dataset.lotusIconMode = item.icon_mode ?? "static";
        iconWrap.dataset.lotusIconState = valueStateObj?.state ?? "";
        iconWrap.appendChild(icon);
      }

      el.appendChild(iconWrap);
    }

    if (item.show_name !== false || item.show_state !== false) {
      const text = document.createElement("div");
      text.className = "text";

      if (item.show_name !== false) {
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = this._friendlyName(item, stateObj);
        this._applyTextStyle(name, item, "name", { defaultBold: true });
        text.appendChild(name);
      }

      if (item.show_state !== false) {
        const valueEntity = String(item.value_entity ?? "").trim();
        const valueStateObj = valueEntity
          ? this._hass?.states?.[valueEntity]
          : stateObj;
        const state = document.createElement("div");
        state.className = "state";
        state.textContent = this._stateText(item, valueStateObj);
        this._applyTextStyle(state, item, "value");
        text.appendChild(state);
      }

      el.appendChild(text);
    }

    if (
      item.type === "button" &&
      action !== "none" &&
      !visualOnly &&
      item.show_affordance === true
    ) {
      const affordance = document.createElement("ha-icon");
      affordance.className = "affordance";
      affordance.setAttribute(
        "icon",
        action === "more-info" ? "mdi:chevron-right" : "mdi:gesture-tap-button",
      );
      el.appendChild(affordance);
    }

    return el;
  }


_render() {
  if (!this.shadowRoot || !this._config) return;

  this._stateFingerprint = this._stateDependencyFingerprint(this._hass);
  const config = this._config;
  const density = config.density ?? "normal";
  const showDividers = config.show_dividers !== false;
  const dividerSize = showDividers ? vscDividerSize(config.divider_size) : 0;
  const backgroundMode = ["theme", "color", "transparent"].includes(config.background_mode)
    ? config.background_mode : "theme";
  const customBackground = String(config.background_color || "#ffffff").trim() || "#ffffff";
  const cardBackground = backgroundMode === "transparent"
    ? "transparent"
    : backgroundMode === "color"
      ? customBackground
      : "var(--ha-card-background, var(--card-background-color, white))";
  const cardBorderEnabled = config.card_border_enabled === true;
  const cardBorderStyle = vscCardBorderStyle(config.card_border_style);
  const cardBorderWidth = cardBorderStyle === "double"
    ? Math.max(3, vscCardBorderWidth(config.card_border_width))
    : vscCardBorderWidth(config.card_border_width);
  const cardBorderColor = vscCardBorderColor(config.card_border_color);
  const cardBorderRadius = vscCardBorderRadius(config.card_border_radius);

  this.shadowRoot.replaceChildren();
  const style = document.createElement("style");
  style.textContent = `
    :host {
      display:block;
      min-width:0;
      min-height:0;
      container-type:inline-size;
    }
    ha-card {
      display:flex;
      flex-direction:column;
      width:100%;
      min-width:0;
      min-height:0;
      overflow:hidden;
      background:${cardBackground};
      ${backgroundMode === "transparent" ? "box-shadow:none;" : ""}
      ${cardBorderEnabled ? `border:${cardBorderWidth}px ${cardBorderStyle} ${cardBorderColor};border-radius:${cardBorderRadius}px;` : "border:none;"}
    }
    .title {
      padding:12px 14px 8px;
      color:var(--primary-text-color);
      background:${cardBackground};
    }
    .vsc-stage {
      position:relative;
      width:100%;
      min-width:0;
      aspect-ratio:${config.frame_width} / ${config.frame_height};
      overflow:hidden;
      background:${cardBackground};
    }
    .vsc-item {
      box-sizing:border-box;
      display:flex;
      align-items:center;
      min-width:0;
      min-height:0;
      overflow:hidden;
      gap:min(12px, 2.2cqw, 2.2cqh);
      padding:${density === "compact" ? "min(8px,1.6cqw,1.6cqh)" : density === "large" ? "min(16px,3cqw,3cqh)" : "min(11px,2.2cqw,2.2cqh)"};
      color:var(--primary-text-color);
      background:${cardBackground};
      container-type:size;
      ${showDividers ? `border:${Math.max(0.5, dividerSize)}px solid var(--divider-color, rgba(127,127,127,.22));` : ""}
    }
    .vsc-item.interactive { cursor:pointer; }
    .vsc-item.interactive:hover { background:var(--secondary-background-color); }
    .vsc-item.interactive:focus-visible { outline:2px solid var(--primary-color); outline-offset:-2px; }
    .vsc-item.interactive.no-interaction-feedback {
      -webkit-tap-highlight-color:transparent;
    }
    .vsc-item.interactive.no-interaction-feedback:hover,
    .vsc-item.interactive.no-interaction-feedback:active,
    .vsc-item.interactive.no-interaction-feedback:focus {
      background:${cardBackground};
    }
    .vsc-item.interactive.no-interaction-feedback:focus-visible {
      outline:none;
    }
    .vsc-item.visual-only {
      display:grid;
      place-items:center;
      padding:0;
      gap:0;
    }
    .vsc-item.visual-only.image-only { padding:0; }
    .icon-wrap {
      width:min(
        var(--lotus-vs-runtime-icon-size, 20cqw),
        var(--lotus-vs-runtime-icon-size-h, 20cqh),
        42cqw,
        88cqh
      );
      height:min(
        var(--lotus-vs-runtime-icon-size, 20cqw),
        var(--lotus-vs-runtime-icon-size-h, 20cqh),
        42cqw,
        88cqh
      );
      min-width:0;
      min-height:0;
      max-width:100%;
      max-height:100%;
      flex:0 0 auto;
      display:grid;
      place-items:center;
      overflow:hidden;
      border-radius:50%;
      background:var(--secondary-background-color);
      color:var(--secondary-text-color);
    }
    .vsc-item.visual-only .icon-wrap {
      width:min(
        var(--lotus-vs-runtime-icon-size, 20cqw),
        var(--lotus-vs-runtime-icon-size-h, 20cqh)
      );
      height:min(
        var(--lotus-vs-runtime-icon-size, 20cqw),
        var(--lotus-vs-runtime-icon-size-h, 20cqh)
      );
      min-width:0;
      min-height:0;
      max-width:100%;
      max-height:100%;
    }
    .icon-wrap ha-icon {
      width:72%;
      height:72%;
      --mdc-icon-size:72%;
    }
    .vsc-item.visual-only .icon-wrap ha-icon {
      width:100%;
      height:100%;
      --mdc-icon-size:100%;
    }
    .image-wrap {
      background:transparent;
      border-radius:0;
      width:38%;
      height:88%;
      min-width:0;
      min-height:0;
      max-width:46%;
      max-height:92%;
      flex:0 0 38%;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:hidden;
    }
    .icon-wrap.no-visual-background {
      background:transparent !important;
      border-radius:0;
    }
    .image-wrap img {
      display:block;
      object-position:center center;
      flex:0 0 auto;
    }
    .image-wrap hui-image[data-lotus-integer-image="true"] {
      display:block;
      width:100%;
      height:100%;
      min-width:0;
      min-height:0;
      flex:1 1 100%;
    }
    /* contain must never crop the source image.  Do not stretch the IMG box
       to the wrapper: constrain its intrinsic rectangle instead. */
    .image-wrap.fit-contain img {
      width:auto;
      height:auto;
      max-width:100%;
      max-height:100%;
      object-fit:contain;
    }
    /* cover/fill intentionally own the complete visual rectangle. */
    .image-wrap.fit-cover img,
    .image-wrap.fit-fill img {
      width:100%;
      height:100%;
      max-width:none;
      max-height:none;
    }
    .image-wrap.fit-cover img { object-fit:cover; }
    .image-wrap.fit-fill img { object-fit:fill; }
    .visual-only.image-only .image-wrap {
      width:100%;
      height:100%;
      min-width:0;
      min-height:0;
      max-width:none;
      max-height:none;
      flex:1 1 100%;
      border-radius:0;
    }
    .active .icon-wrap {
      color:var(--state-icon-active-color, var(--primary-color));
      background:color-mix(in srgb, var(--state-icon-active-color, var(--primary-color)) 16%, transparent);
    }
    .active .icon-wrap.no-active-background,
    .active .image-wrap.no-active-background,
    .active .icon-wrap.no-visual-background { background:transparent !important; }
    .text { flex:1 1 auto; min-width:0; }
    .name, .state {
      overflow:hidden;
      text-overflow:clip;
      white-space:nowrap;
      line-height:1.15;
    }
    .name { font-size:min(14px, 18cqh, 8cqw); font-weight:500; }
    .state { margin-top:min(2px,1cqh); color:var(--secondary-text-color); font-size:min(12px, 16cqh, 7cqw); }
    .affordance { flex:0 0 auto; color:var(--secondary-text-color); --mdc-icon-size:min(18px,24cqh,10cqw); }
  `;

  const card = document.createElement("ha-card");
  if (config.title) {
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = config.title;
    this._applyTextStyle(title, config, "title", { defaultBold:true });
    card.appendChild(title);
  }

  const stage = document.createElement("div");
  stage.className = "vsc-stage";
  for (const region of vscRegions(config)) {
    stage.appendChild(this._createItemElement(this._getItem(region.id), { ...region, region }));
  }
  card.appendChild(stage);
  this.shadowRoot.append(style, card);
  this._scheduleResponsiveContent();
}

}


class VisualStackCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = undefined;
    this._passthroughCardConfig = {};
    this._selectedRegionIds = new Set();
    this._selectedItemId = 1;
    this._frameSelected = true;
    this._multiSelect = false;
    this._history = [];
    this._future = [];
    this._message = "";
    this._resizeDraft = null;
    this._frameDragVisual = null;
    this._snapGuide = null;
    this._frameSquareSnap = null;
    this._dimensionOverlay = null;
    this._selectedDividerKey = "";
    this._cellDrag = null;
    this._suppressCellClickUntil = 0;
    this._hostDialogStyle = null;
    this._hostDialogSyncRaf = 0;
    this._inspectorScrollTop = 0;
    this._inspectorScrollSnapshot = null;
    this._inspectorScrollRestoreRaf = 0;
    this._inspectorScrollRestoring = false;
    this._forcedInspectorScrollSnapshot = null;
  }

  connectedCallback() {
    this._scheduleHostDialogSinglePreview();
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      const inspector = this.shadowRoot?.querySelector(".inspector");
      if (!inspector) return;
      const dialog = this._findHostEditDialog();
      const state = dialog?.__lotusStackInspectorScrollState;
      const persisted = Number(state?.scrollTop);
      const fresh = Number.isFinite(Number(state?.at)) && performance.now() - Number(state.at) < 1500;
      if (fresh && Number.isFinite(persisted) && persisted > 0) {
        this._inspectorScrollTop = persisted;
        this._restoreInspectorScroll(inspector, { scrollTop: persisted });
      }
    });
  }

  disconnectedCallback() {
    this._cancelCellDrag();
    this._frameDragVisual = null;
    if (this._hostDialogSyncRaf) {
      cancelAnimationFrame(this._hostDialogSyncRaf);
      this._hostDialogSyncRaf = 0;
    }
    if (this._inspectorScrollRestoreRaf) {
      cancelAnimationFrame(this._inspectorScrollRestoreRaf);
      this._inspectorScrollRestoreRaf = 0;
    }
    this._inspectorScrollRestoring = false;
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
      if (attempts < 12) {
        this._hostDialogSyncRaf = requestAnimationFrame(sync);
      }
    };
    this._hostDialogSyncRaf = requestAnimationFrame(sync);
  }

  _applyHostDialogSinglePreview() {
    const dialog = this._findHostEditDialog();
    const root = dialog?.shadowRoot;
    if (!root) return false;

    let style = root.querySelector('style[data-lotus-stack-single-preview="1"]');
    if (!style) {
      style = document.createElement("style");
      style.dataset.lotusStackSinglePreview = "1";
      style.textContent = `
        /* Lotus owns the preview and the vertical scrolling while its editor is open. */
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
      const dialog = this._findHostEditDialog();
      dialog?.shadowRoot
        ?.querySelector('style[data-lotus-stack-single-preview="1"]')
        ?.remove();
    }
    this._hostDialogStyle = null;
  }

  set hass(hass) {
    lotusSetHass(hass);
    this._hass = hass;
    if (!this._config) return;
    if (!this.shadowRoot?.childElementCount) this._render();
    else this._refreshHassBindings();
  }
  get hass() { return this._hass; }

  set config(config) {
    if (config) this.setConfig(config);
  }
  get config() {
    return this._config
      ? vscMergeNativePassthrough(
          vscInternalToNative(this._config, this._hass),
          this._passthroughCardConfig,
        )
      : undefined;
  }

  setConfig(config) {
    const normalized = vscNormalizeConfig(config);
    const passthrough = vscNativePassthrough(config);
    const current = this._config ? JSON.stringify(vscInternalToNative(this._config, this._hass)) : "";
    const incoming = JSON.stringify(vscInternalToNative(normalized, this._hass));
    this._passthroughCardConfig = passthrough;
    if (current && current === incoming) return;
    this._config = normalized;
    const ids = this._placedIds();
    if (!ids.includes(this._selectedItemId)) this._selectedItemId = ids[0] ?? 1;
    this._selectedRegionIds = new Set(ids.length ? [this._selectedItemId] : []);
    this._frameSelected = false;
    this._history = [];
    this._future = [];
    this._render();
  }

  _rememberInspectorScroll(scrollTop) {
    const value = Math.max(0, Number(scrollTop) || 0);
    this._inspectorScrollTop = value;
    const dialog = this._findHostEditDialog();
    if (dialog) {
      dialog.__lotusStackInspectorScrollState = {
        scrollTop: value,
        at: performance.now(),
      };
    }
  }

  _captureInspectorScroll() {
    const inspector = this.shadowRoot?.querySelector(".inspector");
    if (!inspector) {
      const dialog = this._findHostEditDialog();
      const state = dialog?.__lotusStackInspectorScrollState;
      const persisted = Number(state?.scrollTop);
      const fresh = Number.isFinite(Number(state?.at)) && performance.now() - Number(state.at) < 1500;
      return {
        scrollTop: fresh && Number.isFinite(persisted) ? persisted : this._inspectorScrollTop,
      };
    }

    const scrollTop = inspector.scrollTop;
    this._rememberInspectorScroll(scrollTop);

    const viewport = inspector.getBoundingClientRect();
    const anchors = [...inspector.querySelectorAll("[data-lotus-scroll-anchor]")];
    const visible = anchors
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > viewport.top + 1 && rect.top < viewport.bottom - 1)
      .sort((a, b) => Math.abs(a.rect.top - viewport.top) - Math.abs(b.rect.top - viewport.top));

    const candidate = visible[0];
    if (!candidate) return { scrollTop };

    const key = candidate.element.dataset.lotusScrollAnchor || "";
    const sameKey = anchors.filter((element) => element.dataset.lotusScrollAnchor === key);
    const occurrence = Math.max(0, sameKey.indexOf(candidate.element));
    return {
      scrollTop,
      key,
      occurrence,
      offset: candidate.rect.top - viewport.top,
    };
  }

  _resolveInspectorScrollTarget(inspector, snapshot) {
    if (!inspector || !snapshot) return 0;
    if (snapshot.key) {
      const matches = [...inspector.querySelectorAll("[data-lotus-scroll-anchor]")]
        .filter((element) => element.dataset.lotusScrollAnchor === snapshot.key);
      const anchor = matches[Math.min(snapshot.occurrence || 0, Math.max(0, matches.length - 1))];
      if (anchor) {
        const viewport = inspector.getBoundingClientRect();
        const rect = anchor.getBoundingClientRect();
        return Math.max(0, inspector.scrollTop + rect.top - viewport.top - (Number(snapshot.offset) || 0));
      }
    }
    return Math.max(0, Number(snapshot.scrollTop) || 0);
  }

  _restoreInspectorScroll(inspector, snapshot) {
    if (!inspector || !snapshot) return;
    if (this._inspectorScrollRestoreRaf) {
      cancelAnimationFrame(this._inspectorScrollRestoreRaf);
      this._inspectorScrollRestoreRaf = 0;
    }

    this._inspectorScrollRestoring = true;
    let frame = 0;
    const restore = () => {
      this._inspectorScrollRestoreRaf = 0;
      if (!this.isConnected || inspector !== this.shadowRoot?.querySelector(".inspector")) {
        this._inspectorScrollRestoring = false;
        return;
      }

      const target = this._resolveInspectorScrollTarget(inspector, snapshot);
      inspector.scrollTop = target;
      frame += 1;
      if (frame < 3) {
        this._inspectorScrollRestoreRaf = requestAnimationFrame(restore);
        return;
      }

      this._inspectorScrollRestoring = false;
      this._rememberInspectorScroll(inspector.scrollTop);
    };

    inspector.scrollTop = this._resolveInspectorScrollTarget(inspector, snapshot);
    this._inspectorScrollRestoreRaf = requestAnimationFrame(restore);
  }

  _refreshHassBindings() {
    if (!this.shadowRoot) return;
    for (const field of this.shadowRoot.querySelectorAll("ha-form, ha-selector, ha-entity-picker, ha-icon-picker, ha-service-picker, ha-card-conditions-editor")) {
      field.hass = this._hass;
    }
    const preview = this.shadowRoot.querySelector("lotus-visual-stack.vsc-editor-preview");
    if (preview) preview.hass = this._hass;
  }

  _placedIds(config = this._config) {
    return config ? vscRegions(config).map((region) => region.id) : [];
  }

  _item(itemId) {
    return this._config?.items?.find((item) => Number(item.id) === Number(itemId));
  }

  _ensureItem(config, itemId) {
    let item = config.items.find((candidate) => Number(candidate.id) === Number(itemId));
    if (!item) {
      item = vscDefaultItem(Number(itemId));
      config.items.push(item);
    }
    return item;
  }

  _emit() {
    if (!this._config) return;
    const nativeConfig = vscMergeNativePassthrough(
      vscInternalToNative(this._config, this._hass),
      this._passthroughCardConfig,
    );
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: nativeConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _commit(
    mutator,
    {
      keepSelection = true,
      silentHistory = false,
      preserveInspectorScroll = false,
    } = {},
  ) {
    if (!this._config) return;

    let exactScrollSnapshot = null;
    if (preserveInspectorScroll) {
      const inspector = this.shadowRoot?.querySelector(".inspector");
      const scrollTop = inspector
        ? inspector.scrollTop
        : this._inspectorScrollTop;
      exactScrollSnapshot = {
        scrollTop: Math.max(0, Number(scrollTop) || 0),
      };
      this._forcedInspectorScrollSnapshot = exactScrollSnapshot;
      this._rememberInspectorScroll(exactScrollSnapshot.scrollTop);
    }

    const before = vscClone(this._config);
    const next = vscClone(this._config);
    mutator(next);
    this._config = vscNormalizeConfig(next);
    if (!silentHistory) {
      this._history.push(before);
      if (this._history.length > 80) this._history.shift();
      this._future = [];
    }

    const ids = this._placedIds();
    if (!ids.includes(this._selectedItemId)) {
      this._selectedItemId = ids[0] ?? 1;
    }
    if (keepSelection) {
      this._selectedRegionIds = new Set(
        [...this._selectedRegionIds].filter((id) => ids.includes(id)),
      );
      if (
        !this._selectedRegionIds.size &&
        !this._frameSelected &&
        ids.length
      ) {
        this._selectedRegionIds.add(this._selectedItemId);
      }
    } else {
      this._selectedRegionIds.clear();
    }

    this._emit();

    // Home Assistant peut renvoyer la configuration de façon synchrone.
    // On réarme donc le snapshot exact avant notre propre rendu afin de ne
    // jamais capturer une position temporaire à 0 pendant la restauration.
    if (exactScrollSnapshot) {
      this._forcedInspectorScrollSnapshot = exactScrollSnapshot;
    }
    this._render();
  }

  _undo() {
    if (!this._history.length || !this._config) return;
    this._future.push(vscClone(this._config));
    this._config = vscNormalizeConfig(this._history.pop());
    const ids = this._placedIds();
    this._selectedItemId = ids.includes(this._selectedItemId) ? this._selectedItemId : ids[0] ?? 1;
    this._selectedRegionIds = new Set(ids.length ? [this._selectedItemId] : []);
    this._frameSelected = false;
    this._emit();
    this._render();
  }

  _redo() {
    if (!this._future.length || !this._config) return;
    this._history.push(vscClone(this._config));
    this._config = vscNormalizeConfig(this._future.pop());
    const ids = this._placedIds();
    this._selectedItemId = ids.includes(this._selectedItemId) ? this._selectedItemId : ids[0] ?? 1;
    this._selectedRegionIds = new Set(ids.length ? [this._selectedItemId] : []);
    this._frameSelected = false;
    this._emit();
    this._render();
  }

  _setTopField(field, value) {
    this._commit((config) => { config[field] = value; });
  }

  _setItemField(itemId, field, value) {
    this._commit((config) => {
      this._ensureItem(config, itemId)[field] = value;
    });
  }

  _nextId(config) {
    const ids = [
      ...config.items.map((item) => Number(item.id)),
      ...vscRegions(config).map((region) => Number(region.id)),
    ].filter((id) => Number.isInteger(id) && id > 0);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  _selectFrame() {
    this._selectedDividerKey = "";
    this._frameSelected = true;
    this._selectedRegionIds.clear();
    this._render();
  }

  _selectRegion(event, id) {
    event.stopPropagation();
    this._selectedDividerKey = "";
    if (performance.now() < this._suppressCellClickUntil) {
      event.preventDefault();
      return;
    }
    this._frameSelected = false;
    const additive = this._multiSelect || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!additive) {
      this._selectedRegionIds = new Set([id]);
    } else if (this._selectedRegionIds.has(id)) {
      this._selectedRegionIds.delete(id);
    } else {
      this._selectedRegionIds.add(id);
    }
    if (this._selectedRegionIds.has(id)) this._selectedItemId = id;
    if (!this._selectedRegionIds.size) this._frameSelected = true;
    this._message = "";
    this._render();
  }

  _regionAtClientPoint(clientX, clientY, frameRect, regions) {
    if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) return null;
    const x = ((clientX - frameRect.left) / frameRect.width) * 100;
    const y = ((clientY - frameRect.top) / frameRect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    const match = regions.find((region) =>
      x >= Number(region.x) - VSC_EPSILON &&
      x <= vscRegionRight(region) + VSC_EPSILON &&
      y >= Number(region.y) - VSC_EPSILON &&
      y <= vscRegionBottom(region) + VSC_EPSILON
    );
    return match ? Number(match.id) : null;
  }

  _swapHelpText(message = this._message) {
    const count = this._config ? vscRegions(this._config).length : 0;
    if (message) return message;
    if (count < 2) return "";
    return lotusT("Glissez une cellule sur une autre pour permuter leur contenu.");
  }

  _setCellDragVisual(sourceId, targetId = null, active = true) {
    const overlay = this.shadowRoot?.querySelector(".region-overlay");
    if (!overlay) return;
    overlay.classList.toggle("cell-dragging", Boolean(active));
    for (const hit of overlay.querySelectorAll(".region-hit")) {
      const id = Number(hit.dataset.regionId);
      hit.classList.toggle("drag-source", Boolean(active) && id === Number(sourceId));
      hit.classList.toggle(
        "drag-target",
        Boolean(active) && Number(targetId) > 0 && id === Number(targetId) && id !== Number(sourceId),
      );
      hit.setAttribute("aria-grabbed", Boolean(active) && id === Number(sourceId) ? "true" : "false");
    }
    const feedback = this.shadowRoot?.querySelector(".canvas-feedback");
    if (feedback && active) {
      feedback.textContent = Number(targetId) > 0 && Number(targetId) !== Number(sourceId)
        ? lotusT("Permuter la cellule {source} avec la cellule {target}", { source:sourceId, target:targetId })
        : lotusT("Déplacer la cellule {source} au-dessus de la cellule cible", { source:sourceId });
    }
  }

  _clearCellDragVisual(previousMessage = this._message) {
    const overlay = this.shadowRoot?.querySelector(".region-overlay");
    overlay?.classList.remove("cell-dragging");
    for (const hit of overlay?.querySelectorAll(".region-hit") ?? []) {
      hit.classList.remove("drag-source", "drag-target");
      hit.setAttribute("aria-grabbed", "false");
    }
    const feedback = this.shadowRoot?.querySelector(".canvas-feedback");
    if (feedback) feedback.textContent = lotusT(this._swapHelpText(previousMessage));
  }

  _cancelCellDrag() {
    const drag = this._cellDrag;
    if (!drag) return;
    window.removeEventListener("pointermove", drag.move);
    window.removeEventListener("pointerup", drag.up);
    window.removeEventListener("pointercancel", drag.cancel);
    this._clearCellDragVisual(drag.previousMessage);
    this._cellDrag = null;
  }

  _swapCellContents(sourceId, targetId) {
    sourceId = Number(sourceId);
    targetId = Number(targetId);
    if (!this._config || !sourceId || !targetId || sourceId === targetId) return;

    this._commit((config) => {
      const sourceIndex = config.items.findIndex((item) => Number(item.id) === sourceId);
      const targetIndex = config.items.findIndex((item) => Number(item.id) === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;

      const sourceItem = vscClone(config.items[sourceIndex]);
      const targetItem = vscClone(config.items[targetIndex]);
      config.items[sourceIndex] = { ...targetItem, id: sourceId };
      config.items[targetIndex] = { ...sourceItem, id: targetId };

      if (Number(config.primary_item) === sourceId) config.primary_item = targetId;
      else if (Number(config.primary_item) === targetId) config.primary_item = sourceId;
    }, { keepSelection: false });

    this._selectedItemId = targetId;
    this._selectedRegionIds = new Set([targetId]);
    this._frameSelected = false;
    this._message = lotusT("Cellules {source} et {target} permutées.", { source:sourceId, target:targetId });
    this._render();
  }

  _startCellDrag(event, sourceId) {
    if (!this._config) return;
    if (vscRegions(this._config).length < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || this._multiSelect) return;

    const frame = this.shadowRoot?.querySelector(".card-frame");
    if (!frame) return;
    const frameRect = frame.getBoundingClientRect();
    const regions = vscRegions(this._config).map((region) => vscClone(region));
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const previousMessage = this._message;
    let active = false;
    let targetId = null;

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      this._clearCellDragVisual(previousMessage);
      this._cellDrag = null;
    };

    const move = (ev) => {
      if (ev.pointerId !== pointerId) return;
      const distance = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      if (!active && distance < 6) return;
      if (!active) {
        active = true;
        this._suppressCellClickUntil = performance.now() + 250;
      }
      ev.preventDefault();
      const nextTarget = this._regionAtClientPoint(ev.clientX, ev.clientY, frameRect, regions);
      targetId = nextTarget && Number(nextTarget) !== Number(sourceId) ? Number(nextTarget) : null;
      this._setCellDragVisual(sourceId, targetId, true);
    };

    const up = (ev) => {
      if (ev.pointerId !== pointerId) return;
      if (!active) {
        cleanup();
        return;
      }
      ev.preventDefault();
      this._suppressCellClickUntil = performance.now() + 250;
      const dropTarget = this._regionAtClientPoint(ev.clientX, ev.clientY, frameRect, regions);
      const resolvedTarget = dropTarget && Number(dropTarget) !== Number(sourceId)
        ? Number(dropTarget)
        : targetId;
      cleanup();
      if (resolvedTarget && Number(resolvedTarget) !== Number(sourceId)) {
        this._swapCellContents(sourceId, resolvedTarget);
      } else {
        this._message = previousMessage;
      }
    };

    const cancel = (ev) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    this._cellDrag = { move, up, cancel, previousMessage, sourceId: Number(sourceId) };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up, { passive: false });
    window.addEventListener("pointercancel", cancel);
  }

  _singleSelectedRegion() {
    if (this._selectedRegionIds.size !== 1) return null;
    const id = [...this._selectedRegionIds][0];
    return vscRegions(this._config).find((region) => region.id === id) ?? null;
  }

  _splitSelected(orientation) {
    const region = this._singleSelectedRegion();
    if (!region) return;
    this._commit((config) => {
      const target = config.regions.find((candidate) => candidate.id === region.id);
      if (!target) return;
      const id = this._nextId(config);
      config.items.push(vscDefaultItem(id));
      if (orientation === "vertical") {
        const half = target.width / 2;
        target.width = half;
        config.regions.push(vscRegion(id, target.x + half, target.y, half, target.height));
      } else {
        const half = target.height / 2;
        target.height = half;
        config.regions.push(vscRegion(id, target.x, target.y + half, target.width, half));
      }
      config.regions = vscNormalizeRegions(config.regions);
    });
  }

  _mergeState() {
    if (this._selectedRegionIds.size < 2) {
      return { allowed:false, reason:"Sélectionnez au moins deux cellules." };
    }
    const rect = vscRegionSelectionRect(this._config, this._selectedRegionIds);
    if (!rect) {
      return { allowed:false, reason:"La sélection doit former un rectangle continu." };
    }
    const keepId = Number([...this._selectedRegionIds][0]);
    return { allowed:true, rect, keepId };
  }

  _mergeSelected() {
    const state = this._mergeState();
    if (!state.allowed) {
      this._message = state.reason;
      this._render();
      return;
    }
    const selected = new Set(this._selectedRegionIds);
    const keepId = Number(state.keepId);
    const rect = state.rect;
    this._selectedItemId = keepId;
    this._selectedRegionIds = new Set([keepId]);
    this._message = lotusT("Cellules fusionnées · contenu conservé : cellule {cell}.", { cell:keepId });
    this._commit((config) => {
      // Fusion is deliberately destructive for every selected cell except the first one
      // selected by the user. This keeps the workflow predictable: no blocking dialog and
      // no ambiguity about which content survives.
      config.regions = config.regions.filter((region) => !selected.has(Number(region.id)));
      config.regions.push(vscRegion(keepId, rect.x, rect.y, rect.width, rect.height));
      config.items = config.items.filter((item) => !selected.has(Number(item.id)) || Number(item.id) === keepId);
      if (selected.has(Number(config.primary_item))) config.primary_item = keepId;
    });
  }

  _equalizeState(axis) {
    if (!this._config || this._selectedRegionIds.size < 2) {
      return { allowed:false, reason:"Sélectionnez au moins deux cellules." };
    }

    const selected = vscRegions(this._config)
      .filter((region) => this._selectedRegionIds.has(Number(region.id)));
    if (selected.length < 2) {
      return { allowed:false, reason:"Sélection incomplète." };
    }

    const horizontal = axis === "horizontal";
    const vertical = axis === "vertical";
    if (!horizontal && !vertical) {
      return { allowed:false, reason:"Axe d’harmonisation inconnu." };
    }

    // The selected cells no longer have to have the same height/width. They only
    // need to form a contiguous chain through a real common side. This makes the
    // tool useful on T-junctions and asymmetric layouts.
    const ordered = selected.slice().sort((a, b) => horizontal
      ? (Number(a.x) - Number(b.x)) || (Number(a.y) - Number(b.y))
      : (Number(a.y) - Number(b.y)) || (Number(a.x) - Number(b.x)));

    const pairs = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const negative = ordered[index - 1];
      const positive = ordered[index];
      const touches = horizontal
        ? vscSame(vscRegionRight(negative), positive.x) &&
          vscIntervalOverlap(negative.y, vscRegionBottom(negative), positive.y, vscRegionBottom(positive)) > VSC_EPSILON
        : vscSame(vscRegionBottom(negative), positive.y) &&
          vscIntervalOverlap(negative.x, vscRegionRight(negative), positive.x, vscRegionRight(positive)) > VSC_EPSILON;
      if (!touches) {
        return { allowed:false, reason:"Les cellules sélectionnées ne partagent pas un côté continu dans ce sens." };
      }
      pairs.push({ negativeId:Number(negative.id), positiveId:Number(positive.id) });
    }

    const start = horizontal ? Number(ordered[0].x) : Number(ordered[0].y);
    const end = horizontal
      ? Number(vscRegionRight(ordered[ordered.length - 1]))
      : Number(vscRegionBottom(ordered[ordered.length - 1]));
    const size = (end - start) / ordered.length;
    const currentSizes = ordered.map((region) => horizontal ? Number(region.width) : Number(region.height));
    const needed = currentSizes.some((value) => Math.abs(value - size) > VSC_EPSILON);
    if (!needed) {
      return { allowed:false, reason:"Les cellules sont déjà harmonisées dans ce sens." };
    }

    return { allowed:true, axis, ordered, pairs, start, end, size };
  }

  _dividerForPair(config, axis, negativeId, positiveId) {
    const orientation = axis === "horizontal" ? "vertical" : "horizontal";
    const dividers = vscInternalDividers(config).filter((divider) => divider.orientation === orientation);
    const seed = dividers.find((divider) =>
      divider.negativeIds.has(Number(negativeId)) &&
      divider.positiveIds.has(Number(positiveId))
    );
    if (!seed) return null;

    // For harmonisation, a visually continuous separator is treated as one line,
    // even when a perpendicular separator splits it into several internal
    // components. Moving the selected segment can therefore resize neighbouring
    // unselected cells above/below (or left/right), which preserves a coherent
    // partition in complex layouts.
    const position = Number(seed.position);
    const connected = [seed];
    let start = Number(seed.start);
    let end = Number(seed.end);
    let changed = true;
    while (changed) {
      changed = false;
      for (const divider of dividers) {
        if (connected.includes(divider) || !vscSame(divider.position, position)) continue;
        const touchesSpan = Number(divider.start) <= end + VSC_EPSILON && Number(divider.end) >= start - VSC_EPSILON;
        if (!touchesSpan) continue;
        connected.push(divider);
        start = Math.min(start, Number(divider.start));
        end = Math.max(end, Number(divider.end));
        changed = true;
      }
    }

    return {
      orientation,
      position,
      start:vscRound(start),
      end:vscRound(end),
      negativeIds:new Set(connected.flatMap((divider) => [...divider.negativeIds].map(Number))),
      positiveIds:new Set(connected.flatMap((divider) => [...divider.positiveIds].map(Number))),
    };
  }

  _equalizeDraft(baseConfig, state) {
    const source = vscClone(baseConfig);
    const next = vscClone(baseConfig);
    const sourceById = new Map(vscRegions(source).map((region) => [Number(region.id), region]));
    const boundsById = new Map(vscRegions(source).map((region) => [Number(region.id), {
      left:Number(region.x),
      right:Number(vscRegionRight(region)),
      top:Number(region.y),
      bottom:Number(vscRegionBottom(region)),
    }]));
    const moves = [];

    // Resolve every separator against the SAME source geometry.  Applying them
    // one after another creates transient zero/small cells (for example four
    // stacked cells 12.5/12.5/25/50 while targeting 25/25/25/25), even though
    // the final geometry is perfectly valid.  Harmonisation is therefore one
    // atomic geometry operation: collect all target separator positions first,
    // then rebuild every affected rectangle once.
    for (let index = 0; index < state.pairs.length; index += 1) {
      const pair = state.pairs[index];
      const target = vscRound(state.start + state.size * (index + 1));
      const divider = this._dividerForPair(source, state.axis, pair.negativeId, pair.positiveId);
      if (!divider) return null;
      moves.push({ divider, target });
    }

    for (const { divider, target } of moves) {
      const vertical = divider.orientation === "vertical";
      const sourcePosition = Number(divider.position);

      for (const id of divider.negativeIds) {
        const region = sourceById.get(Number(id));
        const bounds = boundsById.get(Number(id));
        if (!region || !bounds) continue;
        if (vertical) {
          if (vscSame(vscRegionRight(region), sourcePosition)) bounds.right = target;
        } else if (vscSame(vscRegionBottom(region), sourcePosition)) {
          bounds.bottom = target;
        }
      }

      for (const id of divider.positiveIds) {
        const region = sourceById.get(Number(id));
        const bounds = boundsById.get(Number(id));
        if (!region || !bounds) continue;
        if (vertical) {
          if (vscSame(region.x, sourcePosition)) bounds.left = target;
        } else if (vscSame(region.y, sourcePosition)) {
          bounds.top = target;
        }
      }
    }

    const rebuilt = [];
    for (const region of vscRegions(source)) {
      const bounds = boundsById.get(Number(region.id));
      if (!bounds) return null;
      const width = vscRound(bounds.right - bounds.left);
      const height = vscRound(bounds.bottom - bounds.top);
      const minWidth = Math.min(VSC_MIN_REGION_SIZE, Number(region.width));
      const minHeight = Math.min(VSC_MIN_REGION_SIZE, Number(region.height));
      if (
        bounds.left < -VSC_EPSILON || bounds.top < -VSC_EPSILON ||
        bounds.right > 100 + VSC_EPSILON || bounds.bottom > 100 + VSC_EPSILON ||
        width < minWidth - VSC_EPSILON || height < minHeight - VSC_EPSILON
      ) {
        return null;
      }
      rebuilt.push(vscRegion(region.id, bounds.left, bounds.top, width, height));
    }

    next.regions = vscNormalizeRegions(rebuilt);
    return next;
  }

  _equalizeSelected(axis) {
    const state = this._equalizeState(axis);
    if (!state.allowed) return;

    const before = vscClone(this._config);
    const next = this._equalizeDraft(before, state);

    if (!next) {
      this._message = "Harmonisation impossible : la géométrie finale réduirait une cellule sous sa taille minimale.";
      this._render();
      return;
    }

    this._history.push(before);
    if (this._history.length > 80) this._history.shift();
    this._future = [];
    this._config = vscNormalizeConfig(next);
    this._message = axis === "horizontal"
      ? "Largeurs harmonisées. Les séparateurs ont été repositionnés simultanément."
      : "Hauteurs harmonisées. Les séparateurs ont été repositionnés simultanément.";
    this._emit();
    this._render();
  }

  _frameResizeDraft(baseConfig, nextWidth, nextHeight, edge) {
    const oldWidth = Number(baseConfig.frame_width);
    const oldHeight = Number(baseConfig.frame_height);
    const width = vscFrameValue(nextWidth, oldWidth);
    const height = vscFrameValue(nextHeight, oldHeight);
    const resizeRight = edge === "right" || edge === "corner";
    const resizeLeft = edge === "left";
    const resizeBottom = edge === "bottom" || edge === "corner";
    const resizeTop = edge === "top";
    const widthChanged = !vscSame(width, oldWidth);
    const heightChanged = !vscSame(height, oldHeight);
    const widthScale = oldWidth / Math.max(.01, width);
    const heightScale = oldHeight / Math.max(.01, height);
    const baseRegions = new Map(vscRegions(baseConfig).map((region) => [Number(region.id), region]));
    const regions = vscRegions(baseConfig).map((source) => {
      const region = vscClone(source);
      const oldRight = vscRegionRight(source);
      const oldBottom = vscRegionBottom(source);

      if (widthChanged && (resizeRight || resizeLeft)) {
        if (resizeRight) {
          const nextX = Number(source.x) * widthScale;
          const nextRight = vscSame(oldRight, 100) ? 100 : oldRight * widthScale;
          region.x = vscRound(nextX);
          region.width = vscRound(nextRight - nextX);
        } else {
          const nextRight = 100 - (100 - oldRight) * widthScale;
          const nextX = vscSame(source.x, 0)
            ? 0
            : 100 - (100 - Number(source.x)) * widthScale;
          region.x = vscRound(nextX);
          region.width = vscRound(nextRight - nextX);
        }
      }

      if (heightChanged && (resizeBottom || resizeTop)) {
        if (resizeBottom) {
          const nextY = Number(source.y) * heightScale;
          const nextBottom = vscSame(oldBottom, 100) ? 100 : oldBottom * heightScale;
          region.y = vscRound(nextY);
          region.height = vscRound(nextBottom - nextY);
        } else {
          const nextBottom = 100 - (100 - oldBottom) * heightScale;
          const nextY = vscSame(source.y, 0)
            ? 0
            : 100 - (100 - Number(source.y)) * heightScale;
          region.y = vscRound(nextY);
          region.height = vscRound(nextBottom - nextY);
        }
      }

      return region;
    });

    const valid = regions.every((region) => {
      const base = baseRegions.get(Number(region.id));
      if (!base) return false;
      const right = vscRegionRight(region);
      const bottom = vscRegionBottom(region);
      if (region.x < -VSC_EPSILON || region.y < -VSC_EPSILON || right > 100 + VSC_EPSILON || bottom > 100 + VSC_EPSILON) return false;
      if (region.width <= VSC_EPSILON || region.height <= VSC_EPSILON) return false;

      if (widthChanged) {
        const touchesEdge = resizeRight ? vscSame(vscRegionRight(base), 100) : resizeLeft ? vscSame(base.x, 0) : false;
        if (touchesEdge) {
          const oldAbsolute = Number(base.width) * oldWidth / 100;
          const newAbsolute = Number(region.width) * width / 100;
          const minimum = Math.min(oldAbsolute, oldWidth * VSC_MIN_REGION_SIZE / 100);
          if (newAbsolute < minimum - VSC_EPSILON) return false;
        }
      }

      if (heightChanged) {
        const touchesEdge = resizeBottom ? vscSame(vscRegionBottom(base), 100) : resizeTop ? vscSame(base.y, 0) : false;
        if (touchesEdge) {
          const oldAbsolute = Number(base.height) * oldHeight / 100;
          const newAbsolute = Number(region.height) * height / 100;
          const minimum = Math.min(oldAbsolute, oldHeight * VSC_MIN_REGION_SIZE / 100);
          if (newAbsolute < minimum - VSC_EPSILON) return false;
        }
      }
      return true;
    });

    if (!valid) return null;
    const next = vscClone(baseConfig);
    next.frame_width = width;
    next.frame_height = height;
    next.regions = regions;
    return vscNormalizeConfig(next);
  }


  _frameSquareSnapTargets(config, edge) {
    if (!config || !["left", "right", "top", "bottom"].includes(edge)) return [];
    const width = Number(config.frame_width);
    const height = Number(config.frame_height);
    const horizontalResize = edge === "left" || edge === "right";
    const targets = [];

    const addTarget = (value, { frame = false, regionId = null } = {}) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 10 - VSC_EPSILON || numeric > 200 + VSC_EPSILON) return;
      let target = targets.find((candidate) => Math.abs(Number(candidate.value) - numeric) <= .01);
      if (!target) {
        target = { value:vscRound(numeric, 2), frame:false, regionIds:[] };
        targets.push(target);
      }
      if (frame) target.frame = true;
      if (regionId != null && !target.regionIds.includes(Number(regionId))) target.regionIds.push(Number(regionId));
    };

    // Square outer frame. Because frame_width/frame_height define the reference
    // aspect ratio, equal values are a true physical square in the preview.
    addTarget(horizontalResize ? height : width, { frame:true });

    for (const region of vscRegions(config)) {
      const touches = edge === "right"
        ? vscSame(vscRegionRight(region), 100)
        : edge === "left"
          ? vscSame(region.x, 0)
          : edge === "bottom"
            ? vscSame(vscRegionBottom(region), 100)
            : vscSame(region.y, 0);
      if (!touches) continue;

      if (horizontalResize) {
        const cellHeight = Number(region.height) * height / 100;
        if (edge === "right") {
          const fixedLeft = Number(region.x) * width / 100;
          addTarget(fixedLeft + cellHeight, { regionId:region.id });
        } else {
          const fixedRightGap = width - Number(vscRegionRight(region)) * width / 100;
          addTarget(fixedRightGap + cellHeight, { regionId:region.id });
        }
      } else {
        const cellWidth = Number(region.width) * width / 100;
        if (edge === "bottom") {
          const fixedTop = Number(region.y) * height / 100;
          addTarget(fixedTop + cellWidth, { regionId:region.id });
        } else {
          const fixedBottomGap = height - Number(vscRegionBottom(region)) * height / 100;
          addTarget(fixedBottomGap + cellWidth, { regionId:region.id });
        }
      }
    }

    return targets;
  }


  _startFrameResize(event, edge = "corner") {
    event.preventDefault();
    event.stopPropagation();
    if (!this._config) return;
    const frame = this.shadowRoot.querySelector(".card-frame");
    const stage = this.shadowRoot.querySelector(".design-stage");
    if (!frame || !stage) return;

    const rect = frame.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const before = vscClone(this._config);
    const start = {
      x:event.clientX,
      y:event.clientY,
      width:Number(before.frame_width),
      height:Number(before.frame_height),
      rectWidth:Math.max(1,rect.width),
      rectHeight:Math.max(1,rect.height),
      left:rect.left - stageRect.left,
      top:rect.top - stageRect.top,
    };
    let draftWidth = start.width;
    let draftHeight = start.height;
    let draftConfig = vscClone(before);
    const previousMessage = this._message;
    const squareTargets = this._frameSquareSnapTargets(before, edge);
    const dimensionOrientation = edge === "left" || edge === "right"
      ? "vertical"
      : edge === "top" || edge === "bottom"
        ? "horizontal"
        : "both";

    const updateDragVisual = (width, height) => {
      const widthPx = start.rectWidth * (Number(width) / Math.max(.01, start.width));
      const heightPx = start.rectHeight * (Number(height) / Math.max(.01, start.height));
      let left = start.left;
      let top = start.top;
      if (edge === "left") left = start.left + start.rectWidth - widthPx;
      if (edge === "top") top = start.top + start.rectHeight - heightPx;
      this._frameDragVisual = {
        edge,
        left,
        top,
        width:widthPx,
        height:heightPx,
      };
    };

    updateDragVisual(start.width, start.height);
    this._dimensionOverlay = {
      type:"frame",
      edge,
      orientation:dimensionOrientation,
      widthScale:100,
      heightScale:100,
    };
    this._render();

    const move = (ev) => {
      const dx = (ev.clientX - start.x) / start.rectWidth;
      const dy = (ev.clientY - start.y) / start.rectHeight;
      let candidateWidth = start.width;
      let candidateHeight = start.height;

      if (edge === "corner" || edge === "right") {
        candidateWidth = vscFrameValue(start.width * Math.max(.15, 1 + dx), start.width);
      } else if (edge === "left") {
        candidateWidth = vscFrameValue(start.width * Math.max(.15, 1 - dx), start.width);
      }

      if (edge === "corner" || edge === "bottom") {
        candidateHeight = vscFrameValue(start.height * Math.max(.15, 1 + dy), start.height);
      } else if (edge === "top") {
        candidateHeight = vscFrameValue(start.height * Math.max(.15, 1 - dy), start.height);
      }

      let snapped = null;
      if (!ev.altKey && squareTargets.length) {
        const horizontalResize = edge === "left" || edge === "right";
        const rawValue = horizontalResize ? candidateWidth : candidateHeight;
        const pixelsPerUnit = horizontalResize
          ? start.rectWidth / Math.max(.01, start.width)
          : start.rectHeight / Math.max(.01, start.height);
        let nearestDistancePx = Infinity;
        for (const target of squareTargets) {
          const distancePx = Math.abs(Number(target.value) - Number(rawValue)) * pixelsPerUnit;
          if (distancePx < nearestDistancePx) {
            nearestDistancePx = distancePx;
            snapped = target;
          }
        }
        if (nearestDistancePx <= 12) {
          if (horizontalResize) candidateWidth = Number(snapped.value);
          else candidateHeight = Number(snapped.value);
        } else {
          snapped = null;
        }
      }

      let candidateConfig = this._frameResizeDraft(before, candidateWidth, candidateHeight, edge);
      // A magnetic target can be impossible when another edge cell reaches its
      // minimum size. In that case, keep the free resize rather than blocking.
      if (!candidateConfig && snapped) {
        snapped = null;
        candidateWidth = edge === "corner" || edge === "right"
          ? vscFrameValue(start.width * Math.max(.15, 1 + dx), start.width)
          : edge === "left"
            ? vscFrameValue(start.width * Math.max(.15, 1 - dx), start.width)
            : start.width;
        candidateHeight = edge === "corner" || edge === "bottom"
          ? vscFrameValue(start.height * Math.max(.15, 1 + dy), start.height)
          : edge === "top"
            ? vscFrameValue(start.height * Math.max(.15, 1 - dy), start.height)
            : start.height;
        candidateConfig = this._frameResizeDraft(before, candidateWidth, candidateHeight, edge);
      }
      if (!candidateConfig) return;

      this._frameSquareSnap = snapped
        ? { edge, frame:Boolean(snapped.frame), regionIds:[...(snapped.regionIds || [])], value:Number(snapped.value) }
        : null;
      if (snapped) {
        const labels = [];
        if (snapped.frame) labels.push(lotusT("carte"));
        if (snapped.regionIds?.length) labels.push(...snapped.regionIds.map((id) => `${lotusT("cellule")} ${id}`));
        this._message = lotusT("Carré magnétique · {targets}", { targets:labels.join(" + ") });
      } else {
        this._message = previousMessage;
      }

      draftWidth = Number(candidateConfig.frame_width);
      draftHeight = Number(candidateConfig.frame_height);
      draftConfig = candidateConfig;
      this._config = vscClone(candidateConfig);
      updateDragVisual(draftWidth, draftHeight);
      this._dimensionOverlay = {
        type:"frame",
        edge,
        orientation:dimensionOrientation,
        widthScale:vscRound((draftWidth / start.width) * 100, 1),
        heightScale:vscRound((draftHeight / start.height) * 100, 1),
      };
      this._render();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      this._dimensionOverlay = null;
      this._frameDragVisual = null;
      this._frameSquareSnap = null;
      this._message = previousMessage;
    };

    const up = () => {
      cleanup();
      if (vscSame(draftWidth,start.width) && vscSame(draftHeight,start.height)) {
        this._config = before;
        this._render();
        return;
      }
      this._history.push(before);
      if (this._history.length > 80) this._history.shift();
      this._future = [];
      this._config = vscNormalizeConfig(draftConfig);
      this._emit();
      // The preview is only re-fitted/centred after release. During the gesture
      // the opposite edge and the untouched axis remain visually fixed.
      this._render();
    };

    const cancel = () => {
      cleanup();
      this._config = before;
      this._render();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  _dividerSnapTargets(config, divider) {
    const isVertical = divider.orientation === "vertical";
    const current = Number(divider.position);
    const targets = new Set();
    for (const region of vscRegions(config)) {
      const a = isVertical ? Number(region.x) : Number(region.y);
      const b = a + (isVertical ? Number(region.width) : Number(region.height));
      for (const value of [a, b]) {
        const rounded = vscRound(value);
        if (rounded <= VSC_EPSILON || rounded >= 100 - VSC_EPSILON) continue;
        if (Math.abs(rounded - current) <= VSC_EPSILON * 4) continue;
        targets.add(rounded);
      }
    }
    return [...targets].sort((a, b) => a - b);
  }

  _dividerSquareSnapTargets(config, divider, frameRect) {
    if (!frameRect?.width || !frameRect?.height) return [];
    const isVertical = divider.orientation === "vertical";
    const regions = new Map(vscRegions(config).map((region) => [Number(region.id), region]));
    const targets = [];

    const addTarget = (position, regionId) => {
      if (!Number.isFinite(position)) return;
      const rounded = vscRound(position);
      if (rounded <= VSC_EPSILON || rounded >= 100 - VSC_EPSILON) return;
      const existing = targets.find((target) => Math.abs(target.position - rounded) <= .02);
      if (existing) {
        if (!existing.regionIds.includes(regionId)) existing.regionIds.push(regionId);
        return;
      }
      targets.push({ position:rounded, regionIds:[regionId] });
    };

    for (const id of divider.negativeIds || []) {
      const region = regions.get(Number(id));
      if (!region) continue;
      if (isVertical) {
        const squareWidthPct = Number(region.height) * frameRect.height / frameRect.width;
        addTarget(Number(region.x) + squareWidthPct, Number(region.id));
      } else {
        const squareHeightPct = Number(region.width) * frameRect.width / frameRect.height;
        addTarget(Number(region.y) + squareHeightPct, Number(region.id));
      }
    }

    for (const id of divider.positiveIds || []) {
      const region = regions.get(Number(id));
      if (!region) continue;
      if (isVertical) {
        const squareWidthPct = Number(region.height) * frameRect.height / frameRect.width;
        addTarget(Number(region.x) + Number(region.width) - squareWidthPct, Number(region.id));
      } else {
        const squareHeightPct = Number(region.width) * frameRect.width / frameRect.height;
        addTarget(Number(region.y) + Number(region.height) - squareHeightPct, Number(region.id));
      }
    }

    return targets.sort((a, b) => a.position - b.position);
  }


  _dividerKey(divider) {
    if (!divider) return "";
    const ids = (set) => [...(set || [])].map(Number).sort((a, b) => a - b).join(",");
    return `${divider.orientation}|${ids(divider.negativeIds)}|${ids(divider.positiveIds)}`;
  }

  _selectedDivider() {
    if (!this._selectedDividerKey || !this._config) return null;
    return vscInternalDividers(this._config).find(
      (divider) => this._dividerKey(divider) === this._selectedDividerKey,
    ) ?? null;
  }

  _selectDivider(divider) {
    if (!divider) return;
    this._selectedDividerKey = this._dividerKey(divider);
    this._dimensionOverlay = null;
    this._snapGuide = null;
    const message = divider.orientation === "vertical"
      ? "Séparation verticale sélectionnée · {value} %."
      : "Séparation horizontale sélectionnée · {value} %.";
    this._message = lotusT(message, { value:vscRound(divider.position, 1) });
    this._render();
  }

  _dividerResizeContext(baseConfig, divider) {
    if (!baseConfig || !divider) return null;
    const baseRegions = new Map(vscRegions(baseConfig).map((region) => [Number(region.id), vscClone(region)]));
    const negativeIds = [...(divider.negativeIds || [])].map(Number);
    const positiveIds = [...(divider.positiveIds || [])].map(Number);
    if (!negativeIds.length || !positiveIds.length) return null;
    const negativeRegions = negativeIds.map((id) => baseRegions.get(id)).filter(Boolean);
    const positiveRegions = positiveIds.map((id) => baseRegions.get(id)).filter(Boolean);
    if (!negativeRegions.length || !positiveRegions.length) return null;
    const isVertical = divider.orientation === "vertical";
    const negativeSizes = negativeRegions.map((region) => isVertical ? region.width : region.height);
    const positiveSizes = positiveRegions.map((region) => isVertical ? region.width : region.height);
    const minDelta = Math.max(...negativeSizes.map((size) => Math.min(VSC_MIN_REGION_SIZE, size) - size));
    const maxDelta = Math.min(...positiveSizes.map((size) => size - Math.min(VSC_MIN_REGION_SIZE, size)));
    return {
      before:vscClone(baseConfig),
      divider,
      baseRegions,
      negativeIds,
      positiveIds,
      negativeRegions,
      positiveRegions,
      isVertical,
      minDelta,
      maxDelta,
    };
  }

  _dividerResizeDraft(context, delta) {
    if (!context) return null;
    const { before, baseRegions, negativeIds, positiveIds, isVertical, minDelta, maxDelta } = context;
    const safeDelta = vscRound(vscClamp(delta, minDelta, maxDelta));
    const next = vscClone(before);
    const byId = new Map(next.regions.map((region) => [Number(region.id), region]));
    if (isVertical) {
      for (const id of negativeIds) {
        const region = byId.get(id);
        const base = baseRegions.get(id);
        if (!region || !base) continue;
        region.width = vscRound(base.width + safeDelta);
      }
      for (const id of positiveIds) {
        const region = byId.get(id);
        const base = baseRegions.get(id);
        if (!region || !base) continue;
        region.x = vscRound(base.x + safeDelta);
        region.width = vscRound(base.width - safeDelta);
      }
    } else {
      for (const id of negativeIds) {
        const region = byId.get(id);
        const base = baseRegions.get(id);
        if (!region || !base) continue;
        region.height = vscRound(base.height + safeDelta);
      }
      for (const id of positiveIds) {
        const region = byId.get(id);
        const base = baseRegions.get(id);
        if (!region || !base) continue;
        region.y = vscRound(base.y + safeDelta);
        region.height = vscRound(base.height - safeDelta);
      }
    }
    return vscNormalizeConfig(next);
  }

  _setDividerCellSize(divider, regionId, side, requestedSize) {
    if (!this._config || !divider) return;
    const desired = Number(String(requestedSize ?? "").replace(",", "."));
    if (!Number.isFinite(desired)) return;
    const before = vscClone(this._config);
    const context = this._dividerResizeContext(before, divider);
    if (!context) return;
    const region = context.baseRegions.get(Number(regionId));
    if (!region) return;

    let targetPosition;
    if (divider.orientation === "vertical") {
      targetPosition = side === "negative"
        ? Number(region.x) + desired
        : vscRegionRight(region) - desired;
    } else {
      targetPosition = side === "negative"
        ? Number(region.y) + desired
        : vscRegionBottom(region) - desired;
    }

    const delta = vscClamp(
      Number(targetPosition) - Number(divider.position),
      context.minDelta,
      context.maxDelta,
    );
    if (Math.abs(delta) <= VSC_EPSILON) {
      this._render();
      return;
    }

    this._history.push(before);
    if (this._history.length > 80) this._history.shift();
    this._future = [];
    this._config = this._dividerResizeDraft(context, delta);
    const updated = vscInternalDividers(this._config).find(
      (candidate) => this._dividerKey(candidate) === this._dividerKey(divider),
    );
    this._selectedDividerKey = updated ? this._dividerKey(updated) : "";
    if (updated) {
      this._message = lotusT("Séparation réglée précisément à {value} %.", { value:vscRound(updated.position, 1) });
    }
    this._emit();
    this._render();
  }

  _renderSelectedDividerEditors(overlay) {
    const divider = this._selectedDivider();
    if (!divider || !overlay || !this._config) return;
    const byId = new Map(vscRegions(this._config).map((region) => [Number(region.id), region]));
    const isVertical = divider.orientation === "vertical";
    const entries = [
      ...[...divider.negativeIds].map((id) => ({ id:Number(id), side:"negative" })),
      ...[...divider.positiveIds].map((id) => ({ id:Number(id), side:"positive" })),
    ];

    for (const entry of entries) {
      const region = byId.get(entry.id);
      if (!region) continue;
      const editor = document.createElement("label");
      editor.className = "divider-value-editor";
      editor.style.left = `${Number(region.x) + Number(region.width) / 2}%`;
      editor.style.top = `${Number(region.y) + Number(region.height) / 2}%`;
      const sideLabel = isVertical
        ? (entry.side === "negative" ? "Droite" : "Gauche")
        : (entry.side === "negative" ? "Bas" : "Haut");
      const value = isVertical ? Number(region.width) : Number(region.height);
      const caption = document.createElement("span");
      caption.textContent = lotusT(sideLabel);
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(VSC_MIN_REGION_SIZE);
      input.max = "100";
      input.step = "0.1";
      input.value = String(vscRound(value, 1));
      const accessibleLabel = `${lotusT(sideLabel)} · ${lotusT("Cellule")} ${entry.id} · %`;
      input.setAttribute("aria-label", accessibleLabel);
      input.title = accessibleLabel;
      const suffix = document.createElement("strong");
      suffix.textContent = "%";
      const stop = (event) => event.stopPropagation();
      editor.addEventListener("pointerdown", stop);
      editor.addEventListener("click", stop);
      input.addEventListener("focus", () => input.select());
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") {
          input.value = String(vscRound(value, 1));
          input.blur();
        }
      });
      input.addEventListener("change", () => {
        this._setDividerCellSize(divider, entry.id, entry.side, input.value);
      });
      editor.append(caption, input, suffix);
      overlay.appendChild(editor);
    }
  }


  _startDividerResize(event, divider) {
    event.preventDefault();
    event.stopPropagation();
    if (!this._config || !divider) return;

    const frame = this.shadowRoot.querySelector(".card-frame");
    if (!frame) return;
    const frameRect = frame.getBoundingClientRect();
    const before = vscClone(this._config);
    const context = this._dividerResizeContext(before, divider);
    if (!context) return;
    const { baseRegions, negativeIds, positiveIds, isVertical, minDelta, maxDelta } = context;
    const startClient = isVertical ? event.clientX : event.clientY;
    const pixels = Math.max(1, isVertical ? frameRect.width : frameRect.height);
    let draftDelta = 0;
    let pointerMoved = false;
    const snapTargets = this._dividerSnapTargets(before, divider);
    const squareSnapTargets = this._dividerSquareSnapTargets(before, divider, frameRect);
    const snapThreshold = Math.min(2.25, Math.max(.35, (10 / pixels) * 100));
    const previousMessage = this._message;
    this._dimensionOverlay = {
      type:"divider",
      orientation:divider.orientation,
      regionIds:[...new Set([...negativeIds, ...positiveIds])],
    };
    this._render();

    const buildDraft = (delta) => this._dividerResizeDraft(context, delta);

    const move = (ev) => {
      const client = isVertical ? ev.clientX : ev.clientY;
      if (Math.abs(client - startClient) >= 4) pointerMoved = true;
      const rawDelta = ((client - startClient) / pixels) * 100;
      let nextDelta = vscClamp(rawDelta, minDelta, maxDelta);
      let snapped = null;

      if (!ev.altKey) {
        const rawPosition = Number(divider.position) + nextDelta;
        const candidates = [
          ...squareSnapTargets.map((target) => ({
            position:target.position,
            kind:"square",
            regionIds:target.regionIds,
          })),
          ...snapTargets.map((position) => ({ position, kind:"line", regionIds:[] })),
        ];
        let nearestDistance = Infinity;
        for (const candidate of candidates) {
          const targetDelta = candidate.position - Number(divider.position);
          if (targetDelta < minDelta - VSC_EPSILON || targetDelta > maxDelta + VSC_EPSILON) continue;
          const distance = Math.abs(candidate.position - rawPosition);
          if (
            distance < nearestDistance - .001 ||
            (Math.abs(distance - nearestDistance) <= .001 && candidate.kind === "square" && snapped?.kind !== "square")
          ) {
            snapped = candidate;
            nearestDistance = distance;
          }
        }
        if (snapped && nearestDistance <= snapThreshold) {
          nextDelta = snapped.position - Number(divider.position);
        } else {
          snapped = null;
        }
      }

      draftDelta = vscRound(vscClamp(nextDelta, minDelta, maxDelta));
      this._snapGuide = snapped
        ? {
            orientation:divider.orientation,
            position:vscRound(snapped.position),
            kind:snapped.kind,
            regionIds:[...(snapped.regionIds || [])],
          }
        : null;
      if (!snapped) {
        this._message = previousMessage;
      } else if (snapped.kind === "square") {
        const cells = (snapped.regionIds || []).map((id) => `${lotusT("Cellule")} ${id}`).join(" + ");
        this._message = lotusT("Carré magnétique · {targets} · {value} %", {
          targets:cells || lotusT("cellule"),
          value:vscRound(snapped.position, 1),
        });
      } else {
        this._message = lotusT("Alignement magnétique · {value} %", { value:vscRound(snapped.position, 1) });
      }
      this._config = buildDraft(draftDelta);
      this._dimensionOverlay = {
        type:"divider",
        orientation:divider.orientation,
        regionIds:[...new Set([...negativeIds, ...positiveIds])],
      };
      this._render();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      this._snapGuide = null;
      this._dimensionOverlay = null;
      this._message = previousMessage;
    };

    const up = () => {
      cleanup();
      if (!pointerMoved) {
        this._config = before;
        this._selectDivider(divider);
        return;
      }
      if (Math.abs(draftDelta) <= VSC_EPSILON) {
        this._config = before;
        this._render();
        return;
      }
      this._history.push(before);
      if (this._history.length > 80) this._history.shift();
      this._future = [];
      this._config = buildDraft(draftDelta);
      const updated = vscInternalDividers(this._config).find(
        (candidate) => this._dividerKey(candidate) === this._dividerKey(divider),
      );
      this._selectedDividerKey = updated ? this._dividerKey(updated) : "";
      this._emit();
      this._render();
    };

    const cancel = () => {
      cleanup();
      this._config = before;
      this._render();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  _renderEntityPicker(container, item) {
    const label = item.type === "button" ? "Entité à commander" : "Entité source";

    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.hass = this._hass;
      form.data = { entity: item.entity ?? "" };
      form.schema = [
        {
          name: "entity",
          required: false,
          selector: { entity: {} },
        },
      ];
      form.computeLabel = () => lotusT(label);
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.entity ?? "";
        if (value !== item.entity) this._setItemField(item.id, "entity", value);
      });
      container.appendChild(form);
      return;
    }

    if (customElements.get("ha-entity-picker")) {
      const picker = document.createElement("ha-entity-picker");
      picker.hass = this._hass;
      picker.value = item.entity ?? "";
      picker.allowCustomEntity = false;
      picker.showEntityId = true;
      picker.label = lotusT(label);
      picker.addEventListener("value-changed", (event) => {
        const value = event.detail?.value ?? "";
        if (value !== item.entity) this._setItemField(item.id, "entity", value);
      });
      container.appendChild(picker);
      return;
    }

    container.appendChild(
      this._input(
        label,
        item.entity ?? "",
        (value) => this._setItemField(item.id, "entity", value),
      ),
    );
  }

  _renderValueEntityPicker(container, item) {
    const label = "Entité de la valeur (facultatif)";
    const current = String(item.value_entity ?? "").trim();

    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.hass = this._hass;
      form.data = { entity: current || undefined };
      form.schema = [
        {
          name: "entity",
          required: false,
          selector: { entity: {} },
        },
      ];
      form.computeLabel = () => lotusT(label);
      form.computeHelper = () =>
        lotusT("Laisser vide pour utiliser l’entité principale. Permet par exemple de piloter un ventilateur tout en affichant la température d’un autre capteur.");
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.entity ?? "";
        if (value !== current) {
          this._commit(
            (config) => {
              const target = this._ensureItem(config, item.id);
              target.value_entity = value;
              target.attribute = "";
            },
            { keepSelection: true },
          );
        }
      });
      container.appendChild(form);
      return;
    }

    container.appendChild(
      this._input(
        label,
        current,
        (value) => {
          this._commit(
            (config) => {
              const target = this._ensureItem(config, item.id);
              target.value_entity = value;
              target.attribute = "";
            },
            { keepSelection: true },
          );
        },
        "sensor.temperature_piece",
      ),
    );
  }

  _renderIconPicker(container, item) {
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field";
      form.hass = this._hass;
      form.data = { icon: item.icon || undefined };
      form.schema = [{ name: "icon", required: false, selector: { icon: {} } }];
      form.computeLabel = () => lotusT("Icône personnalisée");
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.icon ?? "";
        if (value !== item.icon) this._setItemField(item.id, "icon", value);
      });
      container.appendChild(form);
      return;
    }

    if (customElements.get("ha-icon-picker")) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = item.icon ?? "";
      picker.label = lotusT("Icône personnalisée");
      picker.addEventListener("value-changed", (event) => this._setItemField(item.id, "icon", event.detail?.value ?? ""));
      container.appendChild(picker);
      return;
    }
    container.appendChild(this._input("Icône personnalisée", item.icon ?? "", (value) => this._setItemField(item.id, "icon", value), "mdi:lightbulb"));
  }

  _renderIconValuePicker(container, labelText, value, onChange) {
    const current = String(value ?? "");
    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field";
      form.hass = this._hass;
      form.data = { icon: current || undefined };
      form.schema = [{ name: "icon", required: false, selector: { icon: {} } }];
      form.computeLabel = () => lotusT(labelText);
      form.addEventListener("value-changed", (event) => {
        const next = event.detail?.value?.icon ?? "";
        if (next !== current) onChange(next);
      });
      container.appendChild(form);
      return;
    }
    if (customElements.get("ha-icon-picker")) {
      const picker = document.createElement("ha-icon-picker");
      picker.hass = this._hass;
      picker.value = current;
      picker.label = lotusT(labelText);
      picker.addEventListener("value-changed", (event) => onChange(event.detail?.value ?? ""));
      container.appendChild(picker);
      return;
    }
    container.appendChild(this._input(labelText, current, onChange, "mdi:lightbulb"));
  }

  _renderIconColorField(container, labelText, value, onChange) {
    const current = String(value ?? "state").trim() || "state";
    const field = this._haFormField(
      `dynamic_icon_color_${Math.random().toString(36).slice(2)}`,
      current,
      { ui_color: { include_none: true, include_state: true, default_color: "state" } },
      labelText,
      (next) => onChange(String(next ?? "state").trim() || "state"),
    );
    if (field) {
      container.appendChild(field);
      return;
    }
    container.appendChild(this._input(labelText, current === "state" ? "" : current, (next) => onChange(next || "state"), "state"));
  }

  _inputWithDatalist(labelText, value, values, onChange, placeholder = "") {
    const label = document.createElement("label"); label.className = "field";
    const span = document.createElement("span"); span.textContent = lotusT(labelText);
    const input = document.createElement("input"); input.type = "text"; input.value = value ?? ""; input.placeholder = placeholder;
    const list = document.createElement("datalist");
    const listId = `vsc-list-${Math.random().toString(36).slice(2)}-${Date.now()}`; list.id = listId; input.setAttribute("list", listId);
    for (const optionValue of [...new Set(values)].filter(Boolean)) { const option = document.createElement("option"); option.value = String(optionValue); list.appendChild(option); }
    input.addEventListener("change", () => onChange(input.value));
    label.append(span, input, list); return label;
  }

  _renderAttributePicker(container, item, sourceEntity = String(item.value_entity ?? "").trim() || item.entity) {
    if (customElements.get("ha-form") && sourceEntity) {
      const form = document.createElement("ha-form");
      form.className = "native-field";
      form.hass = this._hass;
      form.data = { attribute: item.attribute || undefined };
      form.schema = [
        {
          name: "attribute",
          required: false,
          selector: { attribute: { entity_id: sourceEntity } },
        },
      ];
      form.computeLabel = () => lotusT("Attribut");
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.attribute ?? "";
        if (value !== item.attribute) this._setItemField(item.id, "attribute", value);
      });
      container.appendChild(form);
      return;
    }

    const stateObj = sourceEntity ? this._hass?.states?.[sourceEntity] : undefined;
    const attributes = stateObj
      ? Object.keys(stateObj.attributes ?? {}).sort((a, b) => a.localeCompare(b))
      : [];
    container.appendChild(
      this._inputWithDatalist(
        "Attribut",
        item.attribute ?? "",
        attributes,
        (value) => this._setItemField(item.id, "attribute", value),
        "Ex. current_temperature",
      ),
    );
  }


  _renderImagePicker(container, labelText, value, onChange) {
    const current = String(value ?? "").trim();

    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "lotus-image-picker";
      form.hass = this._hass;
      form.data = {
        image: current
          ? {
              media_content_id: current,
              media_content_type: "image/*",
            }
          : undefined,
      };
      form.schema = [
        {
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
        },
      ];
      form.computeLabel = () => lotusT(labelText);
      form.addEventListener("value-changed", (event) => {
        const picked = event.detail?.value?.image;
        const next = typeof picked === "string"
          ? picked
          : String(picked?.media_content_id ?? "");
        if (next !== current) onChange(next);
      });
      container.appendChild(form);
      return;
    }

    container.appendChild(
      this._input(
        labelText,
        current,
        onChange,
        "/local/images/image.png",
      ),
    );
  }

  _renderNativeActionPicker(container, item, field, labelText, defaultAction = "none") {
    const explicit = item?.[field] && typeof item[field] === "object"
      ? vscClone(item[field])
      : field === "tap_action" && item?.action && item.action !== "auto"
        ? vscNativeTapAction(item)
        : undefined;

    if (customElements.get("ha-form")) {
      const form = document.createElement("ha-form");
      form.className = "native-field lotus-action-picker";
      form.hass = this._hass;
      form.data = { [field]: explicit };
      form.context = item.entity ? { entity_id: item.entity } : undefined;
      form.schema = [
        {
          name: field,
          required: false,
          selector: { ui_action: { default_action: defaultAction } },
        },
      ];
      form.computeLabel = () => lotusT(labelText);
      form.addEventListener("value-changed", (event) => {
        const value = event.detail?.value?.[field];
        this._commit((config) => {
          const target = this._ensureItem(config, item.id);
          target[field] = value && typeof value === "object" ? vscClone(value) : undefined;
          if (field === "tap_action") {
            target.action = "auto";
            target.navigation_path = "";
            target.url = "";
            target.service = "";
          }
        }, { keepSelection: true });
      });
      container.appendChild(form);
      return;
    }

    // Fallback only for old HA frontends where ui_action is unavailable.
    if (field === "tap_action") {
      container.appendChild(
        this._select(
          labelText,
          item.action ?? "auto",
          [
            ["auto", "Automatique"],
            ["more-info", "Plus d'informations"],
            ["toggle", "Basculer l'état"],
            ["navigate", "Naviguer dans Home Assistant"],
            ["url", "Ouvrir une URL"],
            ["service", "Appeler un service"],
            ["none", "Aucune action"],
          ],
          (value) => this._setItemField(item.id, "action", value),
        ),
      );
    }
  }

  _currentIconValueCount(itemId, fallback = 0) {
    const item = this._item(itemId);
    const raw = Number(item?.icon_value_count);
    const value = Number.isFinite(raw) ? Math.floor(raw) : Math.floor(Number(fallback) || 0);
    return Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, value));
  }

  _iconValueCountControl(item) {
    const current = this._currentIconValueCount(item.id, item.icon_value_count);
    const field = document.createElement("label");
    field.className = "field image-count-field";
    field.dataset.lotusScrollAnchor = `icon-count:${item.id}`;
    const caption = document.createElement("span");
    caption.textContent = lotusT("Nombre de valeurs / icônes");
    const control = document.createElement("div");
    control.className = "image-count-stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "image-count-step-button";
    minus.textContent = "−";
    minus.title = lotusT("Diminuer d’une valeur");
    const input = document.createElement("input");
    input.type = "number";
    input.className = "image-count-step-input";
    input.min = "0";
    input.max = String(VISUAL_STACK_CARD_MAX_IMAGES);
    input.step = "1";
    input.inputMode = "numeric";
    input.value = String(current);
    input.setAttribute("aria-label", lotusT("Nombre de valeurs / icônes"));
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "image-count-step-button";
    plus.textContent = "+";
    plus.title = lotusT("Augmenter d’une valeur");

    const clamp = (value, fallback = current) => {
      const parsed = Number(value);
      const base = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
      return Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, base));
    };
    const sync = () => {
      const value = clamp(input.value, this._currentIconValueCount(item.id, current));
      minus.disabled = value <= 0;
      plus.disabled = value >= VISUAL_STACK_CARD_MAX_IMAGES;
    };
    const commit = (value) => {
      const next = clamp(value, this._currentIconValueCount(item.id, current));
      input.value = String(next);
      sync();
      if (next !== this._currentIconValueCount(item.id, current)) {
        this._setIconValueCount(item.id, next, { preserveInspectorScroll: true });
      }
    };
    const step = (delta) => {
      const typed = Number(input.value);
      const model = this._currentIconValueCount(item.id, current);
      commit((Number.isFinite(typed) ? Math.floor(typed) : model) + delta);
    };
    for (const [button, delta] of [[minus, -1], [plus, 1]]) {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        step(delta);
      });
      button.addEventListener("click", (event) => {
        if (event.detail === 0) step(delta);
      });
    }
    input.addEventListener("input", sync);
    input.addEventListener("change", () => commit(input.value));
    input.addEventListener("blur", () => commit(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit(input.value);
      input.blur();
    });
    sync();
    control.append(minus, input, plus);
    field.append(caption, control);
    return field;
  }

  _setIconValueCount(itemId, value, { preserveInspectorScroll = false } = {}) {
    const count = Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0));
    if (count === this._currentIconValueCount(itemId, 0)) return;
    this._commit((config) => {
      const item = this._ensureItem(config, itemId);
      const previous = Array.isArray(item.icon_values) ? item.icon_values : [];
      item.icon_value_count = count;
      item.icon_values = Array.from({ length: count }, (_, index) => ({
        value: Number.isInteger(Number(previous[index]?.value)) ? Number(previous[index].value) : index,
        icon: String(previous[index]?.icon ?? ""),
        color: String(previous[index]?.color ?? "state").trim() || "state",
      }));
    }, { keepSelection: true, preserveInspectorScroll });
  }

  _setIconMappingField(itemId, index, field, value) {
    this._commit((config) => {
      const item = this._ensureItem(config, itemId);
      const count = Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, Number(item.icon_value_count) || 0));
      item.icon_values = Array.isArray(item.icon_values) ? item.icon_values.slice(0, count) : [];
      while (item.icon_values.length < count) {
        const current = item.icon_values.length;
        item.icon_values.push({ value: current, icon: "", color: "state" });
      }
      if (!item.icon_values[index]) return;
      item.icon_values[index] = {
        ...item.icon_values[index],
        [field]: field === "value" ? Number(value) : value,
      };
    }, { keepSelection: true });
  }

  _renderIconSettings(parent, item) {
    const section = document.createElement("div");
    section.className = "visual-settings";
    const selectedMode = ["static", "binary", "integer"].includes(item.icon_mode)
      ? item.icon_mode
      : "static";
    const modeRow = document.createElement("div");
    modeRow.className = "form-grid";
    modeRow.appendChild(this._select(
      "Mode de l’icône",
      selectedMode,
      [
        ["static", "Icône fixe"],
        ["binary", "Deux états → icône / couleur"],
        ["integer", "Valeur entière → icône / couleur"],
      ],
      (value) => this._setItemField(item.id, "icon_mode", value),
    ));
    section.appendChild(modeRow);

    const helper = document.createElement("p");
    helper.className = "helper";
    helper.textContent = lotusT("L’icône dynamique suit l’état brut de l’entité de valeur si elle est définie, sinon l’entité principale. Une icône laissée vide réutilise l’icône fixe de secours.");
    section.appendChild(helper);

    if (selectedMode === "static") {
      const iconFields = document.createElement("div");
      iconFields.className = "form-grid";
      const iconSlot = document.createElement("div");
      iconSlot.className = "native-field";
      this._renderIconPicker(iconSlot, item);
      iconFields.appendChild(iconSlot);
      section.appendChild(iconFields);
      this._renderIconStyleToolbar(section, item);
      parent.appendChild(section);
      return;
    }

    const fallbackTitle = document.createElement("div");
    fallbackTitle.className = "helper-text";
    fallbackTitle.textContent = lotusT("Icône et couleur de secours (utilisées si aucune valeur ne correspond)");
    section.appendChild(fallbackTitle);
    const fallbackGrid = document.createElement("div");
    fallbackGrid.className = "form-grid";
    const fallbackIcon = document.createElement("div");
    fallbackIcon.className = "native-field";
    this._renderIconValuePicker(fallbackIcon, "Icône de secours", item.icon ?? "", (value) => this._setItemField(item.id, "icon", value));
    const fallbackColor = document.createElement("div");
    fallbackColor.className = "native-field";
    this._renderIconColorField(fallbackColor, "Couleur de secours", item.icon_color ?? "state", (value) => this._setItemField(item.id, "icon_color", value));
    fallbackGrid.append(fallbackIcon, fallbackColor);
    section.appendChild(fallbackGrid);

    const sizeOnly = document.createElement("div");
    sizeOnly.className = "icon-style-toolbar";
    const sizeGroup = document.createElement("div");
    sizeGroup.className = "icon-size-toolbar";
    const sizeLabel = document.createElement("span");
    sizeLabel.className = "tool-label";
    sizeLabel.textContent = lotusT("Taille");
    const sizeValue = document.createElement("span");
    sizeValue.className = "tool-value";
    sizeValue.textContent = `${vscIconSize(item.icon_size)} %`;
    sizeGroup.append(
      sizeLabel,
      this._iconButton("mdi:magnify-minus-outline", () => this._adjustIconSize(item.id, -2), { title: "Réduire l’icône" }),
      sizeValue,
      this._iconButton("mdi:magnify-plus-outline", () => this._adjustIconSize(item.id, 2), { title: "Agrandir l’icône" }),
      this._iconButton("mdi:restore", () => this._setItemField(item.id, "icon_size", 20), { title: "Taille par défaut" }),
    );
    sizeOnly.appendChild(sizeGroup);
    section.appendChild(sizeOnly);

    if (selectedMode === "binary") {
      const list = document.createElement("div");
      list.className = "image-map-list";
      for (const number of [1, 2]) {
        const row = document.createElement("div");
        row.className = "image-map-row";
        row.appendChild(this._input(
          `Condition ${number}`,
          item[`icon_binary_state_${number}`] ?? (number === 1 ? "off" : "on"),
          (value) => this._setItemField(item.id, `icon_binary_state_${number}`, value),
          number === 1 ? "off ou 0" : "on ou 1",
        ));
        const iconSlot = document.createElement("div");
        iconSlot.className = "native-field";
        this._renderIconValuePicker(iconSlot, `Icône ${number}`, item[`icon_binary_${number}`] ?? "", (value) => this._setItemField(item.id, `icon_binary_${number}`, value));
        const colorSlot = document.createElement("div");
        colorSlot.className = "native-field";
        this._renderIconColorField(colorSlot, `Couleur ${number}`, item[`icon_binary_color_${number}`] ?? "state", (value) => this._setItemField(item.id, `icon_binary_color_${number}`, value));
        row.append(iconSlot, colorSlot);
        list.appendChild(row);
      }
      const help = document.createElement("p");
      help.className = "helper";
      help.textContent = lotusT("OFF et 0 sont traités comme le même état binaire ; ON et 1 également (false/true compris). Les comparaisons (>10, <=20, !=0…) restent acceptées si vous choisissez des conditions personnalisées.");
      section.append(list, help);
    } else {
      const countFields = document.createElement("div");
      countFields.className = "image-count-row";
      countFields.appendChild(this._iconValueCountControl(item));
      section.appendChild(countFields);
      const count = this._currentIconValueCount(item.id, item.icon_value_count);
      if (count > 0) {
        const list = document.createElement("div");
        list.className = "image-map-list";
        const mappings = Array.isArray(item.icon_values) ? item.icon_values : [];
        for (let index = 0; index < count; index += 1) {
          const mapping = mappings[index] ?? { value: index, icon: "", color: "state" };
          const row = document.createElement("div");
          row.className = "image-map-row";
          row.appendChild(this._input(
            `Valeur ${index + 1}`,
            Number.isInteger(Number(mapping.value)) ? Number(mapping.value) : index,
            (value) => this._setIconMappingField(item.id, index, "value", value),
            "",
            "number",
            { step: 1 },
          ));
          const iconSlot = document.createElement("div");
          iconSlot.className = "native-field";
          this._renderIconValuePicker(iconSlot, `Icône ${index + 1}`, mapping.icon ?? "", (value) => this._setIconMappingField(item.id, index, "icon", value));
          const colorSlot = document.createElement("div");
          colorSlot.className = "native-field";
          this._renderIconColorField(colorSlot, `Couleur ${index + 1}`, mapping.color ?? "state", (value) => this._setIconMappingField(item.id, index, "color", value));
          row.append(iconSlot, colorSlot);
          list.appendChild(row);
        }
        section.appendChild(list);
      }
    }
    parent.appendChild(section);
  }

  _currentImageValueCount(itemId, fallback = 0) {
    const item = this._item(itemId);
    const raw = Number(item?.image_value_count);
    const value = Number.isFinite(raw)
      ? Math.floor(raw)
      : Math.floor(Number(fallback) || 0);
    return Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, value));
  }

  _imageValueCountControl(item) {
    const current = this._currentImageValueCount(item.id, item.image_value_count);

    const field = document.createElement("label");
    field.className = "field image-count-field";
    field.dataset.lotusScrollAnchor = `image-count:${item.id}`;

    const caption = document.createElement("span");
    caption.textContent = lotusT("Nombre d'images");

    const control = document.createElement("div");
    control.className = "image-count-stepper";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "image-count-step-button";
    minus.textContent = "−";
    minus.title = lotusT("Diminuer d’une image");
    minus.setAttribute("aria-label", minus.title);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "image-count-step-input";
    input.min = "0";
    input.max = String(VISUAL_STACK_CARD_MAX_IMAGES);
    input.step = "1";
    input.inputMode = "numeric";
    input.value = String(current);
    input.setAttribute("aria-label", lotusT("Nombre d’images"));

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "image-count-step-button";
    plus.textContent = "+";
    plus.title = lotusT("Augmenter d’une image");
    plus.setAttribute("aria-label", plus.title);

    const clampCount = (value, fallback = current) => {
      const parsed = Number(value);
      const base = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
      return Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, base));
    };

    const syncButtonState = () => {
      const value = clampCount(input.value, this._currentImageValueCount(item.id, current));
      minus.disabled = value <= 0;
      plus.disabled = value >= VISUAL_STACK_CARD_MAX_IMAGES;
    };

    const commit = (requestedValue) => {
      const next = clampCount(requestedValue, this._currentImageValueCount(item.id, current));
      input.value = String(next);
      syncButtonState();

      const modelValue = this._currentImageValueCount(item.id, current);
      if (next === modelValue) return;

      this._setImageValueCount(item.id, next, {
        preserveInspectorScroll: true,
      });
    };

    const step = (delta) => {
      // Prefer an unfinished manual entry when it is valid; otherwise always
      // re-read the current internal model. No closure value is used as the
      // authoritative count after a previous update.
      const typed = Number(input.value);
      const modelValue = this._currentImageValueCount(item.id, current);
      const base = Number.isFinite(typed) ? Math.floor(typed) : modelValue;
      commit(base + delta);
    };

    const bindStep = (button, delta) => {
      // Handle pointer input before blur/change can fire on the number field.
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        step(delta);
      });
      // Keyboard activation still emits click with detail === 0.
      button.addEventListener("click", (event) => {
        if (event.detail === 0) step(delta);
      });
    };

    bindStep(minus, -1);
    bindStep(plus, 1);

    // Typing never re-renders the editor. Apply only when the entry is
    // explicitly validated or the field is left.
    input.addEventListener("input", syncButtonState);
    input.addEventListener("change", () => commit(input.value));
    input.addEventListener("blur", () => commit(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit(input.value);
      input.blur();
    });

    syncButtonState();
    control.append(minus, input, plus);
    field.append(caption, control);
    return field;
  }

  _setImageValueCount(
    itemId,
    value,
    { preserveInspectorScroll = false } = {},
  ) {
    const count = Math.max(
      0,
      Math.min(
        VISUAL_STACK_CARD_MAX_IMAGES,
        Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0,
      ),
    );
    const current = this._currentImageValueCount(itemId, 0);
    if (count === current) return;

    this._commit((config) => {
      const item = this._ensureItem(config, itemId);
      const previous = Array.isArray(item.image_values)
        ? item.image_values
        : [];
      item.image_value_count = count;
      item.image_values = Array.from(
        { length: count },
        (_, index) => ({
          value: Number.isInteger(Number(previous[index]?.value))
            ? Number(previous[index].value)
            : index,
          image: String(previous[index]?.image ?? ""),
        }),
      );
    }, { keepSelection: true, preserveInspectorScroll });
  }

  _setImageMappingField(itemId, index, field, value) {
    this._commit((config) => {
      const item = this._ensureItem(config, itemId); const count = Math.max(0, Math.min(VISUAL_STACK_CARD_MAX_IMAGES, Number(item.image_value_count) || 0));
      item.image_values = Array.isArray(item.image_values) ? item.image_values.slice(0, count) : [];
      while (item.image_values.length < count) { const current = item.image_values.length; item.image_values.push({value: current, image: ""}); }
      if (!item.image_values[index]) return;
      item.image_values[index] = {...item.image_values[index], [field]: field === "value" ? Number(value) : value};
    }, {keepSelection: true});
  }

  _renderImageSettings(parent, item) {
    const section = document.createElement("div");
    section.className = "visual-settings";

    const modeChoices = [
      ["binary", "Deux états / deux images"],
      ["integer", "Valeur entière → image"],
    ];

    const selectedMode = item.image_mode ?? "binary";

    const modeRow = document.createElement("div");
    modeRow.className = "form-grid";
    modeRow.appendChild(
      this._select(
        "Mode des images",
        selectedMode,
        modeChoices,
        (value) => this._setItemField(item.id, "image_mode", value),
      ),
    );
    section.appendChild(modeRow);

    const defaultImage = document.createElement("div");
    defaultImage.className = "native-field image-picker-block";
    this._renderImagePicker(
      defaultImage,
      "Image par défaut",
      item.image_default ?? "",
      (value) => this._setItemField(item.id, "image_default", value),
    );
    section.appendChild(defaultImage);

    if (selectedMode === "integer") {
      const sourceHelp = document.createElement("div");
      sourceHelp.className = "helper-text";
      sourceHelp.textContent = lotusT("Les images suivent l’état brut de l’entité source. Les réglages d’attribut servant à afficher du texte n’interviennent pas.");
      section.appendChild(sourceHelp);

      const countFields = document.createElement("div");
      countFields.className = "image-count-row";
      countFields.appendChild(this._imageValueCountControl(item));
      section.appendChild(countFields);

      const count = Math.max(
        0,
        Math.min(
          VISUAL_STACK_CARD_MAX_IMAGES,
          Number(item.image_value_count) || 0,
        ),
      );
      const mappings = Array.isArray(item.image_values)
        ? item.image_values
        : [];

      if (count > 0) {
        const list = document.createElement("div");
        list.className = "image-map-list";

        for (let index = 0; index < count; index += 1) {
          const mapping = mappings[index] ?? { value: index, image: "" };
          const row = document.createElement("div");
          row.className = "image-map-row";

          row.appendChild(
            this._input(
              `Valeur ${index + 1}`,
              Number.isInteger(Number(mapping.value))
                ? Number(mapping.value)
                : index,
              (value) =>
                this._setImageMappingField(item.id, index, "value", value),
              "",
              "number",
              { step: 1 },
            ),
          );

          const imageSlot = document.createElement("div");
          imageSlot.className = "native-field image-picker-block";
          this._renderImagePicker(
            imageSlot,
            `Image ${index + 1}`,
            mapping.image ?? "",
            (value) =>
              this._setImageMappingField(item.id, index, "image", value),
          );
          row.appendChild(imageSlot);
          list.appendChild(row);
        }

        section.appendChild(list);
      }
    } else {
      const list = document.createElement("div");
      list.className = "image-map-list";

      const entries = [
        {
          number: 1,
          condition: item.image_binary_state_1 ?? "off",
          image: item.image_binary_1 ?? "",
        },
        {
          number: 2,
          condition: item.image_binary_state_2 ?? "on",
          image: item.image_binary_2 ?? "",
        },
      ];

      for (const entry of entries) {
        const row = document.createElement("div");
        row.className = "image-map-row";
        row.appendChild(
          this._input(
            `Condition ${entry.number}`,
            entry.condition,
            (value) =>
              this._setItemField(
                item.id,
                `image_binary_state_${entry.number}`,
                value,
              ),
            "off, on, 0, >=10...",
          ),
        );

        const imageSlot = document.createElement("div");
        imageSlot.className = "native-field image-picker-block";
        this._renderImagePicker(
          imageSlot,
          `Image ${entry.number}`,
          entry.image,
          (value) =>
            this._setItemField(
              item.id,
              `image_binary_${entry.number}`,
              value,
            ),
        );
        row.appendChild(imageSlot);
        list.appendChild(row);
      }

      const helper = document.createElement("p");
      helper.className = "helper";
      helper.textContent =
        lotusT("Conditions : texte exact (on/off), nombre exact (0, 1, 25) ou comparaison numérique (>10, >=10, <20, <=20, !=0).");

      section.append(helper, list);
    }

    parent.appendChild(section);
  }

  _haFormField(name, value, selector, labelText, onChange, { required = false, context = undefined } = {}) {
    if (!customElements.get("ha-form")) return null;
    const form = document.createElement("ha-form");
    form.className = "native-field lotus-native-form";
    form.dataset.lotusScrollAnchor = String(labelText || name);
    form.hass = this._hass;
    form.data = { [name]: value };
    form.schema = [{ name, required, selector: lotusLocalizeSelector(selector) }];
    form.computeLabel = () => lotusT(labelText);
    if (context) form.context = context;
    form.addEventListener("value-changed", (event) => {
      onChange(event.detail?.value?.[name]);
    });
    return form;
  }

  _input(labelText, value, onChange, placeholder = "", type = "text", options = {}) {
    // Les champs texte ne doivent pas déclencher _commit() à chaque caractère :
    // l'éditeur serait reconstruit et le focus perdu. La valeur est donc
    // validée uniquement lorsque l'utilisateur quitte le champ.
    if (type !== "number") {
      const label = document.createElement("label");
      label.className = "field lotus-text-field";
      label.dataset.lotusScrollAnchor = String(labelText || "field");

      const span = document.createElement("span");
      span.textContent = lotusT(labelText);

      const input = document.createElement("input");
      input.type = type || "text";
      input.value = value ?? "";
      input.placeholder = placeholder;
      input.addEventListener("change", () => onChange(input.value));

      label.append(span, input);
      return label;
    }
    let selector;
    let nativeValue = value;
    if (type === "number") {
      selector = {
        number: {
          mode: "box",
          ...(options.min !== undefined ? { min: Number(options.min) } : {}),
          ...(options.max !== undefined ? { max: Number(options.max) } : {}),
          ...(options.step !== undefined ? { step: Number(options.step) } : {}),
        },
      };
      nativeValue = value === "" || value === null || value === undefined
        ? undefined
        : Number(value);
    } else {
      selector = { text: { ...(type && type !== "text" ? { type } : {}), ...(placeholder ? { placeholder } : {}) } };
      nativeValue = value ?? "";
    }

    const native = this._haFormField(
      `field_${Math.random().toString(36).slice(2)}`,
      nativeValue,
      selector,
      labelText,
      (next) => {
        if (type === "number") {
          onChange(next === undefined || next === null || next === "" ? "" : Number(next));
        } else {
          onChange(next ?? "");
        }
      },
    );
    if (native) return native;

    const label = document.createElement("label");
    label.className = "field";
    label.dataset.lotusScrollAnchor = String(labelText || "field");
    const span = document.createElement("span");
    span.textContent = lotusT(labelText);
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    input.placeholder = placeholder;
    if (options.min !== undefined) input.min = String(options.min);
    if (options.max !== undefined) input.max = String(options.max);
    if (options.step !== undefined) input.step = String(options.step);
    input.addEventListener("change", () => onChange(type === "number" ? Number(input.value) : input.value));
    label.append(span, input);
    return label;
  }

  _checkbox(labelText, checked, onChange) {
    const native = this._haFormField(
      `field_${Math.random().toString(36).slice(2)}`,
      Boolean(checked),
      { boolean: {} },
      labelText,
      (next) => onChange(Boolean(next)),
    );
    if (native) return native;

    const label = document.createElement("label");
    label.className = "check-field";
    label.dataset.lotusScrollAnchor = String(labelText || "checkbox");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(checked);
    input.addEventListener("change", () => onChange(input.checked));
    const span = document.createElement("span");
    span.textContent = lotusT(labelText);
    label.append(input, span);
    return label;
  }

  _select(labelText, value, choices, onChange) {
    const native = this._haFormField(
      `field_${Math.random().toString(36).slice(2)}`,
      value,
      {
        select: {
          mode: "dropdown",
          options: choices.map(([choiceValue, choiceLabel]) => ({
            value: String(choiceValue),
            label: lotusT(choiceLabel),
          })),
        },
      },
      labelText,
      (next) => onChange(next ?? ""),
    );
    if (native) return native;

    const label = document.createElement("label");
    label.className = "field";
    label.dataset.lotusScrollAnchor = String(labelText || "select");
    const span = document.createElement("span");
    span.textContent = lotusT(labelText);
    const select = document.createElement("select");
    for (const [choiceValue, choiceLabel] of choices) {
      const option = document.createElement("option");
      option.value = String(choiceValue);
      option.textContent = lotusT(choiceLabel);
      option.selected = String(choiceValue) === String(value);
      select.appendChild(option);
    }
    select.addEventListener("change", () => onChange(select.value));
    label.append(span, select);
    return label;
  }

  _button(text, onClick, { disabled = false, kind = "secondary", title = "" } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = lotusT(text);
    button.className = kind;
    button.disabled = disabled;
    if (title) button.title = lotusT(title);
    button.addEventListener("click", onClick);
    return button;
  }

  _iconButton(iconName, onClick, { disabled = false, kind = "secondary", title = "" } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-action ${kind}`;
    button.disabled = disabled;
    button.title = lotusT(title);
    button.setAttribute("aria-label", title ? lotusT(title) : iconName);

    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", iconName);
    button.appendChild(icon);

    button.addEventListener("click", onClick);
    return button;
  }

  _formatIconButton(iconName, active, onClick, title) {
    const button = this._iconButton(iconName, onClick, {
      title,
      kind: "secondary",
    });
    button.classList.add("format-action");
    button.classList.toggle("active", active === true);
    button.setAttribute("aria-pressed", active === true ? "true" : "false");
    return button;
  }

  _fontChoices() {
    return [
      ["", "Police du thème"],
      ["Arial, sans-serif", "Arial"],
      ["Roboto, sans-serif", "Roboto"],
      ["Verdana, sans-serif", "Verdana"],
      ["Tahoma, sans-serif", "Tahoma"],
      ["'Trebuchet MS', sans-serif", "Trebuchet MS"],
      ["Georgia, serif", "Georgia"],
      ["'Times New Roman', serif", "Times New Roman"],
      ["'Courier New', monospace", "Courier New"],
      ["monospace", "Monospace"],
    ];
  }

  _setTextStyleField(scope, itemId, field, value) {
    if (scope === "title") {
      this._setTopField(field, value);
      return;
    }
    this._setItemField(itemId, field, value);
  }

  _adjustTextSize(scope, itemId, prefix, delta, defaultSize) {
    const source =
      scope === "title"
        ? this._config
        : this._item(itemId);

    if (!source) return;

    const field = `${prefix}_font_size`;
    const current = vscTextSize(source[field]);
    const base = current > 0 ? current : defaultSize;
    const next = Math.max(6, Math.min(120, base + delta));

    this._setTextStyleField(scope, itemId, field, next);
  }

  _adjustIconSize(itemId, delta) {
    const item = this._item(itemId);
    if (!item) return;
    this._setItemField(itemId, "icon_size", vscIconSize(vscIconSize(item.icon_size) + delta));
  }

  _renderIconStyleToolbar(parent, item) {
    const toolbar = document.createElement("div");
    toolbar.className = "icon-style-toolbar";

    const sizeGroup = document.createElement("div");
    sizeGroup.className = "icon-size-toolbar";
    const sizeLabel = document.createElement("span");
    sizeLabel.className = "tool-label";
    sizeLabel.textContent = lotusT("Taille");
    const sizeValue = document.createElement("span");
    sizeValue.className = "tool-value";
    sizeValue.textContent = `${vscIconSize(item.icon_size)} %`;

    sizeGroup.append(
      sizeLabel,
      this._iconButton(
        "mdi:magnify-minus-outline",
        () => this._adjustIconSize(item.id, -2),
        { title: "Réduire l’icône" },
      ),
      sizeValue,
      this._iconButton(
        "mdi:magnify-plus-outline",
        () => this._adjustIconSize(item.id, 2),
        { title: "Agrandir l’icône" },
      ),
      this._iconButton(
        "mdi:restore",
        () => this._setItemField(item.id, "icon_size", 20),
        { title: "Taille par défaut" },
      ),
    );

    const colorGroup = document.createElement("div");
    colorGroup.className = "icon-color-toolbar";
    const colorField = this._haFormField(
      `icon_color_${item.id}`,
      String(item.icon_color ?? "state").trim() || "state",
      { ui_color: { include_none: true, include_state: true, default_color: "state" } },
      "Couleur de l’icône",
      (value) => this._setItemField(item.id, "icon_color", String(value ?? "state").trim() || "state"),
    );
    if (colorField) {
      colorGroup.appendChild(colorField);
    } else {
      colorGroup.appendChild(
        this._input(
          "Couleur de l’icône",
          item.icon_color === "state" ? "" : item.icon_color ?? "",
          (value) => this._setItemField(item.id, "icon_color", value || "state"),
          "state",
        ),
      );
    }

    toolbar.append(sizeGroup, colorGroup);
    parent.appendChild(toolbar);
  }

  _renderTextStyleEditor(
    parent,
    {
      heading,
      scope,
      itemId = null,
      prefix,
      defaultSize,
    },
  ) {
    const source =
      scope === "title"
        ? this._config
        : this._item(itemId);

    if (!source) return;

    const block = document.createElement("div");
    block.className = "text-style-block";

    const headingEl = document.createElement("div");
    headingEl.className = "text-style-heading";
    headingEl.textContent = lotusT(heading);
    block.appendChild(headingEl);

    const row = document.createElement("div");
    row.className = "text-style-row";

    const font = this._select(
      "Police",
      source[`${prefix}_font_family`] ?? "",
      this._fontChoices(),
      (value) =>
        this._setTextStyleField(
          scope,
          itemId,
          `${prefix}_font_family`,
          value,
        ),
    );

    const currentSize = vscTextSize(source[`${prefix}_font_size`]);
    const sizeControl = document.createElement("div");
    sizeControl.className = "font-size-control";
    const sizeField = this._input(
      "Taille (px)",
      currentSize > 0 ? currentSize : "",
      (value) =>
        this._setTextStyleField(
          scope,
          itemId,
          `${prefix}_font_size`,
          value === "" ? 0 : vscTextSize(value),
        ),
      "Auto",
      "number",
      { min: 6, max: 120, step: 1 },
    );
    sizeControl.append(
      sizeField,
      this._iconButton(
        "mdi:format-font-size-decrease",
        () => this._adjustTextSize(scope, itemId, prefix, -1, defaultSize),
        { title: "Diminuer la taille" },
      ),
      this._iconButton(
        "mdi:format-font-size-increase",
        () => this._adjustTextSize(scope, itemId, prefix, 1, defaultSize),
        { title: "Augmenter la taille" },
      ),
    );

    const colorControl = document.createElement("div");
    colorControl.className = "color-control";
    const currentColor = String(source[`${prefix}_color`] ?? "");
    const colorField = this._input(
      "Couleur",
      /^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : "#000000",
      (value) => this._setTextStyleField(scope, itemId, `${prefix}_color`, value),
      "",
      "color",
    );
    colorControl.append(
      colorField,
      this._iconButton(
        "mdi:restore",
        () => this._setTextStyleField(scope, itemId, `${prefix}_color`, ""),
        { title: "Couleur du thème" },
      ),
    );

    row.append(font, sizeControl, colorControl);
    block.appendChild(row);

    const toolbar = document.createElement("div");
    toolbar.className = "format-toolbar";

    const align = ["left", "center", "right"].includes(
      source[`${prefix}_align`],
    )
      ? source[`${prefix}_align`]
      : "left";

    toolbar.append(
      this._formatIconButton(
        "mdi:format-align-left",
        align === "left",
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_align`,
            "left",
          ),
        "Aligner à gauche",
      ),
      this._formatIconButton(
        "mdi:format-align-center",
        align === "center",
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_align`,
            "center",
          ),
        "Centrer",
      ),
      this._formatIconButton(
        "mdi:format-align-right",
        align === "right",
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_align`,
            "right",
          ),
        "Aligner à droite",
      ),
    );

    const separator = document.createElement("span");
    separator.className = "toolbar-separator";
    toolbar.appendChild(separator);

    toolbar.append(
      this._formatIconButton(
        "mdi:format-bold",
        source[`${prefix}_bold`] === true,
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_bold`,
            source[`${prefix}_bold`] !== true,
          ),
        "Gras",
      ),
      this._formatIconButton(
        "mdi:format-italic",
        source[`${prefix}_italic`] === true,
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_italic`,
            source[`${prefix}_italic`] !== true,
          ),
        "Italique",
      ),
      this._formatIconButton(
        "mdi:format-underline",
        source[`${prefix}_underline`] === true,
        () =>
          this._setTextStyleField(
            scope,
            itemId,
            `${prefix}_underline`,
            source[`${prefix}_underline`] !== true,
          ),
        "Souligné",
      ),
    );

    block.appendChild(toolbar);
    parent.appendChild(block);
  }


  _adjustCardBorderWidth(delta) {
    const current = vscCardBorderWidth(this._config.card_border_width);
    const minimum = vscCardBorderStyle(this._config.card_border_style) === "double" ? 3 : 1;
    this._setTopField("card_border_width", Math.max(minimum, Math.min(16, current + delta)));
  }

  _adjustCardBorderRadius(delta) {
    const current = vscCardBorderRadius(this._config.card_border_radius);
    this._setTopField("card_border_radius", Math.max(0, Math.min(80, current + delta)));
  }

  _setCardBorderStyle(style) {
    const normalized = vscCardBorderStyle(style);
    this._commit((config) => {
      config.card_border_style = normalized;
      if (normalized === "double" && vscCardBorderWidth(config.card_border_width) < 3) {
        config.card_border_width = 3;
      }
    }, { keepSelection: true });
  }

  _renderCardBorderToolbar(parent) {
    const block = document.createElement("div");
    block.className = "border-style-editor";

    const header = document.createElement("div");
    header.className = "border-toolbar-header";
    const title = document.createElement("div");
    title.className = "border-toolbar-title";
    title.textContent = lotusT("Contour de la carte");

    const toggle = this._iconButton(
      this._config.card_border_enabled === true ? "mdi:border-all" : "mdi:border-none",
      () => this._setTopField("card_border_enabled", this._config.card_border_enabled !== true),
      {
        title: this._config.card_border_enabled === true ? "Masquer le contour" : "Afficher le contour",
        kind: this._config.card_border_enabled === true ? "active" : "secondary",
      },
    );
    header.append(title, toggle);
    block.appendChild(header);

    if (this._config.card_border_enabled === true) {
      const widthRow = document.createElement("div");
      widthRow.className = "border-tool-row";
      const widthLabel = document.createElement("span");
      widthLabel.className = "tool-label";
      widthLabel.textContent = lotusT("Épaisseur");
      const widthValue = document.createElement("span");
      widthValue.className = "tool-value";
      widthValue.textContent = `${vscCardBorderWidth(this._config.card_border_width)} px`;
      widthRow.append(
        widthLabel,
        this._iconButton("mdi:minus", () => this._adjustCardBorderWidth(-1), { title: "Réduire l’épaisseur" }),
        widthValue,
        this._iconButton("mdi:plus", () => this._adjustCardBorderWidth(1), { title: "Augmenter l’épaisseur" }),
        this._iconButton("mdi:restore", () => this._setTopField("card_border_width", 2), { title: "Épaisseur par défaut" }),
      );

      const styleRow = document.createElement("div");
      styleRow.className = "border-tool-row border-pattern-row";
      const styleLabel = document.createElement("span");
      styleLabel.className = "tool-label";
      styleLabel.textContent = lotusT("Motif");
      styleRow.appendChild(styleLabel);
      const styles = [
        ["solid", "mdi:minus", "Bordure simple"],
        ["double", "mdi:equal", "Double bordure"],
        ["dashed", "mdi:drag-horizontal-variant", "Bordure en tirets"],
        ["dotted", "mdi:dots-horizontal", "Bordure pointillée"],
      ];
      for (const [value, icon, label] of styles) {
        styleRow.appendChild(
          this._iconButton(icon, () => this._setCardBorderStyle(value), {
            title: label,
            kind: vscCardBorderStyle(this._config.card_border_style) === value ? "active" : "secondary",
          }),
        );
      }

      const radiusRow = document.createElement("div");
      radiusRow.className = "border-tool-row";
      const radiusLabel = document.createElement("span");
      radiusLabel.className = "tool-label";
      radiusLabel.textContent = lotusT("Arrondi");
      const radiusValue = document.createElement("span");
      radiusValue.className = "tool-value";
      radiusValue.textContent = `${vscCardBorderRadius(this._config.card_border_radius)} px`;
      radiusRow.append(
        radiusLabel,
        this._iconButton("mdi:minus", () => this._adjustCardBorderRadius(-2), { title: "Réduire l’arrondi" }),
        radiusValue,
        this._iconButton("mdi:plus", () => this._adjustCardBorderRadius(2), { title: "Augmenter l’arrondi" }),
        this._iconButton("mdi:restore", () => this._setTopField("card_border_radius", 12), { title: "Arrondi par défaut" }),
      );

      const colorRow = document.createElement("div");
      colorRow.className = "border-color-row";
      const colorField = this._haFormField(
        "card_border_color",
        String(this._config.card_border_color ?? "primary").trim() || "primary",
        { ui_color: { include_none: false, include_state: false, default_color: "primary" } },
        "Couleur du contour",
        (value) => this._setTopField("card_border_color", String(value ?? "primary").trim() || "primary"),
      );
      if (colorField) colorRow.appendChild(colorField);
      else colorRow.appendChild(this._input("Couleur du contour", this._config.card_border_color ?? "primary", (value) => this._setTopField("card_border_color", value || "primary"), "primary"));

      block.append(widthRow, styleRow, radiusRow, colorRow);
    }

    parent.appendChild(block);
  }

  _renderAppearance(parent) {
    const section = document.createElement("section");
    section.className = "panel";

    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h3>${lotusT("Apparence")}</h3>
          <p>${lotusT("Fond, séparations et apparence générale de la carte.")}</p>
        </div>
      </div>
    `;

    const fields = document.createElement("div");
    fields.className = "form-grid appearance-grid";

    fields.append(
      this._input(
        "Titre de la carte",
        this._config.title,
        (value) => this._setTopField("title", value),
      ),
      this._select(
        "Taille des éléments",
        this._config.density,
        [
          ["compact", "Compacte"],
          ["normal", "Normale"],
          ["large", "Grande"],
        ],
        (value) => this._setTopField("density", value),
      ),
      this._select(
        "Fond de la carte",
        this._config.background_mode ?? "theme",
        [
          ["theme", "Couleur du thème"],
          ["color", "Couleur personnalisée"],
          ["transparent", "Transparent"],
        ],
        (value) => this._setTopField("background_mode", value),
      ),
      this._checkbox(
        "Afficher les séparations",
        this._config.show_dividers,
        (value) => this._setTopField("show_dividers", value),
      ),
      this._checkbox(
        "Colorer les icônes selon l'état",
        this._config.state_color,
        (value) => this._setTopField("state_color", value),
      ),
    );

    if (this._config.background_mode === "color") {
      fields.append(
        this._input(
          "Couleur de fond",
          this._config.background_color ?? "#ffffff",
          (value) => this._setTopField("background_color", value),
          "#ffffff",
          "color",
        ),
      );
    }

    if (this._config.show_dividers) {
      fields.append(
        this._input(
          "Épaisseur de séparation (px)",
          this._config.divider_size,
          (value) => this._setTopField("divider_size", value),
          "",
          "number",
          { min: 0, max: 20, step: 1 },
        ),
      );
    }

    section.appendChild(fields);
    this._renderCardBorderToolbar(section);

    if (this._config.title) {
      const typography = document.createElement("div");
      typography.className = "subsection";

      this._renderTextStyleEditor(typography, {
        heading: "Mise en forme du titre",
        scope: "title",
        prefix: "title",
        defaultSize: 18,
      });

      section.appendChild(typography);
    }

    parent.appendChild(section);
  }

  _setItemVisibilityConditions(itemId, conditions, editor = null) {
    if (!this._config) return;
    const nextConditions = Array.isArray(conditions)
      ? vscClone(conditions).filter((condition) => condition && typeof condition === "object")
      : [];
    const before = vscClone(this._config);
    const next = vscClone(this._config);
    this._ensureItem(next, itemId).visibility_conditions = nextConditions;
    this._config = vscNormalizeConfig(next);
    this._history.push(before);
    if (this._history.length > 80) this._history.shift();
    this._future = [];
    if (editor) editor.conditions = vscClone(nextConditions);
    this._emit();
  }

  _renderItemVisibilityEditor(parent, item) {
    const block = document.createElement("div");
    block.className = "subsection visibility-subsection";
    block.dataset.lotusScrollAnchor = "section-visibility";
    const title = document.createElement("h4");
    title.textContent = lotusT("Visibilité");
    const note = document.createElement("p");
    note.className = "condition-note";
    note.textContent = lotusT("Conditions Home Assistant appliquées uniquement à cette cellule. Sans condition, la cellule est toujours visible.");
    block.append(title, note);

    const editor = document.createElement("ha-card-conditions-editor");
    editor.className = "cell-conditions-editor";
    editor.hass = this._hass;
    editor.conditions = vscClone(Array.isArray(item.visibility_conditions) ? item.visibility_conditions : []);
    editor.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this._setItemVisibilityConditions(item.id, event.detail?.value, editor);
    });
    block.appendChild(editor);
    parent.appendChild(block);
  }

  _renderItemEditor(parent) {
    const placed = this._placedIds();
    const item =
      this._item(this._selectedItemId) ??
      this._item(placed[0]);

    if (!item) return;
    this._selectedItemId = item.id;

    const section = document.createElement("section");
    section.className = "panel";

    const heading = document.createElement("div");
    heading.className = "section-heading item-heading";
    heading.innerHTML = `
      <div>
        <h3>${lotusT("Cellule")} ${item.id}</h3>
        <p>${lotusT("Les propriétés modifient directement la cellule sélectionnée dans la carte.")}</p>
      </div>
    `;

    section.appendChild(heading);

    const general = document.createElement("div");
    general.className = "form-grid";

    general.append(
      this._select(
        "Type",
        item.type,
        [
          ["info", "Information"],
          ["button", "Bouton"],
        ],
        (value) => this._setItemField(item.id, "type", value),
      ),
      this._input(
        "Nom personnalisé",
        item.name ?? "",
        (value) => this._setItemField(item.id, "name", value),
      ),
      this._select(
        "Représentation",
        item.visual_type ?? "icon",
        [
          ["icon", "Icône"],
          ["image", "Image"],
        ],
        (value) => this._setItemField(item.id, "visual_type", value),
      ),
    );

    const entitySlot = document.createElement("div");
    entitySlot.className = "native-field";
    this._renderEntityPicker(entitySlot, item);
    general.appendChild(entitySlot);

    const contentGroup = document.createElement("div");
    contentGroup.className = "editor-group";
    contentGroup.dataset.lotusScrollAnchor = "section-content";
    const contentTitle = document.createElement("h4");
    contentTitle.textContent = lotusT("Contenu");
    contentGroup.append(contentTitle, general);
    section.appendChild(contentGroup);

    const displayGroup = document.createElement("div");
    displayGroup.className = "editor-group";
    displayGroup.dataset.lotusScrollAnchor = "section-display";
    const displayTitle = document.createElement("h4");
    displayTitle.textContent = lotusT("Affichage");
    const displayOptions = document.createElement("div");
    displayOptions.className = "toggle-grid";
    displayOptions.append(
      this._checkbox(
        "Afficher le visuel",
        item.show_icon !== false,
        (value) => this._setItemField(item.id, "show_icon", value),
      ),
      this._checkbox(
        "Afficher le nom",
        item.show_name !== false,
        (value) => this._setItemField(item.id, "show_name", value),
      ),
      this._checkbox(
        "Afficher l'état / la valeur",
        item.show_state !== false,
        (value) => this._setItemField(item.id, "show_state", value),
      ),
      this._checkbox(
        "Afficher le retour visuel d’interaction (survol / focus)",
        item.interaction_feedback !== false,
        (value) => this._setItemField(item.id, "interaction_feedback", value),
      ),
      this._checkbox(
        "Afficher l’icône d’interaction",
        item.show_affordance === true,
        (value) => this._setItemField(item.id, "show_affordance", value),
      ),
    );
    displayGroup.append(displayTitle, displayOptions);
    section.appendChild(displayGroup);

    this._renderItemVisibilityEditor(section, item);

    if (item.show_name !== false) {
      const nameTypography = document.createElement("div");
      nameTypography.className = "subsection";
      nameTypography.dataset.lotusScrollAnchor = "section-name-style";
      this._renderTextStyleEditor(nameTypography, {
        heading: "Mise en forme du nom",
        scope: "item",
        itemId: item.id,
        prefix: "name",
        defaultSize: 14,
      });
      section.appendChild(nameTypography);
    }

    if (item.show_state !== false) {
      const valueTypography = document.createElement("div");
      valueTypography.className = "subsection";
      valueTypography.dataset.lotusScrollAnchor = "section-value-style";
      this._renderTextStyleEditor(valueTypography, {
        heading: "Mise en forme de l'état / de la valeur",
        scope: "item",
        itemId: item.id,
        prefix: "value",
        defaultSize: 12,
      });
      section.appendChild(valueTypography);
    }

    if (item.show_state !== false) {
      const infoBlock = document.createElement("div");
      infoBlock.className = "subsection";
      infoBlock.dataset.lotusScrollAnchor = "section-info";

      const title = document.createElement("h4");
      title.textContent = lotusT("Information affichée");
      infoBlock.appendChild(title);

      const infoFields = document.createElement("div");
      infoFields.className = "form-grid";

      const valueEntitySlot = document.createElement("div");
      valueEntitySlot.className = "native-field full-span";
      this._renderValueEntityPicker(valueEntitySlot, item);
      infoFields.appendChild(valueEntitySlot);

      const currentSource =
        item.value_source === "attribute" ||
        (!item.value_source && item.attribute)
          ? "attribute"
          : "state";

      infoFields.appendChild(
        this._select(
          "Source de la valeur",
          currentSource,
          [
            ["state", "État principal de l’entité de valeur"],
            ["attribute", "Attribut de l’entité de valeur"],
          ],
          (value) => {
            this._commit(
              (config) => {
                const target = this._ensureItem(config, item.id);
                target.value_source = value;
                if (value === "state") target.attribute = "";
              },
              { keepSelection: true },
            );
          },
        ),
      );

      if (currentSource === "attribute") {
        const attributeSlot = document.createElement("div");
        attributeSlot.className = "native-field";
        this._renderAttributePicker(attributeSlot, item);
        infoFields.appendChild(attributeSlot);
      }

      infoFields.appendChild(
        this._input(
          "Unité personnalisée",
          item.unit ?? "",
          (value) => this._setItemField(item.id, "unit", value),
          "Ex. °C, %, km/h",
        ),
      );

      infoBlock.appendChild(infoFields);

      section.appendChild(infoBlock);
    }

    const visualBlock = document.createElement("div");
    visualBlock.className = "subsection";
    visualBlock.dataset.lotusScrollAnchor = "section-visual";

    const visualTitle = document.createElement("h4");
    visualTitle.textContent =
      item.visual_type === "image"
        ? "Images"
        : "Icône";
    visualBlock.appendChild(visualTitle);

    if (item.visual_type === "image") {
      const imageOptions = document.createElement("div");
      imageOptions.className = "form-grid";

      imageOptions.append(
        this._select(
          "Ajustement de l'image",
          item.image_fit ?? "contain",
          [
            ["contain", "Contenir — image entière, proportions conservées"],
            ["cover", "Couvrir — cellule remplie, recadrage possible"],
            ["fill", "Étirer — cellule remplie, déformation possible"],
          ],
          (value) => this._setItemField(item.id, "image_fit", value),
        ),
        this._checkbox(
          "Afficher le fond d'état actif derrière l'image",
          item.image_active_background === true,
          (value) =>
            this._setItemField(item.id, "image_active_background", value),
        ),
      );

      visualBlock.appendChild(imageOptions);
      this._renderImageSettings(visualBlock, item);
    } else {
      this._renderIconSettings(visualBlock, item);

      const iconAppearance = document.createElement("div");
      iconAppearance.className = "toggle-grid single-column";
      iconAppearance.appendChild(
        this._checkbox(
          "Afficher le fond circulaire",
          item.visual_background !== false,
          (value) => this._setItemField(item.id, "visual_background", value),
        ),
      );
      visualBlock.appendChild(iconAppearance);
    }

    section.appendChild(visualBlock);

    const actionBlock = document.createElement("div");
    actionBlock.className = "subsection";
    actionBlock.dataset.lotusScrollAnchor = "section-actions";

    const actionTitle = document.createElement("h4");
    actionTitle.textContent = lotusT("Interactions");
    actionBlock.appendChild(actionTitle);

    const actionFields = document.createElement("div");
    actionFields.className = "action-fields-native";

    const resolvedDefault = vscNativeTapAction({ ...item, tap_action: undefined })?.action;
    const defaultTapAction = ["more-info", "toggle", "navigate", "url", "perform-action", "assist", "none"].includes(resolvedDefault)
      ? resolvedDefault
      : "none";

    this._renderNativeActionPicker(
      actionFields,
      item,
      "tap_action",
      "Action au clic",
      defaultTapAction,
    );
    this._renderNativeActionPicker(
      actionFields,
      item,
      "hold_action",
      "Action lors d'un appui long",
      "none",
    );
    this._renderNativeActionPicker(
      actionFields,
      item,
      "double_tap_action",
      "Action au double clic",
      "none",
    );

    actionBlock.appendChild(actionFields);
    section.appendChild(actionBlock);

    const primary = this._checkbox(
      "Déclarer cette cellule comme cellule principale",
      Number(this._config.primary_item) === Number(item.id),
      (checked) => {
        if (!checked) return;

        this._commit(
          (config) => {
            config.primary_item = item.id;
            config.primary_position = "custom";
          },
          { keepSelection: true },
        );
      },
    );

    primary.classList.add("primary-check");
    section.appendChild(primary);
    parent.appendChild(section);
  }


  _frameInspector(parent) {
    const panel = document.createElement("section");
    panel.className = "panel compact-panel";
    const heading = document.createElement("div");
    heading.className = "section-heading";
    heading.innerHTML = `<div><h3>${lotusT("Contour")}</h3><p>${lotusT("Valeurs relatives et responsives. Elles définissent le ratio de conception et pourront servir de référence dans Lotus View Studio.")}</p></div>`;
    panel.appendChild(heading);

    const size = document.createElement("div");
    size.className = "frame-size-row";
    size.append(
      this._input("L", this._config.frame_width, (value) => this._setTopField("frame_width", vscFrameValue(value, this._config.frame_width)), "", "number", { min:10, max:200, step:.5 }),
      this._input("H", this._config.frame_height, (value) => this._setTopField("frame_height", vscFrameValue(value, this._config.frame_height)), "", "number", { min:10, max:200, step:.5 }),
    );
    panel.appendChild(size);

    const note = document.createElement("div");
    note.className = "metric-note";
    note.textContent = `Ratio ${vscRound(this._config.frame_width / this._config.frame_height, 3)}:1`;
    panel.appendChild(note);
    parent.appendChild(panel);
    this._renderAppearance(parent);
  }

  _multiInspector(parent) {
    const panel = document.createElement("section");
    panel.className = "panel compact-panel";
    const merge = this._mergeState();
    const equalWidth = this._equalizeState("horizontal");
    const equalHeight = this._equalizeState("vertical");
    let note = lotusT(merge.allowed
      ? "La sélection forme un rectangle. Les outils de géométrie sont disponibles au-dessus de l’aperçu."
      : "Les outils de géométrie de la sélection sont disponibles au-dessus de l’aperçu.");
    if (equalWidth.allowed) note += lotusT(" Les largeurs peuvent être harmonisées.");
    if (equalHeight.allowed) note += lotusT(" Les hauteurs peuvent être harmonisées.");
    const selectedCountLabel = lotusT(this._selectedRegionIds.size > 1 ? "cellules" : "cellule");
    panel.innerHTML = `<div class="section-heading"><div><h3>${this._selectedRegionIds.size} ${selectedCountLabel}</h3><p>${note}</p></div></div>`;
    parent.appendChild(panel);
  }

  _renderToolbar(parent) {
    const toolbar = document.createElement("div");
    toolbar.className = "editor-toolbar";

    const left = document.createElement("div");
    left.className = "toolbar-group";
    left.append(
      this._iconButton("mdi:undo", () => this._undo(), { disabled:!this._history.length, title:"Annuler la dernière modification" }),
      this._iconButton("mdi:redo", () => this._redo(), { disabled:!this._future.length, title:"Rétablir la modification" }),
      this._iconButton("mdi:crop-free", () => this._selectFrame(), { kind:this._frameSelected ? "active" : "secondary", title:"Sélectionner le contour" }),
      this._iconButton("mdi:select-multiple", () => { this._multiSelect = !this._multiSelect; this._render(); }, { kind:this._multiSelect ? "active" : "secondary", title:"Sélection multiple" }),
    );

    const single = this._singleSelectedRegion();
    if (single) {
      left.append(
        this._iconButton("mdi:view-split-vertical", () => this._splitSelected("vertical"), { title:"Diviser verticalement" }),
        this._iconButton("mdi:view-split-horizontal", () => this._splitSelected("horizontal"), { title:"Diviser horizontalement" }),
      );
    }
    const merge = this._mergeState();
    if (this._selectedRegionIds.size > 1) {
      left.appendChild(this._iconButton("mdi:table-merge-cells", () => this._mergeSelected(), {
        disabled:!merge.allowed, kind:merge.allowed ? "primary" : "secondary", title:merge.allowed ? "Fusionner" : merge.reason
      }));

      const equalWidth = this._equalizeState("horizontal");
      const equalHeight = this._equalizeState("vertical");
      if (equalWidth.allowed) {
        left.appendChild(this._iconButton("mdi:table-column-width", () => this._equalizeSelected("horizontal"), {
          kind:"primary",
          title:"Harmoniser la largeur des cellules sélectionnées",
        }));
      }
      if (equalHeight.allowed) {
        left.appendChild(this._iconButton("mdi:table-row-height", () => this._equalizeSelected("vertical"), {
          kind:"primary",
          title:"Harmoniser la hauteur des cellules sélectionnées",
        }));
      }
    }

    const title = document.createElement("div");
    title.className = "toolbar-title";
    const selectedDivider = this._selectedDivider();
    const toolbarContext = selectedDivider
      ? `${lotusT("Séparation")} ${lotusT(selectedDivider.orientation === "vertical" ? "verticale" : "horizontale")} · ${vscRound(selectedDivider.position, 1)} %`
      : this._frameSelected
        ? lotusT("Contour")
        : this._selectedRegionIds.size > 1
          ? `${this._selectedRegionIds.size} ${lotusT("cellules")}`
          : `${lotusT("Cellule")} ${this._selectedItemId}`;
    title.innerHTML = `<strong>Lotus Stack</strong><span>${toolbarContext}</span>`;

    toolbar.append(left, title);
    parent.appendChild(toolbar);
  }

  _renderDimensionOverlay(frame, overlay) {
    const state = this._dimensionOverlay;
    if (!state || !this._config) return;

    const formatPercent = (value) => {
      const rounded = vscRound(Number(value) || 0, 1);
      return `${rounded} %`;
    };

    const appendCellDimensions = (orientation, regionIds = null) => {
      if (orientation !== "vertical" && orientation !== "horizontal") return;
      const selected = regionIds ? new Set(regionIds.map(Number)) : null;
      for (const region of vscRegions(this._config)) {
        if (selected && !selected.has(Number(region.id))) continue;
        const dimension = document.createElement("div");
        dimension.className = `cell-dimension cell-dimension-${orientation}`;
        dimension.style.left = `${region.x}%`;
        dimension.style.top = `${region.y}%`;
        dimension.style.width = `${region.width}%`;
        dimension.style.height = `${region.height}%`;

        const line = document.createElement("span");
        line.className = "dimension-line";
        const value = document.createElement("strong");
        value.className = "dimension-value";
        value.textContent = formatPercent(orientation === "vertical" ? region.width : region.height);
        dimension.append(line, value);
        overlay.appendChild(dimension);
      }
    };

    if (state.type === "divider") {
      appendCellDimensions(state.orientation, state.regionIds);
      return;
    }

    if (state.type === "frame") {
      if (state.orientation === "vertical" || state.orientation === "horizontal") {
        appendCellDimensions(state.orientation);
      }
      const live = document.createElement("div");
      live.className = `frame-live-dimension frame-live-${state.edge}`;
      if (state.orientation === "vertical") {
        live.textContent = `${lotusT("Largeur")} ${formatPercent(state.widthScale)}`;
      } else if (state.orientation === "horizontal") {
        live.textContent = `${lotusT("Hauteur")} ${formatPercent(state.heightScale)}`;
      } else {
        live.textContent = `${lotusT("L")} ${formatPercent(state.widthScale)} · ${lotusT("H")} ${formatPercent(state.heightScale)}`;
      }
      frame.appendChild(live);
    }
  }

  _renderCanvas(parent) {
    const stage = document.createElement("div");
    stage.className = "design-stage";
    stage.addEventListener("click", () => this._selectFrame());

    const frame = document.createElement("div");
    frame.className = `card-frame ${this._frameSelected ? "selected-frame" : ""} ${this._frameDragVisual ? "frame-dragging" : ""} ${this._frameSquareSnap?.frame ? "frame-square-snap" : ""}`;
    if (this._frameDragVisual) {
      frame.style.position = "absolute";
      frame.style.left = `${this._frameDragVisual.left}px`;
      frame.style.top = `${this._frameDragVisual.top}px`;
      frame.style.width = `${this._frameDragVisual.width}px`;
      frame.style.height = `${this._frameDragVisual.height}px`;
      frame.style.minWidth = "0";
      frame.style.maxWidth = "none";
      frame.style.aspectRatio = "auto";
    } else {
      frame.style.aspectRatio = `${this._config.frame_width} / ${this._config.frame_height}`;
      frame.style.width = `${Math.min(94, Math.max(42, 48 + this._config.frame_width * .34))}%`;
    }
    frame.addEventListener("click", (event) => {
      if (event.target === frame) this._selectFrame();
    });

    const preview = document.createElement("lotus-visual-stack");
    preview.className = "vsc-editor-preview";
    preview.preview = true;
    preview.hass = this._hass;
    preview.setConfig(this._config);
    frame.appendChild(preview);

    const overlay = document.createElement("div");
    overlay.className = "region-overlay";
    const squareSnapRegionIds = new Set([
      ...(this._snapGuide?.kind === "square" ? (this._snapGuide.regionIds || []).map(Number) : []),
      ...((this._frameSquareSnap?.regionIds || []).map(Number)),
    ]);
    const canSwapCells = vscRegions(this._config).length > 1;
    for (const region of vscRegions(this._config)) {
      const hit = document.createElement("button");
      hit.type = "button";
      hit.className = `region-hit ${this._selectedRegionIds.has(region.id) ? "selected" : ""} ${squareSnapRegionIds.has(Number(region.id)) ? "square-snap" : ""} ${canSwapCells ? "can-swap" : "no-swap"}`;
      hit.style.left = `${region.x}%`;
      hit.style.top = `${region.y}%`;
      hit.style.width = `${region.width}%`;
      hit.style.height = `${region.height}%`;
      hit.setAttribute("aria-label", canSwapCells
        ? `Cellule ${region.id}. Glisser sur une autre cellule pour permuter le contenu.`
        : `Cellule ${region.id}`);
      hit.dataset.regionId = String(region.id);
      hit.setAttribute("aria-grabbed", "false");
      const badge = document.createElement("span");
      badge.textContent = String(region.id);
      hit.appendChild(badge);
      if (canSwapCells) {
        hit.addEventListener("pointerdown", (event) => this._startCellDrag(event, region.id));
      }
      hit.addEventListener("click", (event) => this._selectRegion(event, region.id));
      overlay.appendChild(hit);
    }

    for (const divider of vscInternalDividers(this._config)) {
      const handle = document.createElement("button");
      handle.type = "button";
      const dividerSelected = this._dividerKey(divider) === this._selectedDividerKey;
      handle.className = `cell-divider cell-divider-${divider.orientation} ${dividerSelected ? "selected" : ""}`;
      handle.title = lotusT("Glisser pour redimensionner · cliquer pour saisir une dimension exacte");
      handle.setAttribute("aria-label", lotusT("Redimensionner les cellules ou sélectionner la séparation pour saisir un pourcentage exact"));
      if (divider.orientation === "vertical") {
        handle.style.left = `${divider.position}%`;
        handle.style.top = `${divider.start}%`;
        handle.style.height = `${divider.end - divider.start}%`;
      } else {
        handle.style.top = `${divider.position}%`;
        handle.style.left = `${divider.start}%`;
        handle.style.width = `${divider.end - divider.start}%`;
      }
      handle.addEventListener("pointerdown", (event) => this._startDividerResize(event, divider));
      handle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._selectDivider(divider);
      });
      overlay.appendChild(handle);
    }
    this._renderSelectedDividerEditors(overlay);
    frame.appendChild(overlay);

    if (this._snapGuide) {
      const guide = document.createElement("div");
      guide.className = `snap-guide snap-guide-${this._snapGuide.orientation}`;
      if (this._snapGuide.orientation === "vertical") {
        guide.style.left = `${this._snapGuide.position}%`;
      } else {
        guide.style.top = `${this._snapGuide.position}%`;
      }
      overlay.appendChild(guide);
    }

    this._renderDimensionOverlay(frame, overlay);

    if (this._frameSelected) {
      for (const edge of ["top", "right", "bottom", "left"]) {
        const side = document.createElement("button");
        side.type = "button";
        side.className = `frame-edge-resize frame-edge-${edge}`;
        side.title = edge === "left" || edge === "right"
          ? "Modifier uniquement la largeur"
          : "Modifier uniquement la hauteur";
        side.setAttribute("aria-label", side.title);
        side.addEventListener("pointerdown", (event) => this._startFrameResize(event, edge));
        frame.appendChild(side);
      }

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "frame-resize";
      handle.title = lotusT("Modifier largeur et hauteur");
      handle.setAttribute("aria-label", lotusT("Modifier largeur et hauteur"));
      handle.addEventListener("pointerdown", (event) => this._startFrameResize(event, "corner"));
      frame.appendChild(handle);
    }

    const metrics = document.createElement("div");
    metrics.className = "frame-metrics";
    metrics.textContent = `${lotusT("L")} ${this._config.frame_width} · ${lotusT("H")} ${this._config.frame_height} · ${vscRound(this._config.frame_width/this._config.frame_height,2)}:1`;

    stage.append(frame, metrics);
    parent.appendChild(stage);
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const inspectorScrollSnapshot =
      this._forcedInspectorScrollSnapshot || this._captureInspectorScroll();
    this._forcedInspectorScrollSnapshot = null;
    this._inspectorScrollSnapshot = inspectorScrollSnapshot;
    this.shadowRoot.replaceChildren();

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display:block;
        height:100%;
        max-height:100%;
        min-height:0;
        overflow:hidden;
        color:var(--primary-text-color);
        --ls-border:var(--divider-color, rgba(127,127,127,.25));
        --ls-bg:var(--card-background-color, var(--ha-card-background,#fff));
        --ls-muted:var(--secondary-text-color,#777);
        --ls-accent:var(--primary-color,#03a9f4);
      }
      * { box-sizing:border-box; }
      .editor-shell { display:flex; flex-direction:column; gap:12px; min-width:0; min-height:0; height:100%; overflow:hidden; }
      .editor-toolbar {
        position:relative; z-index:10; flex:0 0 auto; width:100%; max-width:100%;
        display:flex; flex-wrap:wrap; align-items:center; justify-content:center;
        gap:6px; padding:7px 9px; border:1px solid var(--ls-border);
        border-radius:12px; background:var(--ls-bg); overflow:hidden;
      }
      .toolbar-group { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:4px; min-width:0; }
      .toolbar-title { order:-1; flex:1 0 100%; min-width:0; text-align:center; display:flex; flex-direction:column; line-height:1.15; }
      .toolbar-title strong { font-size:14px; }
      .toolbar-title span { margin-top:2px; font-size:11px; color:var(--ls-muted); }
      button {
        min-height:36px; border:1px solid var(--ls-border); border-radius:8px;
        background:var(--ls-bg); color:var(--primary-text-color); font:inherit; cursor:pointer;
      }
      button:disabled { opacity:.35; cursor:default; }
      .icon-action {
        display:inline-grid; place-items:center; width:38px; min-width:38px; height:38px; padding:0;
      }
      .icon-action ha-icon { --mdc-icon-size:21px; }
      .icon-action:hover:not(:disabled) { border-color:var(--ls-accent); }
      .icon-action.primary { background:var(--ls-accent); border-color:var(--ls-accent); color:var(--text-primary-color,#fff); }
      .icon-action.active { color:var(--ls-accent); border-color:var(--ls-accent); background:color-mix(in srgb,var(--ls-accent) 12%,transparent); }

      .workspace { display:grid; grid-template-columns:minmax(460px,3fr) minmax(300px,2fr); gap:20px; align-items:stretch; flex:1 1 auto; min-height:0; overflow:hidden; }
      .canvas-column {
        grid-column:2 / 3; grid-row:1;
        min-width:0; min-height:0; max-height:100%; position:relative; top:auto; overflow:hidden;
        display:flex; flex-direction:column; align-items:stretch; justify-content:stretch; gap:8px;
      }
      .inspector {
        grid-column:1 / 2; grid-row:1;
        display:flex; flex-direction:column; gap:16px; min-width:0; min-height:0; height:100%; max-height:none;
        overflow-y:auto; overflow-x:hidden; padding:0 8px 12px 0; scrollbar-gutter:stable;
      }
      .canvas-feedback {
        flex:0 0 auto; min-height:18px; padding:0 4px; text-align:center;
        color:var(--ls-muted); font-size:11px; line-height:1.35;
      }

      .design-stage {
        position:relative; width:100%; height:100%; min-height:0; flex:1 1 auto;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:32px; border:1px dashed var(--ls-border); border-radius:14px; box-sizing:border-box;
        background:color-mix(in srgb,var(--secondary-background-color,#f5f5f5) 70%,transparent);
        overflow:hidden;
      }
      .card-frame {
        position:relative; min-width:180px; max-width:100%;
        transition:box-shadow .12s ease; border-radius:12px;
      }
      .card-frame.frame-dragging { transition:none; max-width:none; }
      .card-frame.frame-dragging .vsc-editor-preview { height:100%; }
      .card-frame.selected-frame { box-shadow:0 0 0 2px var(--ls-accent), 0 8px 30px rgba(0,0,0,.12); }
      .card-frame.frame-square-snap { box-shadow:0 0 0 3px var(--ls-accent), 0 0 0 7px color-mix(in srgb,var(--ls-accent) 18%,transparent), 0 8px 30px rgba(0,0,0,.12); }
      .vsc-editor-preview { display:block; width:100%; pointer-events:none; }
      .region-overlay { position:absolute; inset:0; border-radius:inherit; overflow:hidden; }
      .region-hit {
        position:absolute; min-width:0; min-height:0; padding:0;
        border:1px solid transparent; border-radius:0; background:transparent;
        cursor:pointer; touch-action:none; transition:background .1s ease, border-color .1s ease, box-shadow .1s ease, opacity .1s ease;
      }
      .region-hit.can-swap { cursor:grab; }
      .region-hit.can-swap:active { cursor:grabbing; }
      .region-hit.no-swap { cursor:pointer; }
      .region-overlay.cell-dragging .region-hit { cursor:grabbing; }
      .region-hit.drag-source {
        border:2px dashed var(--ls-accent);
        background:color-mix(in srgb,var(--ls-accent) 10%,transparent);
        opacity:.58; z-index:4;
      }
      .region-hit.drag-target {
        border:3px solid var(--ls-accent);
        background:color-mix(in srgb,var(--ls-accent) 24%,transparent);
        box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ls-bg) 72%,transparent), 0 0 0 2px color-mix(in srgb,var(--ls-accent) 30%,transparent);
        opacity:1; z-index:5;
      }
      .region-hit:hover { border-color:color-mix(in srgb,var(--ls-accent) 55%,transparent); background:color-mix(in srgb,var(--ls-accent) 5%,transparent); }
      .region-hit.selected { border:2px solid var(--ls-accent); background:color-mix(in srgb,var(--ls-accent) 10%,transparent); z-index:2; }
      .region-hit.drag-source.selected { border-style:dashed; opacity:.58; z-index:4; }
      .region-hit.drag-target, .region-hit.drag-target.selected {
        border:3px solid var(--ls-accent);
        background:color-mix(in srgb,var(--ls-accent) 24%,transparent);
        box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ls-bg) 72%,transparent), 0 0 0 2px color-mix(in srgb,var(--ls-accent) 30%,transparent);
        opacity:1; z-index:5;
      }
      .region-hit span {
        position:absolute; top:4px; left:4px; display:none; min-width:20px; height:20px; padding:0 5px;
        place-items:center; border-radius:10px; background:var(--ls-accent); color:var(--text-primary-color,#fff);
        font-size:11px; line-height:20px;
      }
      .region-hit.selected span, .region-hit:hover span { display:grid; }
      .cell-divider {
        position:absolute; z-index:6; padding:0; margin:0; min-width:0; min-height:0;
        border:0; border-radius:0; background:transparent; touch-action:none;
      }
      .cell-divider::after {
        content:""; position:absolute; background:transparent; transition:background .1s ease, box-shadow .1s ease;
      }
      .cell-divider:hover::after, .cell-divider:focus-visible::after, .cell-divider.selected::after {
        background:var(--ls-accent); box-shadow:0 0 0 1px color-mix(in srgb,var(--ls-accent) 35%,transparent);
      }
      .cell-divider.selected::after { box-shadow:0 0 0 2px color-mix(in srgb,var(--ls-accent) 28%,transparent); }
      .cell-divider-vertical {
        width:14px; min-width:14px; transform:translateX(-50%); cursor:col-resize;
      }
      .cell-divider-vertical::after {
        top:0; bottom:0; left:6px; width:2px;
      }
      .cell-divider-horizontal {
        height:14px; min-height:14px; transform:translateY(-50%); cursor:row-resize;
      }
      .cell-divider-horizontal::after {
        left:0; right:0; top:6px; height:2px;
      }
      .divider-value-editor {
        position:absolute; z-index:12; transform:translate(-50%,-50%);
        display:grid; grid-template-columns:auto 58px auto; align-items:center; gap:4px;
        padding:5px 7px; border:1px solid var(--ls-accent); border-radius:9px;
        background:color-mix(in srgb,var(--ls-bg) 94%,transparent);
        box-shadow:0 2px 9px rgba(0,0,0,.20); color:var(--primary-text-color);
        pointer-events:auto; white-space:nowrap;
      }
      .divider-value-editor > span { font-size:10px; font-weight:650; color:var(--ls-muted); }
      .divider-value-editor > strong { font-size:11px; }
      .divider-value-editor input {
        width:58px; min-width:58px; min-height:30px; height:30px; padding:3px 5px;
        text-align:right; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums;
      }
      .frame-edge-resize {
        position:absolute; z-index:7; padding:0; margin:0; min-width:0; min-height:0;
        border:0; border-radius:0; background:transparent; touch-action:none;
      }
      .frame-edge-resize::after { content:""; position:absolute; background:transparent; transition:background .1s ease; }
      .frame-edge-resize:hover::after, .frame-edge-resize:focus-visible::after { background:var(--ls-accent); }
      .frame-edge-left,.frame-edge-right { top:8px; bottom:8px; width:14px; cursor:col-resize; }
      .frame-edge-left { left:-7px; }
      .frame-edge-right { right:-7px; }
      .frame-edge-left::after,.frame-edge-right::after { top:0; bottom:0; left:6px; width:2px; }
      .frame-edge-top,.frame-edge-bottom { left:8px; right:8px; height:14px; cursor:row-resize; }
      .frame-edge-top { top:-7px; }
      .frame-edge-bottom { bottom:-7px; }
      .frame-edge-top::after,.frame-edge-bottom::after { left:0; right:0; top:6px; height:2px; }
      .frame-resize {
        position:absolute; right:-9px; bottom:-9px; z-index:8;
        width:20px; min-width:20px; height:20px; min-height:20px; padding:0;
        border:3px solid var(--ls-bg); border-radius:50%; background:var(--ls-accent);
        cursor:nwse-resize; box-shadow:0 1px 5px rgba(0,0,0,.28);
      }
      .snap-guide { position:absolute; z-index:8; pointer-events:none; background:var(--ls-accent); box-shadow:0 0 0 1px color-mix(in srgb,var(--ls-accent) 30%,transparent); }
      .snap-guide-vertical { top:0; bottom:0; width:2px; transform:translateX(-50%); }
      .snap-guide-horizontal { left:0; right:0; height:2px; transform:translateY(-50%); }
      .region-hit.square-snap {
        border-color:var(--ls-accent);
        box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ls-accent) 72%,transparent), 0 0 0 2px color-mix(in srgb,var(--ls-accent) 22%,transparent);
        background:color-mix(in srgb,var(--ls-accent) 10%,transparent);
      }
      .cell-dimension { position:absolute; z-index:9; pointer-events:none; color:var(--primary-text-color); }
      .cell-dimension .dimension-line { position:absolute; opacity:.9; }
      .cell-dimension .dimension-value {
        position:absolute; z-index:2; display:block; min-width:48px; padding:3px 7px;
        border:1px solid color-mix(in srgb,var(--ls-accent) 62%,var(--ls-bg)); border-radius:999px;
        background:color-mix(in srgb,var(--ls-bg) 88%,transparent); color:var(--primary-text-color);
        box-shadow:0 1px 4px rgba(0,0,0,.16); font-size:11px; font-weight:700; text-align:center; white-space:nowrap;
      }
      .cell-dimension-vertical .dimension-line {
        left:8px; right:8px; top:50%; height:1px; background:var(--ls-accent);
      }
      .cell-dimension-vertical .dimension-line::before,
      .cell-dimension-vertical .dimension-line::after {
        content:""; position:absolute; top:-4px; width:1px; height:9px; background:var(--ls-accent);
      }
      .cell-dimension-vertical .dimension-line::before { left:0; }
      .cell-dimension-vertical .dimension-line::after { right:0; }
      .cell-dimension-vertical .dimension-value { left:50%; top:50%; transform:translate(-50%,-50%); }
      .cell-dimension-horizontal .dimension-line {
        top:8px; bottom:8px; left:50%; width:1px; background:var(--ls-accent);
      }
      .cell-dimension-horizontal .dimension-line::before,
      .cell-dimension-horizontal .dimension-line::after {
        content:""; position:absolute; left:-4px; width:9px; height:1px; background:var(--ls-accent);
      }
      .cell-dimension-horizontal .dimension-line::before { top:0; }
      .cell-dimension-horizontal .dimension-line::after { bottom:0; }
      .cell-dimension-horizontal .dimension-value { left:50%; top:50%; transform:translate(-50%,-50%); }
      .frame-live-dimension {
        position:absolute; z-index:11; pointer-events:none; padding:4px 8px; border-radius:999px;
        background:var(--ls-accent); color:var(--text-primary-color,#fff); box-shadow:0 1px 5px rgba(0,0,0,.24);
        font-size:11px; font-weight:700; white-space:nowrap;
      }
      .frame-live-left { left:8px; top:8px; }
      .frame-live-right { right:8px; top:8px; }
      .frame-live-top { left:50%; top:8px; transform:translateX(-50%); }
      .frame-live-bottom { left:50%; bottom:8px; transform:translateX(-50%); }
      .frame-live-corner { right:10px; bottom:10px; }
      .frame-metrics { margin-top:12px; font-size:12px; color:var(--ls-muted); }

      .panel {
        padding:18px; border:1px solid var(--ls-border); border-radius:14px; background:var(--ls-bg);
      }
      .compact-panel { padding:16px; }
      .section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:18px; }
      .section-heading h3,.section-heading p { margin:0; }
      .section-heading h3 { font-size:15px; }
      .section-heading p { margin-top:3px; color:var(--ls-muted); font-size:11px; line-height:1.35; }
      .form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:14px; row-gap:20px; }
      .form-grid > .full-span { grid-column:1 / -1; }
      .appearance-grid { grid-template-columns:1fr; row-gap:20px; }
      .appearance-grid > * { width:100%; min-width:0; }
      .frame-size-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .field { display:flex; flex-direction:column; gap:4px; min-width:0; }
      .field > span { color:var(--ls-muted); font-size:11px; font-weight:600; }
      input,select {
        width:100%; min-height:36px; padding:6px 8px; border:1px solid var(--ls-border);
        border-radius:8px; background:var(--ls-bg); color:var(--primary-text-color); font:inherit;
      }
      .metric-note,.notice { margin-top:8px; color:var(--ls-muted); font-size:11px; }
      .visibility-subsection .condition-note { margin:0 0 10px; color:var(--ls-muted); font-size:11px; line-height:1.4; }
      .cell-conditions-editor { display:block; width:100%; min-width:0; }
      .inline-actions,.format-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-top:8px; }
      .toolbar-separator { width:1px; height:26px; margin:0 3px; background:var(--ls-border); }
      .border-style-editor { margin-top:20px; padding:14px; border:1px solid var(--ls-border); border-radius:12px; background:color-mix(in srgb,var(--secondary-background-color,#f5f5f5) 45%,transparent); }
      .border-toolbar-header { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:38px; }
      .border-toolbar-title { font-weight:650; }
      .border-tool-row { display:grid; grid-template-columns:minmax(86px,1fr) auto 56px auto auto; align-items:center; gap:8px; margin-top:12px; }
      .border-pattern-row { grid-template-columns:minmax(86px,1fr) repeat(4,auto); }
      .border-color-row { margin-top:14px; }
      .border-style-editor .tool-label { font-size:var(--ha-font-size-s,13px); font-weight:600; }
      .border-style-editor .tool-value { min-width:48px; text-align:center; font-variant-numeric:tabular-nums; }
      .check-field { display:flex; align-items:center; gap:7px; min-height:36px; font-size:12px; }
      .check-field input { width:auto; min-height:auto; margin:0; }
      .native-field, .native-field > * { width:100%; min-width:0; }
      .editor-group { margin-top:18px; }
      .editor-group:first-of-type { margin-top:0; }
      .editor-group h4 { margin:0 0 12px; font-size:13px; }
      .toggle-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 12px; padding:12px; border:1px solid var(--ls-border); border-radius:10px; background:color-mix(in srgb,var(--secondary-background-color,#f5f5f5) 55%,transparent); }
      .subsection { margin-top:22px; padding-top:18px; border-top:1px solid var(--ls-border); }
      .subsection h4 { margin:0 0 12px; font-size:13px; }
      .text-style-heading { margin-bottom:7px; font-size:12px; font-weight:600; }
      .text-style-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; align-items:end; }
      .font-size-control,.color-control { display:flex; align-items:flex-end; gap:4px; min-width:0; }
      .font-size-control > .native-field,.color-control > .native-field { flex:1 1 auto; }
      .action-fields-native { display:flex; flex-direction:column; gap:18px; }
      .font-size-control .icon-action,.color-control .icon-action { flex:0 0 36px; }
      .icon-style-toolbar {
        display:grid; grid-template-columns:minmax(240px,auto) minmax(220px,1fr);
        gap:12px; align-items:end; margin-top:12px; padding:12px;
        border:1px solid var(--ls-border); border-radius:10px;
        background:color-mix(in srgb,var(--secondary-background-color,#f5f5f5) 55%,transparent);
      }
      .icon-size-toolbar { display:flex; align-items:center; gap:6px; min-height:42px; }
      .icon-size-toolbar .tool-label { margin-right:2px; color:var(--ls-muted); font-size:11px; font-weight:600; }
      .icon-size-toolbar .tool-value {
        min-width:52px; padding:6px 8px; border:1px solid var(--ls-border); border-radius:8px;
        background:var(--ls-bg); font-size:12px; font-weight:700; text-align:center; white-space:nowrap;
      }
      .icon-color-toolbar { min-width:0; }
      .icon-color-toolbar > * { width:100%; min-width:0; }
      .format-action.active { color:var(--ls-accent); border-color:var(--ls-accent); }
      .visual-settings { display:flex; flex-direction:column; gap:10px; }
      .binary-image-grid,.image-map-row { display:grid; grid-template-columns:1fr; gap:8px; }
      .image-map-list { display:flex; flex-direction:column; gap:8px; }
      .image-count-row { max-width:280px; }
      .image-count-stepper {
        display:grid; grid-template-columns:40px minmax(78px,1fr) 40px;
        align-items:center; gap:7px; width:100%; margin-top:4px;
      }
      .image-count-step-button {
        width:40px; min-width:40px; min-height:40px; height:40px; padding:0;
        display:grid; place-items:center; font-size:22px; line-height:1;
      }
      .image-count-step-input {
        min-height:40px; padding:6px 8px; text-align:center;
        font-variant-numeric:tabular-nums; appearance:textfield; -moz-appearance:textfield;
      }
      .image-count-step-input::-webkit-inner-spin-button,
      .image-count-step-input::-webkit-outer-spin-button { margin:0; -webkit-appearance:none; }
      .image-map-row { padding:9px; border:1px solid var(--ls-border); border-radius:10px; background:color-mix(in srgb,var(--ls-bg) 96%,var(--ls-border)); }
      .image-picker-block { min-width:0; }
      .image-picker-block ha-form, .lotus-image-picker { display:block; width:100%; min-width:0; }
      .image-map-preview { display:block; width:56px; height:56px; object-fit:contain; border-radius:7px; }
      .primary-check { margin-top:10px; padding-top:9px; border-top:1px solid var(--ls-border); }

      @media (max-width:980px) {
        .workspace { grid-template-columns:1fr; }
        .inspector { grid-column:1; grid-row:2; max-height:none; overflow:visible; padding-right:0; }
        .canvas-column { grid-column:1; grid-row:1; position:static; order:-1; overflow:visible; display:block; }
        .design-stage { height:auto; min-height:400px; overflow:visible; }
      }
      @media (max-width:560px) {
        .toolbar-title { display:none; }
        .form-grid,.text-style-row,.toggle-grid,.icon-style-toolbar { grid-template-columns:1fr; }
        .design-stage { padding:18px 10px; min-height:330px; }
      }
    `;

    const shell = document.createElement("div");
    shell.className = "editor-shell";

    const workspace = document.createElement("div");
    workspace.className = "workspace";
    const canvasColumn = document.createElement("div");
    canvasColumn.className = "canvas-column";
    this._renderToolbar(canvasColumn);
    const feedback = document.createElement("div");
    feedback.className = "canvas-feedback";
    feedback.textContent = lotusT(this._swapHelpText());
    canvasColumn.appendChild(feedback);
    this._renderCanvas(canvasColumn);

    const inspector = document.createElement("aside");
    inspector.className = "inspector";
    inspector.addEventListener("scroll", () => {
      if (!this._inspectorScrollRestoring) this._rememberInspectorScroll(inspector.scrollTop);
    }, { passive: true });
    if (this._frameSelected) {
      this._frameInspector(inspector);
    } else if (this._selectedRegionIds.size > 1) {
      this._multiInspector(inspector);
    } else {
      this._renderItemEditor(inspector);
    }

    workspace.append(inspector, canvasColumn);
    shell.appendChild(workspace);
    this.shadowRoot.append(style, shell);
    this._refreshHassBindings();
    this._restoreInspectorScroll(inspector, inspectorScrollSnapshot);
    this._scheduleHostDialogSinglePreview();
  }

}


// Lightweight picture-elements child dedicated to integer-driven images.
// Unlike Home Assistant state_image, it compares the live source numerically
// and can also read a configured attribute. It intentionally affects integer
// mode only; binary images continue to use the native HA image element.
class LotusDynamicImageElement extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._resolvedMedia = new Map();
    this._pendingMedia = new Set();
    this._appliedStyleKeys = new Set();
    this._holdTimer = 0;
    this._tapTimer = 0;
    this._held = false;
    this._image = document.createElement("img");
    this._image.alt = "";
    this._image.draggable = false;
    this._image.style.width = "100%";
    this._image.style.height = "100%";
    this._image.style.display = "block";
    this._image.style.objectPosition = "center center";
    this._image.style.userSelect = "none";

    // Do not add children from a custom-element constructor. Firefox follows
    // the Custom Elements construction requirements strictly and throws a
    // NotSupportedError when document.createElement() synchronously constructs
    // an element whose constructor already modified its child tree. Home
    // Assistant then receives an un-upgraded element and setConfig() is absent.
    // Attach the image once the element is connected instead.

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("pointerup", (event) => this._onPointerUp(event));
    this.addEventListener("pointercancel", () => this._cancelPointer());
    this.addEventListener("pointerleave", () => this._cancelPointer());
    this.addEventListener("dblclick", (event) => this._onDoubleClick(event));
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this._executeAction(this._config?.tap_action);
    });
  }

  connectedCallback() {
    if (this._image && this._image.parentNode !== this) {
      this.appendChild(this._image);
    }
    this._renderImage();
  }

  set hass(value) {
    lotusSetHass(value);
    this._hass = value;
    this._renderImage();
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Configuration Lotus Dynamic Image invalide");
    this._config = vscClone(config);

    for (const key of this._appliedStyleKeys) this.style.removeProperty(key);
    this._appliedStyleKeys.clear();
    for (const [key, value] of Object.entries(config.style || {})) {
      if (value === undefined || value === null) continue;
      this.style.setProperty(key, String(value));
      this._appliedStyleKeys.add(key);
    }

    this.style.boxSizing = "border-box";
    this.style.minWidth = "0";
    this.style.minHeight = "0";
    this.style.display = "block";
    this.style.overflow = "hidden";
    this.style.userSelect = "none";
    const ratioParts = String(config.aspect_ratio ?? "").split(":").map(Number);
    if (ratioParts.length === 2 && ratioParts.every((part) => Number.isFinite(part) && part > 0)) {
      this.style.aspectRatio = `${ratioParts[0]} / ${ratioParts[1]}`;
    } else {
      this.style.removeProperty("aspect-ratio");
    }
    this._image.style.objectFit = ["contain", "cover", "fill"].includes(config.image_fit)
      ? config.image_fit
      : "contain";

    const interactive = this._hasAction(config.tap_action) || this._hasAction(config.hold_action) || this._hasAction(config.double_tap_action);
    this.style.cursor = interactive ? "pointer" : "default";
    this.tabIndex = interactive ? 0 : -1;
    this._renderImage();
  }

  _rawValue() {
    const entityId = String(this._config?.entity ?? "").trim();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    if (stateObj) return stateObj.state;

    // Compatibility fallback only for external/manual configurations that may
    // still provide current_value. Lotus View Studio itself no longer writes it.
    if (Object.prototype.hasOwnProperty.call(this._config || {}, "current_value")) {
      return this._config?.current_value;
    }
    return undefined;
  }

  _selectedSource() {
    const raw = this._rawValue();
    const numeric = Number(String(raw ?? "").trim().replace(",", "."));
    if (Number.isInteger(numeric)) {
      const match = (Array.isArray(this._config?.image_values) ? this._config.image_values : [])
        .find((entry) => Number.isInteger(Number(entry?.value)) && Number(entry.value) === numeric);
      const mapped = String(match?.image ?? "").trim();
      if (mapped) return mapped;
    }
    return String(this._config?.image ?? "").trim();
  }

  _displayUrl(source) {
    const value = String(source ?? "").trim();
    if (!value) return "";
    if (!value.startsWith("media-source://")) {
      if (typeof this._hass?.hassUrl === "function" && value.startsWith("/")) return this._hass.hassUrl(value);
      return value;
    }

    const cached = this._resolvedMedia.get(value);
    if (cached) return cached;
    if (this._hass && !this._pendingMedia.has(value)) {
      this._pendingMedia.add(value);
      this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: value,
      }).then((result) => {
        const url = String(result?.url ?? "").trim();
        if (!url) return;
        this._resolvedMedia.set(
          value,
          typeof this._hass?.hassUrl === "function" ? this._hass.hassUrl(url) : url,
        );
      }).catch((error) => {
        lotusDebug("Unable to resolve dynamic Stack image", value, error);
      }).finally(() => {
        this._pendingMedia.delete(value);
        if (this.isConnected) this._renderImage();
      });
    }
    return "";
  }

  _renderImage() {
    if (!this._image || !this._config) return;
    const rawValue = this._rawValue();
    const selectedSource = this._selectedSource();
    this.dataset.lotusEntity = String(this._config?.entity ?? "");
    this.dataset.lotusState = rawValue === undefined || rawValue === null ? "" : String(rawValue);
    this.dataset.lotusSource = String(selectedSource ?? "");
    const url = this._displayUrl(selectedSource);
    if (url) {
      if (this._image.getAttribute("src") !== url) this._image.src = url;
      this._image.style.visibility = "visible";
    } else {
      this._image.removeAttribute("src");
      this._image.style.visibility = "hidden";
    }
  }

  _hasAction(config) {
    return Boolean(config && typeof config === "object" && String(config.action ?? "none") !== "none");
  }

  _clearTimer(field) {
    if (this[field]) clearTimeout(this[field]);
    this[field] = 0;
  }

  _cancelPointer() {
    this._clearTimer("_holdTimer");
  }

  _onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._held = false;
    this._clearTimer("_holdTimer");
    if (this._hasAction(this._config?.hold_action)) {
      this._holdTimer = window.setTimeout(() => {
        this._holdTimer = 0;
        this._held = true;
        this._executeAction(this._config?.hold_action);
      }, 500);
    }
  }

  _onPointerUp(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._clearTimer("_holdTimer");
    if (this._held) {
      this._held = false;
      return;
    }
    if (!this._hasAction(this._config?.tap_action)) return;
    if (this._hasAction(this._config?.double_tap_action)) {
      this._clearTimer("_tapTimer");
      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = 0;
        this._executeAction(this._config?.tap_action);
      }, 260);
    } else {
      this._executeAction(this._config?.tap_action);
    }
  }

  _onDoubleClick(event) {
    if (!this._hasAction(this._config?.double_tap_action)) return;
    event.preventDefault();
    this._clearTimer("_tapTimer");
    this._clearTimer("_holdTimer");
    this._executeAction(this._config?.double_tap_action);
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
    const config = actionConfig && typeof actionConfig === "object" ? actionConfig : { action: "none" };
    const action = String(config.action ?? "none");
    if (!this._hass || action === "none") return;
    const entityId = String(this._config?.action_entity ?? this._config?.entity ?? "").trim();

    if (action === "more-info") {
      this._fireMoreInfo(entityId);
      return;
    }
    if (action === "toggle") {
      const target = config.target && typeof config.target === "object" ? config.target : entityId ? { entity_id: entityId } : {};
      const targetEntity = target.entity_id || entityId;
      if (targetEntity) await this._hass.callService("homeassistant", "toggle", {}, { entity_id: targetEntity });
      return;
    }
    if (action === "navigate") {
      const path = String(config.navigation_path ?? "").trim();
      if (!path) return;
      window.history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
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
        : entityId
          ? { entity_id: entityId }
          : {};
      await this._hass.callService(domain, service, data, target);
    }
  }
}

// Lightweight picture-elements child for custom icon/color mappings. Home
// Assistant's state-icon can use the entity's own dynamic icon/color but does
// not expose an arbitrary user-defined state/value -> icon/color table.
class LotusDynamicIconElement extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._appliedStyleKeys = new Set();
    this._holdTimer = 0;
    this._tapTimer = 0;
    this._held = false;
    this._wrap = document.createElement("div");
    this._wrap.style.display = "grid";
    this._wrap.style.placeItems = "center";
    this._wrap.style.boxSizing = "border-box";
    this._icon = document.createElement("ha-icon");
    this._wrap.appendChild(this._icon);
    this._resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => this._applyResponsiveSize())
      : null;

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("pointerup", (event) => this._onPointerUp(event));
    this.addEventListener("pointercancel", () => this._cancelPointer());
    this.addEventListener("pointerleave", () => this._cancelPointer());
    this.addEventListener("dblclick", (event) => this._onDoubleClick(event));
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this._executeAction(this._config?.tap_action);
    });
  }

  connectedCallback() {
    if (this._wrap.parentNode !== this) this.appendChild(this._wrap);
    this._resizeObserver?.observe?.(this);
    if (this.parentElement) this._resizeObserver?.observe?.(this.parentElement);
    this._renderIcon();
    queueMicrotask(() => this._applyResponsiveSize());
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect?.();
  }

  set hass(value) {
    lotusSetHass(value);
    this._hass = value;
    this._renderIcon();
  }

  get hass() { return this._hass; }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Configuration Lotus Dynamic Icon invalide");
    this._config = vscClone(config);
    for (const key of this._appliedStyleKeys) this.style.removeProperty(key);
    this._appliedStyleKeys.clear();
    for (const [key, value] of Object.entries(config.style || {})) {
      if (value === undefined || value === null) continue;
      this.style.setProperty(key, String(value));
      this._appliedStyleKeys.add(key);
    }
    this.style.boxSizing = "border-box";
    this.style.display = "grid";
    this.style.placeItems = "center";
    this.style.overflow = "visible";
    this.style.userSelect = "none";
    const interactive = this._hasAction(config.tap_action) || this._hasAction(config.hold_action) || this._hasAction(config.double_tap_action);
    this.style.cursor = interactive ? "pointer" : "default";
    this.tabIndex = interactive ? 0 : -1;
    this._renderIcon();
    queueMicrotask(() => this._applyResponsiveSize());
  }

  _stateObj() {
    const entityId = String(this._config?.entity ?? "").trim();
    return entityId ? this._hass?.states?.[entityId] : undefined;
  }

  _rawValue() { return this._stateObj()?.state; }

  _fallbackIcon(stateObj) {
    const configured = String(this._config?.icon ?? "").trim();
    if (configured) return configured;
    const entityIcon = String(stateObj?.attributes?.icon ?? "").trim();
    if (entityIcon) return entityIcon;
    const domain = String(stateObj?.entity_id ?? this._config?.entity ?? "").split(".")[0];
    const defaults = {
      light: "mdi:lightbulb", switch: "mdi:toggle-switch", sensor: "mdi:eye",
      binary_sensor: "mdi:radiobox-marked", climate: "mdi:thermostat",
      cover: "mdi:window-shutter", lock: "mdi:lock", media_player: "mdi:play-circle",
      person: "mdi:account", device_tracker: "mdi:map-marker-account", fan: "mdi:fan",
      alarm_control_panel: "mdi:shield-home", input_boolean: "mdi:toggle-switch",
      scene: "mdi:palette", script: "mdi:script-text", automation: "mdi:robot",
    };
    return defaults[domain] || "mdi:circle-outline";
  }

  _selection() {
    const stateObj = this._stateObj();
    const fallback = {
      icon: this._fallbackIcon(stateObj),
      color: String(this._config?.color ?? "state").trim() || "state",
    };
    const mode = this._config?.mode === "integer" ? "integer" : "binary";
    const raw = this._rawValue();
    if (mode === "integer") {
      const numeric = Number(String(raw ?? "").trim().replace(",", "."));
      if (!Number.isInteger(numeric)) return fallback;
      const match = (Array.isArray(this._config?.icon_values) ? this._config.icon_values : [])
        .find((entry) => Number.isInteger(Number(entry?.value)) && Number(entry.value) === numeric);
      if (!match) return fallback;
      return {
        icon: String(match?.icon ?? "").trim() || fallback.icon,
        color: String(match?.color ?? "state").trim() || fallback.color,
      };
    }
    const entries = [
      { condition: this._config?.binary_state_1 ?? "off", icon: this._config?.binary_icon_1, color: this._config?.binary_color_1 },
      { condition: this._config?.binary_state_2 ?? "on", icon: this._config?.binary_icon_2, color: this._config?.binary_color_2 },
    ];
    const match = entries.find((entry) => vscBinaryIconConditionMatches(raw, entry.condition));
    if (!match) return fallback;
    return {
      icon: String(match.icon ?? "").trim() || fallback.icon,
      color: String(match.color ?? "state").trim() || fallback.color,
    };
  }

  _isActive(stateObj) {
    if (!stateObj) return false;
    return new Set(["on", "open", "opening", "home", "playing", "active", "heat", "cool", "heating", "cooling", "locked", "unlocked", "detected"])
      .has(String(stateObj.state).toLowerCase());
  }

  _renderIcon() {
    if (!this._config || !this._icon) return;
    const stateObj = this._stateObj();
    const selected = this._selection();
    this._icon.setAttribute("icon", selected.icon || "mdi:circle-outline");
    const cssColor = vscIconCssColor(selected.color);
    if (cssColor) {
      this._wrap.style.color = cssColor;
    } else if (this._config?.state_color !== false && this._isActive(stateObj)) {
      this._wrap.style.color = "var(--state-icon-active-color, var(--primary-color))";
    } else {
      this._wrap.style.color = "var(--state-icon-color, var(--secondary-text-color))";
    }
    const noBackground = String(this.style.getPropertyValue("--lotus-vs-visual-background") || "").trim() === "none";
    this._wrap.style.background = noBackground ? "transparent" : "var(--secondary-background-color)";
    this._wrap.style.borderRadius = noBackground ? "0" : "50%";
    this.dataset.lotusEntity = String(this._config?.entity ?? "");
    this.dataset.lotusState = this._rawValue() ?? "";
    this.dataset.lotusIcon = selected.icon ?? "";
    this.dataset.lotusColor = selected.color ?? "";
    this._applyResponsiveSize();
  }

  _overlayRect() {
    const own = this.getBoundingClientRect?.();
    let node = this.parentElement;
    let fallback = null;
    for (let i = 0; node && i < 6; i += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) continue;
      fallback = rect;
      if (!own || rect.width > own.width * 1.15 || rect.height > own.height * 1.15) return rect;
    }
    return fallback || own;
  }

  _applyResponsiveSize() {
    if (!this._config || !this._wrap || !this._icon) return;
    const percent = vscIconSize(this._config.icon_size ?? this.style.getPropertyValue("--lotus-vs-icon-size") ?? 20);
    const regionWidthPct = Number.parseFloat(String(this.style.getPropertyValue("--lotus-vs-region-width") || ""));
    const regionHeightPct = Number.parseFloat(String(this.style.getPropertyValue("--lotus-vs-region-height") || ""));
    const overlay = this._overlayRect();
    let regionWidth = Number(this.getBoundingClientRect?.().width) || 40;
    let regionHeight = Number(this.getBoundingClientRect?.().height) || 40;
    if (overlay && Number.isFinite(regionWidthPct) && regionWidthPct > 0 && Number.isFinite(regionHeightPct) && regionHeightPct > 0) {
      regionWidth = overlay.width * regionWidthPct / 100;
      regionHeight = overlay.height * regionHeightPct / 100;
    }
    const iconOnly = String(this.style.getPropertyValue("--lotus-vs-icon-only") || "").trim() === "true";
    let diameter = Math.min(regionWidth, regionHeight) * percent / 100;
    if (!iconOnly) diameter = Math.min(diameter, regionWidth * 0.42, regionHeight * 0.88);
    const size = `${Math.max(1, diameter)}px`;
    this._wrap.style.width = size;
    this._wrap.style.height = size;
    this._icon.style.setProperty("--mdc-icon-size", size);
  }

  _hasAction(config) { return Boolean(config && typeof config === "object" && String(config.action ?? "none") !== "none"); }
  _clearTimer(field) { if (this[field]) clearTimeout(this[field]); this[field] = 0; }
  _cancelPointer() { this._clearTimer("_holdTimer"); }
  _onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._held = false;
    this._clearTimer("_holdTimer");
    if (this._hasAction(this._config?.hold_action)) {
      this._holdTimer = window.setTimeout(() => {
        this._holdTimer = 0;
        this._held = true;
        this._executeAction(this._config?.hold_action);
      }, 500);
    }
  }
  _onPointerUp(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._clearTimer("_holdTimer");
    if (this._held) { this._held = false; return; }
    if (!this._hasAction(this._config?.tap_action)) return;
    if (this._hasAction(this._config?.double_tap_action)) {
      this._clearTimer("_tapTimer");
      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = 0;
        this._executeAction(this._config?.tap_action);
      }, 260);
    } else this._executeAction(this._config?.tap_action);
  }
  _onDoubleClick(event) {
    if (!this._hasAction(this._config?.double_tap_action)) return;
    event.preventDefault();
    this._clearTimer("_tapTimer");
    this._clearTimer("_holdTimer");
    this._executeAction(this._config?.double_tap_action);
  }
  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }
  async _executeAction(actionConfig) {
    const config = actionConfig && typeof actionConfig === "object" ? actionConfig : { action: "none" };
    const action = String(config.action ?? "none");
    if (!this._hass || action === "none") return;
    const entityId = String(this._config?.action_entity ?? this._config?.entity ?? "").trim();
    if (action === "more-info") { this._fireMoreInfo(entityId); return; }
    if (action === "toggle") {
      const target = config.target && typeof config.target === "object" ? config.target : entityId ? { entity_id: entityId } : {};
      const targetEntity = target.entity_id || entityId;
      if (targetEntity) await this._hass.callService("homeassistant", "toggle", {}, { entity_id: targetEntity });
      return;
    }
    if (action === "navigate") {
      const path = String(config.navigation_path ?? "").trim();
      if (!path) return;
      window.history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
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
      const target = config.target && typeof config.target === "object" ? config.target : entityId ? { entity_id: entityId } : {};
      await this._hass.callService(domain, service, data, target);
    }
  }
}

// Lightweight picture-elements child used when a Lotus cell displays a literal
// custom name. Home Assistant's native state-label requires an entity and cannot
// render static text by itself. This element intentionally implements only the
// standard Lovelace action subset used by Lotus Stack.
class LotusStaticTextElement extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => this._fitText())
      : null;
    this._holdTimer = 0;
    this._tapTimer = 0;
    this._held = false;
    this._appliedStyleKeys = new Set();

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("pointerup", (event) => this._onPointerUp(event));
    this.addEventListener("pointercancel", () => this._cancelPointer());
    this.addEventListener("pointerleave", () => this._cancelPointer());
    this.addEventListener("dblclick", (event) => this._onDoubleClick(event));
    this.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this._executeAction(this._config?.tap_action);
    });
  }

  connectedCallback() {
    this._resizeObserver?.observe(this);
    queueMicrotask(() => this._fitText());
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    this._clearTimer("_holdTimer");
    this._clearTimer("_tapTimer");
  }

  set hass(value) {
    lotusSetHass(value);
    this._hass = value;
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Configuration Lotus Static Text invalide");
    this._config = vscClone(config);

    for (const key of this._appliedStyleKeys) this.style.removeProperty(key);
    this._appliedStyleKeys.clear();
    for (const [key, value] of Object.entries(config.style || {})) {
      if (value === undefined || value === null) continue;
      this.style.setProperty(key, String(value));
      this._appliedStyleKeys.add(key);
    }

    this.textContent = String(config.text ?? "");
    this.style.boxSizing = "border-box";
    this.style.minWidth = "0";
    this.style.minHeight = "0";
    this.style.lineHeight = "1.15";
    this.style.userSelect = "none";
    const interactive = this._hasAction(config.tap_action) || this._hasAction(config.hold_action) || this._hasAction(config.double_tap_action);
    this.style.cursor = interactive ? "pointer" : "default";
    this.tabIndex = interactive ? 0 : -1;
    queueMicrotask(() => this._fitText());
  }

  _hasAction(config) {
    return Boolean(config && typeof config === "object" && String(config.action ?? "none") !== "none");
  }

  _clearTimer(field) {
    if (this[field]) clearTimeout(this[field]);
    this[field] = 0;
  }

  _cancelPointer() {
    this._clearTimer("_holdTimer");
  }

  _onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._held = false;
    this._clearTimer("_holdTimer");
    if (this._hasAction(this._config?.hold_action)) {
      this._holdTimer = window.setTimeout(() => {
        this._holdTimer = 0;
        this._held = true;
        this._executeAction(this._config?.hold_action);
      }, 500);
    }
  }

  _onPointerUp(event) {
    if (event.button !== undefined && event.button !== 0) return;
    this._clearTimer("_holdTimer");
    if (this._held) {
      this._held = false;
      return;
    }
    if (!this._hasAction(this._config?.tap_action)) return;
    if (this._hasAction(this._config?.double_tap_action)) {
      this._clearTimer("_tapTimer");
      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = 0;
        this._executeAction(this._config?.tap_action);
      }, 260);
    } else {
      this._executeAction(this._config?.tap_action);
    }
  }

  _onDoubleClick(event) {
    if (!this._hasAction(this._config?.double_tap_action)) return;
    event.preventDefault();
    this._clearTimer("_tapTimer");
    this._clearTimer("_holdTimer");
    this._executeAction(this._config?.double_tap_action);
  }

  _fitText() {
    const text = String(this._config?.text ?? "");
    if (!text) return;
    const style = this._config?.style || {};
    const configured = Number.parseFloat(style["--lotus-vs-font-max"] ?? style["font-size"] ?? 14) || 14;
    const width = Math.max(1, this.clientWidth || this.getBoundingClientRect().width || 1);
    const height = Math.max(1, this.clientHeight || this.getBoundingClientRect().height || 1);
    const byHeight = height * 0.72;
    const byWidth = width / Math.max(1, text.length * 0.56);
    const fitted = Math.max(4, Math.min(configured, byHeight, byWidth));
    this.style.fontSize = `${Math.round(fitted * 100) / 100}px`;
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
    const config = actionConfig && typeof actionConfig === "object" ? actionConfig : { action:"none" };
    const action = String(config.action ?? "none");
    if (!this._hass || action === "none") return;
    const entityId = config.entity || this._config?.entity;

    if (action === "more-info") {
      this._fireMoreInfo(entityId);
      return;
    }
    if (action === "toggle") {
      if (entityId) await this._hass.callService("homeassistant", "toggle", {}, { entity_id:entityId });
      return;
    }
    if (action === "navigate") {
      const path = String(config.navigation_path ?? "").trim();
      if (!path) return;
      window.history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
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
        : entityId
          ? { entity_id:entityId }
          : {};
      await this._hass.callService(domain, service, data, target);
    }
  }
}

if (!customElements.get("lotus-dynamic-image-element")) {
  customElements.define("lotus-dynamic-image-element", LotusDynamicImageElement);
}
if (!customElements.get("lotus-dynamic-icon-element")) {
  customElements.define("lotus-dynamic-icon-element", LotusDynamicIconElement);
}

if (!customElements.get("lotus-static-text-element")) {
  customElements.define("lotus-static-text-element", LotusStaticTextElement);
}

window.LotusVisualStack = Object.assign(window.LotusVisualStack || {}, {
  version: VISUAL_STACK_CARD_VERSION,
  schemaVersion: LOTUS_VISUAL_STACK_SCHEMA_VERSION,
  isNativeConfig: vscIsNativeVisualStackConfig,
  toNative: vscInternalToNative,
  toInternal: vscNormalizeConfig,
});

if (!customElements.get("lotus-visual-stack-editor")) {
  customElements.define("lotus-visual-stack-editor", VisualStackCardEditor);
}
if (!customElements.get("lotus-visual-stack")) {
  customElements.define("lotus-visual-stack", VisualStackCard);
}
if (!customElements.get("visual-stack-card")) {
  class LegacyVisualStackCard extends VisualStackCard {}
  customElements.define("visual-stack-card", LegacyVisualStackCard);
}

// Register again after the full component module has loaded. The tiny registry
// module also runs at bootstrap time, before the heavy Stack editor is evaluated.

const installLotusStackNativeEditorBridge = () => {
  customElements.whenDefined("hui-card-element-editor").then(() => {
    const EditorClass = customElements.get("hui-card-element-editor");
    const prototype = EditorClass?.prototype;
    if (!prototype || prototype.__lotusStackNativeEditorBridge) return;

    const originalGetConfigElement = prototype.getConfigElement;
    if (typeof originalGetConfigElement !== "function") return;

    Object.defineProperty(prototype, "__lotusStackNativeEditorBridge", {
      value: true,
      configurable: false,
      enumerable: false,
    });

    prototype.getConfigElement = async function(...args) {
      if (vscIsNativeVisualStackConfig(this.value)) {
        await customElements.whenDefined("lotus-visual-stack-editor");
        return document.createElement("lotus-visual-stack-editor");
      }
      return originalGetConfigElement.apply(this, args);
    };
  }).catch((error) => {
    lotusDebug("Unable to activate the native Home Assistant editor", error);
  });
};

installLotusStackNativeEditorBridge();
registerLotusStackCard();
