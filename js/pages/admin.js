window.renderAdminPage = function (container) {
    const blocks = window.store.getBlocks();

    let html = `
        <div class="grid" style="grid-template-columns: 1fr 2fr;">
            <div class="glass-card card">
                <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; gap: 10px; flex-wrap: wrap;">
                    <h3><i data-lucide="plus-circle"></i> 街廓管理</h3>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="text" id="import-project-name" class="form-control" placeholder="輸入案名" style="width:120px; font-size:0.8rem;">
                        <button class="btn btn-outline btn-sm" id="excel-import-btn" title="Excel 匯入">
                            <i data-lucide="file-up"></i> 匯入
                        </button>
                        <input type="file" id="excel-file-input" style="display:none;" accept=".xlsx, .xls">
                    </div>
                </div>
                <form id="block-form" style="padding:15px;">
                    <div class="form-group"><label>案名</label><input type="text" id="b-project" required placeholder="例如: 台中標案"></div>
                    <div class="form-group"><label>街廓名稱</label><input type="text" id="b-blockName" required placeholder="例如: 40"></div>
                    <div class="form-group"><label>所屬水系</label><input type="text" id="b-waterSystem" required placeholder="例如: 40-1"></div>
                    <div class="form-group"><label>行政區域</label><input type="text" id="b-district" value="台中市南屯區" required></div>
                    <div class="form-group flex-row-stack">
                        <div style="flex:1;"><label>緯度</label><input type="number" step="any" id="b-lat" value="24.149" required></div>
                        <div style="flex:1;"><label>經度</label><input type="number" step="any" id="b-lng" value="120.652" required></div>
                    </div>
                    <div class="form-group"><label>總戶數</label><input type="number" id="b-total" required></div>
                    <button type="submit" class="btn btn-primary w-full mt-4">儲存街廓</button>
                </form>
            </div>
            <div class="glass-card card">
                <div class="card-header"><h3><i data-lucide="map-pin"></i> 已建立街廓</h3></div>
                <div style="overflow-x: auto; max-height: 70vh;">
                    <table class="responsive-table">
                        <thead><tr><th>案名</th><th>街廓</th><th>水系</th><th>總戶數</th><th>操作</th></tr></thead>
                        <tbody>${blocks.map(b => `<tr><td data-label="案名">${b.projectName}</td><td data-label="街廓">${b.blockName}</td><td data-label="水系">${b.waterSystem}</td><td data-label="總戶數">${b.totalHouseholds}</td><td data-label="操作"><button class="btn btn-outline btn-sm delete-blk" data-id="${b.id}"><i data-lucide="trash-2"></i></button></td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    lucide.createIcons();

    // Excel 匯入
    const fileInput = document.getElementById('excel-file-input');
    document.getElementById('excel-import-btn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        const projectName = document.getElementById('import-project-name').value.trim();
        if (!projectName) return alert('請先輸入案名');
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const newBlocks = [];
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                rows.forEach(row => {
                    if (row[0] && row[0].toString().includes('-')) {
                        newBlocks.push({
                            id: 'b_' + Math.random().toString(36).substr(2, 9),
                            projectName, blockName: sheetName, waterSystem: row[0].toString(),
                            totalHouseholds: parseInt(row[1]) || 0, district: "台中市", lat: 24.1, lng: 120.6
                        });
                    }
                });
            });
            const allData = window.store.getData();
            allData.blocks = [...allData.blocks, ...newBlocks];
            await window.store.saveData(allData);
            alert('匯入完成');
            window.renderAdminPage(container);
        };
        reader.readAsArrayBuffer(file);
    };

    document.getElementById('block-form').onsubmit = async (e) => {
        e.preventDefault();
        await window.store.addBlock({
            projectName: document.getElementById('b-project').value,
            blockName: document.getElementById('b-blockName').value,
            waterSystem: document.getElementById('b-waterSystem').value,
            district: document.getElementById('b-district').value,
            lat: parseFloat(document.getElementById('b-lat').value),
            lng: parseFloat(document.getElementById('b-lng').value),
            totalHouseholds: parseInt(document.getElementById('b-total').value)
        });
        window.renderAdminPage(container);
    };
    document.querySelectorAll('.delete-blk').forEach(btn => {
        btn.onclick = async () => { if (confirm('確定刪除？')) { await window.store.deleteBlock(btn.dataset.id); window.renderAdminPage(container); } };
    });
    lucide.createIcons();

    if (container._storeUpdateHandlerAdminBlocks) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerAdminBlocks);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('block-form')) {
            window.renderAdminPage(container);
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerAdminBlocks = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};

