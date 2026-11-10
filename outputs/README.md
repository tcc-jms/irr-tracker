# 資本支出 IRR 效益追蹤系統

## 目前版本

`index.html` 是模組化應用的 HTML 外殼，依序載入 `src/` 下的工具、核心、引擎、元件與頁面模組，並載入 `demo/seed.js` 範例資料。修改這些模組會影響實際執行的應用程式。

應用程式以原始單檔版本的 Excel 解析與 IRR 演算法為基準，並透過模組 API 提供專案概覽、年度回報、通知、審計及備份功能。`src/engine/irr-engine.js` 是公式及 IRR 計算核心；`src/engine/compute.js` 提供應用層介面。

## 快速開始

請透過 HTTP 靜態伺服器執行（ES Module 不支援直接以 `file://` 開啟）：

```bash
python -m http.server 8000
```

接著開啟 `http://localhost:8000`。此應用程式沒有建置步驟，但需要網路連線以載入 Supabase JavaScript client 並存取雲端資料庫。

Excel `.xlsx` / `.xlsm` 解壓縮使用瀏覽器的 `DecompressionStream` API；若瀏覽器不支援，請改用支援此 API 的新版瀏覽器。

## 功能

- 上傳 Excel，解析 `IRR` 工作表並建立追蹤專案。
- 檢視專案年度效益、成本、回報狀態、原提報與實際 IRR。
- 編輯年度回報並重新計算 IRR 與回收年限。
- 年度回報未輸入的數值會以 `0` 保存；只有項次、沒有描述且基準值全為零的 Excel 占位列會略過。
- 依搜尋條件、廠區、狀態篩選及排序專案。
- 調整系統日期以測試年度提醒排程。
- 檢視通知及操作紀錄。
- 專案資料保存於 Supabase，啟動時載入，並約每 10 秒檢查其他使用者的專案更新。
- 匯出或匯入 JSON 備份；匯入的專案會寫回 Supabase。
- 「操作紀錄」及「備份 / 恢復」需先登入管理者通行碼；第一次使用時由管理者設定。

通知功能僅在應用程式內產生通知紀錄，不會實際寄送 Email。通知、操作紀錄及系統日期只保留在目前瀏覽器工作階段，不會寫入 Supabase，重新載入後會重設。

## 範例資料

首次啟動且雲端沒有專案時，應用程式會從 `demo/seed.js` 建立一筆範例專案，計算 baseline IRR 後保存到 Supabase。`demo/seed.json` 是可閱讀的範例資料副本。

## 資料保存與隱私

專案資料保存在 Supabase `projects` 表的 `project_data` 欄位。傳送前會嘗試以 gzip 壓縮大型工作簿 `wb`；載入時自動解壓，保留 IRR 計算所需的 `wb`、`model`、`baseline` 等資料。資料表需包含唯一且非空的文字欄位 `id`、`name`、`plant`、`owner`、JSONB `project_data`、`updated_at` 欄位。若既有表缺少 `id`，請在 Supabase SQL Editor 執行一次 [`supabase-migration.sql`](./supabase-migration.sql)；此 migration 會為既有列產生 ID，並寫入對應的 `project_data.id`。目前前端使用的匿名 publishable key 必須具有讀取、新增、更新、刪除所需的 RLS 政策。若匿名使用者無法更新或刪除，請在 SQL Editor 執行 [`supabase-projects-write-policies.sql`](./supabase-projects-write-policies.sql)。

**注意：**此匿名政策會允許任何能呼叫 Supabase API 的人更新或刪除 `projects` 中的任何資料。只適合受控環境或測試，不能保護敏感資料；公開部署前應改為 Supabase Auth 與依使用者限制的 RLS。請勿在前端放置 service-role key。

專案更新約每 10 秒同步到其他開啟中的頁面。若同一專案在兩端同時修改，存檔會先檢查雲端版本並在偵測到衝突時取消，請重新整理後再編輯。Excel 檔案仍在瀏覽器本機解析，不會上傳。

首次載入時，若雲端沒有專案且此瀏覽器有舊資料，系統會把專案遷移至雲端，成功後才刪除本機專案資料。若雲端已有資料，為避免覆蓋或重複，舊資料會保留在本機且不會自動合併；請先匯出備份，再自行處理。通知、操作紀錄及系統日期不在雲端遷移範圍。

目前選用匿名存取政策代表任何能取得網站的人都可能透過前端 API 讀取或修改雲端專案；頁面上的管理者通行碼不能保護 Supabase 資料。只可在你接受此風險的受控環境使用，勿放置機密資料。需要限制同事身份時，必須改用 Supabase Auth 與限制性的 RLS 政策。請定期匯出 JSON 備份；雲端儲存不等同於獨立備份。

## 目錄結構

```text
outputs/
├── index.html       模組化應用入口與樣式
├── README.md        本文件
├── demo/
│   ├── seed.js      執行時載入的範例資料
│   └── seed.json    範例資料副本
└── src/
	├── utils/       共用 escaping、DOM、格式與日期工具
	├── core/        狀態、儲存、審計、路由與通知排程
	├── engine/      Excel 解析、公式計算與 IRR 引擎
	├── components/  toast、modal、年度追蹤表及回報操作
	├── views/       概覽、專案、上傳、通知、審計、備份頁
	└── main.js      初始化、seed 與共用 runtime
```

## 常見問題

### 專案清單沒有範例資料

範例只會在 Supabase 沒有專案時建立。請確認使用的是 `outputs/index.html`，並檢查 Supabase `projects` 表及其 RLS 政策。

### Excel 無法解析

請確認檔案為 `.xlsx` 或 `.xlsm`，且包含 `IRR` 工作表。檔案解壓需要瀏覽器支援 `DecompressionStream`；不支援時請更新瀏覽器。

### 換電腦後看不到專案

確認新裝置連線至同一個 Supabase 專案，且 `projects` 表允許目前使用者讀取。

### 不要公開部署真實資料

目前雲端資料使用匿名存取，任何能開啟網站的人都可能讀寫 Supabase 專案資料；管理者通行碼只隱藏頁面，不會限制 API。請勿在此設定下存放敏感資料或部署至公開網站。

「操作紀錄」及「備份 / 恢復」頁面有前端通行碼門檻，通行碼保存在瀏覽器 `localStorage`，登入狀態僅維持於目前分頁。這不是帳號或伺服器端權限控制；可使用開發者工具或清除網站資料繞過，不能用來保護機密資料。初次設定應由管理者在受控裝置完成。若需要真正的個人帳號、角色權限或防止直接存取，必須加入伺服器端驗證。

專案資料以外的通知、操作紀錄及系統日期只存在記憶體，重新載入後會重設；操作人欄位沒有登入整合，預設為匿名使用者。舊版專案遷移完成後，應用程式不再用 `localStorage` 保存專案資料；管理者通行碼仍保存在 `localStorage`。