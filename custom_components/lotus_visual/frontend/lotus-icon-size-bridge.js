/*
 * Lotus Visual native picture-elements responsive bridge — v0.9.6
 *
 * Lotus Stack is deliberately saved as a native Home Assistant picture-elements
 * card. Native state-icon/state-label elements do not know the logical Lotus
 * cell size, so this bridge uses the metadata written into their styles to
 * shrink icons and text when the rendered dashboard becomes smaller.
 */

const ICON_PATCHED = Symbol.for("lotusVisual.iconSizeBridge.v0812");
const LABEL_PATCHED = Symbol.for("lotusVisual.labelSizeBridge.v0812");
const OBSERVER = Symbol.for("lotusVisual.responsiveBridge.observer.v0812");
const MIN_PERCENT = 1;
const MAX_PERCENT = 100;

function numberMarker(host, name, fallback = 0) {
  const raw = Number.parseFloat(String(host?.style?.getPropertyValue(name) || ""));
  return Number.isFinite(raw) ? raw : fallback;
}

function overlayRect(host) {
  const own = host?.getBoundingClientRect?.();
  let node = host?.parentElement;
  let fallback = null;
  for (let i = 0; node && i < 6; i += 1, node = node.parentElement) {
    const rect = node.getBoundingClientRect?.();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) continue;
    fallback = rect;
    if (!own || rect.width > own.width * 1.15 || rect.height > own.height * 1.15) return rect;
  }
  return fallback || own;
}

function regionSize(host) {
  const regionWidthPct = numberMarker(host, "--lotus-vs-region-width", 0);
  const regionHeightPct = numberMarker(host, "--lotus-vs-region-height", 0);
  const overlay = overlayRect(host);
  if (overlay && regionWidthPct > 0 && regionHeightPct > 0) {
    return {
      width: overlay.width * regionWidthPct / 100,
      height: overlay.height * regionHeightPct / 100,
    };
  }
  const rect = host?.getBoundingClientRect?.();
  return { width: Number(rect?.width) || 0, height: Number(rect?.height) || 0 };
}

function requestedIcon(host) {
  if (!host?.style) return null;
  const marker = String(host.style.getPropertyValue("--lotus-vs") || "").trim();
  if (!/:visual$/.test(marker)) return null;
  const raw = numberMarker(host, "--lotus-vs-icon-size", 20);
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, raw || 20));
}

function applyIconSize(host) {
  const percent = requestedIcon(host);
  if (percent === null) return;
  const region = regionSize(host);
  if (!(region.width > 0) || !(region.height > 0)) return;

  const iconOnly = String(host.style.getPropertyValue("--lotus-vs-icon-only") || "").trim() === "true";
  let diameter = Math.min(region.width, region.height) * percent / 100;
  if (!iconOnly) diameter = Math.min(diameter, region.width * 0.42, region.height * 0.88);
  const sizePx = Math.max(1, diameter);
  const size = `${sizePx}px`;

  if (iconOnly) {
    host.style.setProperty("display", "grid", "important");
    host.style.setProperty("place-items", "center", "important");
  }
  host.style.setProperty("--mdc-icon-size", size, "important");

  const badge = host.shadowRoot?.querySelector("state-badge");
  if (!badge) return;
  badge.style.setProperty("width", size, "important");
  badge.style.setProperty("height", size, "important");
  badge.style.setProperty("display", "grid", "important");
  badge.style.setProperty("place-items", "center", "important");
  badge.style.setProperty("--mdc-icon-size", size, "important");

  const visualBackground = String(host.style.getPropertyValue("--lotus-vs-visual-background") || "").trim();
  if (visualBackground === "none") {
    badge.style.setProperty("background", "transparent", "important");
  } else {
    badge.style.setProperty("background", "var(--secondary-background-color)", "important");
    badge.style.setProperty("border-radius", "50%", "important");
  }

  const stateIcon = badge.shadowRoot?.querySelector("ha-state-icon");
  if (stateIcon) stateIcon.style.setProperty("--mdc-icon-size", size, "important");
}

function visibleText(host) {
  const root = host?.shadowRoot;
  if (!root) return "";
  const leaves = [...root.querySelectorAll("*")]
    .filter((node) => node.children.length === 0)
    .map((node) => String(node.textContent || "").trim())
    .filter(Boolean);
  if (leaves.length) return leaves.sort((a, b) => b.length - a.length)[0];
  return String(root.textContent || "").trim();
}

