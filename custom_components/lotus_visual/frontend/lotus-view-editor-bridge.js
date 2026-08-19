import { LOTUS_VISUAL_VERSION } from "./lotus-core.js?v=0.9.6";
import { lotusSetHass, lotusT } from "./lotus-i18n.js?v=0.9.6";

const LOTUS_VIEW_TYPE = "custom:lotus-visual-layout";
const LOTUS_VIEW_LABEL = "Lotus Visual";
const LOTUS_VIEW_META_KEY = "lotus_visual";
const LOTUS_VIEW_FILL_KEY = "fill_color";
const LOTUS_VIEW_LEGACY_FILL_KEY = "lotus_fill_color";
const SELECTOR_PATCHED = Symbol("lotusVisualSelectorPatched");
const BACKGROUND_EDITOR_PATCHED = Symbol.for("lotusVisualBackgroundEditorPatched.v085");
const LOTUS_FILL_FIELD_ID = "lotus-visual-fill-color-field-v085";

const NATIVE_VIEW_TYPES = new Set(["sections", "masonry", "sidebar", "panel"]);

const optionValue = (option) =>
  typeof option === "object" && option !== null ? String(option.value ?? "") : String(option ?? "");

const isViewTypeSelector = (selector) => {
  const options = selector?.select?.options;
  if (!Array.isArray(options)) return false;

  const values = new Set(options.map(optionValue));
  return [...NATIVE_VIEW_TYPES].every((value) => values.has(value));
};

const withLotusOption = (selector) => {
  if (!isViewTypeSelector(selector)) return selector;

  const options = selector.select.options;
  if (options.some((option) => optionValue(option) === LOTUS_VIEW_TYPE)) return selector;

  const lotusOption = { value: LOTUS_VIEW_TYPE, label: LOTUS_VIEW_LABEL };
  const nextOptions = [...options];
  const sectionsIndex = nextOptions.findIndex((option) => optionValue(option) === "sections");
  nextOptions.splice(sectionsIndex >= 0 ? sectionsIndex + 1 : 0, 0, lotusOption);

  return {
    ...selector,
    select: {
      ...selector.select,
      options: nextOptions,
    },
  };
};

const visitShadowRoots = (root, callback) => {
  if (!root?.querySelectorAll) return;
  callback(root);
  for (const node of root.querySelectorAll("*")) {
    if (node.shadowRoot) visitShadowRoots(node.shadowRoot, callback);
  }
};

const patchSelectSelector = async () => {
  await customElements.whenDefined("ha-selector-select");

  const SelectSelector = customElements.get("ha-selector-select");
  const prototype = SelectSelector?.prototype;
  if (!prototype || prototype[SELECTOR_PATCHED]) return;

  const originalRender = prototype.render;
  if (typeof originalRender !== "function") {
    throw new Error("ha-selector-select.render() indisponible");
  }

  prototype.render = function (...args) {
    if (isViewTypeSelector(this.selector)) {
      const augmented = withLotusOption(this.selector);
      if (augmented !== this.selector) {
        // `selector` is a public reactive property of ha-selector-select. By
        // augmenting the options here, Home Assistant keeps ownership of the
        // radio UI, value-changed event, validation and save workflow.
        this.selector = augmented;
      }
    }
    return originalRender.apply(this, args);
  };

  Object.defineProperty(prototype, SELECTOR_PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
  });

  // Refresh selectors that may already exist in an opened dialog.
  visitShadowRoots(document, (root) => {
    for (const selector of root.querySelectorAll("ha-selector-select")) {
      if (isViewTypeSelector(selector.selector)) {
        const augmented = withLotusOption(selector.selector);
        if (augmented !== selector.selector) selector.selector = augmented;
        selector.requestUpdate?.();
      }
    }
  });

  window.LotusVisual = Object.assign(window.LotusVisual || {}, {
    viewSelectorBridge: "ha-selector-select",
  });
};

const fillColorLabel = (hass) => {
  if (hass) lotusSetHass(hass);
  return lotusT("Couleur de fond de la vue");
};

const fillColorHelper = (hass) => {
  if (hass) lotusSetHass(hass);
  return lotusT("Facultative. Elle s’affiche derrière l’image d’arrière-plan et remplit aussi toute la vue lorsqu’aucune image n’est définie.");
};

