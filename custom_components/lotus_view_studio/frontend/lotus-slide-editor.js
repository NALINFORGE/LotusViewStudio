/*
 * Lotus Slide editor UX patch for Lotus View Studio current package.
 *
 * Goals:
 * - allow each side/end position to explicitly have no icon or image;
 * - defer dimension/size number commits until Enter or focus loss so clearing
 *   and replacing a value does not immediately clamp to a min/max value.
 *
 * This module is loaded after lotus-slide-card.js and only patches the editor.
 */

import { lotusT } from "./lotus-i18n.js";

const MAX_SIDE_VISUAL_VALUES = 20;
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

const isDeferredSizePath = (path) => {
  const key = String(path ?? "").split(".").pop();
  return DEFERRED_SIZE_KEYS.has(key);
};

const sideHasPotentialVisual = (conf, visualType = conf?.visual_type) => {
  if (!conf) return false;
  if (visualType === "image") {
    if (String(conf.image ?? "").trim()) return true;
    if (String(conf.binary_image_1 ?? "").trim()) return true;
    if (String(conf.binary_image_2 ?? "").trim()) return true;
    return Array.isArray(conf.values)
      && conf.values.some((entry) => String(entry?.image ?? "").trim());
  }
  if (String(conf.icon ?? "").trim()) return true;
  if (String(conf.binary_icon_1 ?? "").trim()) return true;
  if (String(conf.binary_icon_2 ?? "").trim()) return true;
  return Array.isArray(conf.values)
    && conf.values.some((entry) => String(entry?.icon ?? "").trim());
};

const clearSideVisual = (side) => {
  if (!side) return;
  // Keep the historical schema valid: the runtime understands an empty icon
  // configuration as an empty end-zone, so no new YAML-only type is required.
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
  if (side.background && typeof side.background === "object") {
    side.background.enabled = false;
  }
};

const editorClass = customElements.get("lotus-slide-card-editor");

