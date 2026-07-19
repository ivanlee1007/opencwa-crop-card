import {
  buildCropModel,
  CARD_VERSION,
  escapeHtml,
  formatTimestamp,
  normalizedConfig,
  selectLayout,
} from "./core.js";

const ICONS = {
  warning: "mdi:alert-octagon",
  advisory: "mdi:alert",
  normal: "mdi:shield-check",
  "no-data": "mdi:database-alert-outline",
  unavailable: "mdi:cloud-alert",
};

const css = String.raw`
  :host { display:block; height:100%; min-width:0; container-type:inline-size; }
  ha-card { --crop-accent:#2f7d4f; --crop-soft:#eaf5ed; display:flex; flex-direction:column; width:100%; height:100%; min-height:64px; box-sizing:border-box; overflow:hidden; position:relative; color:var(--primary-text-color); background:var(--ha-card-background,var(--card-background-color,#fff)); border-radius:var(--ha-card-border-radius,16px); }
  * { box-sizing:border-box; }
  button { font:inherit; }
  .crop-shell { display:flex; flex-direction:column; min-width:0; height:100%; }
  .crop-header { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:12px; padding:16px 18px 12px; border-bottom:1px solid color-mix(in srgb,var(--divider-color,#d7dce0) 75%,transparent); }
  .crop-mark { width:42px; height:42px; display:grid; place-items:center; border-radius:13px; color:#fff; background:linear-gradient(145deg,#2f7d4f,#4da96e); box-shadow:0 6px 16px rgba(31,111,67,.24); }
  .crop-mark ha-icon { --mdc-icon-size:25px; }
  .crop-heading { min-width:0; }
  .eyebrow { color:var(--secondary-text-color); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .crop-title { margin:2px 0 0; font-size:clamp(19px,3.5cqw,27px); line-height:1.15; font-weight:750; overflow-wrap:anywhere; }
  .level-chip { display:flex; align-items:center; gap:6px; min-width:max-content; padding:7px 10px; border-radius:999px; font-size:12px; font-weight:750; color:#25633f; background:var(--crop-soft); }
  .level-chip .dot { width:7px; height:7px; border-radius:50%; background:#36a664; }
  .level-warning .level-chip { color:#991b1b; background:#fee2e2; }
  .level-warning .level-chip .dot { background:#dc2626; }
  .level-advisory .level-chip { color:#7a4a00; background:#fff0c2; }
  .level-advisory .level-chip .dot { background:#d99000; }
  .crop-body { min-width:0; overflow:auto; padding:14px 18px 18px; scrollbar-width:thin; }
  .alert { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:start; gap:12px; padding:14px; border-radius:14px; border:1px solid; overflow:hidden; }
  .alert::before { content:""; position:absolute; inset:0 auto 0 0; width:5px; background:currentColor; }
  .alert-warning { color:#fff; border-color:#b91c1c; background:linear-gradient(135deg,#991b1b 0%,#c62828 55%,#a71313 100%); box-shadow:0 10px 25px rgba(153,27,27,.24); }
  .alert-advisory { color:#4a2b00; border-color:#f4b942; background:linear-gradient(135deg,#fff3cd,#ffe29a); }
  .alert-normal { color:#175b34; border-color:#a5d8b5; background:#edf8f0; }
  .alert-no-data,.alert-unavailable { color:var(--primary-text-color); border-color:#b9c5ce; background:color-mix(in srgb,var(--secondary-background-color,#eef2f4) 88%,transparent); }
  .alert-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,.18); }
  .alert-icon ha-icon { --mdc-icon-size:23px; }
  .alert-copy { min-width:0; }
  .alert-kicker { font-size:11px; font-weight:850; letter-spacing:.08em; text-transform:uppercase; opacity:.9; }
  .alert-title { margin-top:2px; font-size:16px; line-height:1.3; font-weight:800; overflow-wrap:anywhere; }
  .alert-summary { margin-top:5px; font-size:13px; line-height:1.55; opacity:.94; white-space:pre-wrap; overflow-wrap:anywhere; }
  .alert-toggle { border:0; min-width:max-content; color:inherit; background:rgba(255,255,255,.18); padding:6px 9px; border-radius:999px; cursor:pointer; font-weight:750; }
  .alert-normal .alert-toggle,.alert-advisory .alert-toggle,.alert-no-data .alert-toggle { background:rgba(0,0,0,.07); }
  .alert-list { grid-column:2/-1; display:grid; gap:8px; margin-top:2px; }
  .alert-item { padding:10px 12px; border-radius:10px; background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.19); }
  .alert-advisory .alert-item,.alert-normal .alert-item,.alert-no-data .alert-item { background:rgba(255,255,255,.5); border-color:rgba(0,0,0,.08); }
  .alert-item-title { font-weight:800; }
  .alert-item-meta { margin-top:3px; font-size:12px; opacity:.85; }
  .section-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); gap:12px; margin-top:12px; }
  .panel { grid-column:span 6; min-width:0; padding:14px; border:1px solid color-mix(in srgb,var(--divider-color,#d9dee2) 75%,transparent); border-radius:14px; background:color-mix(in srgb,var(--card-background-color,#fff) 92%,var(--secondary-background-color,#eef2f4)); }
  .panel-wide { grid-column:1/-1; }
  .panel-title { display:flex; align-items:center; gap:8px; margin:0 0 11px; font-size:13px; font-weight:800; color:var(--primary-text-color); }
  .panel-title ha-icon { color:var(--crop-accent); --mdc-icon-size:19px; }
  .action-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .action { min-width:0; padding:11px 12px; border-radius:11px; background:var(--secondary-background-color,#f1f4f5); }
  .action-label { display:flex; gap:7px; align-items:center; color:var(--secondary-text-color); font-size:11px; font-weight:750; }
  .action-label ha-icon { --mdc-icon-size:17px; color:var(--crop-accent); }
  .action-text { margin-top:6px; font-size:13px; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
  .metric-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
  .metric { min-width:0; border:0; text-align:left; color:inherit; cursor:pointer; padding:10px 11px; border-radius:11px; background:var(--secondary-background-color,#f1f4f5); }
  .metric:hover { background:color-mix(in srgb,var(--crop-soft) 68%,var(--secondary-background-color,#f1f4f5)); }
  .metric-label { display:flex; align-items:center; gap:6px; color:var(--secondary-text-color); font-size:11px; }
  .metric-label ha-icon { --mdc-icon-size:16px; color:var(--crop-accent); }
  .metric-value { margin-top:4px; font-size:17px; font-weight:780; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .metric.unavailable .metric-value { color:var(--disabled-text-color,#8b949b); }
  .profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px 14px; }
  .datum { min-width:0; }
  .datum-label { color:var(--secondary-text-color); font-size:11px; }
  .datum-value { margin-top:2px; font-size:13px; font-weight:680; overflow-wrap:anywhere; }
  details.rule { border-top:1px solid var(--divider-color,#e1e4e6); }
  details.rule:first-of-type { border-top:0; }
  details.rule summary { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; cursor:pointer; padding:10px 2px; font-size:13px; font-weight:720; }
  .rule-stage { color:var(--secondary-text-color); font-size:11px; font-weight:600; }
  .rule-body { display:grid; gap:8px; padding:0 2px 12px; }
  .rule-row { display:grid; grid-template-columns:72px minmax(0,1fr); gap:8px; font-size:12px; line-height:1.5; }
  .rule-row strong { color:var(--secondary-text-color); }
  .source { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:12px; color:var(--secondary-text-color); font-size:11px; }
  .source span { display:flex; align-items:center; gap:4px; }
  .source ha-icon { --mdc-icon-size:14px; }
  .empty { display:grid; place-items:center; min-height:180px; padding:24px; text-align:center; color:var(--secondary-text-color); }
  .empty ha-icon { --mdc-icon-size:38px; color:var(--crop-accent); margin-bottom:8px; }
  .tiny .crop-header { display:none; }
  .tiny .crop-body { height:100%; padding:6px; overflow:auto; }
  .tiny .alert { min-height:52px; grid-template-columns:auto minmax(0,1fr) auto; padding:7px 8px; gap:7px; cursor:pointer; }
  .tiny .alert-icon { width:28px; height:28px; }
  .tiny .alert-kicker { display:none; }
  .tiny .alert-title { font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tiny .alert-summary { display:-webkit-box; margin-top:2px; font-size:10px; line-height:1.25; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
  .tiny .alert-list { display:none; }
  .tiny .alert-toggle { align-self:center; font-size:10px; padding:3px 6px; }
  .tiny .section-grid { display:none; }
  .tiny .source { display:none; }
  .compact .crop-header { padding:12px 14px 9px; }
  .compact .crop-body { padding:10px 14px 14px; }
  .compact .section-grid { grid-template-columns:1fr; }
  .compact .panel { grid-column:1; }
  .compact .action-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .portrait .crop-header { grid-template-columns:auto minmax(0,1fr); justify-items:stretch; text-align:left; gap:8px; padding:9px 10px; }
  .portrait .crop-mark { width:34px; height:34px; border-radius:10px; }
  .portrait .eyebrow,.portrait .level-chip { display:none; }
  .portrait .crop-title { margin:0; align-self:center; font-size:16px; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .portrait .crop-body { padding:8px 10px 12px; }
  .portrait .alert { grid-template-columns:minmax(0,1fr) auto; justify-items:stretch; text-align:left; gap:8px; padding:10px; }
  .portrait .alert-icon { display:none; }
  .portrait .alert-toggle { min-width:0; max-width:100%; }
  .portrait .alert-list { grid-column:1/-1; width:100%; text-align:left; }
  .portrait .section-grid { grid-template-columns:1fr; }
  .portrait .panel { grid-column:1; }
  .portrait .action-grid,.portrait .metric-grid,.portrait .profile-grid { grid-template-columns:1fr; }
  .portrait .rule-row { grid-template-columns:1fr; gap:3px; }
  .portrait .rule-row span { min-width:0; overflow-wrap:anywhere; }
  .portrait .source { justify-content:center; text-align:center; }
  .expanded .section-grid { gap:16px; }
  .expanded .panel { padding:17px; }
  .expanded .metric-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
  @media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; transition:none!important; animation:none!important; } }
`;

