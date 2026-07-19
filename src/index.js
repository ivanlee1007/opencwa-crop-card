import "./editor.js";
import "./card.js";

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "opencwa-crop-card")) {
  window.customCards.push({
    type: "opencwa-crop-card",
    name: "OpenCWA 作物農耕輔助卡",
    description: "依OpenCWA作物顯示警示、農耕行動、灌溉與風險知識",
    preview: true,
    configurable: true,
    documentationURL: "https://github.com/ivanlee1007/opencwa-crop-card",
  });
}