const editorViewConfig = (editor) => {
  const direct = editor?.config && typeof editor.config === "object" ? editor.config : undefined;
  if (direct?.type === LOTUS_VIEW_TYPE) return direct;

  // Some Home Assistant builds expose a reduced config object to the
  // background editor. In that case the owning view dialog still carries the
  // complete view config, including the custom view type.
  const host = editor?.getRootNode?.()?.host;
  if (host?._config && typeof host._config === "object" && host._config.type === LOTUS_VIEW_TYPE) {
    return host._config;
  }
  return direct;
};

const owningViewDialog = (editor) => {
  let node = editor;
  for (let depth = 0; depth < 8 && node; depth += 1) {
    if (node.localName === "hui-dialog-edit-view") return node;
    const root = node.getRootNode?.();
    const host = root?.host;
    if (!host || host === node) break;
    node = host;
  }
  return undefined;
};

const isLotusBackgroundEditor = (editor) => editorViewConfig(editor)?.type === LOTUS_VIEW_TYPE;

const currentFillColor = (editor) => {
  const config = editorViewConfig(editor);
  const meta = config?.[LOTUS_VIEW_META_KEY];
  const directValue = meta && typeof meta === "object" && !Array.isArray(meta)
    ? meta[LOTUS_VIEW_FILL_KEY]
    : undefined;
  if (typeof directValue === "string" && directValue.trim()) return directValue.trim();

  // Read the 0.4.20-0.4.25 experimental location for seamless migration.
  const background = config?.background;
  const legacyValue = background && typeof background === "object" && !Array.isArray(background)
    ? background[LOTUS_VIEW_LEGACY_FILL_KEY]
    : undefined;
  return typeof legacyValue === "string" && legacyValue.trim() ? legacyValue.trim() : undefined;
};

const writeFillColor = (editor, value) => {
  const config = editorViewConfig(editor);
  if (!config || config.type !== LOTUS_VIEW_TYPE) return;

  const normalized = typeof value === "string" ? value.trim() : "";
  const nextConfig = { ...config };
  const existingMeta = config[LOTUS_VIEW_META_KEY];
  const meta = existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
    ? { ...existingMeta }
    : {};

  if (!normalized || normalized === "none") delete meta[LOTUS_VIEW_FILL_KEY];
  else meta[LOTUS_VIEW_FILL_KEY] = normalized;

  if (Object.keys(meta).length) nextConfig[LOTUS_VIEW_META_KEY] = meta;
  else delete nextConfig[LOTUS_VIEW_META_KEY];

  // Migrate the old experimental key out of Home Assistant's native
  // background object. Keeping Lotus metadata outside `background` prevents
  // the native background editor from normalizing/dropping it on save.
  const background = config.background;
  if (background && typeof background === "object" && !Array.isArray(background)
      && Object.prototype.hasOwnProperty.call(background, LOTUS_VIEW_LEGACY_FILL_KEY)) {
    const migratedBackground = { ...background };
    delete migratedBackground[LOTUS_VIEW_LEGACY_FILL_KEY];
    nextConfig.background = migratedBackground;
  }

  // Update the public child property immediately so a Lit re-render cannot
  // flash back to the previous value before the owning view dialog reacts.
  try { editor.config = nextConfig; } catch (_error) { /* defensive */ }

  editor.dispatchEvent(new CustomEvent("background-config-changed", {
    bubbles: true,
    composed: true,
    detail: { config: nextConfig },
  }));

  // In Home Assistant 2026.8 the public background-config-changed contract is
  // sufficient. Keep a narrowly guarded fallback for builds where the custom
  // field is mounted after the dialog listener boundary and the event does not
  // mark the view dirty. This runs only when the owning dialog still exposes
  // the old config after the event has propagated.
  queueMicrotask(() => {
    const dialog = owningViewDialog(editor);
    if (!dialog || !dialog._config || dialog._config.type !== LOTUS_VIEW_TYPE) return;
    const currentMeta = dialog._config?.[LOTUS_VIEW_META_KEY];
    const currentValue = currentMeta && typeof currentMeta === "object" && !Array.isArray(currentMeta)
      ? currentMeta[LOTUS_VIEW_FILL_KEY]
      : undefined;
    const expectedValue = normalized && normalized !== "none" ? normalized : undefined;
    if (currentValue === expectedValue) return;
    try {
      dialog._config = nextConfig;
      dialog._updateDirtyState?.(nextConfig);
      dialog.requestUpdate?.();
    } catch (_error) {
      // Defensive only: the normal Home Assistant event contract remains the
      // primary path and no private API is required when it succeeds.
    }
  });
};

