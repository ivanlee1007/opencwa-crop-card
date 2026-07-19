import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCropModel,
  cropEntityMap,
  escapeHtml,
  findCropOptions,
  formatTimestamp,
  normalizedConfig,
  selectLayout,
} from "../src/core.js";

const anchor = "sensor.opencwa_farm_cabbage_agricultural_advisory_status";
const ids = cropEntityMap(anchor);
function fixture(overrides = {}) {
  return {
    [anchor]: {
      entity_id: anchor,
      state: "advisory",
      last_updated: "2026-07-19T14:55:04Z",
      attributes: {
        crop_profile_id: "crop-1",
        crop_name: "甘藍",
        advisory_active: true,
        warning_active: false,
        warning_count: 0,
        advisory_count: 2,
        matched_total: 2,
        source_provider: "高雄農來訊",
        source_timestamp: "2026-07-19T18:10:00+08:00",
        provider_available: true,
        items: [
          { classification: "advisory", disaster: "高溫", stage: "結球期", growth: "營養生長期", prevention: "定期灌溉降溫", effect: "結球延遲", recovery: "延後種植" },
          { classification: "warning", disaster: "豪雨", prevention: "加強排水", effect: "根系缺氧", recovery: "排除積水" },
        ],
        rules: [{ disaster: "高溫", stage: "結球期", prevention: "遮陰" }],
        ...overrides,
      },
    },
    [ids.notification]: { entity_id: ids.notification, state: "active", attributes: { title: "甘藍高溫注意", summary: "高溫持續" } },
    [ids.warning]: { entity_id: ids.warning, state: "off", attributes: {} },
    [ids.advisory]: { entity_id: ids.advisory, state: "on", attributes: {} },
    [ids.et0]: { entity_id: ids.et0, state: "4.12", attributes: { unit_of_measurement: "mm" } },
    [ids.kc]: { entity_id: ids.kc, state: "0.9", attributes: {} },
    [ids.etc]: { entity_id: ids.etc, state: "3.71", attributes: { unit_of_measurement: "mm" } },
    [ids.water]: { entity_id: ids.water, state: "unavailable", attributes: { unit_of_measurement: "t" } },
  };
}

test("discovers configured OpenCWA crops by stable profile attribute", () => {
  const states = fixture();
  states["sensor.second_agricultural_advisory_status"] = {
    entity_id: "sensor.second_agricultural_advisory_status",
    state: "no_data",
    attributes: { crop_profile_id: "crop-2", crop_name: "甘藍", supported: true },
  };
  const options = findCropOptions(states);
  assert.equal(options.length, 2);
  assert.deepEqual(options.map((option) => option.profileId).sort(), ["crop-1", "crop-2"]);
});

test("builds classified model and sorts warning ahead of advisory", () => {
  const model = buildCropModel(fixture(), { entity: anchor });
  assert.equal(model.cropName, "甘藍");
  assert.equal(model.level, "advisory");
  assert.equal(model.items[0].disaster, "豪雨");
  assert.equal(model.profile.stage, "—");
  assert.equal(model.metrics.find((metric) => metric.key === "water").available, false);
  assert.equal(model.metrics.find((metric) => metric.key === "et0").value, "4.12 mm");
});

test("removes an alert summary that only repeats the headline with emoji and punctuation", () => {
  const states = fixture();
  states[ids.notification].attributes.title = "🌱 甘藍－注意高溫生產注意";
  states[ids.notification].attributes.summary = "甘藍－注意高溫生產注意";
  const model = buildCropModel(states, { entity: anchor });
  assert.equal(model.headline, "🌱 甘藍－注意高溫生產注意");
  assert.equal(model.summary, "");

  states[ids.notification].attributes.summary = "未來24小時請加強巡田";
  assert.equal(buildCropModel(states, { entity: anchor }).summary, "未來24小時請加強巡田");
});

test("warning_active always promotes the card to first-level warning", () => {
  const model = buildCropModel(fixture({ warning_active: true }), { entity: anchor });
  assert.equal(model.level, "warning");
  assert.equal(model.levelLabel, "一級警示");
});

