# 住戶意願接管系統 - 系統架構與功能清單 (System Documentation)

這份文件旨在提供系統的完整概觀與邏輯解釋，以便於後續開發、維護或 AI 協作時能快速掌握核心架構，降低理解成本。

---

## 1. 系統概觀 (Overview)
本系統是一個用於管理「污水下水道接管意願」的整合平台，涵蓋了從住戶填寫意願、廠商試水回報、顧問數據分析到管理員權限控制的全流程。

### 技術棧 (Technology Stack)
- **前端**: Vanilla JavaScript, HTML5, CSS3 (Glassmorphism 設計風格)。
- **圖示**: Lucide Icons。
- **資料庫/持久化**: 
  - **Firebase Realtime Database**: 雲端即時同步資料。
  - **LocalStorage**: 用於「記住我」功能與暫存狀態。
- **架構模式**: 單頁應用 (SPA) 邏輯，透過 `app.js` 進行前端路由切換。

---

## 2. 角色與權限 (Roles & Permissions)

系統分為四個角色，各具備不同的功能導向：

| 角色 | 核心功能 | 權限說明 |
| :--- | :--- | :--- |
| **住戶 (Resident)** | 意願填寫 | 登入後僅能填寫並查看自己的接管意願（前巷、後巷、側巷等）。 |
| **廠商 (Contractor)** | 現場試水回報 | 執行現場試水後錄入建議方向，並與住戶意願進行比對。 |
| **顧問 (Consultant)** | 大數據分析、分配管理 | 查看全區統計圖表、匯入預設地址、管理住戶街廓分配。 |
| **管理員 (Admin)** | 全權限管理 | 包含顧問功能，加上帳號審核、系統日誌監控及權限變更。 |

---

## 3. 核心業務邏輯 (Core Logic)

### A. 聯動下拉選單 (Cascading Dropdowns)
- **邏輯**: `案名 (Project) -> 街廓 (Block) -> 水系 (Water System)`。
- **實現**: 當上級選項改變時，下級選項會自動根據 `store.js` 中的 `blocks` 資料進行過濾與重繪。

### B. 住戶比對與建立邏輯 (`findOrCreateResident`)
- **唯一性識別**: 優先比對「電話號碼」；若電話為「未填」，則比對「地址 + 街廓 ID」。
- **自動關聯**: 若住戶選擇的地址已存在於「預設地址庫」中，系統會自動關聯對應的 `blockId`。

### C. 試水比對邏輯 (Water Test Comparison)
- **流程**: 廠商針對特定地址提交「試水建議」。
- **比對**: 系統會自動抓取該地址對應住戶的「接管意願」，若兩者不一致，則在列表中標示為「衝突 (Conflict)」。

### D. 預設地址管理 (Predefined Addresses)
- **目的**: 針對尚未註冊的住戶，先由顧問匯入地址清單。
- **顯示**: 在住戶選擇器中，預設地址會標示為 `(預設地址)`，選取後會自動建立一個狀態為 `pending` 的暫時住戶資料。

---

## 4. 資料模型 (Data Model - store.js)

- `blocks`: 存儲地理區劃資訊 (案名、街廓、水系、坐標)。
- `residents`: 存儲住戶基本資料、意願、狀態 (`pending`, `processed`, `dispute`)。
- `users`: 系統工作人員帳號，包含 `status` (pending/approved)。
- `waterTests`: 廠商提交的試水結果。
- `addresses`: 顧問匯入的預設地址庫。
- `auditLogs / systemLogs`: 操作稽核與錯誤追蹤。

---

## 5. 代碼結構說明 (File Structure)

- `/index.html`: 主入口，包含所有樣式引用與 Modal 結構。
- `/js/app.js`: 核心控制器，處理路由、登入驗證、側邊欄建置。
- `/js/store.js`: **資料中心**，封裝所有 Firebase 通訊與複雜的資料過濾邏輯。
- `/js/pages/`:
  - `resident.js`: 住戶填寫介面。
  - `contractor.js`: 廠商試水回報與比對介面。
  - `consultant.js`: 包含分析圖表 (`renderConsultantPage`) 與分配管理 (`renderConsultantAllocationPage`)。
  - `admin.js`: 街廓管理、帳號審核、系統狀態。

---

## 6. AI 協作開發指引 (For Future AI Modding)
1. **修改 UI**: 應遵循 `index.css` 中的 Design Tokens (例如 `--primary`, `--glass-bg`)。
2. **操作資料**: 務必透過 `window.store` 的方法進行，不可直接修改 `window.store.data`，以確保 Firebase 同步。
3. **新增頁面**: 在 `NAV_CONFIG` (app.js) 增加配置，並在 `loadPage` 函數中實例化新的渲染函數。
4. **處理中文字元**: 編輯 PowerShell 腳本或 JS 檔案時，請確保使用 **UTF-8 (帶 BOM)** 或正確處理編碼，以免損壞中文字元。