const createFillForm = (editor) => {
  const wrapper = document.createElement("div");
  wrapper.id = LOTUS_FILL_FIELD_ID;
  wrapper.style.display = "block";
  wrapper.style.margin = "20px 0 4px";

  const form = document.createElement("ha-form");
  form.dataset.lotusFillForm = "true";
  form.schema = [
    {
      name: LOTUS_VIEW_FILL_KEY,
      selector: {
        ui_color: {
          include_none: true,
          include_state: false,
        },
      },
    },
  ];
  form.computeLabel = (schema) =>
    schema?.name === LOTUS_VIEW_FILL_KEY ? fillColorLabel(editor.hass) : String(schema?.name || "");
  form.computeHelper = (schema) =>
    schema?.name === LOTUS_VIEW_FILL_KEY ? fillColorHelper(editor.hass) : undefined;

  form.addEventListener("value-changed", (event) => {
    event.stopPropagation();
    writeFillColor(editor, event.detail?.value?.[LOTUS_VIEW_FILL_KEY]);
  });

  wrapper.appendChild(form);
  return wrapper;
};

const ensureFillField = (editor) => {
  if (!editor?.isConnected) return;
  const root = editor.renderRoot || editor.shadowRoot;
  if (!root?.querySelector) return;

  let wrapper = root.querySelector(`#${LOTUS_FILL_FIELD_ID}`);
  if (!isLotusBackgroundEditor(editor)) {
    wrapper?.remove();
    return;
  }

  if (!wrapper) {
    wrapper = createFillForm(editor);
    const nativeForm = root.querySelector("ha-form");
    if (nativeForm?.parentNode) {
      nativeForm.insertAdjacentElement("afterend", wrapper);
    } else {
      root.appendChild(wrapper);
    }
  }

  const form = wrapper.querySelector("ha-form");
  if (!form) return;
  form.hass = editor.hass;
  form.data = { [LOTUS_VIEW_FILL_KEY]: currentFillColor(editor) ?? "none" };
  form.requestUpdate?.();
};

const scheduleFillField = (editor) => {
  queueMicrotask(() => ensureFillField(editor));
  requestAnimationFrame(() => ensureFillField(editor));
};

const patchBackgroundEditor = async () => {
  await customElements.whenDefined("hui-view-background-editor");
  await customElements.whenDefined("ha-form");

  const EditorClass = customElements.get("hui-view-background-editor");
  const prototype = EditorClass?.prototype;
  if (!prototype || prototype[BACKGROUND_EDITOR_PATCHED]) return;

  const originalUpdated = prototype.updated;
  prototype.updated = function (...args) {
    const result = typeof originalUpdated === "function"
      ? originalUpdated.apply(this, args)
      : undefined;
    scheduleFillField(this);
    return result;
  };

  const originalConnected = prototype.connectedCallback;
  prototype.connectedCallback = function (...args) {
    const result = typeof originalConnected === "function"
      ? originalConnected.apply(this, args)
      : undefined;
    scheduleFillField(this);
    return result;
  };

  Object.defineProperty(prototype, BACKGROUND_EDITOR_PATCHED, {
    value: true,
    configurable: false,
    enumerable: false,
  });

  // The editor can already be open when Lotus Visual finishes loading.
  visitShadowRoots(document, (root) => {
    for (const editor of root.querySelectorAll("hui-view-background-editor")) {
      scheduleFillField(editor);
    }
  });

  window.LotusVisual = Object.assign(window.LotusVisual || {}, {
    viewBackgroundFillBridge: "hui-view-background-editor/ha-form/ui_color",
  });
};

Promise.all([patchSelectSelector(), patchBackgroundEditor()]).then(() => {
  console.info(
    `%c LOTUS VISUAL VIEW BRIDGE %c v${LOTUS_VISUAL_VERSION} `,
    "color:white;background:#00897b;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px;",
    "color:#00897b;background:#e0f2f1;font-weight:700;padding:2px 6px;border-radius:0 4px 4px 0;",
  );
}).catch((error) => {
  console.error("[Lotus Visual] Impossible d'installer les extensions de l'éditeur de vue.", error);
});

export { LOTUS_VIEW_TYPE };
