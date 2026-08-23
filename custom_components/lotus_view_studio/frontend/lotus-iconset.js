/* Lotus View Studio custom icon set.
 * Registered globally so the Home Assistant sidebar can use the Lotus brand
 * mark without requiring an external custom-icons integration.
 */

const LOTUS_ICONSET_VERSION = "0.12.2";

// 24x24 monochrome sidebar icon: a simplified Lotus inside a window frame.
// It follows currentColor so Home Assistant controls selected/unselected colors.
const LOTUS_ICONS = Object.freeze({
  lotus: {
    // Sidebar-specific mark derived from the user-approved Lotus-in-window icon.
    // The outer frame is deliberately separated from the five petals so the
    // symbol remains readable at Home Assistant's 24 px sidebar size.
    path: "M4 2.5H20Q21.5 2.5 21.5 4V20Q21.5 21.5 20 21.5H4Q2.5 21.5 2.5 20V4Q2.5 2.5 4 2.5ZM4.1 4V20H19.9V4H4.1ZM12 6.5C10.5 8.1 9.8 9.9 10 11.7C10.2 13.4 11 14.6 12 15.4C13 14.6 13.8 13.4 14 11.7C14.2 9.9 13.5 8.1 12 6.5ZM9.6 9.5C8.1 9.7 7 10.4 6.5 11.5C6 12.7 6.3 13.9 7.3 14.9C8.2 15.8 9.3 16.1 10.5 15.8C9.4 14.7 8.8 13.4 8.7 12C8.6 11 8.9 10.1 9.6 9.5ZM14.4 9.5C15.9 9.7 17 10.4 17.5 11.5C18 12.7 17.7 13.9 16.7 14.9C15.8 15.8 14.7 16.1 13.5 15.8C14.6 14.7 15.2 13.4 15.3 12C15.4 11 15.1 10.1 14.4 9.5ZM6 12.4C4.9 12.8 4.3 13.5 4.2 14.4C4.2 15.5 5 16.5 6.1 17.1C7.4 17.8 8.7 17.7 9.9 17.2C8.3 16.6 7.2 15.7 6.5 14.5C6.1 13.8 5.9 13.1 6 12.4ZM18 12.4C19.1 12.8 19.7 13.5 19.8 14.4C19.8 15.5 19 16.5 17.9 17.1C16.6 17.8 15.3 17.7 14.1 17.2C15.7 16.6 16.8 15.7 17.5 14.5C17.9 13.8 18.1 13.1 18 12.4Z",
    keywords: ["lotus", "window", "dashboard", "lotus visual"],
  },
  "tab-move": {
    // A tab/window with an outbound arrow. This is intentionally owned by the
    // Lotus iconset because mdi:tab-arrow-right is not available in every HA
    // frontend version supported by the addon.
    path: "M3 4H9L11 6H21V13H19V8H10L8 6H5V18H11V20H3V4ZM13 11H17V8L22 13L17 18V15H13V11Z",
    keywords: ["tab", "move", "assign", "onglet", "déplacer"],
  },
});

async function getIcon(name) {
  const normalized = String(name || "").trim().toLowerCase().replaceAll("_", "-");
  const icon = LOTUS_ICONS[normalized];
  return icon ? { path: icon.path } : "";
}

async function getIconList() {
  return Object.entries(LOTUS_ICONS).map(([name, icon]) => ({
    name,
    keywords: icon.keywords,
  }));
}

window.customIcons = window.customIcons || {};
window.customIcons.lotus = { getIcon, getIconList };
window.customIconsets = window.customIconsets || {};
window.customIconsets.lotus = getIcon;

window.LotusVisualIconset = Object.assign(window.LotusVisualIconset || {}, {
  version: LOTUS_ICONSET_VERSION,
  prefix: "lotus",
  icon: "lotus:lotus",
});

// Older and newer HA frontends have used slightly different custom-icon
// refresh paths. These harmless events make already-rendered <ha-icon>
// instances reconsider the newly registered icon set after a hard reload.
window.dispatchEvent(new CustomEvent("lotus-iconset-ready", {
  detail: { prefix: "lotus", version: LOTUS_ICONSET_VERSION },
}));