function icon(name) {
  return `<ha-icon icon="${escapeHtml(name)}"></ha-icon>`;
}

function profileDatum(label, value) {
  return `<div class="datum"><div class="datum-label">${escapeHtml(label)}</div><div class="datum-value">${escapeHtml(value)}</div></div>`;
}

export class OpenCwaCropCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = normalizedConfig({});
    this._layout = "regular";
    this._expandedAlerts = false;
    this._renderQueued = false;
    this._observer = null;
  }

  setConfig(config) {
    this._config = normalizedConfig(config);
    this._expandedAlerts = this._config.default_expand_alerts;
    this._measure();
    this._queueRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._queueRender();
  }

  get hass() { return this._hass; }

  connectedCallback() {
    this._ensureObserver();
    this._queueRender();
  }

  disconnectedCallback() {
    this._observer?.disconnect();
  }

  _ensureObserver() {
    if (!this._observer && "ResizeObserver" in window) {
      this._observer = new ResizeObserver((entries) => {
        const box = entries[0]?.contentRect;
        if (!box) return;
        const next = selectLayout(box.width, box.height);
        if (next !== this._layout) {
          this._layout = next;
          this._queueRender();
        }
      });
    }
    this._observer?.observe(this);
  }

  _measure() {
    const box = this.getBoundingClientRect?.();
    if (box) this._layout = selectLayout(box.width, box.height);
  }

  _queueRender() {
    if (!this.isConnected || this._renderQueued) return;
    this._renderQueued = true;
    queueMicrotask(() => {
      this._renderQueued = false;
      this._render();
    });
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _renderError(code) {
    const copy = code === "not_configured"
      ? "請在卡片設定中選擇一筆 OpenCWA 作物"
      : code === "profile_mismatch"
        ? "作物識別已變更，請在卡片設定中重新選擇作物"
        : "找不到已設定的 OpenCWA 作物實體";
    return `<ha-card><style>${css}</style><div class="empty">${icon("mdi:sprout-outline")}<div><strong>OpenCWA 作物輔助</strong><br>${escapeHtml(copy)}</div></div></ha-card>`;
  }

  _renderAlert(model) {
    const count = model.items.length;
    const visible = this._expandedAlerts ? model.items : model.items.slice(0, 1);
    const more = Math.max(0, count - 1);
    const list = visible.length ? `<div class="alert-list">${visible.map((item) => `
      <div class="alert-item">
        <div class="alert-item-title">${escapeHtml(item.disaster || "農業風險")}</div>
        <div class="alert-item-meta">${escapeHtml([item.stage || item.growth, item.threshold && item.measures ? `門檻 ${item.threshold} ${item.measures}` : ""].filter(Boolean).join(" · "))}</div>
      </div>`).join("")}</div>` : "";
    const toggle = count > 1 ? `<button class="alert-toggle" data-alert-toggle aria-expanded="${this._expandedAlerts}">${this._expandedAlerts ? "收合" : `+${more}`}</button>` : "";
    const summary = model.summary ? `<div class="alert-summary">${escapeHtml(model.summary)}</div>` : "";
    const accessibility = [model.levelLabel, model.headline, model.summary, model.items[0]?.prevention ? `立即防範：${model.items[0].prevention}` : ""].filter(Boolean).join("。");
    return `<section class="alert alert-${model.level}" data-entity="${escapeHtml(model.entities.notification)}" role="button" tabindex="0" aria-label="${escapeHtml(accessibility)}">
      <div class="alert-icon">${icon(ICONS[model.level] || ICONS.unavailable)}</div>
      <div class="alert-copy"><div class="alert-kicker">${escapeHtml(model.levelLabel)}</div><div class="alert-title">${escapeHtml(model.headline)}</div>${summary}</div>
      ${toggle}${list}
    </section>`;
  }

  _renderActions(model) {
    const item = model.items[0] || {};
    const prevention = item.prevention || (model.level === "normal" ? "維持例行巡田與灌溉紀錄。" : "目前沒有可用的即時防範建議，請參考作物風險知識庫。" );
    const recovery = item.recovery || "若災害發生，先記錄田區狀況並依專業農業單位指引處置。";
    return `<section class="panel panel-wide action-panel"><h3 class="panel-title">${icon("mdi:clipboard-check-outline")}現在要做</h3><div class="action-grid">
      <div class="action"><div class="action-label">${icon("mdi:shield-sun-outline")}立即防範</div><div class="action-text">${escapeHtml(prevention)}</div></div>
      <div class="action"><div class="action-label">${icon("mdi:leaf-circle-outline")}災後復耕</div><div class="action-text">${escapeHtml(recovery)}</div></div>
    </div></section>`;
  }

  _renderMetrics(model) {
    return `<section class="panel metrics-panel"><h3 class="panel-title">${icon("mdi:watering-can-outline")}灌溉參考</h3><div class="metric-grid">${model.metrics.map((metric) => `<button class="metric ${metric.available ? "" : "unavailable"}" data-entity="${escapeHtml(metric.entity)}"><div class="metric-label">${icon(metric.icon)}${escapeHtml(metric.label)}</div><div class="metric-value">${escapeHtml(metric.value)}</div></button>`).join("")}</div></section>`;
  }

  _renderProfile(model) {
    return `<section class="panel profile-panel"><h3 class="panel-title">${icon("mdi:sprout-outline")}作物檔案</h3><div class="profile-grid">
      ${profileDatum("目前生育期", model.profile.growthStage)}${profileDatum("風險適用期", model.profile.stage)}${profileDatum("種植日期", model.profile.plantingDate)}${profileDatum("種植面積", model.profile.area)}${profileDatum("資料地點", model.profile.location)}${profileDatum("命中規則", `${model.counts.matched} 項`)}
    </div></section>`;
  }

  _renderKnowledge(model) {
    if (!this._config.show_knowledge) return "";
    const rules = model.rules.length ? model.rules.map((rule) => `<details class="rule"><summary><span>${escapeHtml(rule.disaster || "農業風險")}</span><span class="rule-stage">${escapeHtml(rule.stage || rule.growth || "")}</span></summary><div class="rule-body">
      ${rule.effect ? `<div class="rule-row"><strong>可能影響</strong><span>${escapeHtml(rule.effect)}</span></div>` : ""}
      ${rule.prevention ? `<div class="rule-row"><strong>事前防範</strong><span>${escapeHtml(rule.prevention)}</span></div>` : ""}
      ${rule.recovery ? `<div class="rule-row"><strong>復耕處置</strong><span>${escapeHtml(rule.recovery)}</span></div>` : ""}
      ${rule.threshold ? `<div class="rule-row"><strong>參考門檻</strong><span>${escapeHtml(`${rule.threshold} ${rule.measures || ""}／${rule.duration || "—"} 小時`)}</span></div>` : ""}
    </div></details>`).join("") : `<div class="action-text">尚無此作物的風險規則。</div>`;
    return `<section class="panel panel-wide knowledge-panel"><h3 class="panel-title">${icon("mdi:book-open-variant")}作物風險知識庫</h3>${rules}</section>`;
  }

  _renderSource(model) {
    if (!this._config.show_source) return "";
    const locale = this._hass?.locale?.language || "zh-TW";
    const zone = this._hass?.config?.time_zone || "Asia/Taipei";
    const freshness = model.source.stale ? "資料可能過期" : model.source.providerAvailable ? "來源已連線" : "來源暫時不可用";
    return `<footer class="source"><span>${icon("mdi:database-outline")}${escapeHtml(model.source.provider)}</span><span>${icon("mdi:clock-outline")}${escapeHtml(formatTimestamp(model.source.timestamp, locale, zone))}</span><span>${icon(model.source.stale ? "mdi:alert-circle-outline" : "mdi:check-circle-outline")}${escapeHtml(freshness)}</span></footer>`;
  }

  _render() {
    if (!this.shadowRoot) return;
    const model = buildCropModel(this._hass?.states || {}, this._config);
    if (model.error) {
      this.shadowRoot.innerHTML = this._renderError(model.error);
      return;
    }
    const title = this._config.title || model.cropName;
    this.shadowRoot.innerHTML = `<ha-card class="${escapeHtml(this._layout)} level-${escapeHtml(model.level)}" aria-label="${escapeHtml(`${title}，${model.levelLabel}，${model.headline}`)}"><style>${css}</style><div class="crop-shell">
      <header class="crop-header" data-entity="${escapeHtml(model.entities.status)}"><div class="crop-mark">${icon("mdi:sprout")}</div><div class="crop-heading"><div class="eyebrow">OpenCWA · 農耕決策輔助</div><h2 class="crop-title">${escapeHtml(title)}</h2></div><div class="level-chip"><span class="dot"></span><span>${escapeHtml(model.levelLabel)}</span></div></header>
      <div class="crop-body">${this._renderAlert(model)}<div class="section-grid">${this._renderActions(model)}${this._renderMetrics(model)}${this._renderProfile(model)}${this._renderKnowledge(model)}</div>${this._renderSource(model)}</div>
    </div></ha-card>`;
    this.shadowRoot.querySelector("[data-alert-toggle]")?.addEventListener("click", () => { this._expandedAlerts = !this._expandedAlerts; this._render(); });
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((element) => {
      const open = (event) => {
        if (event.target.closest?.("[data-alert-toggle]")) return;
        this._moreInfo(element.dataset.entity);
      };
      element.addEventListener("click", open);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") open(event);
      });
    });
  }

  getCardSize() { return 7; }
  getGridOptions() { return { columns: 12, rows: 7, min_columns: 3, min_rows: 1 }; }

  static async getConfigElement() {
    return document.createElement("opencwa-crop-card-editor");
  }

  static getStubConfig(hass) {
    const options = Object.values(hass?.states || {}).filter((stateObj) => stateObj?.entity_id?.endsWith("_agricultural_advisory_status") && stateObj.attributes?.crop_profile_id);
    return { entity: options[0]?.entity_id || "", profile_id: options[0]?.attributes?.crop_profile_id || "" };
  }
}

if (!customElements.get("opencwa-crop-card")) customElements.define("opencwa-crop-card", OpenCwaCropCard);
console.info(`%c OPEN CWA CROP CARD %c v${CARD_VERSION} `, "color:white;background:#2f7d4f;font-weight:700;padding:2px 5px;border-radius:4px 0 0 4px", "color:#2f7d4f;background:#eaf5ed;padding:2px 5px;border-radius:0 4px 4px 0");
