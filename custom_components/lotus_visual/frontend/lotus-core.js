import { lotusT } from "./lotus-i18n.js?v=0.9.6";

export const LOTUS_VISUAL_VERSION = "0.9.6";
export const LOTUS_LAYOUT_KEY = "lotus";
export const LOTUS_LEGACY_LAYOUT_KEYS = Object.freeze(["lotus_visual_layout"]);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const roundPct = (value) => Math.round(Number(value) * 1000) / 1000;

// Build the visible separator between two tabs when a rounded edge is filled
// with the neighbouring tab. The separator follows the rounded geometry instead
// of remaining as a straight line across the exposed underlay.
export const lotusTabEdgeBorderPath = (position, mode, width, height, radius) => {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  const r = Math.max(0, Math.min(Number(radius) || 0, w, h));
  if (!(w > 0 && h > 0 && r > 0) || !["start", "end"].includes(mode)) return "";

  const n = (value) => Math.round(value * 1000) / 1000;
  const W = n(w);
  const H = n(h);
  const R = n(r);

  switch (position) {
    case "top":
      return mode === "start"
        ? `M 0 ${H} L 0 ${R} A ${R} ${R} 0 0 1 ${R} 0`
        : `M ${n(W - R)} 0 A ${R} ${R} 0 0 1 ${W} ${R} L ${W} ${H}`;
    case "bottom":
      return mode === "start"
        ? `M 0 0 L 0 ${n(H - R)} A ${R} ${R} 0 0 0 ${R} ${H}`
        : `M ${W} 0 L ${W} ${n(H - R)} A ${R} ${R} 0 0 1 ${n(W - R)} ${H}`;
    case "left":
      return mode === "start"
        ? `M ${W} 0 L ${R} 0 A ${R} ${R} 0 0 0 0 ${R}`
        : `M ${W} ${H} L ${R} ${H} A ${R} ${R} 0 0 1 0 ${n(H - R)}`;
    case "right":
      return mode === "start"
        ? `M 0 0 L ${n(W - R)} 0 A ${R} ${R} 0 0 1 ${W} ${R}`
        : `M 0 ${H} L ${n(W - R)} ${H} A ${R} ${R} 0 0 0 ${W} ${n(H - R)}`;
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
