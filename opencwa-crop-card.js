/* OpenCWA Crop Card v1.0.3 | MIT */
(() => {
  // src/core.js
  var CARD_VERSION = "1.0.3";
  var STATUS_SUFFIX = "_agricultural_advisory_status";
  var ENTITY_SUFFIXES = Object.freeze({
    status: "_agricultural_advisory_status",
    notification: "_agricultural_advisory_notification",
    warning: "_crop_warning",
    advisory: "_crop_advisory",
    supported: "_crop_data_supported",
    et0: "_reference_evapotranspiration",
    kc: "_crop_coefficient",
    etc: "_crop_evapotranspiration",
    water: "_crop_water_requirement"
  });
  var BAD_STATES = /* @__PURE__ */ new Set(["unknown", "unavailable", "none", "null", ""]);
  var WARNING_STATES = /* @__PURE__ */ new Set(["warning", "danger", "critical", "severe"]);
  var ADVISORY_STATES = /* @__PURE__ */ new Set(["advisory", "active", "watch"]);
  function isUsableState(stateObj) {
    return Boolean(stateObj && !BAD_STATES.has(String(stateObj.state ?? "").toLowerCase()));
  }
  function cropEntityMap(anchorEntity) {
    if (typeof anchorEntity !== "string" || !anchorEntity.endsWith(STATUS_SUFFIX)) return {};
    const root = anchorEntity.slice(0, -STATUS_SUFFIX.length);
    return Object.fromEntries(Object.entries(ENTITY_SUFFIXES).map(([key, suffix]) => [key, `${root}${suffix}`]));
  }
  function findCropOptions(states = {}) {
    return Object.values(states).filter((stateObj) => stateObj?.entity_id?.endsWith(STATUS_SUFFIX)).map((stateObj) => {
      const profileId = stateObj.attributes?.crop_profile_id || "";
      const cropName = stateObj.attributes?.crop_name || stateObj.attributes?.friendly_name || stateObj.entity_id;
      const town = stateObj.attributes?.items?.[0]?.town || "";
      const identity = (profileId || stateObj.entity_id).slice(-6).toUpperCase();
      return {
        entity: stateObj.entity_id,
        profileId,
        cropName,
        town,
        label: [cropName, town, identity].filter(Boolean).join(" \xB7 "),
        supported: stateObj.attributes?.supported !== false
      };
    }).sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
  }
  function selectLayout(width, height) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (w <= 380 && h >= 250 && h / Math.max(w, 1) >= 1.12) return "portrait";
    if (w < 280 && h < 250) return "tiny";
    if (w < 560 || h < 300) return "compact";
    if (w >= 900 && h >= 430) return "expanded";
    return "regular";
  }
  function normalizedConfig(config = {}) {
    if (!config || typeof config !== "object") throw new Error("Invalid card configuration");
    return {
      type: "custom:opencwa-crop-card",
      entity: typeof config.entity === "string" ? config.entity.trim() : "",
      profile_id: typeof config.profile_id === "string" ? config.profile_id.trim() : "",
      title: typeof config.title === "string" ? config.title.trim() : "",
      show_knowledge: config.show_knowledge !== false,
      show_source: config.show_source !== false,
      default_expand_alerts: config.default_expand_alerts === true
    };
  }
  function levelFor(status, siblings = {}) {
    const attrs = status?.attributes || {};
    const state = String(status?.state || "").toLowerCase();
    if (!status || BAD_STATES.has(state)) return "unavailable";
    if (attrs.provider_available === false) return "unavailable";
    if (state === "no_data" || attrs.supported === false || siblings.supported?.state === "off") return "no-data";
    if (siblings.warning?.state === "on" || attrs.warning_active === true || WARNING_STATES.has(state)) return "warning";
    if (siblings.advisory?.state === "on" || attrs.advisory_active === true || ADVISORY_STATES.has(state)) return "advisory";
    return "normal";
  }
  function severityRank(item) {
    const value = String(item?.classification || item?.severity || "").toLowerCase();
    if (WARNING_STATES.has(value) || value === "warning") return 0;
    if (ADVISORY_STATES.has(value) || value === "advisory") return 1;
    return 2;
  }
  function valueOf(stateObj, digits = 2) {
    if (!isUsableState(stateObj)) return { value: "\u2014", available: false };
    const raw = stateObj.state;
    const parsed = Number(raw);
    const value = Number.isFinite(parsed) ? parsed.toLocaleString(void 0, { maximumFractionDigits: digits }) : String(raw);
    const unit = stateObj.attributes?.unit_of_measurement || "";
    return { value: `${value}${unit ? ` ${unit}` : ""}`, available: true };
  }
  function comparableText(value) {
    return String(value ?? "").normalize("NFKC").toLocaleLowerCase("zh-Hant").replace(/[\p{P}\p{S}\s]/gu, "");
  }
  function removeRepeatedSummary(headline, summary) {
    const copy = String(summary ?? "").trim();
    return copy && comparableText(headline) === comparableText(copy) ? "" : copy;
  }
  function buildCropModel(states = {}, config = {}) {
    const normalized = normalizedConfig(config);
    const entities = cropEntityMap(normalized.entity);
    const status = states[entities.status];
    if (!normalized.entity) return { error: "not_configured", config: normalized, entities };
    if (!status) return { error: "entity_missing", config: normalized, entities };
    const attrs = status.attributes || {};
    const profileId = attrs.crop_profile_id || attrs.profile_id || "";
    if (normalized.profile_id && normalized.profile_id !== profileId) {
      return { error: "profile_mismatch", config: normalized, entities };
    }
    const notification = states[entities.notification];
    const rawItems = Array.isArray(attrs.items) ? [...attrs.items].sort((a, b) => severityRank(a) - severityRank(b)) : [];
    const rules = Array.isArray(attrs.rules) ? attrs.rules : [];
    const level = levelFor(status, {
      warning: states[entities.warning],
      advisory: states[entities.advisory],
      supported: states[entities.supported]
    });
    const items = level === "unavailable" || level === "no-data" ? [] : rawItems;
    const metrics = [
      ["et0", "\u53C3\u8003\u84B8\u6563 ET\u2080", "mdi:weather-sunny"],
      ["kc", "\u4F5C\u7269\u4FC2\u6578 Kc", "mdi:sprout"],
      ["etc", "\u4F5C\u7269\u84B8\u6563 ETc", "mdi:water-percent"],
      ["water", "\u4F5C\u7269\u9700\u6C34\u91CF", "mdi:watering-can"]
    ].map(([key, label, icon2]) => ({ key, label, icon: icon2, entity: entities[key], ...valueOf(states[entities[key]]) }));
    const unavailableCopy = level === "unavailable";
    const noDataCopy = level === "no-data";
    const headline = unavailableCopy ? "\u8FB2\u696D\u8CC7\u6599\u66AB\u6642\u7121\u6CD5\u53D6\u5F97" : noDataCopy ? "\u76EE\u524D\u6C92\u6709\u76F8\u7B26\u7684\u4F5C\u7269\u5C08\u5C6C\u8CC7\u6599" : notification?.attributes?.title || (level === "warning" ? "\u4E00\u7D1A\u8FB2\u696D\u8B66\u793A" : level === "advisory" ? "\u8FB2\u8015\u6CE8\u610F\u4E8B\u9805" : "\u76EE\u524D\u4F5C\u7269\u98A8\u96AA\u6982\u6CC1");
    const rawSummary = unavailableCopy ? "\u76EE\u524D\u7121\u6CD5\u78BA\u8A8D\u5373\u6642\u8FB2\u696D\u98A8\u96AA\uFF0C\u8ACB\u76F4\u63A5\u5DE1\u67E5\u7530\u5340\u4E26\u7A0D\u5F8C\u91CD\u65B0\u6574\u7406\u3002" : noDataCopy ? "\u8CC7\u6599\u4E0D\u8DB3\u4E0D\u4EE3\u8868\u6C92\u6709\u8FB2\u696D\u98A8\u96AA\uFF0C\u8ACB\u6301\u7E8C\u7559\u610F\u4E00\u822C\u6C23\u8C61\u8B66\u7279\u5831\u8207\u7530\u9593\u72C0\u6CC1\u3002" : notification?.attributes?.summary || notification?.attributes?.message || "\u76EE\u524D\u6C92\u6709\u4F5C\u7269\u5C08\u5C6C\u8B66\u793A";
    const summary = removeRepeatedSummary(headline, rawSummary);
    return {
      error: null,
      config: normalized,
      entities,
      profileId,
      cropName: attrs.crop_name || status.attributes?.friendly_name || "\u4F5C\u7269",
      level,
      levelLabel: { warning: "\u4E00\u7D1A\u8B66\u793A", advisory: "\u6CE8\u610F", normal: "\u6B63\u5E38", "no-data": "\u8CC7\u6599\u4E0D\u8DB3", unavailable: "\u7121\u6CD5\u53D6\u5F97" }[level],
      headline,
      summary,
      items,
      rules,
      metrics,
      profile: {
        growthStage: attrs.growth_stage || items[0]?.growth || "\u672A\u8A2D\u5B9A",
        stage: items[0]?.stage || "\u2014",
        plantingDate: attrs.planting_date || "\u672A\u8A2D\u5B9A",
        area: attrs.area_hectares == null ? "\u672A\u8A2D\u5B9A" : `${attrs.area_hectares} ha`,
        location: [items[0]?.city, items[0]?.town].filter(Boolean).join(" ") || "\u2014"
      },
      counts: {
        warning: Number(attrs.warning_count) || 0,
        advisory: Number(attrs.advisory_count) || 0,
        matched: Number(attrs.matched_total) || items.length
      },
      source: {
        provider: attrs.source_provider || attrs.agricultural_source || notification?.attributes?.source_provider || "OpenCWA",
        timestamp: attrs.source_timestamp || notification?.attributes?.source_timestamp || attrs.last_success_at || status.last_updated || null,
        stale: attrs.stale === true,
        providerAvailable: attrs.provider_available !== false,
        derived: attrs.derived_by_opencwa === true
      }
    };
  }
  function formatTimestamp(value, locale = "zh-TW", timeZone = "Asia/Taipei") {
    if (!value) return "\u2014";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "\u2014";
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
    } catch {
      return "\u2014";
    }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  // src/editor.js
  var editorCss = `
  :host{display:block;min-width:0;color:var(--primary-text-color)}
  .editor{display:grid;min-width:0;gap:16px;padding:4px 0 12px}
  .section{display:grid;min-width:0;gap:10px;padding:14px;border:1px solid var(--divider-color,#ddd);border-radius:12px;background:var(--card-background-color,#fff)}
  .section-title{display:flex;align-items:center;gap:8px;font-weight:750;font-size:14px}
  .section-title ha-icon{--mdc-icon-size:20px;color:var(--primary-color,#03a9f4)}
  label.field{display:grid;min-width:0;gap:6px;color:var(--secondary-text-color);font-size:12px;font-weight:650}
  select,input[type=text]{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:42px;padding:9px 11px;border:1px solid var(--input-idle-line-color,#a7adb2);border-radius:8px;background:var(--input-fill-color,var(--card-background-color,#fff));color:var(--primary-text-color);font:inherit;font-size:14px}
  select:focus,input:focus{outline:2px solid color-mix(in srgb,var(--primary-color,#03a9f4) 55%,transparent);outline-offset:1px}
  .toggle{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--divider-color,#eee)}
  .toggle:first-of-type{border-top:0}
  .toggle strong{display:block;font-size:13px}
  .toggle span{display:block;margin-top:2px;color:var(--secondary-text-color);font-size:11px;line-height:1.4}
  input[type=checkbox]{width:20px;height:20px;accent-color:var(--primary-color,#03a9f4)}
  .empty{padding:10px 12px;border-radius:8px;background:var(--secondary-background-color,#f2f4f5);font-size:12px;line-height:1.5;color:var(--secondary-text-color)}
`;
  var OpenCwaCropCardEditor = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._hass = null;
      this._config = normalizedConfig({});
    }
    set hass(value) {
      this._hass = value;
      if (!this.shadowRoot.activeElement) this._render();
    }
    get hass() {
      return this._hass;
    }
    setConfig(config) {
      this._config = normalizedConfig(config);
      this._render();
    }
    _emit(patch) {
      const config = { ...this._config, ...patch };
      for (const key of ["title"]) if (config[key] === "") delete config[key];
      this._config = normalizedConfig(config);
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { ...config, type: "custom:opencwa-crop-card" } }, bubbles: true, composed: true }));
      this._render();
    }
    _render() {
      if (!this.shadowRoot) return;
      const options = findCropOptions(this._hass?.states || {});
      const optionHtml = options.map((option) => `<option value="${escapeHtml(option.entity)}" data-profile-id="${escapeHtml(option.profileId)}" ${option.entity === this._config.entity ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
      const cropField = options.length ? `<label class="field">OpenCWA \u4F5C\u7269<select data-key="entity"><option value="">\u8ACB\u9078\u64C7\u4F5C\u7269</option>${optionHtml}</select></label>` : `<div class="empty">\u76EE\u524D\u627E\u4E0D\u5230\u53EF\u8A2D\u5B9A\u7684OpenCWA\u4F5C\u7269\u3002\u8ACB\u5148\u5728OpenCWA\u6574\u5408\u4E2D\u555F\u7528\u8FB2\u696D\u6C23\u8C61\uFF0C\u4E26\u65B0\u589E\u81F3\u5C11\u4E00\u7B46\u4F5C\u7269\u3002</div>`;
      this.shadowRoot.innerHTML = `<style>${editorCss}</style><div class="editor"><section class="section"><div class="section-title"><ha-icon icon="mdi:sprout"></ha-icon>\u4F5C\u7269\u8207\u6A19\u984C</div>${cropField}<label class="field">\u81EA\u8A02\u5361\u7247\u6A19\u984C\uFF08\u9078\u586B\uFF09<input type="text" data-key="title" value="${escapeHtml(this._config.title)}" placeholder="\u9810\u8A2D\u4F7F\u7528\u4F5C\u7269\u540D\u7A31"></label></section><section class="section"><div class="section-title"><ha-icon icon="mdi:view-dashboard-outline"></ha-icon>\u8CC7\u8A0A\u986F\u793A</div>${this._toggle("show_knowledge", "\u986F\u793A\u98A8\u96AA\u77E5\u8B58\u5EAB", "\u5217\u51FA\u8A72\u4F5C\u7269\u7684\u5B8C\u6574\u707D\u5BB3\u898F\u5247\u8207\u9632\u7BC4\u3001\u5FA9\u8015\u8CC7\u8A0A", this._config.show_knowledge)}${this._toggle("show_source", "\u986F\u793A\u8CC7\u6599\u4F86\u6E90", "\u986F\u793Aprovider\u3001\u8CC7\u6599\u6642\u9593\u8207\u9023\u7DDA\u72C0\u614B", this._config.show_source)}${this._toggle("default_expand_alerts", "\u9810\u8A2D\u5C55\u958B\u5168\u90E8\u8B66\u793A", "\u95DC\u9589\u6642\u53EA\u986F\u793A\u6700\u9AD8\u512A\u5148\u8B66\u793A\uFF0C\u5176\u9918\u4EE5+N\u5448\u73FE", this._config.default_expand_alerts)}</section></div>`;
      this.shadowRoot.querySelector('select[data-key="entity"]')?.addEventListener("change", (event) => {
        const selected = event.currentTarget.selectedOptions[0];
        this._emit({ entity: event.currentTarget.value, profile_id: selected?.dataset.profileId || "" });
      });
      this.shadowRoot.querySelectorAll('input[type="text"]').forEach((control) => control.addEventListener("change", (event) => this._emit({ [event.currentTarget.dataset.key]: event.currentTarget.value })));
      this.shadowRoot.querySelectorAll('input[type="checkbox"][data-value-type="boolean"]').forEach((control) => control.addEventListener("change", (event) => this._emit({ [event.currentTarget.dataset.key]: event.currentTarget.checked === true })));
    }
    _toggle(key, title, description, checked) {
      return `<label class="toggle"><span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></span><input type="checkbox" data-key="${escapeHtml(key)}" data-value-type="boolean" ${checked ? "checked" : ""}></label>`;
    }
  };
  if (!customElements.get("opencwa-crop-card-editor")) customElements.define("opencwa-crop-card-editor", OpenCwaCropCardEditor);

  // src/card.js
  var ICONS = {
    warning: "mdi:alert-octagon",
    advisory: "mdi:alert",
    normal: "mdi:shield-check",
    "no-data": "mdi:database-alert-outline",
    unavailable: "mdi:cloud-alert"
  };
  var css = String.raw`
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
  var OpenCwaCropCard = class extends HTMLElement {
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
    get hass() {
      return this._hass;
    }
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
      const copy = code === "not_configured" ? "\u8ACB\u5728\u5361\u7247\u8A2D\u5B9A\u4E2D\u9078\u64C7\u4E00\u7B46 OpenCWA \u4F5C\u7269" : code === "profile_mismatch" ? "\u4F5C\u7269\u8B58\u5225\u5DF2\u8B8A\u66F4\uFF0C\u8ACB\u5728\u5361\u7247\u8A2D\u5B9A\u4E2D\u91CD\u65B0\u9078\u64C7\u4F5C\u7269" : "\u627E\u4E0D\u5230\u5DF2\u8A2D\u5B9A\u7684 OpenCWA \u4F5C\u7269\u5BE6\u9AD4";
      return `<ha-card><style>${css}</style><div class="empty">${icon("mdi:sprout-outline")}<div><strong>OpenCWA \u4F5C\u7269\u8F14\u52A9</strong><br>${escapeHtml(copy)}</div></div></ha-card>`;
    }
    _renderAlert(model) {
      const count = model.items.length;
      const visible = this._expandedAlerts ? model.items : model.items.slice(0, 1);
      const more = Math.max(0, count - 1);
      const list = visible.length ? `<div class="alert-list">${visible.map((item) => `
      <div class="alert-item">
        <div class="alert-item-title">${escapeHtml(item.disaster || "\u8FB2\u696D\u98A8\u96AA")}</div>
        <div class="alert-item-meta">${escapeHtml([item.stage || item.growth, item.threshold && item.measures ? `\u9580\u6ABB ${item.threshold} ${item.measures}` : ""].filter(Boolean).join(" \xB7 "))}</div>
      </div>`).join("")}</div>` : "";
      const toggle = count > 1 ? `<button class="alert-toggle" data-alert-toggle aria-expanded="${this._expandedAlerts}">${this._expandedAlerts ? "\u6536\u5408" : `+${more}`}</button>` : "";
      const summary = model.summary ? `<div class="alert-summary">${escapeHtml(model.summary)}</div>` : "";
      const accessibility = [model.levelLabel, model.headline, model.summary, model.items[0]?.prevention ? `\u7ACB\u5373\u9632\u7BC4\uFF1A${model.items[0].prevention}` : ""].filter(Boolean).join("\u3002");
      return `<section class="alert alert-${model.level}" data-entity="${escapeHtml(model.entities.notification)}" role="button" tabindex="0" aria-label="${escapeHtml(accessibility)}">
      <div class="alert-icon">${icon(ICONS[model.level] || ICONS.unavailable)}</div>
      <div class="alert-copy"><div class="alert-kicker">${escapeHtml(model.levelLabel)}</div><div class="alert-title">${escapeHtml(model.headline)}</div>${summary}</div>
      ${toggle}${list}
    </section>`;
    }
    _renderActions(model) {
      const item = model.items[0] || {};
      const prevention = item.prevention || (model.level === "normal" ? "\u7DAD\u6301\u4F8B\u884C\u5DE1\u7530\u8207\u704C\u6E89\u7D00\u9304\u3002" : "\u76EE\u524D\u6C92\u6709\u53EF\u7528\u7684\u5373\u6642\u9632\u7BC4\u5EFA\u8B70\uFF0C\u8ACB\u53C3\u8003\u4F5C\u7269\u98A8\u96AA\u77E5\u8B58\u5EAB\u3002");
      const recovery = item.recovery || "\u82E5\u707D\u5BB3\u767C\u751F\uFF0C\u5148\u8A18\u9304\u7530\u5340\u72C0\u6CC1\u4E26\u4F9D\u5C08\u696D\u8FB2\u696D\u55AE\u4F4D\u6307\u5F15\u8655\u7F6E\u3002";
      return `<section class="panel panel-wide action-panel"><h3 class="panel-title">${icon("mdi:clipboard-check-outline")}\u73FE\u5728\u8981\u505A</h3><div class="action-grid">
      <div class="action"><div class="action-label">${icon("mdi:shield-sun-outline")}\u7ACB\u5373\u9632\u7BC4</div><div class="action-text">${escapeHtml(prevention)}</div></div>
      <div class="action"><div class="action-label">${icon("mdi:leaf-circle-outline")}\u707D\u5F8C\u5FA9\u8015</div><div class="action-text">${escapeHtml(recovery)}</div></div>
    </div></section>`;
    }
    _renderMetrics(model) {
      return `<section class="panel metrics-panel"><h3 class="panel-title">${icon("mdi:watering-can-outline")}\u704C\u6E89\u53C3\u8003</h3><div class="metric-grid">${model.metrics.map((metric) => `<button class="metric ${metric.available ? "" : "unavailable"}" data-entity="${escapeHtml(metric.entity)}"><div class="metric-label">${icon(metric.icon)}${escapeHtml(metric.label)}</div><div class="metric-value">${escapeHtml(metric.value)}</div></button>`).join("")}</div></section>`;
    }
    _renderProfile(model) {
      return `<section class="panel profile-panel"><h3 class="panel-title">${icon("mdi:sprout-outline")}\u4F5C\u7269\u6A94\u6848</h3><div class="profile-grid">
      ${profileDatum("\u76EE\u524D\u751F\u80B2\u671F", model.profile.growthStage)}${profileDatum("\u98A8\u96AA\u9069\u7528\u671F", model.profile.stage)}${profileDatum("\u7A2E\u690D\u65E5\u671F", model.profile.plantingDate)}${profileDatum("\u7A2E\u690D\u9762\u7A4D", model.profile.area)}${profileDatum("\u8CC7\u6599\u5730\u9EDE", model.profile.location)}${profileDatum("\u547D\u4E2D\u898F\u5247", `${model.counts.matched} \u9805`)}
    </div></section>`;
    }
    _renderKnowledge(model) {
      if (!this._config.show_knowledge) return "";
      const rules = model.rules.length ? model.rules.map((rule) => `<details class="rule"><summary><span>${escapeHtml(rule.disaster || "\u8FB2\u696D\u98A8\u96AA")}</span><span class="rule-stage">${escapeHtml(rule.stage || rule.growth || "")}</span></summary><div class="rule-body">
      ${rule.effect ? `<div class="rule-row"><strong>\u53EF\u80FD\u5F71\u97FF</strong><span>${escapeHtml(rule.effect)}</span></div>` : ""}
      ${rule.prevention ? `<div class="rule-row"><strong>\u4E8B\u524D\u9632\u7BC4</strong><span>${escapeHtml(rule.prevention)}</span></div>` : ""}
      ${rule.recovery ? `<div class="rule-row"><strong>\u5FA9\u8015\u8655\u7F6E</strong><span>${escapeHtml(rule.recovery)}</span></div>` : ""}
      ${rule.threshold ? `<div class="rule-row"><strong>\u53C3\u8003\u9580\u6ABB</strong><span>${escapeHtml(`${rule.threshold} ${rule.measures || ""}\uFF0F${rule.duration || "\u2014"} \u5C0F\u6642`)}</span></div>` : ""}
    </div></details>`).join("") : `<div class="action-text">\u5C1A\u7121\u6B64\u4F5C\u7269\u7684\u98A8\u96AA\u898F\u5247\u3002</div>`;
      return `<section class="panel panel-wide knowledge-panel"><h3 class="panel-title">${icon("mdi:book-open-variant")}\u4F5C\u7269\u98A8\u96AA\u77E5\u8B58\u5EAB</h3>${rules}</section>`;
    }
    _renderSource(model) {
      if (!this._config.show_source) return "";
      const locale = this._hass?.locale?.language || "zh-TW";
      const zone = this._hass?.config?.time_zone || "Asia/Taipei";
      const freshness = model.source.stale ? "\u8CC7\u6599\u53EF\u80FD\u904E\u671F" : model.source.providerAvailable ? "\u4F86\u6E90\u5DF2\u9023\u7DDA" : "\u4F86\u6E90\u66AB\u6642\u4E0D\u53EF\u7528";
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
      this.shadowRoot.innerHTML = `<ha-card class="${escapeHtml(this._layout)} level-${escapeHtml(model.level)}" aria-label="${escapeHtml(`${title}\uFF0C${model.levelLabel}\uFF0C${model.headline}`)}"><style>${css}</style><div class="crop-shell">
      <header class="crop-header" data-entity="${escapeHtml(model.entities.status)}"><div class="crop-mark">${icon("mdi:sprout")}</div><div class="crop-heading"><div class="eyebrow">OpenCWA \xB7 \u8FB2\u8015\u6C7A\u7B56\u8F14\u52A9</div><h2 class="crop-title">${escapeHtml(title)}</h2></div><div class="level-chip"><span class="dot"></span><span>${escapeHtml(model.levelLabel)}</span></div></header>
      <div class="crop-body">${this._renderAlert(model)}<div class="section-grid">${this._renderActions(model)}${this._renderMetrics(model)}${this._renderProfile(model)}${this._renderKnowledge(model)}</div>${this._renderSource(model)}</div>
    </div></ha-card>`;
      this.shadowRoot.querySelector("[data-alert-toggle]")?.addEventListener("click", () => {
        this._expandedAlerts = !this._expandedAlerts;
        this._render();
      });
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
    getCardSize() {
      return 7;
    }
    getGridOptions() {
      return { columns: 12, rows: 7, min_columns: 3, min_rows: 1 };
    }
    static async getConfigElement() {
      return document.createElement("opencwa-crop-card-editor");
    }
    static getStubConfig(hass) {
      const options = Object.values(hass?.states || {}).filter((stateObj) => stateObj?.entity_id?.endsWith("_agricultural_advisory_status") && stateObj.attributes?.crop_profile_id);
      return { entity: options[0]?.entity_id || "", profile_id: options[0]?.attributes?.crop_profile_id || "" };
    }
  };
  if (!customElements.get("opencwa-crop-card")) customElements.define("opencwa-crop-card", OpenCwaCropCard);
  console.info(`%c OPEN CWA CROP CARD %c v${CARD_VERSION} `, "color:white;background:#2f7d4f;font-weight:700;padding:2px 5px;border-radius:4px 0 0 4px", "color:#2f7d4f;background:#eaf5ed;padding:2px 5px;border-radius:0 4px 4px 0");

  // src/index.js
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === "opencwa-crop-card")) {
    window.customCards.push({
      type: "opencwa-crop-card",
      name: "OpenCWA \u4F5C\u7269\u8FB2\u8015\u8F14\u52A9\u5361",
      description: "\u4F9DOpenCWA\u4F5C\u7269\u986F\u793A\u8B66\u793A\u3001\u8FB2\u8015\u884C\u52D5\u3001\u704C\u6E89\u8207\u98A8\u96AA\u77E5\u8B58",
      preview: true,
      configurable: true,
      documentationURL: "https://github.com/ivanlee1007/opencwa-crop-card"
    });
  }
})();
