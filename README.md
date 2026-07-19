# OpenCWA Crop Card

[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)
[![CI](https://github.com/ivanlee1007/opencwa-crop-card/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanlee1007/opencwa-crop-card/actions/workflows/ci.yml)

專為 [OpenCWA](https://github.com/ivanlee1007/OpenCWB) 1.5.0+ 多作物資料設計的專業農耕決策 Lovelace Card。

卡片讓使用者直接從 GUI 選擇一筆 OpenCWA 作物，並把即時風險、現在要做的農務、灌溉參考、作物檔案與完整風險知識庫整理成容易快速閱讀的資訊層級。

## 功能

- GUI 直接列出 HA 目前的 OpenCWA 作物，不必輸入長 Entity ID。
- 使用穩定的 `crop_profile_id` 辨識作物；同名作物仍可分別選擇。
- 一級警示使用高對比紅色 Banner、粗體與警示圖示，任何尺寸都不隱藏。
- 多筆警示預設顯示最高優先項，其餘以 `+N` 收合，可點擊展開。
- 農務資訊分類：
  - **現在要做**：立即防範、災後復耕。
  - **灌溉參考**：ET₀、Kc、ETc、作物需水量。
  - **作物檔案**：生育期、種植日、面積、地點與命中規則。
  - **風險知識庫**：各類災害的影響、事前防範、復耕與門檻。
- 依卡片本身的實際寬度、高度與長寬比切換 `tiny / compact / portrait / regular / expanded`，不是只看瀏覽器 viewport。
- Tall-narrow 卡片採完整垂直編排；short-narrow 卡片保留警示、作物與主要狀態的緊湊排列。
- 點擊灌溉數值或標題可開啟 Home Assistant More Info。
- 支援 HA 明暗主題與 `prefers-reduced-motion`。

## 需求

- Home Assistant 2026.7 或更新版本。
- OpenCWA 1.5.0 或更新版本。
- OpenCWA 農業氣象已啟用，且至少建立一筆作物。

## HACS 安裝

1. HACS → Dashboard → 右上角選單 → **自訂儲存庫**。
2. 加入 `https://github.com/ivanlee1007/opencwa-crop-card`，類型選 **Dashboard**。
3. 下載最新版並重新整理瀏覽器。
4. 在 Lovelace 新增卡片，搜尋 **OpenCWA 作物農耕輔助卡**。

## 手動安裝

1. 將 `opencwa-crop-card.js` 放到 `/config/www/opencwa-crop-card/`。
2. 在 Dashboard Resources 加入：

```text
/local/opencwa-crop-card/opencwa-crop-card.js
```

資源類型選 **JavaScript Module**。

## GUI 設定

- **OpenCWA 作物**：從目前已存在的作物清單選擇。
- **自訂卡片標題**：選填；預設使用作物名稱。
- **顯示風險知識庫**：預設開啟。
- **顯示資料來源**：預設開啟。
- **預設展開全部警示**：預設關閉。

## YAML

```yaml
type: custom:opencwa-crop-card
entity: sensor.example_agricultural_advisory_status
profile_id: 01KXXEXAMPLESTABLEID
title: 一期甘藍
show_knowledge: true
show_source: true
default_expand_alerts: false
```

> `entity` 應選擇該作物的 `Agricultural Advisory Status` sensor。GUI editor 會自動列出正確選項，並保存 `profile_id`；同名同地點作物會顯示 stable ID 末 6 碼以供辨識。手寫 YAML 可省略 `profile_id`，但透過 GUI 保存可額外防止 Entity 被錯誤指向另一筆作物。

## 警示語意

| 等級 | 顯示 | 意義 |
|---|---|---|
| 一級警示 | 高對比紅色 | OpenCWA `warning_active` 或 warning/critical 狀態 |
| 注意 | 琥珀色 | 有農業 advisory |
| 正常 | 綠色 | 有資料且目前無命中風險 |
| 資料不足 | 中性色 | 沒有相符作物專屬資料；**不代表沒有農業風險** |
| 無法取得 | 中性色 | Entity/provider 暫時不可用 |

## 開發

```bash
npm ci
npm test
npm run build
node --check opencwa-crop-card.js
npm audit --audit-level=high
```

CI 會重新建立 committed HACS artifact，並在 source 與 bundle 不一致時失敗。

## License

MIT
