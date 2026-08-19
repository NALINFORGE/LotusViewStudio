// Bootstrap version is intentionally local: the first import must itself be
// cache-busted. A static import of lotus-core.js could otherwise survive an
// integration upgrade in the browser ESM module map.
const LOTUS_VISUAL_BOOTSTRAP_VERSION = "0.9.6";
await import(`./lotus-iconset.js?v=${LOTUS_VISUAL_BOOTSTRAP_VERSION}`);
const { LOTUS_VISUAL_VERSION } = await import(`./lotus-core.js?v=${LOTUS_VISUAL_BOOTSTRAP_VERSION}`);

// Load integration bridges with the package version in the URL. This matters
// especially for direct-create compatibility fixes: an old cached bridge must
// never survive an integration upgrade while the main module is new.
await import(`./lotus-card-registry.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-card-picker-bridge.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-direct-create-bridge.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-edit-dialog-bridge.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-view-editor-bridge.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-image-fit-bridge.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-icon-size-bridge.js?v=${LOTUS_VISUAL_VERSION}`);

// Components may already be loaded as legacy Lovelace resources. Avoid
// redefining custom elements during migration; users can then remove the old
// resources. Always execute Stack and Slide so their Home Assistant card-picker
// registrations are repaired even when a legacy element was loaded first.
await import(`./lotus-visual-stack.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-slide-card.js?v=${LOTUS_VISUAL_VERSION}`);
await import(`./lotus-digicode-card.js?v=${LOTUS_VISUAL_VERSION}`);
if (!customElements.get("lotus-layers-card")) {
  await import(`./lotus-layers.js?v=${LOTUS_VISUAL_VERSION}`);
}
if (!customElements.get("lotus-visual-layout")) {
  await import(`./lotus-visual-layout.js?v=${LOTUS_VISUAL_VERSION}`);
}
if (!customElements.get("lotus-visual-manager")) {
  await import(`./lotus-visual-manager.js?v=${LOTUS_VISUAL_VERSION}`);
}

window.LotusVisual = Object.assign(window.LotusVisual || {}, {
  version: LOTUS_VISUAL_VERSION,
  layoutType: "custom:lotus-visual-layout",
  layerType: "custom:lotus-layers-card",
  stackType: "custom:lotus-visual-stack",
  slideType: "custom:lotus-slide-card",
  digicodeType: "custom:lotus-digicode-card",
});

console.info(
  `%c LOTUS VISUAL %c v${LOTUS_VISUAL_VERSION} `,
  "color:white;background:#00897b;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px;",
  "color:#00897b;background:#e0f2f1;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0;",
);
