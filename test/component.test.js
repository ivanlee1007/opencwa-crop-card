import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { cropEntityMap } from "../src/core.js";

const dom = new Window({ url: "http://homeassistant.local" });
Object.assign(globalThis, {
  window: dom,
  document: dom.document,
  customElements: dom.customElements,
  HTMLElement: dom.HTMLElement,
  CustomEvent: dom.CustomEvent,
  Event: dom.Event,
});

class FakeResizeObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.observeCount = 0; this.active = false; FakeResizeObserver.instances.push(this); }
  observe() { this.observeCount += 1; this.active = true; }
  disconnect() { this.active = false; }
  emit(width, height) { if (this.active) this.callback([{ contentRect: { width, height } }]); }
}
globalThis.ResizeObserver = FakeResizeObserver;
dom.ResizeObserver = FakeResizeObserver;
await import("../src/index.js");

const anchor = "sensor.opencwa_plot_cabbage_agricultural_advisory_status";
const entities = cropEntityMap(anchor);
function hassFixture(warning = false) {
  return {
    locale: { language: "zh-TW" },
    config: { time_zone: "Asia/Taipei" },
    states: {
      [anchor]: {
        entity_id: anchor,
        state: warning ? "warning" : "advisory",
        attributes: {
          crop_profile_id: "stable-crop-1",
          crop_name: "甘藍",
          warning_active: warning,
          advisory_active: !warning,
          warning_count: warning ? 2 : 0,
          advisory_count: warning ? 0 : 1,
          matched_total: warning ? 2 : 1,
          source_provider: "高雄農來訊",
          items: warning
            ? [
                { classification: "warning", disaster: "豪雨", effect: "根系缺氧", prevention: "立刻清溝排水", recovery: "排除積水" },
                { classification: "warning", disaster: "強風", prevention: "加固植株" },
              ]
            : [{ classification: "advisory", disaster: "高溫", prevention: "定期灌溉降溫", recovery: "延後種植" }],
          rules: [{ disaster: "高溫", effect: "<script>bad</script>", prevention: "遮陰" }],
        },
      },
      [entities.notification]: { entity_id: entities.notification, state: "active", attributes: { title: warning ? "豪雨一級警示" : "高溫注意", summary: "請巡查田區" } },
      [entities.et0]: { entity_id: entities.et0, state: "4.1", attributes: { unit_of_measurement: "mm" } },
      [entities.kc]: { entity_id: entities.kc, state: "0.9", attributes: {} },
      [entities.etc]: { entity_id: entities.etc, state: "3.7", attributes: { unit_of_measurement: "mm" } },
      [entities.water]: { entity_id: entities.water, state: "1.3", attributes: { unit_of_measurement: "t" } },
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("card renders professional classified sections", async () => {
  const card = document.createElement("opencwa-crop-card");
  document.body.append(card);
  card.setConfig({ entity: anchor });
  card.hass = hassFixture(false);
  await settle();
  const text = card.shadowRoot.textContent;
  assert.match(text, /甘藍/);
  assert.match(text, /現在要做/);
  assert.match(text, /立即防範/);
  assert.match(text, /灌溉參考/);
  assert.match(text, /作物風險知識庫/);
  assert.equal(card.shadowRoot.querySelector("ha-card").classList.contains("level-advisory"), true);
  assert.equal(card.shadowRoot.querySelector("script"), null);
  card.remove();
});

test("first-level warning is visually promoted and additional alerts collapse to +N", async () => {
  const card = document.createElement("opencwa-crop-card");
  document.body.append(card);
  card.setConfig({ entity: anchor });
  card.hass = hassFixture(true);
  await settle();
  const root = card.shadowRoot.querySelector("ha-card");
  assert.equal(root.classList.contains("level-warning"), true);
  assert.match(card.shadowRoot.textContent, /一級警示/);
  assert.match(card.shadowRoot.textContent, /\+1/);
  assert.equal(card.shadowRoot.querySelectorAll(".alert-item").length, 1);
  card.shadowRoot.querySelector("[data-alert-toggle]").click();
  assert.equal(card.shadowRoot.querySelectorAll(".alert-item").length, 2);
  card.remove();
});


test("tiny first-level warning keeps actionable summary and More Info access", async () => {
  const card = document.createElement("opencwa-crop-card");
  document.body.append(card);
  card.setConfig({ entity: anchor });
  card.hass = hassFixture(true);
  await settle();
  const observer = FakeResizeObserver.instances.at(-1);
  observer.emit(210, 64);
  await settle();
  const root = card.shadowRoot.querySelector("ha-card");
  const alert = card.shadowRoot.querySelector(".alert");
  assert.equal(root.classList.contains("tiny"), true);
  assert.match(card.shadowRoot.querySelector(".alert-summary").textContent, /巡查田區/);
  assert.match(alert.getAttribute("aria-label"), /立刻清溝排水/);
  let entityId;
  card.addEventListener("hass-more-info", (event) => { entityId = event.detail.entityId; });
  alert.click();
  assert.equal(entityId, entities.notification);
  assert.equal(card.getGridOptions().min_rows, 1);
  card.remove();
});

test("standard compact card keeps crop profile and risk knowledge visible", async () => {
  const card = document.createElement("opencwa-crop-card");
  document.body.append(card);
  card.setConfig({ entity: anchor, show_knowledge: true });
  card.hass = hassFixture(false);
  await settle();
  FakeResizeObserver.instances.at(-1).emit(492, 715);
  await settle();
  const root = card.shadowRoot.querySelector("ha-card");
  assert.equal(root.classList.contains("compact"), true);
  assert.notEqual(window.getComputedStyle(card.shadowRoot.querySelector(".profile-panel")).display, "none");
  assert.notEqual(window.getComputedStyle(card.shadowRoot.querySelector(".knowledge-panel")).display, "none");
  card.remove();
});

test("editor lists discovered crops and emits strict boolean config", async () => {
  const editor = document.createElement("opencwa-crop-card-editor");
  document.body.append(editor);
  editor.setConfig({ entity: anchor, show_knowledge: true });
  editor.hass = hassFixture(false);
  await settle();
  const select = editor.shadowRoot.querySelector('select[data-key="entity"]');
  assert.match(select.textContent, /甘藍/);
  const checkbox = editor.shadowRoot.querySelector('input[data-key="show_knowledge"]');
  let next;
  editor.addEventListener("config-changed", (event) => { next = event.detail.config; });
  checkbox.checked = false;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(next.show_knowledge, false);
  const cropSelect = editor.shadowRoot.querySelector('select[data-key="entity"]');
  cropSelect.value = anchor;
  cropSelect.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(next.profile_id, "stable-crop-1");
  editor.remove();
});

test("ResizeObserver resumes after reconnect and distinguishes portrait from tiny", async () => {
  const card = document.createElement("opencwa-crop-card");
  document.body.append(card);
  card.setConfig({ entity: anchor });
  card.hass = hassFixture(false);
  await settle();
  const observer = FakeResizeObserver.instances.at(-1);
  observer.emit(150, 250);
  await settle();
  assert.equal(card.shadowRoot.querySelector("ha-card").classList.contains("portrait"), true);
  card.remove();
  document.body.append(card);
  observer.emit(210, 64);
  await settle();
  assert.equal(observer.observeCount >= 2, true);
  assert.equal(card.shadowRoot.querySelector("ha-card").classList.contains("tiny"), true);
  card.remove();
});
