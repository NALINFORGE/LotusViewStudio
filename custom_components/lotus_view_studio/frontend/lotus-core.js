import { lotusT } from "./lotus-i18n.js?v=0.12.2";

export const LOTUS_VISUAL_VERSION = "0.12.2";
export const LOTUS_LAYOUT_KEY = "lotus";
export const LOTUS_LEGACY_LAYOUT_KEYS = Object.freeze(["lotus_visual_layout"]);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const roundPct = (value) => Math.round(Number(value) * 1000) / 1000;

// Build the visible separator between two tabs when a rounded edge is filled
// with the neighbouring tab. The separator follows the rounded geometry instead
// of remaining as a straight line across the exposed underlay.
export const lotusTabEdgeBorderPath = (position, mode, width, height, radius, strokeWidth = 0) => {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  const r = Math.max(0, Math.min(Number(radius) || 0, w, h));
  if (!(w > 0 && h > 0 && r > 0) || !["start", "end"].includes(mode)) return "";

  const n = (value) => Math.round(value * 1000) / 1000;
  const W = n(w);
  const H = n(h);
  const R = n(r);

  // Historical callers/tests that do not pass a stroke width keep the exact
  // legacy 0.9.7 path. Runtime and preview pass the real separator width so the
  // centre-line of the SVG stroke aligns with the centre-line of the inset
  // active-tab outline. Without this compensation, a 2 px active outline is
  // centred 1 px inside the tab while the SVG path is centred on the slot
  // edge, which creates the visible rectangular "step" at high zoom.
  const requestedStroke = Math.max(0, Number(strokeWidth) || 0);
  if (!(requestedStroke > 0)) {
    switch (position) {
      case "top":
        return mode === "start"
          ? `M 0 ${H} L 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L 0 0`
          : `M ${W} ${H} L ${W} ${R} A ${R} ${R} 0 0 0 ${n(W - R)} 0 L ${W} 0`;
      case "bottom":
        return mode === "start"
          ? `M 0 0 L 0 ${n(H - R)} A ${R} ${R} 0 0 0 ${R} ${H} L 0 ${H}`
          : `M ${W} 0 L ${W} ${n(H - R)} A ${R} ${R} 0 0 1 ${n(W - R)} ${H} L ${W} ${H}`;
      case "left":
        return mode === "start"
          ? `M ${W} 0 L ${R} 0 A ${R} ${R} 0 0 0 0 ${R} L 0 0`
          : `M ${W} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${n(H - R)} L 0 ${H}`;
      case "right":
        return mode === "start"
          ? `M 0 0 L ${n(W - R)} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} 0`
          : `M 0 ${H} L ${n(W - R)} ${H} A ${R} ${R} 0 0 0 ${W} ${n(H - R)} L ${W} ${H}`;
      default:
        return "";
    }
  }

  // SVG strokes are centred on their path, whereas the active outline is an
  // inset shadow. Move the replacement contour inward by half its thickness
  // and reduce the quarter-circle radius by the same amount. This makes the
  // straight outline, tangent and curved separator share one continuous
  // centre-line. The small end connectors bridge the same half-stroke inset
  // on the opposite outer edge and avoid a second one-pixel notch.
  const inset = n(Math.min(requestedStroke / 2, r / 2, w / 2, h / 2));
  const innerRadius = n(Math.max(0.001, r - inset));
  const WR = n(w - r);
  const HR = n(h - r);
  const Wi = n(w - inset);
  const Hi = n(h - inset);

  switch (position) {
    case "top":
      return mode === "start"
        ? `M 0 ${Hi} L ${inset} ${Hi} L ${inset} ${R} A ${innerRadius} ${innerRadius} 0 0 1 ${R} ${inset} L 0 ${inset}`
        : `M ${W} ${Hi} L ${Wi} ${Hi} L ${Wi} ${R} A ${innerRadius} ${innerRadius} 0 0 0 ${WR} ${inset} L ${W} ${inset}`;
    case "bottom":
      return mode === "start"
        ? `M 0 ${inset} L ${inset} ${inset} L ${inset} ${HR} A ${innerRadius} ${innerRadius} 0 0 0 ${R} ${Hi} L 0 ${Hi}`
        : `M ${W} ${inset} L ${Wi} ${inset} L ${Wi} ${HR} A ${innerRadius} ${innerRadius} 0 0 1 ${WR} ${Hi} L ${W} ${Hi}`;
    case "left":
      return mode === "start"
        ? `M ${Wi} 0 L ${Wi} ${inset} L ${R} ${inset} A ${innerRadius} ${innerRadius} 0 0 0 ${inset} ${R} L ${inset} 0`
        : `M ${Wi} ${H} L ${Wi} ${Hi} L ${R} ${Hi} A ${innerRadius} ${innerRadius} 0 0 1 ${inset} ${HR} L ${inset} ${H}`;
    case "right":
      return mode === "start"
        ? `M ${inset} 0 L ${inset} ${inset} L ${WR} ${inset} A ${innerRadius} ${innerRadius} 0 0 1 ${Wi} ${R} L ${Wi} 0`
        : `M ${inset} ${H} L ${inset} ${Hi} L ${WR} ${Hi} A ${innerRadius} ${innerRadius} 0 0 0 ${Wi} ${HR} L ${Wi} ${H}`;
    default:
      return "";
  }
};

export const deepClone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

export const lotusSlugify = (value, fallback = "vue") => {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
};

export const makeIconButton = ({ icon, title, className = "", disabled = false, onClick }) => {
  const localizedTitle = lotusT(title);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `lotus-icon-button ${className}`.trim();
  button.title = localizedTitle;
  button.setAttribute("aria-label", localizedTitle);
  button.disabled = Boolean(disabled);
  const haIcon = document.createElement("ha-icon");
  haIcon.setAttribute("icon", icon);
  button.appendChild(haIcon);
  if (onClick) button.addEventListener("click", onClick);
  return button;
};

export const fireEvent = (node, type, detail = {}) => {
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
};

export const lotusThemeCss = `
  :host {
    --lotus-accent: var(--primary-color, #03a9f4);
    --lotus-bg: var(--card-background-color, var(--ha-card-background, #fff));
    --lotus-fg: var(--primary-text-color, #212121);
    --lotus-muted: var(--secondary-text-color, #727272);
    --lotus-border: var(--divider-color, rgba(127,127,127,.24));
    --lotus-danger: var(--error-color, #db4437);
    color: var(--lotus-fg);
  }
  .lotus-icon-button[hidden] {
    display: none !important;
  }
  .lotus-icon-button {
    appearance: none;
    display: inline-grid;
    place-items: center;
    width: 38px;
    height: 38px;
    padding: 0;
    color: var(--lotus-fg);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: pointer;
  }
  .lotus-icon-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--lotus-accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--lotus-accent) 24%, transparent);
  }
  .lotus-icon-button.primary {
    color: var(--text-primary-color, #fff);
    background: var(--lotus-accent);
  }
  .lotus-icon-button.danger:hover:not(:disabled) {
    color: var(--lotus-danger);
    background: color-mix(in srgb, var(--lotus-danger) 10%, transparent);
  }
  .lotus-icon-button:disabled { opacity: .35; cursor: default; }
  .lotus-icon-button ha-icon { --mdc-icon-size: 22px; }
`;
