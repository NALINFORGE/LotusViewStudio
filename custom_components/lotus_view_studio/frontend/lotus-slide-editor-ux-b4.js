/*
 * Lotus Slide UX enhancements — local 0.13.0b4 test candidate.
 *
 * This module deliberately patches only Lotus Slide/Card editor behaviour so
 * the candidate can be tested locally before any GitHub publication.
 */

import { lotusT } from "./lotus-i18n.js?v=0.13.0b4";

const MAX_SIDE_VISUAL_VALUES = 20;
const CHEVRON_PREFIX = "mdi:chevron-double-";
const DEFERRED_SIZE_KEYS = new Set([
  "width",
  "height",
  "thickness",
  "size",
  "border_width",
  "radius",
  "bevel",
  "font_size",
]);

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const clampValue = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const isChevron = (value) => String(value || "").startsWith(CHEVRON_PREFIX);
const isDeferredSizePath = (path) => DEFERRED_SIZE_KEYS.has(String(path ?? "").split(".").pop());

const oppositeDirection = (direction) => ({ up: "down", down: "up", left: "right", right: "left" }[direction] || direction);
const directionalThumbIcon = (config, side) => {
  let towardEnd;
  if (config?.orientation === "vertical") towardEnd = config?.reverse ? "down" : "up";
  else towardEnd = config?.reverse ? "left" : "right";
  const direction = side === "end" ? oppositeDirection(towardEnd) : towardEnd;
  return `${CHEVRON_PREFIX}${direction}`;
};

const sideHasPotentialVisual = (conf) => {
  if (!conf) return false;
  if (conf.visual_type === "image") {
    if (String(conf.image ?? "").trim()) return true;
    if (String(conf.binary_image_1 ?? "").trim()) return true;
    if (String(conf.binary_image_2 ?? "").trim()) return true;
    return Array.isArray(conf.values) && conf.values.some((entry) => String(entry?.image ?? "").trim());
  }
  if (String(conf.icon ?? "").trim()) return true;
  if (String(conf.binary_icon_1 ?? "").trim()) return true;
  if (String(conf.binary_icon_2 ?? "").trim()) return true;
  return Array.isArray(conf.values) && conf.values.some((entry) => String(entry?.icon ?? "").trim());
};

const clearSideVisual = (side) => {
  if (!side) return;
  side.visual_type = "icon";
  side.icon = "";
  side.image = "";
  side.state_entity = "";
  side.state_mode = "static";
  side.binary_icon_1 = "";
  side.binary_icon_2 = "";
  side.binary_image_1 = "";
  side.binary_image_2 = "";
  side.value_count = 0;
  side.values = [];
  if (side.background && typeof side.background === "object") side.background.enabled = false;
};

const thumbStateFromRaw = (rawConfig, normalizedConfig = undefined) => {
  const rawThumb = rawConfig?.icons?.thumb && typeof rawConfig.icons.thumb === "object"
    ? rawConfig.icons.thumb
    : {};
  const normalizedThumb = normalizedConfig?.icons?.thumb || {};
  const fallbackStart = directionalThumbIcon(normalizedConfig || rawConfig || {}, "start");
  const fallbackEnd = directionalThumbIcon(normalizedConfig || rawConfig || {}, "end");
  const legacy = String(rawThumb.icon ?? normalizedThumb.icon ?? "").trim();
  const hasPair = Object.prototype.hasOwnProperty.call(rawThumb, "icon_start")
    || Object.prototype.hasOwnProperty.call(rawThumb, "icon_end");
  const explicitAuto = Object.prototype.hasOwnProperty.call(rawThumb, "auto_direction")
    ? rawThumb.auto_direction === true
    : null;
  // Legacy 0.13.0b0 confirm sliders stored auto_direction:false even though
  // their stock thumb was a directional chevron. Treat that untouched stock
  // icon as the new automatic default. A real custom icon still disables it.
  const automatic = hasPair
    ? explicitAuto === true
    : (explicitAuto === true || !legacy || isChevron(legacy));
  return {
    automatic,
    start: String(rawThumb.icon_start ?? legacy ?? fallbackStart).trim() || fallbackStart,
    end: String(rawThumb.icon_end ?? fallbackEnd).trim() || fallbackEnd,
  };
};

/* -------------------------------------------------------------------------- */
/* Runtime card: two thumb icons + hard button/body size constraint.           */
/* -------------------------------------------------------------------------- */