if (editorClass && !editorClass.prototype.__lotusSlideEditorB1Patched) {
  editorClass.prototype.__lotusSlideEditorB1Patched = true;

  const originalNumber = editorClass.prototype._number;

  editorClass.prototype._number = function patchedNumber(
    parent,
    path,
    label,
    value,
    min,
    max,
    step,
    onChange,
    mode = "slider",
  ) {
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

    let committedValue = Number(value);
    const canonical = Number.isFinite(committedValue) ? committedValue : value;

    const restore = () => {
      input.value = canonical ?? "";
    };

    const commit = () => {
      const raw = String(input.value ?? "").trim();
      if (!raw) {
        restore();
        return;
      }

      let next = Number(raw.replace(",", "."));
      if (!Number.isFinite(next)) {
        restore();
        return;
      }

      const lower = Number(min);
      const upper = Number(max);
      if (Number.isFinite(lower)) next = Math.max(lower, next);
      if (Number.isFinite(upper)) next = Math.min(upper, next);

      const increment = Number(step);
      if (Number.isFinite(increment) && increment > 0) {
        const base = Number.isFinite(lower) ? lower : 0;
        next = base + Math.round((next - base) / increment) * increment;
        if (Number.isFinite(lower)) next = Math.max(lower, next);
        if (Number.isFinite(upper)) next = Math.min(upper, next);
      }

      if (Number.isFinite(committedValue) && Math.abs(next - committedValue) < 1e-9) {
        input.value = String(next);
        return;
      }

      committedValue = next;
      input.value = String(next);
      onChange(next);
    };

    // No input/change listener is registered on purpose. The editor may remain
    // temporarily empty while the user replaces the value. Commit only when
    // they explicitly validate with Enter or leave the field.
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

  editorClass.prototype._renderSideVisualGroup = function patchedSideVisualGroup(parent, kind, title) {
    const conf = this._config.icons[kind];
    this._lotusSideVisualDraft ??= Object.create(null);

    const hasCurrentVisual = sideHasPotentialVisual(conf, conf.visual_type);
    const draftedType = this._lotusSideVisualDraft[kind];
    const selectedVisual = hasCurrentVisual
      ? conf.visual_type
      : (["icon", "image", "none"].includes(draftedType) ? draftedType : "none");

    const group = document.createElement("div");
    group.className = "subgroup";
    const h4 = document.createElement("h4");
    h4.textContent = lotusT(title);
    group.appendChild(h4);

    this._select(
      group,
      `icons.${kind}.visual_type`,
      "Type visuel de l’extrémité",
      selectedVisual,
      [["none", "Aucun"], ["icon", "Icône"], ["image", "Image"]],
      (value) => {
        const nextType = ["icon", "image"].includes(value) ? value : "none";
        this._lotusSideVisualDraft[kind] = nextType;
        if (nextType === "none") {
          this._commit((c) => clearSideVisual(c.icons[kind]));
          return;
        }
        this._commit((c) => {
          c.icons[kind].visual_type = nextType;
        });
      },
    );

    // "Aucun" is a real configuration choice. Do not show irrelevant state,
    // media, size or background controls until the user selects Icon or Image.
    if (selectedVisual === "none") {
      parent.appendChild(group);
      return;
    }

    this._entityField(
      group,
      `icons.${kind}.state_entity`,
      "Entité source de l’état visuel (facultatif)",
      conf.state_entity,
      (value) => this._commit((c) => { c.icons[kind].state_entity = value; }),
    );
    this._select(
      group,
      `icons.${kind}.state_mode`,
      "Mode de variation selon l’état",
      conf.state_mode,
      [["static", "Visuel fixe"], ["binary", "Deux états → visuel"], ["integer", "Valeur entière → visuel"]],
      (value) => this._commit((c) => {
        c.icons[kind].state_mode = ["binary", "integer"].includes(value) ? value : "static";
      }),
    );

    if (selectedVisual === "image") {
      this._imagePicker(
        group,
        `icons.${kind}.image`,
        conf.state_mode === "static" ? "Image" : "Image de secours",
        conf.image,
        (value) => this._commit((c) => {
          c.icons[kind].visual_type = "image";
          c.icons[kind].image = value;
        }),
      );
      this._select(
        group,
        `icons.${kind}.image_fit`,
        "Ajustement de l’image",
        conf.image_fit,
        [["contain", "Contenir"], ["cover", "Couvrir"], ["fill", "Étirer"]],
        (value) => this._commit((c) => { c.icons[kind].image_fit = value; }),
      );
    } else {
      this._icon(
        group,
        `icons.${kind}.icon`,
        conf.state_mode === "static" ? "Icône" : "Icône de secours",
        conf.icon,
        (value) => this._commit((c) => {
          c.icons[kind].visual_type = "icon";
          c.icons[kind].icon = value;
        }),
      );
    }

    this._number(
      group,
      `icons.${kind}.size`,
      "Taille du visuel (%)",
      conf.size,
      12,
      100,
      1,
      (value) => this._commit((c) => { c.icons[kind].size = Number(value); }),
    );

    if (conf.state_mode === "binary") {
      for (const index of [1, 2]) {
        const map = document.createElement("div");
        map.className = "state-map-row";
        this._text(
          map,
          `icons.${kind}.binary_state_${index}`,
          `Condition ${index}`,
          conf[`binary_state_${index}`],
          (value) => this._commit((c) => { c.icons[kind][`binary_state_${index}`] = value; }),
        );
        if (selectedVisual === "image") {
          this._imagePicker(
            map,
            `icons.${kind}.binary_image_${index}`,
            `Image ${index}`,
            conf[`binary_image_${index}`],
            (value) => this._commit((c) => {
              c.icons[kind].visual_type = "image";
              c.icons[kind][`binary_image_${index}`] = value;
            }),
          );
        } else {
          this._icon(
            map,
            `icons.${kind}.binary_icon_${index}`,
            `Icône ${index}`,
            conf[`binary_icon_${index}`],
            (value) => this._commit((c) => {
              c.icons[kind].visual_type = "icon";
              c.icons[kind][`binary_icon_${index}`] = value;
            }),
          );
          this._color(
            map,
            `icons.${kind}.binary_color_${index}`,
            `Couleur ${index}`,
            conf[`binary_color_${index}`],
            (value) => this._commit((c) => { c.icons[kind][`binary_color_${index}`] = value; }),
            true,
          );
        }
        group.appendChild(map);
      }
      const helper = document.createElement("p");
      helper.className = "helper";
      helper.textContent = lotusT("OFF/0/false et ON/1/true sont reconnus comme états binaires équivalents. Les comparaisons numériques restent possibles.");
      group.appendChild(helper);
    } else if (conf.state_mode === "integer") {
      this._number(
        group,
        `icons.${kind}.value_count`,
        "Nombre de valeurs",
        conf.value_count,
        0,
        MAX_SIDE_VISUAL_VALUES,
        1,
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
        }),
        "box",
      );
      for (let index = 0; index < conf.value_count; index += 1) {
        const mapping = conf.values[index] ?? { value: index, icon: "", color: "state", image: "" };
        const map = document.createElement("div");
        map.className = "state-map-row";
        this._number(
          map,
          `icons.${kind}.values.${index}.value`,
          `Valeur ${index + 1}`,
          mapping.value,
          -999999,
          999999,
          1,
          (value) => this._commit((c) => { c.icons[kind].values[index].value = Number(value); }),
          "box",
        );
        if (selectedVisual === "image") {
          this._imagePicker(
            map,
            `icons.${kind}.values.${index}.image`,
            `Image ${index + 1}`,
            mapping.image,
            (value) => this._commit((c) => {
              c.icons[kind].visual_type = "image";
              c.icons[kind].values[index].image = value;
            }),
          );
        } else {
          this._icon(
            map,
            `icons.${kind}.values.${index}.icon`,
            `Icône ${index + 1}`,
            mapping.icon,
            (value) => this._commit((c) => {
              c.icons[kind].visual_type = "icon";
              c.icons[kind].values[index].icon = value;
            }),
          );
          this._color(
            map,
            `icons.${kind}.values.${index}.color`,
            `Couleur ${index + 1}`,
            mapping.color,
            (value) => this._commit((c) => { c.icons[kind].values[index].color = value; }),
            true,
          );
        }
        group.appendChild(map);
      }
    }

    this._boolean(
      group,
      `icons.${kind}.background.enabled`,
      "Afficher un fond derrière le visuel",
      conf.background.enabled,
      (value) => this._commit((c) => { c.icons[kind].background.enabled = value; }),
    );
    if (conf.background.enabled) {
      this._color(
        group,
        `icons.${kind}.background.color`,
        "Couleur du fond du visuel",
        conf.background.color,
        (value) => this._commit((c) => { c.icons[kind].background.color = value; }),
      );
      this._number(
        group,
        `icons.${kind}.background.opacity`,
        "Opacité du fond (%)",
        conf.background.opacity,
        0,
        100,
        1,
        (value) => this._commit((c) => { c.icons[kind].background.opacity = Number(value); }),
      );
      this._number(
        group,
        `icons.${kind}.background.size`,
        "Taille du fond (%)",
        conf.background.size,
        20,
        100,
        1,
        (value) => this._commit((c) => { c.icons[kind].background.size = Number(value); }),
      );
      this._number(
        group,
        `icons.${kind}.background.radius`,
        "Arrondi du fond (%)",
        conf.background.radius,
        0,
        50,
        1,
        (value) => this._commit((c) => { c.icons[kind].background.radius = Number(value); }),
      );
    }

    if (selectedVisual === "icon" && conf.state_mode === "static") {
      this._boolean(
        group,
        `icons.${kind}.dynamic`,
        "Couleur liée à la position du curseur",
        conf.dynamic,
        (value) => this._commit((c) => { c.icons[kind].dynamic = value; }),
      );
      this._color(
        group,
        `icons.${kind}.color_start`,
        "Couleur au départ",
        conf.color_start,
        (value) => this._commit((c) => { c.icons[kind].color_start = value; }),
      );
      if (conf.dynamic) {
        this._color(
          group,
          `icons.${kind}.color_end`,
          "Couleur à l’arrivée",
          conf.color_end,
          (value) => this._commit((c) => { c.icons[kind].color_end = value; }),
        );
      }
    }

    parent.appendChild(group);
  };
}
