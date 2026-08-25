await import("./lotus-iconset.js");
const { LOTUS_VISUAL_VERSION } = await import("./lotus-core.js");

// Load integration bridges with the package version in the URL. This matters
// especially for direct-create compatibility fixes: an old cached bridge must
// never survive an integration upgrade while the main module is new.
await import("./lotus-card-registry.js");
await import("./lotus-card-picker-bridge.js");
await import("./lotus-direct-create-bridge.js");
await import("./lotus-edit-dialog-bridge.js");
await import("./lotus-view-editor-bridge.js");
await import("./lotus-image-fit-bridge.js");
await import("./lotus-icon-size-bridge.js");

// Components may already be loaded as legacy Lovelace resources. Avoid
// redefining custom elements during migration; users can then remove the old
// resources. Always execute Stack and Slide so their Home Assistant card-picker
// registrations are repaired even when a legacy element was loaded first.
await import("./lotus-visual-stack.js");
await import("./lotus-slide-card.js");
// Load the stable Lotus Slide runtime and its visual editor refinements.
await import("./lotus-slide-editor.js");
await import("./lotus-slide-editor-direct.js");
await import("./lotus-slide-editor-direct-fix.js");
await import("./lotus-digicode-card.js");
if (!customElements.get("lotus-layers-card")) {
  await import("./lotus-layers.js");
}
if (!customElements.get("lotus-visual-layout")) {
  await import("./lotus-visual-layout.js");
}
if (!customElements.get("lotus-visual-manager")) {
  await import("./lotus-visual-manager.js");
}

const lotusViewStudioApi = {
  version: LOTUS_VISUAL_VERSION,
  layoutType: "custom:lotus-visual-layout",
  layerType: "custom:lotus-layers-card",
  stackType: "custom:lotus-visual-stack",
  slideType: "custom:lotus-slide-card",
  digicodeType: "custom:lotus-digicode-card",
};
window.LotusViewStudio = Object.assign(window.LotusViewStudio || {}, lotusViewStudioApi);
// Backward-compatible global namespace for existing scripts and dashboards.
window.LotusVisual = Object.assign(window.LotusVisual || {}, lotusViewStudioApi);