const cardClass = customElements.get("lotus-slide-card");
if (cardClass && !cardClass.prototype.__lotusSlideLocalB1RuntimePatched) {
  cardClass.prototype.__lotusSlideLocalB1RuntimePatched = true;

  const originalSetConfig = cardClass.prototype.setConfig;
  cardClass.prototype.setConfig = function patchedSetConfig(config) {
    const raw = config ? clone(config) : config;
    const stateBefore = thumbStateFromRaw(raw || {});
    originalSetConfig.call(this, raw);
    this._lotusThumbIcons = thumbStateFromRaw(raw || {}, this._config);
    if (stateBefore.automatic === false) this._lotusThumbIcons.automatic = false;

    // The thumb must never protrude beyond the outside cross-dimension of the
    // slider body. This also sanitizes hand-written YAML.
    if (this._config?.thumb && this._config?.track) {
      this._config.thumb.size = Math.min(Number(this._config.thumb.size) || 0, Number(this._config.track.thickness) || 0);
    }
    if (this._config?.icons?.thumb) {
      this._config.icons.thumb.icon_start = this._lotusThumbIcons.start;
      this._config.icons.thumb.icon_end = this._lotusThumbIcons.end;
      this._config.icons.thumb.auto_direction = this._lotusThumbIcons.automatic;
      this._config.icons.thumb.icon = this._lotusThumbIcons.start;
    }
    this._render();
  };

  cardClass.prototype._thumbDirectionalIcon = function patchedThumbIcon() {
    const state = this._lotusThumbIcons || thumbStateFromRaw(this._config, this._config);
    let side = "start";
    if (this._config.mode === "two_state") {
      const origin = this._dragging
        ? (this._dragOrigin >= 0.5 ? 1 : 0)
        : (this._progress >= 0.5 ? 1 : 0);
      side = origin === 1 ? "end" : "start";
    } else {
      side = this._progress * 100 >= this._config.threshold ? "end" : "start";
    }
    if (state.automatic) return directionalThumbIcon(this._config, side);
    return side === "end" ? state.end : state.start;
  };
}

/* -------------------------------------------------------------------------- */
/* Editor.                                                                     */
/* -------------------------------------------------------------------------- */