test("models no-data without claiming no agricultural risk", () => {
  const model = buildCropModel(fixture({ status: "no_data", advisory_active: false, items: [] }), { entity: anchor });
  // State is the authority, not a duplicated status attribute in this fixture.
  assert.equal(model.level, "advisory");
  const states = fixture({ advisory_active: false, items: [] });
  states[anchor].state = "no_data";
  const noData = buildCropModel(states, { entity: anchor });
  assert.equal(noData.level, "no-data");
  assert.match(noData.levelLabel, /資料不足/);
});


test("availability fails closed before stale active flags", () => {
  const unavailable = fixture({ advisory_active: true });
  unavailable[anchor].state = "unavailable";
  assert.equal(buildCropModel(unavailable, { entity: anchor }).level, "unavailable");

  const disconnected = fixture({ advisory_active: false, provider_available: false });
  disconnected[anchor].state = "normal";
  assert.equal(buildCropModel(disconnected, { entity: anchor }).level, "unavailable");
});

test("sibling safety entities correct stale anchor attributes", () => {
  const warning = fixture({ warning_active: false, advisory_active: false });
  warning[anchor].state = "normal";
  warning[ids.warning] = { entity_id: ids.warning, state: "on", attributes: {} };
  assert.equal(buildCropModel(warning, { entity: anchor }).level, "warning");

  const unsupported = fixture({ warning_active: false, advisory_active: false, supported: true });
  unsupported[anchor].state = "normal";
  unsupported[ids.supported] = { entity_id: ids.supported, state: "off", attributes: {} };
  assert.equal(buildCropModel(unsupported, { entity: anchor }).level, "no-data");
});

test("same-name crop options are visibly distinct and carry stable identity", () => {
  const states = {};
  for (const [suffix, profileId] of [["one", "01KXXAAAA111111"], ["two", "01KXXBBBB222222"]]) {
    const entity = `sensor.${suffix}_agricultural_advisory_status`;
    states[entity] = { entity_id: entity, state: "normal", attributes: { crop_profile_id: profileId, crop_name: "甘藍", items: [{ town: "霧峰區" }] } };
  }
  const options = findCropOptions(states);
  assert.equal(new Set(options.map((option) => option.label)).size, 2);
  assert.match(options[0].label, /甘藍 · 霧峰區 · [A-Z0-9]{6}/);
  const config = normalizedConfig({ entity: options[0].entity, profile_id: options[0].profileId });
  assert.equal(config.profile_id, options[0].profileId);
});

test("profile mismatch or missing runtime identity fails closed", () => {
  const mismatch = buildCropModel(fixture(), { entity: anchor, profile_id: "different-profile" });
  assert.equal(mismatch.error, "profile_mismatch");
  const missing = fixture({ crop_profile_id: undefined, profile_id: undefined });
  const unverified = buildCropModel(missing, { entity: anchor, profile_id: "crop-1" });
  assert.equal(unverified.error, "profile_mismatch");
});

test("layout uses card width, height and aspect ratio", () => {
  assert.equal(selectLayout(150, 250), "portrait");
  assert.equal(selectLayout(210, 64), "tiny");
  assert.equal(selectLayout(420, 220), "compact");
  assert.equal(selectLayout(720, 380), "regular");
  assert.equal(selectLayout(1000, 500), "expanded");
  assert.equal(selectLayout(360, 249), "compact");
  assert.equal(selectLayout(360, 410), "portrait");
});

test("normalization preserves explicit false and rejects string booleans", () => {
  const config = normalizedConfig({ entity: ` ${anchor} `, show_knowledge: false, show_source: "false", default_expand_alerts: "true" });
  assert.equal(config.entity, anchor);
  assert.equal(config.show_knowledge, false);
  assert.equal(config.show_source, true);
  assert.equal(config.default_expand_alerts, false);
});

test("formatTimestamp uses h23 and fails closed", () => {
  assert.match(formatTimestamp("2026-07-19T16:05:00Z", "zh-TW", "Asia/Taipei"), /00:05/);
  assert.equal(formatTimestamp("bad"), "—");
});

test("escapes provider-supplied content before HTML rendering", () => {
  assert.equal(escapeHtml(`<img src=x onerror='bad'>&`), "&lt;img src=x onerror=&#39;bad&#39;&gt;&amp;");
});