function applyLabelSize(host) {
  if (!host?.style) return;
  const marker = String(host.style.getPropertyValue("--lotus-vs") || "").trim();
  if (!/:(name|state)$/.test(marker)) return;

  const maxSize = Math.max(1, numberMarker(host, "--lotus-vs-font-max", marker.endsWith(":name") ? 14 : 12));
  const lineCount = Math.max(1, numberMarker(host, "--lotus-vs-text-lines", 1));
  const hasVisual = String(host.style.getPropertyValue("--lotus-vs-has-visual") || "").trim() === "true";
  const region = regionSize(host);
  if (!(region.width > 0) || !(region.height > 0)) return;

  const availableWidth = Math.max(1, region.width * (hasVisual ? 0.60 : 0.92));
  const availableHeight = Math.max(1, region.height / lineCount * 0.90);
  const text = visibleText(host);
  // 0.58em is a conservative average glyph width for HA UI fonts. It makes
  // long labels shrink early enough to stay complete instead of ellipsizing.
  const glyphs = Math.max(1, [...text].length || 1);
  const byWidth = availableWidth / (glyphs * 0.58);
  const byHeight = availableHeight / 1.18;
  const fontSize = Math.max(1, Math.min(maxSize, byWidth, byHeight));
  host.style.setProperty("font-size", `${fontSize}px`, "important");
  host.style.setProperty("line-height", "1.15", "important");
  host.style.setProperty("text-overflow", "clip", "important");
}

function schedule(host, apply) {
  queueMicrotask(() => apply(host));
  window.requestAnimationFrame(() => apply(host));
  Promise.resolve(host?.updateComplete).then(() => apply(host));
}

function ensureObserver(host, apply) {
  if (host?.[OBSERVER] || typeof ResizeObserver !== "function") return;
  const observer = new ResizeObserver(() => apply(host));
  observer.observe(host);
  let parent = host.parentElement;
  if (parent) observer.observe(parent);
  Object.defineProperty(host, OBSERVER, { value: observer, configurable: true });
}

function patchLifecycle(proto, patchSymbol, apply) {
  if (!proto || proto[patchSymbol]) return;

  const originalConnected = proto.connectedCallback;
  proto.connectedCallback = function lotusResponsiveConnected() {
    const result = typeof originalConnected === "function" ? originalConnected.call(this) : undefined;
    ensureObserver(this, apply);
    schedule(this, apply);
    return result;
  };

  const originalDisconnected = proto.disconnectedCallback;
  proto.disconnectedCallback = function lotusResponsiveDisconnected() {
    this[OBSERVER]?.disconnect?.();
    try { delete this[OBSERVER]; } catch (_) { /* non-critical */ }
    return typeof originalDisconnected === "function" ? originalDisconnected.call(this) : undefined;
  };

  const originalUpdated = proto.updated;
  proto.updated = function lotusResponsiveUpdated(changedProperties) {
    if (typeof originalUpdated === "function") originalUpdated.call(this, changedProperties);
    ensureObserver(this, apply);
    schedule(this, apply);
  };

  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function lotusResponsiveSetConfig(config) {
      const result = originalSetConfig.call(this, config);
      ensureObserver(this, apply);
      schedule(this, apply);
      return result;
    };
  }

  Object.defineProperty(proto, patchSymbol, { value: true, configurable: false });
}

function installIconBridge(klass) {
  patchLifecycle(klass?.prototype, ICON_PATCHED, applyIconSize);
}

function installLabelBridge(klass) {
  patchLifecycle(klass?.prototype, LABEL_PATCHED, applyLabelSize);
}

const iconClass = customElements.get("hui-state-icon-element");
if (iconClass) installIconBridge(iconClass);
else customElements.whenDefined("hui-state-icon-element").then(() => installIconBridge(customElements.get("hui-state-icon-element")));

const labelClass = customElements.get("hui-state-label-element");
if (labelClass) installLabelBridge(labelClass);
else customElements.whenDefined("hui-state-label-element").then(() => installLabelBridge(customElements.get("hui-state-label-element")));

window.LotusVisual = Object.assign(window.LotusVisual || {}, {
  iconSizeBridge: "0.9.6",
  stackResponsiveBridge: "0.9.6",
});
