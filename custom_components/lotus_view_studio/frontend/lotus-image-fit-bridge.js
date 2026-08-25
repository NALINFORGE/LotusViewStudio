import { LOTUS_PACKAGE_VERSION } from "./lotus-version.js";
/*
 * Lotus View Studio native picture-elements image-fit bridge
 *
 * Home Assistant's hui-image component supports fitMode (cover/contain/fill),
 * but hui-image-element currently does not forward such a property to it.
 * Lotus Stack stores the requested mode on the native image element as
 * --lotus-vs-image-fit.  This narrowly scoped bridge forwards that marker to
 * the child hui-image so saved picture-elements cards render like the Lotus
 * visual editor.  Image elements without the Lotus marker are untouched.
 */

const PATCHED = Symbol.for("lotusVisual.imageFitBridge.v072");
const VALID_FITS = new Set(["contain", "cover", "fill"]);

function requestedFit(host) {
  if (!host?.style) return null;
  const marker = String(host.style.getPropertyValue("--lotus-vs-image-fit") || "").trim();
  if (VALID_FITS.has(marker)) return marker;
  return null;
}

function applyFit(host) {
  const fit = requestedFit(host);
  if (!fit) return;
  const image = host.shadowRoot?.querySelector("hui-image");
  if (!image) return;
  if (image.fitMode !== fit) image.fitMode = fit;
}

function install(ImageElementClass) {
  const proto = ImageElementClass?.prototype;
  if (!proto || proto[PATCHED]) return;

  const originalUpdated = proto.updated;
  proto.updated = function lotusImageElementUpdated(changedProperties) {
    if (typeof originalUpdated === "function") {
      originalUpdated.call(this, changedProperties);
    }
    queueMicrotask(() => applyFit(this));
  };

  const originalSetConfig = proto.setConfig;
  if (typeof originalSetConfig === "function") {
    proto.setConfig = function lotusImageElementSetConfig(config) {
      const result = originalSetConfig.call(this, config);
      Promise.resolve(this.updateComplete).then(() => applyFit(this));
      return result;
    };
  }

  Object.defineProperty(proto, PATCHED, { value: true, configurable: false });
}

const existing = customElements.get("hui-image-element");
if (existing) {
  install(existing);
} else {
  customElements.whenDefined("hui-image-element").then(() => {
    install(customElements.get("hui-image-element"));
  });
}

window.LotusVisual = Object.assign(window.LotusVisual || {}, {
  imageFitBridge: LOTUS_PACKAGE_VERSION,
});