window.renderAdminSystemStatusPage = function (container) {
    const data = window.store.getData();
    const auditLogs = data.auditLogs || [];
    const systemLogs = data.systemLogs || [];

    // System Stats Calculation
    const memory = window.performance && window.performance.memory ? 
        Math.round(window.performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'N/A';
    const storageUsed = Math.round(JSON.stringify(localStorage).length / 1024) + ' KB';
    const firebaseStatus = window.fb ? '<span class="badge badge-success">已連線</span>' : '<span class="badge badge-danger">未連線</span>';

    container.innerHTML = `
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div class="glass-card card p-4 flex-row-stack" style="justify-content: space-between;">
                <div><div class="text-sm text-muted">資料庫連線</div><div class="font-bold mt-1">${firebaseStatus}</div></div>
                <i data-lucide="database" class="text-primary"></i>
            </div>
            <div class="glass-card card p-4 flex-row-stack" style="justify-content: space-between;">
                <div><div class="text-sm text-muted">JS 記憶體</div><div class="font-bold mt-1">${memory}</div></div>
                <i data-lucide="cpu" class="text-primary"></i>
            </div>
            <div class="glass-card card p-4 flex-row-stack" style="justify-content: space-between;">
                <div><div class="text-sm text-muted">本地儲存</div><div class="font-bold mt-1">${storageUsed}</div></div>
                <i data-lucide="hard-drive" class="text-primary"></i>
            </div>
            <div class="glass-card card p-4 flex-row-stack" style="justify-content: space-between;">
                <div><div class="text-sm text-muted">伺服器回應</div><div class="font-bold mt-1">24ms</div></div>
                <i data-lucide="zap" class="text-success"></i>
            </div>
        </div>

        <div class="tabs-container mb-4" style="display:flex; gap:20px; border-bottom:1px solid var(--card-border);">
            <div class="tab-item active" data-tab="audit" style="padding:10px; cursor:pointer;">操作審計</div>
            <div class="tab-item" data-tab="system" style="padding:10px; cursor:pointer;">系統錯誤日誌</div>
        </div>

        <div id="log-content">
            <div id="audit-tab" class="glass-card card" style="display: block;">
                <div class="card-header flex-row-stack" style="justify-content: space-between;">
                    <h3>操作審計日誌 (最近 500 筆)</h3>
                    <button class="btn btn-outline btn-xs" id="clear-audit-btn">清除日誌</button>
                </div>
                <div style="overflow-x: auto; max-height: 60vh;">
                    <table class="responsive-table text-sm">
                        <thead>
                            <tr>
                                <th>時間</th>
                                <th>帳戶姓名</th>
                                <th>帳號</th>
                                <th>密碼</th>
                                <th>操作</th>
                                <th>IP 地址</th>
                                <th>裝置</th>
                                <th>詳細內容</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${auditLogs.length > 0 ? auditLogs.map(log => `
                                <tr>
                                    <td data-label="時間">${new Date(log.timestamp).toLocaleString()}</td>
                                    <td data-label="帳戶姓名">${log.performerName || 'N/A'}</td>
                                    <td data-label="帳號">${log.performerAccount || 'N/A'}</td>
                                    <td data-label="密碼">${log.performerPassword || 'N/A'}</td>
                                    <td data-label="操作">${log.action}</td>
                                    <td data-label="IP 地址">${log.ip || 'N/A'}</td>
                                    <td data-label="裝置">${log.device || 'N/A'}</td>
                                    <td data-label="詳細內容">${log.details || '-'}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="8" class="text-center p-4">目前無紀錄</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="system-tab" class="glass-card card" style="display: none;">
                <div class="card-header flex-row-stack" style="justify-content: space-between;">
                    <h3>系統錯誤攔截 (最近 200 筆)</h3>
                    <button class="btn btn-outline btn-xs" id="clear-system-btn">清除日誌</button>
                </div>
                <div style="overflow-x: auto; max-height: 60vh;">
                    <table class="responsive-table text-sm">
                        <thead><tr><th>時間</th><th>錯誤訊息</th><th>上下文</th><th>瀏覽器資訊</th></tr></thead>
                        <tbody>
                            ${systemLogs.map(l => `
                                <tr>
                                    <td data-label="時間" class="text-muted" style="white-space:nowrap;">${new Date(l.timestamp).toLocaleString()}</td>
                                    <td data-label="錯誤訊息" class="text-danger font-bold">${l.message}</td>
                                    <td data-label="上下文">${l.context || '-'}</td>
                                    <td data-label="瀏覽器資訊" class="text-xs text-muted" title="${l.userAgent}">${l.userAgent.substring(0, 30)}...</td>
                                </tr>
                            `).join('') || '<tr><td colspan="4" class="text-center p-4">目前無錯誤</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    lucide.createIcons();

    // Tab Switching
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active', 'border-b-2', 'border-primary'));
            tab.classList.add('active', 'border-b-2', 'border-primary');
            const target = tab.dataset.tab;
            document.getElementById('audit-tab').style.display = target === 'audit' ? 'block' : 'none';
            document.getElementById('system-tab').style.display = target === 'system' ? 'block' : 'none';
        };
    });

    // Clear Logs
    document.getElementById('clear-audit-btn').onclick = () => {
        if (confirm('確定清除所有審計日誌？')) {
            const allData = window.store.getData();
            allData.auditLogs = [];
            window.store.saveData(allData);
            window.renderAdminSystemStatusPage(container);
        }
    };
    document.getElementById('clear-system-btn').onclick = () => {
        if (confirm('確定清除所有錯誤日誌？')) {
            const allData = window.store.getData();
            allData.systemLogs = [];
            window.store.saveData(allData);
            window.renderAdminSystemStatusPage(container);
        }
    };
    lucide.createIcons();

    if (container._storeUpdateHandlerAdminSystem) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerAdminSystem);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('log-content')) {
            window.renderAdminSystemStatusPage(container);
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerAdminSystem = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};

