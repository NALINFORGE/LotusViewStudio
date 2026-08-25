import {
  LOTUS_VISUAL_VERSION,
  deepClone,
  lotusSlugify,
  lotusThemeCss,
  makeIconButton,
} from "./lotus-core.js";
import {
  LOTUS_LANGUAGES,
  lotusGetAutomaticLanguage,
  lotusGetLanguagePreference,
  lotusGetTextDirection,
  lotusSetHass,
  lotusSetLanguagePreference,
  lotusT,
} from "./lotus-i18n.js";

const LOTUS_BRAND_ICON_URL = LOTUS_VISUAL_VERSION === "dev"
  ? "/lotus_view_studio_brand/icon.png"
  : `/lotus_view_studio_brand_v/${encodeURIComponent(LOTUS_VISUAL_VERSION)}/icon.png`;
const DEFAULT_VIEW_ICON = "mdi:view-dashboard-outline";
const LOTUS_VIEW_TYPE = "custom:lotus-visual-layout";

class LotusVisualManager extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._panel = undefined;
    this._dashboards = [];
    this._configs = new Map();
    this._loading = false;
    this._error = "";
    this._renderShell();
  }

  set hass(value) {
    const first = !this._hass && value;
    this._hass = value;
    if (value) lotusSetHass(value);
    if (first) this._refresh();
  }

  get hass() { return this._hass; }

  set panel(value) { this._panel = value; }
  get panel() { return this._panel; }

  connectedCallback() {
    if (this._hass && !this._dashboards.length && !this._loading) this._refresh();
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>
        ${lotusThemeCss}
        :host { display:block; width:100%; min-height:100%; box-sizing:border-box; background:var(--primary-background-color, #fafafa); }
        .page { max-width:1160px; margin:0 auto; padding:20px; box-sizing:border-box; }
        .topbar {
          position:relative; z-index:1; overflow:hidden; display:flex; align-items:center; gap:22px;
          min-height:120px; margin:0 0 18px; padding:24px 26px; box-sizing:border-box;
          color:#fff; border:1px solid rgba(255,255,255,.16); border-radius:24px;
          background:
            radial-gradient(circle at 88% -20%, rgba(255,255,255,.30), transparent 34%),
            linear-gradient(118deg, #0755b7 0%, #0078ec 52%, #3b96f1 100%);
          box-shadow:0 14px 34px rgba(0,94,190,.22);
        }
        .topbar::after {
          content:""; position:absolute; inset:auto -70px -105px auto; width:300px; height:220px;
          border:1px solid rgba(255,255,255,.13); border-radius:50%; transform:rotate(-12deg); pointer-events:none;
        }
        .brand { position:relative; z-index:1; flex:1; min-width:0; display:flex; align-items:center; gap:20px; }
        .brand-logo-shell {
          width:78px; height:78px; flex:0 0 78px; display:grid; place-items:center; box-sizing:border-box;
          background:rgba(255,255,255,.96); border:1px solid rgba(255,255,255,.70); border-radius:20px;
          box-shadow:0 8px 20px rgba(0,42,100,.20), inset 0 0 0 2px rgba(7,85,183,.06);
        }
        .brand-logo { width:68px; height:68px; object-fit:contain; display:block; }
        .brand-text { min-width:0; }
        .brand-kicker { margin-bottom:4px; font-size:11px; line-height:1.2; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.86); }
        .brand-title { font-size:clamp(28px, 3vw, 38px); line-height:1.04; font-weight:760; letter-spacing:-.025em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#fff; }
        .brand-subtitle { margin-top:7px; color:rgba(255,255,255,.86); font-size:13px; }
        .hero-side { position:relative; z-index:1; flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-end; gap:11px; }
        .hero-version { padding:5px 9px; border:1px solid rgba(255,255,255,.22); border-radius:999px; background:rgba(0,45,110,.16); color:rgba(255,255,255,.92); font-size:11px; font-weight:700; letter-spacing:.03em; }
        .top-actions { display:flex; align-items:center; gap:7px; }
        .top-actions .lotus-icon-button { color:#fff; background:rgba(255,255,255,.10); border-color:rgba(255,255,255,.20); backdrop-filter:blur(6px); }
        .top-actions .lotus-icon-button:hover:not(:disabled) { background:rgba(255,255,255,.20); border-color:rgba(255,255,255,.38); }
        .top-actions .lotus-icon-button.primary { color:#374151; background:#fff; border-color:rgba(255,255,255,.75); box-shadow:0 4px 12px rgba(0,53,125,.18); }
        .top-actions .lotus-icon-button.primary ha-icon { color:#374151; --mdc-icon-size:23px; }
        .top-actions .lotus-icon-button.primary:hover:not(:disabled) { color:#1f2937; background:#f4faff; border-color:#fff; }
        .top-actions .lotus-icon-button.primary:hover:not(:disabled) ha-icon { color:#1f2937; }
        .notice { padding:12px 14px; margin-bottom:14px; border:1px solid var(--lotus-border); border-radius:12px; background:var(--lotus-bg); color:var(--lotus-muted); }
        .notice.error { color:var(--lotus-danger); border-color:color-mix(in srgb, var(--lotus-danger) 40%, var(--lotus-border)); }
        .dashboards { display:grid; gap:14px; }
        .dashboard { background:var(--lotus-bg); border:1px solid var(--lotus-border); border-radius:16px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,.04); }
        .dashboard-head { display:flex; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid var(--lotus-border); }
        .dashboard-head > ha-icon { color:var(--lotus-accent); }
        .dashboard-name { flex:1; min-width:0; }
        .dashboard-title { font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dashboard-path { color:var(--lotus-muted); font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .actions { display:flex; align-items:center; gap:2px; }
        .views { display:grid; gap:1px; background:var(--lotus-border); }
        .view { display:flex; align-items:center; gap:10px; padding:9px 12px 9px 20px; background:var(--lotus-bg); min-height:42px; box-sizing:border-box; }
        .view > ha-icon { color:var(--lotus-muted); --mdc-icon-size:20px; }
        .view.lotus > ha-icon { color:var(--lotus-accent); }
        .view-brand-logo { width:22px; height:22px; flex:0 0 22px; object-fit:contain; display:block; }
        .view-name { flex:1; min-width:0; }
        .view-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .view-meta { color:var(--lotus-muted); font-size:11px; }
        .empty { padding:28px 18px; text-align:center; color:var(--lotus-muted); background:var(--lotus-bg); border:1px dashed var(--lotus-border); border-radius:16px; }
        .loading { display:grid; place-items:center; min-height:180px; color:var(--lotus-muted); }
        .modal-backdrop { position:fixed; inset:0; z-index:10000; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.42); box-sizing:border-box; }
        .modal { width:min(520px, 94vw); background:var(--lotus-bg); color:var(--lotus-fg); border-radius:16px; box-shadow:0 18px 55px rgba(0,0,0,.35); overflow:hidden; }
        .modal-head { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--lotus-border); }
        .modal-head strong { flex:1; }
        .modal-body { display:grid; gap:13px; padding:16px; }
        label { display:grid; gap:5px; color:var(--lotus-muted); font-size:12px; }
        input, select { box-sizing:border-box; width:100%; min-height:42px; padding:8px 10px; color:var(--lotus-fg); background:var(--secondary-background-color, #f5f5f5); border:1px solid var(--lotus-border); border-radius:10px; font:inherit; }
        input:focus, select:focus { outline:2px solid color-mix(in srgb, var(--lotus-accent) 40%, transparent); border-color:var(--lotus-accent); }
        .modal-foot { display:flex; justify-content:flex-end; gap:8px; padding:10px 14px 14px; }
        .text-button { appearance:none; min-height:38px; padding:0 14px; border:1px solid var(--lotus-border); border-radius:10px; background:transparent; color:var(--lotus-fg); font:inherit; cursor:pointer; }
        .text-button.primary { background:var(--lotus-accent); color:var(--text-primary-color,#fff); border-color:transparent; }
        @media (max-width:650px) {
          .page { padding:10px; }
          .topbar { flex-direction:column; align-items:stretch; gap:14px; min-height:0; margin:0 0 12px; padding:17px; border-radius:19px; }
          .brand { gap:13px; }
          .brand-logo-shell { width:60px; height:60px; flex-basis:60px; border-radius:16px; }
          .brand-logo { width:52px; height:52px; }
          .brand-kicker { font-size:9px; letter-spacing:.12em; }
          .brand-title { font-size:25px; }
          .brand-subtitle { margin-top:4px; font-size:12px; }
          .hero-side { flex-direction:row; align-items:center; justify-content:space-between; gap:10px; padding-top:12px; border-top:1px solid rgba(255,255,255,.16); }
          .dashboard-path { display:none; }
          .view { padding-left:12px; }
        }
      </style>
      <div class="page">
        <header class="topbar">
          <div class="brand">
            <div class="brand-logo-shell">
              <img class="brand-logo" src="${LOTUS_BRAND_ICON_URL}" alt="" aria-hidden="true">
            </div>
            <div class="brand-text">
              <div class="brand-kicker">HOME ASSISTANT · ${lotusT("Éditeur visuel de dashboards")}</div>
              <div class="brand-title">Lotus View Studio</div>
              <div class="brand-subtitle">${lotusT("Créez, organisez et personnalisez vos vues Home Assistant.")}</div>
            </div>
          </div>
          <div class="hero-side">
            <div class="hero-version">v${LOTUS_VISUAL_VERSION}</div>
            <div class="top-actions"></div>
          </div>
        </header>
        <main id="content"></main>
      </div>`;

    const actions = this.shadowRoot.querySelector(".top-actions");
    actions.append(
      makeIconButton({ icon: "mdi:translate", title: "Langue de l’interface", onClick: () => this._showLanguageDialog() }),
      makeIconButton({ icon: "mdi:refresh", title: "Actualiser", onClick: () => this._refresh() }),
      makeIconButton({ icon: "mdi:file-outline", title: "Créer un dashboard Lotus", className: "primary", onClick: () => this._showCreateDashboard() }),
    );
  }

  async _refresh() {
    if (!this._hass || this._loading) return;
    this._loading = true;
    this._error = "";
    this._renderContent();
    try {
      const dashboards = await this._hass.callWS({ type: "lovelace/dashboards/list" });
      this._dashboards = Array.isArray(dashboards) ? dashboards : [];
      this._configs.clear();
      await Promise.all(this._dashboards.map(async (dashboard) => {
        const path = dashboard.url_path;
        if (!path) return;
        try {
          const config = await this._hass.callWS({ type: "lovelace/config", url_path: path, force: true });
          this._configs.set(path, config || { views: [] });
        } catch (error) {
          this._configs.set(path, { views: [], _lotus_error: String(error?.message || error) });
        }
      }));
    } catch (error) {
      this._error = lotusT(`Impossible de lire les dashboards : ${error?.message || error}`);
    } finally {
      this._loading = false;
      this._renderContent();
    }
  }

  _renderContent() {
    const content = this.shadowRoot.getElementById("content");
    if (!content) return;
    content.replaceChildren();
    if (this._loading) {
      const loading = document.createElement("div");
      loading.className = "loading";
      loading.textContent = lotusT("Chargement…");
      content.appendChild(loading);
      return;
    }
    if (this._error) {
      const error = document.createElement("div");
      error.className = "notice error";
      error.textContent = this._error;
      content.appendChild(error);
    }
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = lotusT("Créez, organisez et personnalisez vos vues Home Assistant.");
    content.appendChild(notice);

    if (!this._dashboards.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = lotusT("Aucun dashboard en mode stockage détecté. Utilisez l’icône + pour créer votre premier dashboard Lotus.");
      content.appendChild(empty);
      return;
    }

    const list = document.createElement("section");
    list.className = "dashboards";
    for (const dashboard of this._dashboards) list.appendChild(this._renderDashboard(dashboard));
    content.appendChild(list);
  }

  _renderDashboard(dashboard) {
    const path = dashboard.url_path;
    const config = this._configs.get(path) || { views: [] };
    const section = document.createElement("article");
    section.className = "dashboard";

    const head = document.createElement("header");
    head.className = "dashboard-head";
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", dashboard.icon || "mdi:view-dashboard");
    const name = document.createElement("div");
    name.className = "dashboard-name";
    const title = document.createElement("div");
    title.className = "dashboard-title";
    title.textContent = dashboard.title || path || "Dashboard";
    const pathEl = document.createElement("div");
    pathEl.className = "dashboard-path";
    pathEl.textContent = `/${path}`;
    name.append(title, pathEl);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      makeIconButton({ icon: "mdi:open-in-new", title: "Ouvrir le dashboard", onClick: () => this._openDashboard(path) }),
      makeIconButton({ icon: "mdi:plus-box-outline", title: "Ajouter une vue Lotus", onClick: () => this._showCreateView(dashboard) }),
    );
    head.append(icon, name, actions);
    section.append(head);

    const views = document.createElement("div");
    views.className = "views";
    const configViews = Array.isArray(config.views) ? config.views : [];
    if (!configViews.length) {
      const row = document.createElement("div");
      row.className = "view";
      row.textContent = config._lotus_error ? lotusT("Configuration inaccessible") : lotusT("Aucune vue");
      views.append(row);
    } else {
      configViews.forEach((view, index) => views.append(this._renderView(dashboard, view, index)));
    }
    section.append(views);
    return section;
  }

  _renderView(dashboard, view, index) {
    const row = document.createElement("div");
    const isLotus = view?.type === LOTUS_VIEW_TYPE;
    row.className = `view${isLotus ? " lotus" : ""}`;
    const iconValue = isLotus ? "" : String(view?.icon || DEFAULT_VIEW_ICON);
    if (isLotus) {
      const brandLogo = document.createElement("img");
      brandLogo.className = "view-brand-logo";
      brandLogo.src = LOTUS_BRAND_ICON_URL;
      brandLogo.alt = "";
      brandLogo.setAttribute("aria-hidden", "true");
      row.append(brandLogo);
    } else {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", iconValue);
      row.append(icon);
    }

    const name = document.createElement("div");
    name.className = "view-name";
    const title = document.createElement("div");
    title.className = "view-title";
    title.textContent = view?.title || view?.path || `${lotusT("Vue")} ${index + 1}`;
    const meta = document.createElement("div");
    meta.className = "view-meta";
    meta.textContent = isLotus ? lotusT("Vue Lotus") : (view?.type || "masonry");
    name.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(makeIconButton({ icon: "mdi:open-in-new", title: "Ouvrir cette vue", onClick: () => this._openDashboard(dashboard.url_path, view?.path) }));
    if (!isLotus) {
      actions.append(makeIconButton({ icon: "mdi:sprout", title: "Convertir cette vue en vue Lotus View Studio", onClick: () => this._convertView(dashboard, index) }));
    }
    row.append(name, actions);
    return row;
  }

  async _saveConfig(path, config) {
    if (!this._hass) throw new Error(lotusT("Home Assistant indisponible"));
    await this._hass.callWS({ type: "lovelace/config/save", url_path: path, config });
    this._configs.set(path, config);
  }

  _openDashboard(path, viewPath = "") {
    const suffix = viewPath ? `/${viewPath}` : "";
    history.pushState(null, "", `/${path}${suffix}`);
    window.dispatchEvent(new Event("location-changed"));
  }

  _showCreateDashboard() {
    const backdrop = this._modal(lotusT("Nouveau dashboard Lotus"));
    const body = backdrop.querySelector(".modal-body");
    const titleInput = document.createElement("input");
    titleInput.placeholder = lotusT("Nom");
    titleInput.value = "Lotus";
    const pathInput = document.createElement("input");
    pathInput.placeholder = lotusT("Chemin");
    pathInput.value = "lotus";
    const viewTitle = document.createElement("input");
    viewTitle.placeholder = lotusT("Première vue");
    viewTitle.value = lotusT("Accueil");
    body.append(this._field("Nom", titleInput), this._field("Chemin", pathInput), this._field("Première vue", viewTitle));
    const primary = backdrop.querySelector(".text-button.primary");
    primary.textContent = lotusT("Créer");
    primary.onclick = async () => {
      const title = titleInput.value.trim() || "Lotus";
      const path = lotusSlugify(pathInput.value || title);
      if (!path) return;
      primary.disabled = true;
      try {
        await this._hass.callWS({ type: "lovelace/dashboards/create", url_path: path, title, icon: "mdi:view-dashboard-outline", show_in_sidebar: true, require_admin: false });
        const config = { views: [{ type: LOTUS_VIEW_TYPE, title: viewTitle.value.trim() || lotusT("Accueil"), path: "home", lotus: { layers: [] }, cards: [] }] };
        await this._saveConfig(path, config);
        backdrop.remove();
        await this._refresh();
      } catch (error) {
        alert(lotusT(`Création impossible : ${error?.message || error}`));
        primary.disabled = false;
      }
    };
  }

  _showCreateView(dashboard) {
    const path = dashboard.url_path;
    const backdrop = this._modal(lotusT("Ajouter une vue Lotus"));
    const body = backdrop.querySelector(".modal-body");
    const titleInput = document.createElement("input");
    titleInput.placeholder = lotusT("Nom");
    titleInput.value = lotusT("Nouvelle vue");
    const pathInput = document.createElement("input");
    pathInput.placeholder = lotusT("Chemin");
    pathInput.value = "vue";
    body.append(this._field("Nom", titleInput), this._field("Chemin", pathInput));
    const primary = backdrop.querySelector(".text-button.primary");
    primary.textContent = lotusT("Ajouter");
    primary.onclick = async () => {
      const config = deepClone(this._configs.get(path) || { views: [] });
      config.views = Array.isArray(config.views) ? config.views : [];
      const title = titleInput.value.trim() || lotusT("Nouvelle vue");
      let viewPath = lotusSlugify(pathInput.value || title) || `vue-${config.views.length + 1}`;
      const used = new Set(config.views.map((v) => v?.path).filter(Boolean));
      if (used.has(viewPath)) viewPath = `${viewPath}-${config.views.length + 1}`;
      config.views.push({ type: LOTUS_VIEW_TYPE, title, path: viewPath, lotus: { layers: [] }, cards: [] });
      primary.disabled = true;
      try {
        await this._saveConfig(path, config);
        backdrop.remove();
        this._renderContent();
      } catch (error) {
        alert(lotusT(`Ajout impossible : ${error?.message || error}`));
        primary.disabled = false;
      }
    };
  }

  async _convertView(dashboard, index) {
    const path = dashboard.url_path;
    const config = deepClone(this._configs.get(path) || { views: [] });
    if (!config.views?.[index]) return;
    const view = config.views[index];
    view.type = LOTUS_VIEW_TYPE;
    view.lotus = view.lotus || { layers: [] };
    try {
      await this._saveConfig(path, config);
      this._renderContent();
    } catch (error) {
      alert(lotusT(`Conversion impossible : ${error?.message || error}`));
    }
  }

  _showLanguageDialog() {
    const backdrop = this._modal(lotusT("Langue de l’interface"));
    const body = backdrop.querySelector(".modal-body");
    const select = document.createElement("select");
    const autoLanguage = lotusGetAutomaticLanguage();
    for (const language of LOTUS_LANGUAGES) {
      const option = document.createElement("option");
      option.value = language.value;
      option.textContent = language.value === "auto"
        ? `${lotusT("Automatique — Home Assistant")} (${autoLanguage})`
        : `${language.nativeName} — ${language.englishName}`;
      select.appendChild(option);
    }
    select.value = lotusGetLanguagePreference();
    const info = document.createElement("div");
    info.className = "notice";
    info.textContent = `${lotusT("Suivre automatiquement la langue choisie dans Home Assistant.")} ${lotusT("La préférence est enregistrée pour votre utilisateur Home Assistant.")}`;
    body.append(this._field("Langue", select), info);
    const primary = backdrop.querySelector(".text-button.primary");
    primary.textContent = lotusT("Appliquer");
    primary.onclick = async () => {
      primary.disabled = true;
      try {
        await lotusSetLanguagePreference(select.value, this._hass);
        this._renderShell();
        this._renderContent();
        backdrop.remove();
      } catch (error) {
        alert(lotusT(`Impossible d’enregistrer la langue : ${error?.message || error}`));
        primary.disabled = false;
      }
    };
  }

  _field(labelText, control) {
    const label = document.createElement("label");
    const text = document.createElement("span");
    text.textContent = lotusT(labelText);
    label.append(text, control);
    return label;
  }

  _modal(titleText) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <section class="modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <strong>${lotusT(titleText)}</strong>
          <button class="text-button close" type="button">${lotusT("Fermer")}</button>
        </header>
        <div class="modal-body"></div>
        <footer class="modal-foot">
          <button class="text-button cancel" type="button">${lotusT("Annuler")}</button>
          <button class="text-button primary" type="button">${lotusT("Enregistrer")}</button>
        </footer>
      </section>`;
    const close = () => backdrop.remove();
    backdrop.querySelector(".close").onclick = close;
    backdrop.querySelector(".cancel").onclick = close;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.body.append(backdrop);
    return backdrop;
  }
}

if (!customElements.get("lotus-visual-manager")) customElements.define("lotus-visual-manager", LotusVisualManager);