const editorClass = customElements.get("lotus-slide-card-editor");
if (editorClass && !editorClass.prototype.__lotusSlideLocalB1EditorPatched) {
  editorClass.prototype.__lotusSlideLocalB1EditorPatched = true;

  const originalSetConfig = editorClass.prototype.setConfig;
  editorClass.prototype.setConfig = function patchedEditorSetConfig(config) {
    this._lotusThumbIcons = thumbStateFromRaw(config || {});
    originalSetConfig.call(this, config);
    this._lotusThumbIcons = thumbStateFromRaw(config || {}, this._config);
    if (this._config?.thumb && this._config?.track) {
      this._config.thumb.size = Math.min(Number(this._config.thumb.size) || 0, Number(this._config.track.thickness) || 0);
    }
    // Re-render once so the first visible editor already contains the local
    // enhancements and the clamped geometry.
    this._render();
  };

  editorClass.prototype._emit = function patchedEmit() {
    const config = clone(this._config);
    config.icons ??= {};
    config.icons.thumb ??= {};
    const state = this._lotusThumbIcons || thumbStateFromRaw(config, config);
    config.icons.thumb.icon = state.start;
    config.icons.thumb.icon_start = state.start;
    config.icons.thumb.icon_end = state.end;
    config.icons.thumb.auto_direction = state.automatic;
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config },
    }));
  };

  const originalCommit = editorClass.prototype._commit;
  editorClass.prototype._commit = function patchedCommit(mutator, options = {}) {
    return originalCommit.call(this, (next) => {
      mutator(next);
      if (next?.thumb && next?.track) {
        const trackThickness = clampValue(next.track.thickness, 18, 100);
        next.track.thickness = trackThickness;
        next.thumb.size = clampValue(next.thumb.size, 8, trackThickness);
      }
    }, options);
  };

  /* Deferred size/dimension inputs: commit only on Enter or blur. */
  const originalNumber = editorClass.prototype._number;
  editorClass.prototype._number = function patchedNumber(parent, path, label, value, min, max, step, onChange, mode = "slider") {
    if (path === "thumb.size") {
      min = 8;
      max = Math.max(8, Number(this._config?.track?.thickness) || 8);
    }
    if (!isDeferredSizePath(path)) {
      return originalNumber.call(this, parent, path, label, value, min, max, step, onChange, mode);
    }

    const wrap = document.createElement("label");
    wrap.className = "fallback-field lotus-deferred-number-field";
    wrap.dataset.fieldPath = path;
    const span = document.createElement("span");
    span.textContent = lotusT(label);
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "decimal";
    input.value = value ?? "";
    if (Number.isFinite(Number(min))) input.min = String(min);
    if (Number.isFinite(Number(max))) input.max = String(max);
    if (Number.isFinite(Number(step)) && Number(step) > 0) input.step = String(step);

    const initial = Number(value);
    const restore = () => { input.value = Number.isFinite(initial) ? String(initial) : String(value ?? ""); };
    const commit = () => {
      const raw = String(input.value ?? "").trim().replace(",", ".");
      if (!raw) { restore(); return; }
      let next = Number(raw);
      if (!Number.isFinite(next)) { restore(); return; }
      const low = Number(min);
      const high = Number(max);
      if (Number.isFinite(low)) next = Math.max(low, next);
      if (Number.isFinite(high)) next = Math.min(high, next);
      const inc = Number(step);
      if (Number.isFinite(inc) && inc > 0) {
        const base = Number.isFinite(low) ? low : 0;
        next = base + Math.round((next - base) / inc) * inc;
        if (Number.isFinite(low)) next = Math.max(low, next);
        if (Number.isFinite(high)) next = Math.min(high, next);
      }
      input.value = String(next);
      if (!Number.isFinite(initial) || Math.abs(next - initial) > 1e-9) onChange(next);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        restore();
        input.blur();
      }
    });
    input.addEventListener("blur", commit);
    wrap.append(span, input);
    parent.appendChild(wrap);
    return wrap;
  };

  /* Side visuals: explicit None / Icon / Image. */
  editorClass.prototype._renderSideVisualGroup = function patchedSideVisualGroup(parent, kind, title) {
    const conf = this._config.icons[kind];
    this._lotusSideVisualDraft ??= Object.create(null);
    const drafted = this._lotusSideVisualDraft[kind];
    const selected = sideHasPotentialVisual(conf)
      ? conf.visual_type
      : (["none", "icon", "image"].includes(drafted) ? drafted : "none");

    const group = document.createElement("div");
    group.className = "subgroup";
    group.dataset.lotusVisualTarget = kind;
    const h4 = document.createElement("h4");
    h4.textContent = lotusT(title);
    group.appendChild(h4);

    this._select(group, `icons.${kind}.visual_type`, "Type visuel de l’extrémité", selected,
      [["none", "Aucun"], ["icon", "Icône"], ["image", "Image"]], (value) => {
        const nextType = ["icon", "image"].includes(value) ? value : "none";
        this._lotusSideVisualDraft[kind] = nextType;
        if (nextType === "none") {
          this._commit((c) => clearSideVisual(c.icons[kind]));
        } else {
          this._commit((c) => { c.icons[kind].visual_type = nextType; });
        }
      });

    if (selected === "none") {
      parent.appendChild(group);
      return;
    }

    this._entityField(group, `icons.${kind}.state_entity`, "Entité source de l’état visuel (facultatif)", conf.state_entity,
      (value) => this._commit((c) => { c.icons[kind].state_entity = value; }));
    this._select(group, `icons.${kind}.state_mode`, "Mode de variation selon l’état", conf.state_mode,
      [["static", "Visuel fixe"], ["binary", "Deux états → visuel"], ["integer", "Valeur entière → visuel"]],
      (value) => this._commit((c) => { c.icons[kind].state_mode = ["binary", "integer"].includes(value) ? value : "static"; }));

    if (selected === "image") {
      this._imagePicker(group, `icons.${kind}.image`, conf.state_mode === "static" ? "Image" : "Image de secours", conf.image,
        (value) => this._commit((c) => { c.icons[kind].visual_type = "image"; c.icons[kind].image = value; }));
      this._select(group, `icons.${kind}.image_fit`, "Ajustement de l’image", conf.image_fit,
        [["contain", "Contenir"], ["cover", "Couvrir"], ["fill", "Étirer"]],
        (value) => this._commit((c) => { c.icons[kind].image_fit = value; }));
    } else {
      this._icon(group, `icons.${kind}.icon`, conf.state_mode === "static" ? "Icône" : "Icône de secours", conf.icon,
        (value) => this._commit((c) => { c.icons[kind].visual_type = "icon"; c.icons[kind].icon = value; }));
    }
    this._number(group, `icons.${kind}.size`, "Taille du visuel (%)", conf.size, 12, 100, 1,
      (value) => this._commit((c) => { c.icons[kind].size = Number(value); }));

    if (conf.state_mode === "binary") {
      for (const index of [1, 2]) {
        const map = document.createElement("div");
        map.className = "state-map-row";
        this._text(map, `icons.${kind}.binary_state_${index}`, `Condition ${index}`, conf[`binary_state_${index}`],
          (value) => this._commit((c) => { c.icons[kind][`binary_state_${index}`] = value; }));
        if (selected === "image") {
          this._imagePicker(map, `icons.${kind}.binary_image_${index}`, `Image ${index}`, conf[`binary_image_${index}`],
            (value) => this._commit((c) => { c.icons[kind].visual_type = "image"; c.icons[kind][`binary_image_${index}`] = value; }));
        } else {
          this._icon(map, `icons.${kind}.binary_icon_${index}`, `Icône ${index}`, conf[`binary_icon_${index}`],
            (value) => this._commit((c) => { c.icons[kind].visual_type = "icon"; c.icons[kind][`binary_icon_${index}`] = value; }));
          this._color(map, `icons.${kind}.binary_color_${index}`, `Couleur ${index}`, conf[`binary_color_${index}`],
            (value) => this._commit((c) => { c.icons[kind][`binary_color_${index}`] = value; }), true);
        }
        group.appendChild(map);
      }
      const helper = document.createElement("p");
      helper.className = "helper";
      helper.textContent = lotusT("OFF/0/false et ON/1/true sont reconnus comme états binaires équivalents. Les comparaisons numériques restent possibles.");
      group.appendChild(helper);
    } else if (conf.state_mode === "integer") {
      this._number(group, `icons.${kind}.value_count`, "Nombre de valeurs", conf.value_count, 0, MAX_SIDE_VISUAL_VALUES, 1,
        (value) => this._commit((c) => {
          const side = c.icons[kind];
          const count = Math.max(0, Math.min(MAX_SIDE_VISUAL_VALUES, Math.floor(Number(value) || 0)));
          const previous = Array.isArray(side.values) ? side.values : [];
          side.value_count = count;
          side.values = Array.from({ length: count }, (_, idx) => ({
            value: Number.isInteger(Number(previous[idx]?.value)) ? Number(previous[idx].value) : idx,
            icon: String(previous[idx]?.icon ?? ""),
            color: String(previous[idx]?.color ?? "state"),
            image: String(previous[idx]?.image ?? ""),
          }));
        }), "box");
      for (let index = 0; index < conf.value_count; index += 1) {
        const mapping = conf.values[index] ?? { value: index, icon: "", color: "state", image: "" };
        const map = document.createElement("div");
        map.className = "state-map-row";
        this._number(map, `icons.${kind}.values.${index}.value`, `Valeur ${index + 1}`, mapping.value, -999999, 999999, 1,
          (value) => this._commit((c) => { c.icons[kind].values[index].value = Number(value); }), "box");
        if (selected === "image") {
          this._imagePicker(map, `icons.${kind}.values.${index}.image`, `Image ${index + 1}`, mapping.image,
            (value) => this._commit((c) => { c.icons[kind].visual_type = "image"; c.icons[kind].values[index].image = value; }));
        } else {
          this._icon(map, `icons.${kind}.values.${index}.icon`, `Icône ${index + 1}`, mapping.icon,
            (value) => this._commit((c) => { c.icons[kind].visual_type = "icon"; c.icons[kind].values[index].icon = value; }));
          this._color(map, `icons.${kind}.values.${index}.color`, `Couleur ${index + 1}`, mapping.color,
            (value) => this._commit((c) => { c.icons[kind].values[index].color = value; }), true);
        }
        group.appendChild(map);
      }
    }

    this._boolean(group, `icons.${kind}.background.enabled`, "Afficher un fond derrière le visuel", conf.background.enabled,
      (value) => this._commit((c) => { c.icons[kind].background.enabled = value; }));
    if (conf.background.enabled) {
      this._color(group, `icons.${kind}.background.color`, "Couleur du fond du visuel", conf.background.color,
        (value) => this._commit((c) => { c.icons[kind].background.color = value; }));
      this._number(group, `icons.${kind}.background.opacity`, "Opacité du fond (%)", conf.background.opacity, 0, 100, 1,
        (value) => this._commit((c) => { c.icons[kind].background.opacity = Number(value); }));
      this._number(group, `icons.${kind}.background.size`, "Taille du fond (%)", conf.background.size, 20, 100, 1,
        (value) => this._commit((c) => { c.icons[kind].background.size = Number(value); }));
      this._number(group, `icons.${kind}.background.radius`, "Arrondi du fond (%)", conf.background.radius, 0, 50, 1,
        (value) => this._commit((c) => { c.icons[kind].background.radius = Number(value); }));
    }

    if (selected === "icon" && conf.state_mode === "static") {
      this._boolean(group, `icons.${kind}.dynamic`, "Couleur liée à la position du curseur", conf.dynamic,
        (value) => this._commit((c) => { c.icons[kind].dynamic = value; }));
      this._color(group, `icons.${kind}.color_start`, "Couleur au départ", conf.color_start,
        (value) => this._commit((c) => { c.icons[kind].color_start = value; }));
      if (conf.dynamic) {
        this._color(group, `icons.${kind}.color_end`, "Couleur à l’arrivée", conf.color_end,
          (value) => this._commit((c) => { c.icons[kind].color_end = value; }));
      }
    }
    parent.appendChild(group);
  };

  /* Thumb editor: two configurable icons in both slider modes. */
  const originalRenderIconGroup = editorClass.prototype._renderIconGroup;
  editorClass.prototype._renderIconGroup = function patchedIconGroup(parent, kind, title) {
    if (kind !== "thumb") return originalRenderIconGroup.call(this, parent, kind, title);

    const conf = this._config.icons.thumb;
    const state = this._lotusThumbIcons || thumbStateFromRaw(this._config, this._config);
    this._lotusThumbIcons = state;
    const group = document.createElement("div");
    group.className = "subgroup";
    group.dataset.lotusVisualTarget = "thumb";
    const h4 = document.createElement("h4");
    h4.textContent = lotusT(title);
    group.appendChild(h4);

    this._boolean(group, "icons.thumb.auto_direction", "Adapter automatiquement les flèches à l’orientation", state.automatic, (value) => {
      state.automatic = Boolean(value);
      this._emit();
      this._render();
    });

    const startShown = state.automatic ? directionalThumbIcon(this._config, "start") : state.start;
    const endShown = state.automatic ? directionalThumbIcon(this._config, "end") : state.end;
    this._icon(group, "icons.thumb.icon_start", "Icône du bouton côté départ", startShown, (value) => {
      state.start = String(value || "") || directionalThumbIcon(this._config, "start");
      state.automatic = false;
      this._emit();
      this._render();
    });
    this._icon(group, "icons.thumb.icon_end", "Icône du bouton côté arrivée", endShown, (value) => {
      state.end = String(value || "") || directionalThumbIcon(this._config, "end");
      state.automatic = false;
      this._emit();
      this._render();
    });

    this._number(group, "icons.thumb.size", "Taille de l’icône (%)", conf.size, 12, 100, 1,
      (value) => this._commit((c) => { c.icons.thumb.size = Number(value); }));
    this._boolean(group, "icons.thumb.dynamic", "Couleur liée à la position du curseur", conf.dynamic,
      (value) => this._commit((c) => { c.icons.thumb.dynamic = value; }));
    this._color(group, "icons.thumb.color_start", "Couleur au départ", conf.color_start,
      (value) => this._commit((c) => { c.icons.thumb.color_start = value; }));
    if (conf.dynamic) {
      this._color(group, "icons.thumb.color_end", "Couleur à l’arrivée", conf.color_end,
        (value) => this._commit((c) => { c.icons.thumb.color_end = value; }));
    }
    parent.appendChild(group);
  };

  /* Section tagging allows contextual navigation without relying on translated text. */
  const SECTION_TARGETS = Object.freeze({
    "Nom": "general",
    "Comportement": "general",
    "Interaction": "interaction",
    "Format responsive": "general",
    "Corps / glissière du slider": "track",
    "Bouton du slider": "thumb",
    "Icônes et images d’extrémité": "visuals",
    "Texte": "text",
    "Action Home Assistant": "general",
    "Actions des deux positions": "general",
  });
  const originalSection = editorClass.prototype._section;
  editorClass.prototype._section = function patchedSection(title, description = "") {
    const section = originalSection.call(this, title, description);
    section.dataset.lotusSectionSource = title;
    section.dataset.lotusSectionTarget = SECTION_TARGETS[title] || "general";
    return section;
  };

  editorClass.prototype._lotusApplyContext = function applyContext() {
    const pane = this.shadowRoot?.querySelector(".config-pane");
    if (!pane) return;
    const selected = this._lotusSelection || "general";
    pane.querySelectorAll(".editor-section").forEach((section) => {
      const target = section.dataset.lotusSectionTarget || "general";
      let visible = target === selected;
      if (["start", "end"].includes(selected)) visible = target === "visuals";
      if (selected === "thumb" && target === "visuals") visible = true;
      section.hidden = !visible;
      if (target === "visuals") {
        section.querySelectorAll(".subgroup").forEach((group) => {
          const kind = group.dataset.lotusVisualTarget;
          if (!kind) return;
          group.hidden = selected === "thumb" ? kind !== "thumb" : (["start", "end"].includes(selected) ? kind !== selected : false);
        });
      }
    });
    pane.scrollTop = 0;
  };

  editorClass.prototype._lotusPreviewTargetFromEvent = function targetFromEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const el = path.find((node) => node instanceof Element && (
      node.classList?.contains("slide-thumb")
      || node.classList?.contains("slide-label")
      || node.classList?.contains("slide-icon-zone")
      || node.classList?.contains("slide-track")
    ));
    if (!el) return "general";
    if (el.classList.contains("slide-thumb")) return "thumb";
    if (el.classList.contains("slide-label")) return "text";
    if (el.classList.contains("slide-icon-zone")) return el.dataset.iconKind === "end" ? "end" : "start";
    if (el.classList.contains("slide-track")) return "track";
    return "general";
  };

  editorClass.prototype._lotusPreviewElement = function previewElement(target = this._lotusSelection) {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!preview || !root) return null;
    if (target === "general") return preview;
    if (target === "track") return root.querySelector(".slide-track");
    if (target === "thumb") return root.querySelector(".slide-thumb");
    if (target === "text") return root.querySelector(".slide-label");
    if (["start", "end"].includes(target)) {
      const zone = root.querySelector(`.slide-icon-zone[data-icon-kind="${target}"]`);
      return zone?.querySelector(".slide-side-icon,.slide-side-image") || zone;
    }
    return null;
  };

  editorClass.prototype._lotusMarkSelection = function markSelection() {
    const root = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview")?.shadowRoot;
    if (!root) return;
    root.querySelectorAll(".lotus-edit-selected").forEach((el) => el.classList.remove("lotus-edit-selected"));
    if (this._lotusTestMode) return;
    const target = this._lotusPreviewElement();
    target?.classList?.add("lotus-edit-selected");
  };

  editorClass.prototype._lotusPositionResizeOverlay = function positionResizeOverlay() {
    const overlay = this.shadowRoot?.querySelector(".lotus-resize-overlay");
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const target = this._lotusPreviewElement();
    if (!overlay || !frame || !target || this._lotusTestMode || this._lotusSelection === "interaction") {
      if (overlay) overlay.hidden = true;
      return;
    }
    if (["start", "end"].includes(this._lotusSelection) && !sideHasPotentialVisual(this._config.icons[this._lotusSelection])) {
      overlay.hidden = true;
      return;
    }
    const tr = target.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    if (!(tr.width > 0 && tr.height > 0)) { overlay.hidden = true; return; }
    overlay.hidden = false;
    overlay.style.left = `${tr.left - fr.left}px`;
    overlay.style.top = `${tr.top - fr.top}px`;
    overlay.style.width = `${tr.width}px`;
    overlay.style.height = `${tr.height}px`;
  };

  editorClass.prototype._lotusSelect = function select(target) {
    if (this._lotusTestMode) return;
    this._lotusSelection = target || "general";
    this._lotusApplyContext();
    this._lotusMarkSelection();
    this._lotusSyncToolbar();
    requestAnimationFrame(() => this._lotusPositionResizeOverlay());
  };

  editorClass.prototype._lotusResizeDraft = function resizeDraft(session, event) {
    const dx = event.clientX - session.x;
    const dy = event.clientY - session.y;
    const draft = clone(session.config);
    const target = session.target;
    if (target === "general") {
      const rw = Math.max(0.1, (session.rect.width + dx) / Math.max(1, session.rect.width));
      const rh = Math.max(0.1, (session.rect.height + dy) / Math.max(1, session.rect.height));
      draft.design.width = clampValue(session.config.design.width * rw, 5, 200);
      draft.design.height = clampValue(session.config.design.height * rh, 5, 200);
    } else if (target === "track") {
      const delta = this._config.orientation === "vertical" ? dx : dy;
      const cross = this._config.orientation === "vertical" ? session.rect.width : session.rect.height;
      draft.track.thickness = clampValue(session.config.track.thickness * Math.max(0.1, (cross + delta) / Math.max(1, cross)), 18, 100);
      draft.thumb.size = Math.min(draft.thumb.size, draft.track.thickness);
    } else if (target === "thumb") {
      const ratio = Math.max(0.1, Math.max(
        (session.rect.width + dx) / Math.max(1, session.rect.width),
        (session.rect.height + dy) / Math.max(1, session.rect.height),
      ));
      draft.thumb.size = clampValue(session.config.thumb.size * ratio, 8, draft.track.thickness);
    } else if (["start", "end"].includes(target)) {
      const ratio = Math.max(0.1, Math.max(
        (session.rect.width + dx) / Math.max(1, session.rect.width),
        (session.rect.height + dy) / Math.max(1, session.rect.height),
      ));
      draft.icons[target].size = clampValue(session.config.icons[target].size * ratio, 12, 100);
    } else if (target === "text") {
      const ratio = Math.max(0.1, (session.rect.height + dy) / Math.max(1, session.rect.height));
      draft.text.font_size = clampValue(session.config.text.font_size * ratio, 8, 36);
    }
    return draft;
  };

  editorClass.prototype._lotusApplyResizePreview = function applyResizePreview(draft) {
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    if (!preview) return;
    preview.setConfig(draft);
    preview.hass = this._hass;
    preview.preview = true;
    if (this._lotusSelection === "general") preview.style.aspectRatio = `${draft.design.width}/${draft.design.height}`;
    this._lotusMarkSelection();
    requestAnimationFrame(() => this._lotusPositionResizeOverlay());
  };

  editorClass.prototype._lotusCommitResize = function commitResize(target, draft) {
    this._commit((config) => {
      if (target === "general") {
        config.design.width = Math.round(draft.design.width * 100) / 100;
        config.design.height = Math.round(draft.design.height * 100) / 100;
      } else if (target === "track") {
        config.track.thickness = Math.round(draft.track.thickness * 100) / 100;
        config.thumb.size = Math.min(config.thumb.size, config.track.thickness);
      } else if (target === "thumb") {
        config.thumb.size = Math.min(Math.round(draft.thumb.size * 100) / 100, config.track.thickness);
      } else if (["start", "end"].includes(target)) {
        config.icons[target].size = Math.round(draft.icons[target].size * 100) / 100;
      } else if (target === "text") {
        config.text.font_size = Math.round(draft.text.font_size * 100) / 100;
      }
    });
  };

  editorClass.prototype._lotusStartResize = function startResize(event) {
    if (this._lotusTestMode) return;
    const targetEl = this._lotusPreviewElement();
    if (!targetEl) return;
    event.preventDefault();
    event.stopPropagation();
    const session = {
      target: this._lotusSelection || "general",
      x: event.clientX,
      y: event.clientY,
      rect: targetEl.getBoundingClientRect(),
      config: clone(this._config),
      draft: null,
    };
    this._lotusResizeSession = session;
    const move = (e) => {
      e.preventDefault();
      session.draft = this._lotusResizeDraft(session, e);
      this._lotusApplyResizePreview(session.draft);
    };
    const end = (e) => {
      e.preventDefault();
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      this._lotusResizeSession = null;
      if (session.draft) this._lotusCommitResize(session.target, session.draft);
      else this._lotusPositionResizeOverlay();
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };

  editorClass.prototype._lotusSideMeta = function sideMeta(kind) {
    const vertical = this._config.orientation === "vertical";
    const reverse = this._config.reverse === true;
    if (vertical) {
      if (kind === "start") return { icon: reverse ? "mdi:chevron-up" : "mdi:chevron-down", label: reverse ? "Extrémité haute / départ" : "Extrémité basse / départ" };
      return { icon: reverse ? "mdi:chevron-down" : "mdi:chevron-up", label: reverse ? "Extrémité basse / arrivée" : "Extrémité haute / arrivée" };
    }
    if (kind === "start") return { icon: reverse ? "mdi:chevron-right" : "mdi:chevron-left", label: reverse ? "Extrémité droite / départ" : "Extrémité gauche / départ" };
    return { icon: reverse ? "mdi:chevron-left" : "mdi:chevron-right", label: reverse ? "Extrémité gauche / arrivée" : "Extrémité droite / arrivée" };
  };

  editorClass.prototype._lotusSyncToolbar = function syncToolbar() {
    const toolbar = this.shadowRoot?.querySelector(".lotus-slide-toolbar");
    if (!toolbar) return;
    toolbar.querySelectorAll("button[data-target]").forEach((button) => {
      const active = !this._lotusTestMode && button.dataset.target === (this._lotusSelection || "general");
      button.classList.toggle("active", active);
      button.disabled = this._lotusTestMode;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const test = toolbar.querySelector("button[data-test-toggle]");
    if (test) {
      test.classList.toggle("test-active", Boolean(this._lotusTestMode));
      test.title = lotusT(this._lotusTestMode ? "Revenir au mode édition" : "Tester le slider");
      test.setAttribute("aria-label", test.title);
      const icon = test.querySelector("ha-icon");
      icon?.setAttribute("icon", this._lotusTestMode ? "mdi:pencil" : "mdi:play-circle-outline");
    }
  };

  editorClass.prototype._lotusSetTestMode = function setTestMode(value) {
    this._lotusTestMode = Boolean(value);
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    if (preview) preview.preview = true; // Simulation only: never call HA services from the editor.
    this.shadowRoot?.querySelector(".preview-frame")?.classList.toggle("lotus-test-mode", this._lotusTestMode);
    this.shadowRoot?.querySelector(".lotus-test-badge")?.toggleAttribute("hidden", !this._lotusTestMode);
    this._lotusMarkSelection();
    this._lotusSyncToolbar();
    this._lotusPositionResizeOverlay();
  };

  editorClass.prototype._lotusInstallEditorUi = function installEditorUi() {
    const previewPane = this.shadowRoot?.querySelector(".preview-pane");
    const frame = this.shadowRoot?.querySelector(".preview-frame");
    const preview = this.shadowRoot?.querySelector("lotus-slide-card.slide-preview");
    const root = preview?.shadowRoot;
    if (!previewPane || !frame || !preview || !root) return;

    // Runtime style inside the preview shadow root.
    const runtimeStyle = document.createElement("style");
    runtimeStyle.dataset.lotusEditorUx = "1";
    runtimeStyle.textContent = `
      .slide-icon-zone,.slide-label { pointer-events:auto !important; }
      .lotus-edit-selected { outline:2px solid var(--primary-color,#03a9f4) !important; outline-offset:3px !important; }
    `;
    root.appendChild(runtimeStyle);

    // Context toolbar.
    const start = this._lotusSideMeta("start");
    const end = this._lotusSideMeta("end");
    const toolbar = document.createElement("div");
    toolbar.className = "lotus-slide-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", lotusT("Configuration du slider"));
    const items = [
      ["general", "mdi:tune-variant", "Général"],
      ["track", "mdi:minus-thick", "Corps / glissière du slider"],
      ["start", start.icon, start.label],
      ["thumb", "mdi:circle-double", "Bouton du slider"],
      ["end", end.icon, end.label],
      ["text", "mdi:format-text", "Texte"],
      ["interaction", "mdi:gesture-tap", "Interaction"],
    ];
    for (const [target, iconName, label] of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.target = target;
      button.title = lotusT(label);
      button.setAttribute("aria-label", lotusT(label));
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", iconName);
      button.appendChild(icon);
      button.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._lotusSelect(target); });
      toolbar.appendChild(button);
    }
    const separator = document.createElement("span");
    separator.className = "lotus-toolbar-separator";
    toolbar.appendChild(separator);
    const testButton = document.createElement("button");
    testButton.type = "button";
    testButton.dataset.testToggle = "1";
    testButton.className = "test-toggle";
    const testIcon = document.createElement("ha-icon");
    testIcon.setAttribute("icon", "mdi:play-circle-outline");
    testButton.appendChild(testIcon);
    testButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._lotusSetTestMode(!this._lotusTestMode);
    });
    toolbar.appendChild(testButton);
    previewPane.appendChild(toolbar);

    const badge = document.createElement("div");
    badge.className = "lotus-test-badge";
    badge.textContent = lotusT("MODE TEST — simulation, aucune action Home Assistant exécutée");
    badge.hidden = true;
    previewPane.appendChild(badge);

    const overlay = document.createElement("div");
    overlay.className = "lotus-resize-overlay";
    overlay.innerHTML = '<div class="lotus-resize-handle" title="Redimensionner"></div>';
    frame.appendChild(overlay);
    overlay.querySelector(".lotus-resize-handle")?.addEventListener("pointerdown", (e) => this._lotusStartResize(e));

    // In edit mode, clicking the mini editor selects a context. In test mode,
    // the event is intentionally left untouched so Lotus Slide behaves normally.
    root.addEventListener("pointerdown", (event) => {
      if (this._lotusTestMode || this._lotusResizeSession) return;
      const target = this._lotusPreviewTargetFromEvent(event);
      event.preventDefault();
      event.stopImmediatePropagation();
      this._lotusSelect(target);
    }, true);
    frame.addEventListener("pointerdown", (event) => {
      if (this._lotusTestMode || this._lotusResizeSession) return;
      if (event.target === frame) this._lotusSelect("general");
    });

    this._lotusApplyContext();
    this._lotusSetTestMode(Boolean(this._lotusTestMode));
    this._lotusSelect(this._lotusSelection || "general");
  };

  const originalRender = editorClass.prototype._render;
  editorClass.prototype._render = function patchedRender(...args) {
    const selected = this._lotusSelection || "general";
    const testMode = Boolean(this._lotusTestMode);
    const result = originalRender.apply(this, args);
    this._lotusSelection = selected;
    this._lotusTestMode = testMode;

    // The thumb size field must expose only values that fit in the current body.
    const thumbInput = this.shadowRoot?.querySelector('[data-field-path="thumb.size"] input');
    if (thumbInput) thumbInput.max = String(this._config.track.thickness);

    const style = document.createElement("style");
    style.dataset.lotusSlideLocalUx = "1";
    style.textContent = `
      .editor-section[hidden], .subgroup[hidden], .lotus-test-badge[hidden], .lotus-resize-overlay[hidden] { display:none !important; }
      .preview-title { top:58px !important; }
      .preview-frame { padding-top:82px !important; }
      .lotus-slide-toolbar {
        position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:50;
        display:flex; align-items:center; gap:4px; max-width:calc(100% - 20px); padding:5px;
        border:1px solid var(--divider-color,rgba(127,127,127,.25)); border-radius:12px;
        background:var(--card-background-color,#fff); box-shadow:0 2px 8px rgba(0,0,0,.12); overflow-x:auto;
      }
      .lotus-slide-toolbar button {
        appearance:none; flex:0 0 auto; display:grid; place-items:center; width:34px; height:34px; padding:0;
        border:1px solid transparent; border-radius:9px; color:var(--secondary-text-color,#727272); background:transparent; cursor:pointer;
      }
      .lotus-slide-toolbar button:hover:not(:disabled) { background:color-mix(in srgb,var(--primary-color,#03a9f4) 10%,transparent); color:var(--primary-text-color,#212121); }
      .lotus-slide-toolbar button.active { color:var(--text-primary-color,#fff); background:var(--primary-color,#03a9f4); }
      .lotus-slide-toolbar button:disabled { opacity:.35; cursor:default; }
      .lotus-slide-toolbar button.test-toggle.test-active { color:var(--text-primary-color,#fff); background:var(--success-color,#43a047); }
      .lotus-slide-toolbar ha-icon { --mdc-icon-size:20px; }
      .lotus-toolbar-separator { width:1px; height:24px; margin:0 2px; background:var(--divider-color,rgba(127,127,127,.35)); flex:0 0 auto; }
      .lotus-test-badge {
        position:absolute; top:56px; left:50%; transform:translateX(-50%); z-index:45; white-space:nowrap;
        padding:4px 9px; border-radius:999px; font-size:10px; font-weight:700;
        color:var(--text-primary-color,#fff); background:var(--success-color,#43a047); pointer-events:none;
      }
      .lotus-resize-overlay { position:absolute; z-index:30; box-sizing:border-box; border:1px dashed var(--primary-color,#03a9f4); pointer-events:none; }
      .lotus-resize-handle {
        position:absolute; right:-7px; bottom:-7px; width:14px; height:14px; box-sizing:border-box;
        border:2px solid var(--card-background-color,#fff); border-radius:50%; background:var(--primary-color,#03a9f4);
        box-shadow:0 1px 4px rgba(0,0,0,.3); cursor:nwse-resize; pointer-events:auto; touch-action:none;
      }
      .preview-frame.lotus-test-mode { outline:2px solid color-mix(in srgb,var(--success-color,#43a047) 55%,transparent); outline-offset:-2px; }
      @media (max-width:980px) {
        .lotus-slide-toolbar { position:relative; top:auto; left:auto; transform:none; margin:0 auto 8px; width:max-content; max-width:100%; }
        .preview-title { position:static !important; margin:0 0 8px !important; }
        .preview-frame { padding-top:24px !important; }
        .lotus-test-badge { position:relative; top:auto; left:auto; transform:none; width:max-content; max-width:100%; margin:0 auto 8px; }
      }
    `;
    this.shadowRoot?.appendChild(style);
    requestAnimationFrame(() => this._lotusInstallEditorUi());
    return result;
  };
}