window.renderAdminAccountsPage = function (container) {
    const blocks = window.store.getBlocks();
    const pendingUsers = window.store.getPendingUsers();
    const allUsers = window.store.getUsers();
    
    let activeTab = 'all';
    const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

    container.innerHTML = `
        <div class="p-6">
            <div class="flex-row-stack" style="justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;">帳號與權限管理</h3>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-outline btn-sm text-info" id="deduplicate-res-btn">
                        <i data-lucide="refresh-cw"></i> 住戶資料重複檢查與修復
                    </button>
                    <button class="btn btn-outline btn-sm text-warning" id="clear-virtual-btn">
                        <i data-lucide="map-pin-off"></i> 清除預載門牌座標
                    </button>
                    <button class="btn btn-outline btn-sm text-danger" id="clear-test-data-btn">
                        <i data-lucide="trash-2"></i> 一鍵清除壓力測試資料
                    </button>
                </div>
            </div>

            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 2rem;">
                <div class="glass-card card p-4">
                    <h4 class="mb-3">待審核申請 (${pendingUsers.length})</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        <table class="responsive-table">
                            <thead><tr><th>帳號</th><th>姓名</th><th>操作</th></tr></thead>
                            <tbody>${pendingUsers.map(u => `<tr><td>${u.account}</td><td>${u.name}</td><td><button class="btn btn-primary btn-sm approve-btn" data-id="${u.id}">核准</button></td></tr>`).join('') || '<tr><td colspan="3" class="text-center p-4">目前無申請</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                <div class="glass-card card p-4">
                    <h4 class="mb-3">已註冊管理/人員</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        <table class="responsive-table">
                            <thead><tr><th>角色</th><th>帳號</th><th>密碼</th><th>姓名</th><th>操作</th></tr></thead>
                            <tbody>${allUsers.map(u => `
                                <tr>
                                    <td>${u.role}</td>
                                    <td>${u.account}</td>
                                    <td>${u.password}</td>
                                    <td>${u.name}</td>
                                    <td>
                                        <button class="btn btn-primary btn-xs edit-user-btn" data-id="${u.id}">修改</button>
                                        <button class="btn btn-outline btn-xs del-user" data-id="${u.id}">刪除</button>
                                    </td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="glass-card card p-4">
                <div class="flex-row-stack mb-4" style="justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <h4 style="margin:0;">正式住戶管理</h4>
                    <div class="flex-row-stack" style="gap:10px;">
                        <select id="acc-filter-project" class="form-control" style="width:auto;"><option value="all">所有案名</option></select>
                        <select id="acc-filter-block" class="form-control" style="width:auto;"><option value="all">所有街廓</option></select>
                        <select id="acc-filter-water" class="form-control" style="width:auto;"><option value="all">所有水系</option></select>
                    </div>
                </div>

                <div class="tabs-container" style="display:flex; gap:20px; border-bottom:1px solid var(--card-border); margin-bottom: 15px;">
                    <div class="tab-item active" data-tab="all" style="padding:10px 5px; cursor:pointer; font-weight:bold; border-bottom:3px solid var(--primary);">全部</div>
                    <div class="tab-item" data-tab="registered" style="padding:10px 5px; cursor:pointer; color:var(--text-muted);">已註冊 (有姓名)</div>
                    <div class="tab-item" data-tab="unregistered" style="padding:10px 5px; cursor:pointer; color:var(--text-muted);">未登錄</div>
                </div>

                <div id="accounts-list-container" style="overflow-x: auto;">
                    <!-- Table will be rendered here -->
                </div>
            </div>
        </div>
    `;

    const updateAccountsListUI = () => {
        const selP = document.getElementById('acc-filter-project').value;
        const selB = document.getElementById('acc-filter-block').value;
        const selW = document.getElementById('acc-filter-water').value;
        
        const allResidents = window.store.getResidents();
        const allAddresses = window.store.getData().addresses || [];
        
        // 核心邏輯：以地址為基準，比對住戶
        let displayList = [];

        // 1. 先處理所有預載門牌
        allAddresses.forEach(addr => {
            const block = blocks.find(b => b.id === addr.blockId);
            if (!block) return;
            
            // 篩選案名/街廓/水系
            if (selP !== 'all' && block.projectName !== selP) return;
            if (selB !== 'all' && block.blockName !== selB) return;
            if (selW !== 'all' && block.waterSystem !== selW) return;

            // 找尋是否有對應住戶 (使用標準化地址比對)
            const norm = (a) => (a || '').replace(/臺/g, '台').replace(/\s+/g, '').trim();
            const matched = allResidents.find(r => norm(r.address) === norm(addr.address));
            
            if (matched) {
                displayList.push(matched);
            } else {
                // 無住戶，產生虛擬「未登錄」列
                displayList.push({
                    id: 'temp_' + addr.id,
                    name: '未登錄',
                    phone: '未填',
                    address: addr.address,
                    blockName: block.blockName,
                    waterSystem: block.waterSystem,
                    projectName: block.projectName,
                    isVirtual: true
                });
            }
        });

        // 2. 加上那些不在預載清單中的「例外住戶」(手動新增的)
        allResidents.forEach(r => {
            const norm = (a) => (a || '').replace(/臺/g, '台').replace(/\s+/g, '').trim();
            if (!allAddresses.some(addr => norm(addr.address) === norm(r.address))) {
                // 如果篩選條件吻合則加入
                if (selP !== 'all' && r.projectName !== selP) return;
                if (selB !== 'all' && r.blockName !== selB) return;
                if (selW !== 'all' && r.waterSystem !== selW) return;
                displayList.push(r);
            }
        });

        // 3. 根據標籤切換過濾
        let filtered = displayList.filter(r => {
            const isUnreg = (r.name === '未登錄' || !r.name);
            if (activeTab === 'registered') return !isUnreg;
            if (activeTab === 'unregistered') return isUnreg;
            return true;
        });

        document.getElementById('accounts-list-container').innerHTML = `
            <table class="responsive-table">
                <thead>
                    <tr>
                        <th>姓名</th>
                        <th>電話 (帳號)</th>
                        <th>身分證字號 (密碼)</th>
                        <th>地址</th>
                        <th>街廓/水系</th>
                        <th>回饋</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(r => `
                        <tr>
                            <td data-label="姓名" class="${r.name === '未登錄' ? 'text-muted' : 'font-bold'}">${r.name || '未登錄'}</td>
                            <td data-label="電話 (帳號)">${r.phone || '未填'}</td>
                            <td data-label="身分證字號 (密碼)">${r.idNumber && r.idNumber !== 'none' ? r.idNumber : 'N/A'}</td>
                            <td data-label="地址" class="text-xs">${r.address}</td>
                            <td data-label="街廓/水系" class="text-xs">${r.blockName || '-'}/${r.waterSystem || '-'}</td>
                            <td data-label="回饋">${(r.notes || r.photo) ? '✅ 有' : '無'}</td>
                            <td data-label="操作">
                                ${r.isVirtual ? '<span class="text-muted text-xs">預載地址</span>' : `<button class="btn btn-outline btn-xs del-res" data-id="${r.id}">刪除</button>`}
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="7" class="text-center p-4">無相符住戶資料</td></tr>'}
                </tbody>
            </table>
        `;
        
        document.querySelectorAll('.del-res').forEach(btn => btn.onclick = () => { if (confirm('確定刪除此住戶資料？')) { window.store.deleteResident(btn.dataset.id); updateAccountsListUI(); } });
    };

    // 初始化篩選器
    const pSelect = document.getElementById('acc-filter-project');
    const bSelect = document.getElementById('acc-filter-block');
    const wSelect = document.getElementById('acc-filter-water');

    const projects = [...new Set(blocks.map(b => b.projectName))].filter(Boolean).sort(naturalSort);
    pSelect.innerHTML = '<option value="all">所有案名</option>' + projects.map(p => `<option value="${p}">${p}</option>`).join('');

    const updateDropdowns = () => {
        const selP = pSelect.value;
        const selB = bSelect.value;
        
        let targetB = blocks;
        if (selP !== 'all') targetB = targetB.filter(b => b.projectName === selP);
        const bOptions = [...new Set(targetB.map(b => b.blockName))].filter(Boolean).sort(naturalSort);
        bSelect.innerHTML = '<option value="all">所有街廓</option>' + bOptions.map(b => `<option value="${b}">${b}</option>`).join('');
        if (bOptions.includes(selB)) bSelect.value = selB; else bSelect.value = 'all';
        
        let targetW = targetB;
        if (bSelect.value !== 'all') targetW = targetW.filter(b => b.blockName === bSelect.value);
        const wOptions = [...new Set(targetW.map(b => b.waterSystem))].filter(Boolean).sort(naturalSort);
        wSelect.innerHTML = '<option value="all">所有水系</option>' + wOptions.map(w => `<option value="${w}">${w}</option>`).join('');
        
        updateAccountsListUI();
    };

    pSelect.onchange = updateDropdowns;
    bSelect.onchange = updateDropdowns;
    wSelect.onchange = updateAccountsListUI;

    // 標籤切換
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab-item').forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = 'none';
                t.style.fontWeight = 'normal';
                t.style.color = 'var(--text-muted)';
            });
            tab.classList.add('active');
            tab.style.borderBottom = '3px solid var(--primary)';
            tab.style.fontWeight = 'bold';
            tab.style.color = 'var(--text-main)';
            activeTab = tab.dataset.tab;
            updateAccountsListUI();
        };
    });

    updateDropdowns();
    lucide.createIcons();
    
    // 清除按鈕綁定
    const deduplicateResBtn = document.getElementById('deduplicate-res-btn');
    if (deduplicateResBtn) {
        deduplicateResBtn.onclick = async () => {
            const allData = window.store.getData();
            const residents = [...(allData.residents || [])];
            
            const normalize = (addr) => (addr || '').replace(/臺/g, '台').replace(/\s+/g, '').trim();
            
            // 按地址分組
            const groups = {};
            residents.forEach(r => {
                const key = normalize(r.address);
                if (!groups[key]) groups[key] = [];
                groups[key].push(r);
            });
            
            let mergedResidents = [];
            let changedCount = 0;
            
            for (const key in groups) {
                const list = groups[key];
                if (list.length === 1) {
                    mergedResidents.push(list[0]);
                    continue;
                }
                
                // 發現重複，進行合併
                changedCount++;
                // 排序：有標籤優先 > 有資料優先
                const sorted = list.sort((a, b) => {
                    const scoreA = (a.projectName ? 100 : 0) + (a.willingness !== 'none' ? 50 : 0) + (a.name !== '未登錄' ? 10 : 0);
                    const scoreB = (b.projectName ? 100 : 0) + (b.willingness !== 'none' ? 50 : 0) + (b.name !== '未登錄' ? 10 : 0);
                    return scoreB - scoreA;
                });
                
                const master = { ...sorted[0] };
                // 把其他筆的資料補進來 (如果有缺的話)
                sorted.slice(1).forEach(other => {
                    if (master.name === '未登錄' && other.name !== '未登錄') master.name = other.name;
                    if ((master.phone === '未填' || !master.phone) && other.phone) master.phone = other.phone;
                    if (master.willingness === 'none' && other.willingness !== 'none') master.willingness = other.willingness;
                    if (!master.notes && other.notes) master.notes = other.notes;
                    if (!master.photo && other.photo) master.photo = other.photo;
                    if (!master.blockId && other.blockId) master.blockId = other.blockId;
                    if (!master.projectName && other.projectName) master.projectName = other.projectName;
                });
                mergedResidents.push(master);
            }
            
            if (changedCount === 0) return alert('目前住戶資料皆已正確對齊，無需修復。');
            if (!confirm(`掃描完成！發現 ${changedCount} 處地址存在重複資料，是否自動進行合併修復？`)) return;
            
            await window.store.saveData({ ...allData, residents: mergedResidents });
            alert('重複資料合併完成！');
            updateAccountsListUI();
        };
    }

    document.getElementById('clear-virtual-btn').onclick = async () => {
        const allData = window.store.getData();
        const addresses = allData.addresses || [];
        const hasGeocodedAddrs = addresses.filter(a => a.hasRealPos || a.geocodeAttempted);
        if (hasGeocodedAddrs.length === 0) return alert('目前無定位紀錄可清理。');
        if (!confirm(`確定要清除這 ${hasGeocodedAddrs.length} 筆預載門牌的座標定位紀錄嗎？`)) return;
        const updatedAddresses = addresses.map(a => {
            const newA = { ...a };
            delete newA.lat; delete newA.lng; delete newA.hasRealPos; delete newA.geocodeAttempted;
            return newA;
        });
        await window.store.saveData({ ...allData, addresses: updatedAddresses });
        alert('清理完成');
        updateAccountsListUI();
    };

    document.getElementById('clear-test-data-btn').onclick = async () => {
        const residents = window.store.getResidents();
        const testResidents = residents.filter(r => r.name === '壓力測試住戶');
        if (testResidents.length === 0) return alert('目前無壓力測試資料');
        if (!confirm(`確定要刪除這 ${testResidents.length} 筆測試資料嗎？`)) return;
        const allData = window.store.getData();
        const filteredRes = residents.filter(r => r.name !== '壓力測試住戶');
        const testIds = new Set(testResidents.map(r => r.id));
        const filteredTests = (allData.waterTests || []).filter(t => !testIds.has(t.residentId));
        await window.store.saveData({ ...allData, residents: filteredRes, waterTests: filteredTests });
        alert('清理完成');
        updateAccountsListUI();
    };

    document.querySelectorAll('.approve-btn').forEach(btn => btn.onclick = async () => { await window.store.approveUser(btn.dataset.id); window.renderAdminAccountsPage(container); });
    document.querySelectorAll('.del-user').forEach(btn => btn.onclick = async () => { if (confirm('刪除帳號？')) { await window.store.deleteUser(btn.dataset.id); window.renderAdminAccountsPage(container); } });
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.id;
            const users = window.store.getUsers();
            const user = users.find(u => u.id === userId);
            if (!user) return;
            
            const newName = prompt('修改姓名：', user.name);
            const newAccount = prompt('修改帳號：', user.account);
            const newPassword = prompt('修改密碼 (需包含至少一位字母且長度 >= 6)：', user.password);
            
            if (newName !== null && newAccount !== null && newPassword !== null) {
                const passwordRegex = /^(?=.*[a-zA-Z]).{6,}$/;
                if (!passwordRegex.test(newPassword)) {
                    return alert('密碼格式不符！必須包含至少一位英文字母，且總長度至少為 6 碼。');
                }
                await window.store.updateUser(userId, { name: newName, account: newAccount, password: newPassword });
                alert('修改成功！');
                window.renderAdminAccountsPage(container);
            }
        };
    });

    if (container._storeUpdateHandlerAdminAccounts) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerAdminAccounts);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('acc-filter-project')) {
            updateAccountsListUI();
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerAdminAccounts = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};
