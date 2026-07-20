export const CARD_VERSION = "__OPENCWA_CROP_CARD_VERSION__";
export const STATUS_SUFFIX = "_agricultural_advisory_status";

export const ENTITY_SUFFIXES = Object.freeze({
  status: "_agricultural_advisory_status",
  notification: "_agricultural_advisory_notification",
  warning: "_crop_warning",
  advisory: "_crop_advisory",
  supported: "_crop_data_supported",
  et0: "_reference_evapotranspiration",
  kc: "_crop_coefficient",
  etc: "_crop_evapotranspiration",
  water: "_crop_water_requirement",
});

const BINARY_ENTITY_KEYS = new Set(["warning", "advisory", "supported"]);

const BAD_STATES = new Set(["unknown", "unavailable", "none", "null", ""]);
const WARNING_STATES = new Set(["warning", "danger", "critical", "severe"]);
const ADVISORY_STATES = new Set(["advisory", "active", "watch"]);

export function isUsableState(stateObj) {
  return Boolean(stateObj && !BAD_STATES.has(String(stateObj.state ?? "").toLowerCase()));
}

export function cropEntityMap(anchorEntity) {
  if (typeof anchorEntity !== "string" || !anchorEntity.endsWith(STATUS_SUFFIX)) return {};
  const root = anchorEntity.slice(0, -STATUS_SUFFIX.length);
  return Object.fromEntries(Object.entries(ENTITY_SUFFIXES).map(([key, suffix]) => {
    const entity = `${root}${suffix}`;
    return [key, BINARY_ENTITY_KEYS.has(key) ? entity.replace(/^sensor\./, "binary_sensor.") : entity];
  }));
}

export function findCropOptions(states = {}) {
  return Object.values(states)
    .filter((stateObj) => stateObj?.entity_id?.endsWith(STATUS_SUFFIX))
    .map((stateObj) => {
      const profileId = stateObj.attributes?.crop_profile_id || "";
      const cropName = stateObj.attributes?.crop_name || stateObj.attributes?.friendly_name || stateObj.entity_id;
      const town = stateObj.attributes?.items?.[0]?.town || "";
      const identity = (profileId || stateObj.entity_id).slice(-6).toUpperCase();
      return {
        entity: stateObj.entity_id,
        profileId,
        cropName,
        town,
        label: [cropName, town, identity].filter(Boolean).join(" · "),
        supported: stateObj.attributes?.supported !== false,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));
}

export function selectLayout(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 380 && h >= 250 && h / Math.max(w, 1) >= 1.12) return "portrait";
  if (w < 280 && h < 250) return "tiny";
  if (w < 560 || h < 300) return "compact";
  if (w >= 900 && h >= 430) return "expanded";
  return "regular";
}

export function normalizedConfig(config = {}) {
  if (!config || typeof config !== "object") throw new Error("Invalid card configuration");
  return {
    type: "custom:opencwa-crop-card",
    entity: typeof config.entity === "string" ? config.entity.trim() : "",
    profile_id: typeof config.profile_id === "string" ? config.profile_id.trim() : "",
    title: typeof config.title === "string" ? config.title.trim() : "",
    show_irrigation: config.show_irrigation !== false,
    show_profile: config.show_profile !== false,
    show_knowledge: config.show_knowledge !== false,
    show_source: config.show_source !== false,
    default_expand_alerts: config.default_expand_alerts === true,
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
  if (!isUsableState(stateObj)) return { value: "—", available: false };
  const raw = stateObj.state;
  const parsed = Number(raw);
  const value = Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits }) : String(raw);
  const unit = stateObj.attributes?.unit_of_measurement || "";
  return { value: `${value}${unit ? ` ${unit}` : ""}`, available: true };
}

function comparableText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function removeRepeatedSummary(headline, summary) {
  const copy = String(summary ?? "").trim();
  return copy && comparableText(headline) === comparableText(copy) ? "" : copy;
}

export function buildCropModel(states = {}, config = {}) {
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
    supported: states[entities.supported],
  });
  const items = level === "unavailable" || level === "no-data" ? [] : rawItems;
  const metrics = [
    ["et0", "參考蒸散 ET₀", "mdi:weather-sunny"],
    ["kc", "作物係數 Kc", "mdi:sprout"],
    ["etc", "作物蒸散 ETc", "mdi:water-percent"],
    ["water", "作物需水量", "mdi:watering-can"],
  ].map(([key, label, icon]) => ({ key, label, icon, entity: entities[key], ...valueOf(states[entities[key]]) }));

  const unavailableCopy = level === "unavailable";
  const noDataCopy = level === "no-data";
  const headline = unavailableCopy
    ? "農業資料暫時無法取得"
    : noDataCopy
      ? "目前沒有相符的作物專屬資料"
      : notification?.attributes?.title || (level === "warning" ? "一級農業警示" : level === "advisory" ? "農耕注意事項" : "目前作物風險概況");
  const rawSummary = unavailableCopy
    ? "目前無法確認即時農業風險，請直接巡查田區並稍後重新整理。"
    : noDataCopy
      ? "資料不足不代表沒有農業風險，請持續留意一般氣象警特報與田間狀況。"
      : notification?.attributes?.summary || notification?.attributes?.message || "目前沒有作物專屬警示";
  const summary = removeRepeatedSummary(headline, rawSummary);
  return {
    error: null,
    config: normalized,
    entities,
    profileId,
    cropName: attrs.crop_name || status.attributes?.friendly_name || "作物",
    level,
    levelLabel: { warning: "一級警示", advisory: "注意", normal: "正常", "no-data": "資料不足", unavailable: "無法取得" }[level],
    headline,
    summary,
    items,
    rules,
    metrics,
    profile: {
      growthStage: attrs.growth_stage || items[0]?.growth || "未設定",
      stage: items[0]?.stage || "—",
      plantingDate: attrs.planting_date || "未設定",
      area: attrs.area_hectares == null ? "未設定" : `${attrs.area_hectares} ha`,
      location: [items[0]?.city, items[0]?.town].filter(Boolean).join(" ") || "—",
    },
    counts: {
      warning: Number(attrs.warning_count) || 0,
      advisory: Number(attrs.advisory_count) || 0,
      matched: Number(attrs.matched_total) || items.length,
    },
    source: {
      provider: attrs.source_provider || attrs.agricultural_source || notification?.attributes?.source_provider || "OpenCWA",
      timestamp: attrs.source_timestamp || notification?.attributes?.source_timestamp || attrs.last_success_at || status.last_updated || null,
      stale: attrs.stale === true,
      providerAvailable: attrs.provider_available !== false,
      derived: attrs.derived_by_opencwa === true,
    },
  };
}

export function formatTimestamp(value, locale = "zh-TW", timeZone = "Asia/Taipei") {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  } catch {
    return "—";
  }
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}
