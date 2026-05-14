window.renderConsultantPage = function (container) {
    const blocks = window.store.getBlocks();
    const residents = window.store.getAllResidents();
    const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

    let html = `
        <div class="glass-card card mb-6">
            <div class="card-header flex-row-stack" style="justify-content:space-between; align-items:center;">
                <h3><i data-lucide="bar-chart-2"></i> 區域意願統計總覽</h3>
                <div class="flex-row-stack" style="align-items:center; flex-wrap:wrap;">
                    <select id="filter-project" class="form-control" style="width:auto; padding:5px 8px; font-size:0.8rem;"><option value="all">所有案名</option></select>
                    <select id="filter-block" class="form-control" style="width:auto; padding:5px 8px; font-size:0.8rem;"><option value="all">所有街廓</option></select>
                    <select id="filter-water" class="form-control" style="width:auto; padding:5px 8px; font-size:0.8rem;"><option value="all">所有水系</option></select>
                </div>
            </div>
            <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
                <div style="height: 350px; position: relative;" class="glass-card"><canvas id="main-chart"></canvas></div>
                <div class="glass-card" style="height: 350px; overflow: hidden; padding: 0; position: relative;">
                    <div id="geocode-progress-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: rgba(0,0,0,0.05); z-index: 1000; display: none;">
                        <div id="geocode-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary), #60a5fa); transition: width 0.3s ease; box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);"></div>
                    </div>
                    <div id="geocode-progress-text" style="position: absolute; bottom: 20px; left: 10px; font-size: 0.75rem; background: rgba(255,255,255,0.9); padding: 4px 10px; border-radius: 8px; color: var(--primary); font-weight: bold; border: 1px solid rgba(37, 99, 235, 0.3); box-shadow: 0 2px 5px rgba(0,0,0,0.1); z-index: 1001; display: none;">正在定位: 0/0</div>
                    
                    <!-- 手動校正提示橫幅 -->
                    <div id="manual-pin-banner" style="position: absolute; top: 15px; left: 50%; transform: translateX(-50%); background: var(--danger); color: white; padding: 8px 15px; border-radius: 20px; z-index: 2000; display: none; font-size: 0.85rem; font-weight: bold; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.3);">
                        📍 請在地圖上點擊【<span id="pin-address-text"></span>】的正確位置
                        <button onclick="window.cancelManualPin()" style="margin-left: 10px; background: white; color: var(--danger); border: none; padding: 2px 8px; border-radius: 10px; cursor: pointer; font-weight:bold;">取消</button>
                    </div>

                    <div id="map-view" style="height: 100%; width: 100%;"></div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 15px; border-left: 1px solid var(--card-border); padding-left: 20px;">
                    <div id="ai-recommendation-box" class="p-3" style="background: rgba(37, 99, 235, 0.05); border-radius: 12px; border: 1px solid rgba(37, 99, 235, 0.1);">
                        <h4 style="font-size: 0.9rem; color: var(--primary); margin-bottom: 8px;"><i data-lucide="sparkles" style="width: 16px;"></i> AI 智慧判接建議</h4>
                        <div id="ai-suggestion-text" style="font-size: 0.85rem; line-height: 1.5; color: var(--text-main);">正在分析數據...</div>
                    </div>
                    <div style="overflow-x: auto; flex: 1;">
                        <table id="mini-stats-table"><thead><tr><th>項目</th><th>戶數</th></tr></thead><tbody id="mini-stats-body"></tbody></table>
                    </div>
                </div>
            </div>
        </div>
        <div class="glass-card card mt-4">
            <div class="card-header"><h3><i data-lucide="map"></i> 各街廓詳細數據</h3></div>
            <div style="overflow-x: auto;">
                <table class="responsive-table">
                    <thead><tr><th>案名</th><th>街廓</th><th>水系</th><th>前巷</th><th>後巷</th><th>無意見</th><th>未表達</th><th>總戶數</th></tr></thead>
                    <tbody id="block-data-body"></tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();
    let chartInstance = null;
    let mapInstance = null;
    let markersLayer = null;

    const initMap = () => {
        if (mapInstance) return;
        const mapEl = document.getElementById('map-view');
        if (!mapEl) return;
        
        mapInstance = L.map('map-view').setView([24.149, 120.652], 13);
        
        // 定義 Google 各種圖資來源
        const googleStreet = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Map data &copy; Google'
        });
        
        const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: 'Map data &copy; Google'
        });

        // 預設使用街道圖
        googleStreet.addTo(mapInstance);

        // 加入圖層切換控制
        const baseMaps = {
            "Google 街道圖": googleStreet,
            "Google 衛星圖": googleSatellite
        };
        L.control.layers(baseMaps).addTo(mapInstance);
        
        markersLayer = L.layerGroup().addTo(mapInstance);
        
        // 綁定地圖點擊事件，用於手動校正模式
        mapInstance.on('click', async (e) => {
            if (window.isManualPinning && window.pinningAddress) {
                const { lat, lng } = e.latlng;
                await window.store.updateAddressData(window.pinningAddress, { lat, lng, hasRealPos: true, geocodeAttempted: true });
                window.cancelManualPin();
                updateUI(); // 重新渲染地圖，點位會瞬間飛到新位置
            }
        });

        setTimeout(() => mapInstance.invalidateSize(), 100);
    };

    // --- 手動座標校正模式 ---
    window.isManualPinning = false;
    window.pinningAddress = null;

    window.startManualPin = (address) => {
        window.isManualPinning = true;
        window.pinningAddress = address;
        document.getElementById('pin-address-text').innerText = address;
        document.getElementById('manual-pin-banner').style.display = 'block';
        document.getElementById('map-view').style.cursor = 'crosshair';
        if (mapInstance) mapInstance.closePopup();
    };

    window.cancelManualPin = () => {
        window.isManualPinning = false;
        window.pinningAddress = null;
        document.getElementById('manual-pin-banner').style.display = 'none';
        document.getElementById('map-view').style.cursor = '';
    };
    // -----------------------

    // --- 內部門牌解析引擎 (精簡 JSON 字典) ---
    const localGeocodeDict = {};
    let isDictLoaded = false;


    const loadLocalGeocodeDict = async () => {
        try {
            const resp = await fetch('data/geocode_taichung_6districts.json');
            if (!resp.ok) {
                console.warn('找不到門牌字典，將使用座標模擬模式');
                isDictLoaded = true;
                processGeocodeQueue();
                return;
            }
            const dict = await resp.json();
            Object.assign(localGeocodeDict, dict);
            console.log(`✅ 成功載入門牌字典，共 ${Object.keys(localGeocodeDict).length} 筆地址`);
            // 重置記憶體中所有未精確定位的住戶，讓字典重新比對
            if (window.store && window.store.data && window.store.data.residents) {
                window.store.data.residents.forEach(r => {
                    if (!r.hasRealPos && r.geocodeAttempted) r.geocodeAttempted = false;
                });
            }
        } catch (e) {
            console.error('載入門牌字典失敗:', e);
            if (location.protocol === 'file:') {
                alert('⚠️ 偵測到您直接開啟 HTML 檔案，這會導致字典載入失敗。\n\n請改用網址：http://127.0.0.1:8080 開啟網頁！');
            }
        } finally {
            isDictLoaded = true;
            processGeocodeQueue();
        }
    };

    const geocodeQueue = [];
    let isGeocoding = false;

    const processGeocodeQueue = async () => {
        // 如果字典還沒載入完，或佇列空了就先暫停
        if (!isDictLoaded || isGeocoding || geocodeQueue.length === 0) return;
        
        isGeocoding = true;
        const item = geocodeQueue.shift();
        
        try {
            // 清理地址：去樓層，只保留到「號」
            // 例：「臺中市西區大墩十街64號7樓之4」→「臺中市西區大墩十街64號」
            const cleanAddrMatch = item.address.match(/^(.+?號)/);
            const fullCleanAddress = cleanAddrMatch ? cleanAddrMatch[1] : item.address;
            
            // 字典的 key 格式為「大墩十街64號」（只有路名+號碼）
            // 策略：剝除縣市區前綴，取「區/鄉/鎮/市」之後的所有內容，並將 - 轉為 之
            let lookupKey = fullCleanAddress;
            const districtMatch = fullCleanAddress.match(/[市縣].+?[區鄉鎮市](.+號)$/);
            if (districtMatch && districtMatch[1]) {
                lookupKey = districtMatch[1];
            } else {
                // 如果沒抓到行政區，嘗試去掉前三個字（假設是 臺中市 或類似前綴）
                lookupKey = fullCleanAddress.replace(/^.{3}[區鄉鎮市]?/, '');
            }
            
            // 正規化：將半形 - 轉為 之，並修剪空白，確保與政府資料格式一致
            lookupKey = lookupKey.replace('-', '之').trim();
            
            const dictResult = localGeocodeDict[lookupKey];
            console.log('[Geocode]', item.address, '->', lookupKey, '->', dictResult ? '命中✅' : '未命中❌');
            
            // 存入 Store (使用 skipSave=true 模式)
            if (dictResult) {
                window.store.updateAddressData(item.address, { 
                    lat: dictResult[0], 
                    lng: dictResult[1],
                    hasRealPos: true,
                    geocodeAttempted: true
                }, true);
            } else {
                window.store.updateAddressData(item.address, { geocodeAttempted: true }, true);
                console.warn("政府資料庫找不到該地址:", item.address, "-> 嘗試鍵值:", lookupKey);
            }

        } catch (err) {
            console.warn("地址解析發生錯誤:", item.address);
            window.store.updateAddressData(item.address, { geocodeAttempted: true }, true);
        } finally {
            if (geocodeQueue.length === 0) {
                // 全部定位完了，這時候才執行「真正的儲存」與「畫面更新」
                console.log("💾 所有地址定位完畢，正在同步至雲端...");
                window.store.saveData(window.store.data).then(() => {
                    // 等存檔完畢後再更新畫面，避免無窮迴圈
                    updateUI();
                });
            }

            setTimeout(() => {
                isGeocoding = false;
                processGeocodeQueue();
            }, 1); 
        }
    };

    // 防抖更新 UI，避免當機
    let updateUITimer = null;
    const debouncedUpdateUI = () => {
        if (updateUITimer) clearTimeout(updateUITimer);
        updateUITimer = setTimeout(() => {
            updateUI();
            console.log('📍 地圖點位已批次更新');
        }, 300); // 300ms 內沒新任務才畫地圖
    };
    const addToGeocodeQueue = (address) => {
        if (!address || typeof address !== 'string') return;
        const normAddr = address.trim();

        // 已經在佇列裡就絕對跳過
        if (geocodeQueue.some(item => item.address === normAddr)) return;

        // 已經有精確座標或嘗試過就不用再排隊
        const normalizeAddr = (addr) => {
            if (!addr) return '';
            return addr.replace(/臺中市/g, '').replace(/台中市/g, '').replace(/[\s　]/g, '').replace(/-/g, '之').trim();
        };
        const nAddr = normalizeAddr(normAddr);
        
        // 檢查正式住戶是否已有座標
        const res = window.store.getResidents().find(r => normalizeAddr(r.address) === nAddr);
        // 檢查預載門牌是否已有座標 (新架構)
        const addrObj = window.store.getData().addresses.find(a => normalizeAddr(a.address) === nAddr);
        
        const hasGeocoded = (res && (res.hasRealPos || res.geocodeAttempted)) || (addrObj && (addrObj.hasRealPos || addrObj.geocodeAttempted));
        
        if (hasGeocoded) return;
        
        geocodeQueue.push({ address: normAddr });
        if (!isGeocoding) processGeocodeQueue();
    };
    // ----------------------

    const updateUI = () => {
        const selP = document.getElementById('filter-project').value;
        const selB = document.getElementById('filter-block').value;
        const selW = document.getElementById('filter-water').value;
        const currentBlocks = window.store.getBlocks();
        let targetBlocks = currentBlocks;
        if (selP !== 'all') targetBlocks = targetBlocks.filter(b => b.projectName === selP);
        if (selB !== 'all') targetBlocks = targetBlocks.filter(b => b.blockName === selB);
        if (selW !== 'all') targetBlocks = targetBlocks.filter(b => b.waterSystem === selW);

        const totals = targetBlocks.reduce((acc, b) => {
            const s = window.store.getBlockStats(b.id);
            acc.front += (s.front + s.side_front); acc.back += (s.back + s.side_back);
            acc.no_opinion += s.no_opinion; acc.unexpressed += s.unexpressed; acc.total += s.total;
            return acc;
        }, { front: 0, back: 0, no_opinion: 0, unexpressed: 0, total: 0 });

        const chartCtx = document.getElementById('main-chart');
        if (chartCtx && window.Chart) {
            if (chartInstance) chartInstance.destroy();
            chartInstance = new Chart(chartCtx, {
                type: 'pie',
                data: {
                    labels: ['前巷', '後巷', '無意見', '未表達'],
                    datasets: [{ data: [totals.front, totals.back, totals.no_opinion, totals.unexpressed], backgroundColor: ['#2563eb', '#ef4444', '#d946ef', '#94a3b8'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        document.getElementById('mini-stats-body').innerHTML = `
            <tr><td data-label="項目">前巷</td><td data-label="戶數" class="font-bold" style="color:#2563eb">${totals.front}</td></tr>
            <tr><td data-label="項目">後巷</td><td data-label="戶數" class="font-bold" style="color:#ef4444">${totals.back}</td></tr>
            <tr><td data-label="項目">無意見</td><td data-label="戶數" class="font-bold" style="color:#d946ef">${totals.no_opinion}</td></tr>
            <tr><td data-label="項目">未表達</td><td data-label="戶數" class="font-bold" style="color:#94a3b8">${totals.unexpressed}</td></tr>
            <tr style="border-top:2px solid var(--card-border);"><td data-label="項目">總戶數</td><td data-label="戶數" class="font-bold">${totals.total}</td></tr>
        `;

        // AI 判接邏輯實作
        const aiBox = document.getElementById('ai-recommendation-box');
        const aiText = document.getElementById('ai-suggestion-text');
        
        const allTests = window.store.getData().waterTests || [];
        const currentResidents = window.store.getAllResidents();
        
        // 取得當前範圍內所有住戶/地址的試水結果 (優化檢索效能)
        const targetAddressSet = new Set(targetBlocks.reduce((acc, b) => {
            return [...acc, ...window.store.getAddressesByBlock(b.id).map(a => a.address)];
        }, []));
        
        const relevantTests = allTests.filter(t => {
            const res = currentResidents.find(r => r.id === t.residentId);
            return res && targetAddressSet.has(res.address);
        });

        const allTestsAreFront = relevantTests.length > 0 && relevantTests.every(t => t.result === 'front');
        const allTestsAreBack = relevantTests.length > 0 && relevantTests.every(t => t.result === 'back');
        
        const frontRatio = totals.total > 0 ? (totals.front / totals.total) * 100 : 0;
        const frontWillingness = totals.front;
        const backWillingness = totals.back;

        let suggestion = "";
        
        if (allTestsAreFront) {
            // 規則 1：試水全前巷，不論民意
            suggestion = `<span style="color:var(--success); font-weight:700;">方案建議：前巷接管</span><br>分析：現場試水資料顯示全區前巷可行，技術層面優先判定為前巷接管。`;
            aiBox.style.background = "rgba(16, 185, 129, 0.05)";
            aiBox.style.borderColor = "rgba(16, 185, 129, 0.2)";
        } else if (allTestsAreBack) {
            // 規則 2：試水全後巷，需絕對多數民意翻轉
            if (frontRatio > 50) {
                suggestion = `<span style="color:var(--primary); font-weight:700;">方案建議：前巷接管</span><br>分析：雖然試水結果為後巷，但該區住戶前巷意願 (${frontWillingness}) 已大於總戶數一半 (${totals.total}/2)，採民意導向建議前巷。`;
                aiBox.style.background = "rgba(37, 99, 235, 0.05)";
                aiBox.style.borderColor = "rgba(37, 99, 235, 0.2)";
            } else {
                suggestion = `<span style="color:var(--danger); font-weight:700;">方案建議：後巷接管</span><br>分析：技術試水為後巷且前巷意願未達絕對多數 (未過半)，判定維持後巷接管設計。`;
                aiBox.style.background = "rgba(239, 68, 68, 0.05)";
                aiBox.style.borderColor = "rgba(239, 68, 68, 0.2)";
            }
        } else if (frontRatio > 50) {
            // 規則 3：一般過半判定
            suggestion = `<span style="color:var(--primary); font-weight:700;">方案建議：前巷接管</span><br>分析：當前水系住戶前巷意願已達 ${frontRatio.toFixed(1)}% (過半)，具備強大民意基礎。`;
            aiBox.style.background = "rgba(37, 99, 235, 0.05)";
            aiBox.style.borderColor = "rgba(37, 99, 235, 0.2)";
        } else if (totals.total > 0) {
            suggestion = `數據不足或意願分散，建議工程師安排現場說明會，或進一步執行試水作業以確認技術可行性。`;
            aiBox.style.background = "rgba(245, 158, 11, 0.05)";
            aiBox.style.borderColor = "rgba(245, 158, 11, 0.2)";
        } else {
            suggestion = `請選擇具體的街廓或水系以進行智慧分析。`;
            aiBox.style.background = "rgba(148, 163, 184, 0.05)";
            aiBox.style.borderColor = "rgba(148, 163, 184, 0.2)";
        }

        aiText.innerHTML = suggestion;
        lucide.createIcons();

        document.getElementById('block-data-body').innerHTML = targetBlocks.map(b => {
            const s = window.store.getBlockStats(b.id);
            return `<tr><td data-label="案名">${b.projectName}</td><td data-label="街廓" class="font-bold">${b.blockName}</td><td data-label="水系">${b.waterSystem}</td><td data-label="前巷">${s.front + s.side_front}</td><td data-label="後巷">${s.back + s.side_back}</td><td data-label="無意見">${s.no_opinion}</td><td data-label="未表達">${s.unexpressed}</td><td data-label="總戶數">${s.total}</td></tr>`;
        }).join('');

        // 更新地圖標記 (住戶層級顯示)
        if (mapInstance && markersLayer) {
            markersLayer.clearLayers();
            const points = [];
            
            // 地址正規化函數，用於精確比對
            const normalizeAddr = (addr) => {
                if (!addr) return '';
                return addr.replace(/臺中市/g, '')
                           .replace(/台中市/g, '')
                           .replace(/[\s　]/g, '')
                           .replace(/-/g, '之')
                           .trim();
            };

            // 1. 建立當前區塊的顯示數據
            const targetAddressData = [];
            targetBlocks.forEach(blk => {
                // 獲取此街廓的所有預載地址
                const addrs = window.store.getAddressesByBlock(blk.id);
                
                addrs.forEach(a => {
                    const normA = normalizeAddr(a.address);
                    
                    // 從全域住戶資料中找尋匹配項
                    const matchedRes = currentResidents.find(r => normalizeAddr(r.address) === normA);
                    
                    if (matchedRes) {
                        // 如果有真實住戶，優先使用真實住戶的資料
                        targetAddressData.push({
                            ...matchedRes,
                            // 住戶本身有座標就用住戶的，否則用預載門牌的，最後才用街廓中心的
                            lat: matchedRes.lat || a.lat || blk.lat,
                            lng: matchedRes.lng || a.lng || blk.lng,
                            hasRealPos: matchedRes.hasRealPos || a.hasRealPos,
                            geocodeAttempted: matchedRes.geocodeAttempted || a.geocodeAttempted,
                            _normalized: normA
                        });
                    } else {
                        // 完全沒住戶資料，直接使用預載門牌的資料與定位狀態 (新架構)
                        targetAddressData.push({ 
                            lat: a.lat || blk.lat, 
                            lng: a.lng || blk.lng,
                            hasRealPos: a.hasRealPos,
                            geocodeAttempted: a.geocodeAttempted,
                            name: '未登錄', address: a.address, willingness: 'none',
                            _normalized: normA
                        });
                    }
                });

                // 額外檢查：有沒有住戶是手動填寫但不在預載清單內的？
                const manualResidents = currentResidents.filter(r => r.blockId === blk.id && !targetAddressData.some(d => d.id === r.id));
                manualResidents.forEach(r => {
                    targetAddressData.push({
                        ...r,
                        lat: r.lat || blk.lat,
                        lng: r.lng || blk.lng,
                        _normalized: normalizeAddr(r.address)
                    });
                });
            });

            targetAddressData.forEach((res, index) => {
                const hasAccuratePos = res.hasRealPos === true;
                let finalLat = res.lat;
                let finalLng = res.lng;

                if (finalLat && finalLng) {
                    // 只有「模擬中」的點位才需要微幅擴散防止重疊
                    if (!hasAccuratePos) {
                        const baseOffset = 0.00015;
                        const angle = (index / targetAddressData.length) * Math.PI * 2;
                        finalLat += Math.sin(angle) * baseOffset;
                        finalLng += Math.cos(angle) * baseOffset;
                    }
                    
                    if (!hasAccuratePos && !res.geocodeAttempted) {
                        addToGeocodeQueue(res.address);
                    }

                    // 顏色定義
                    let color = '#94a3b8'; // 預設灰色 (未登錄)
                    if (res.willingness === 'front') color = '#2563eb';      // 前巷-藍
                    else if (res.willingness === 'back') color = '#ef4444';       // 後巷-紅
                    else if (res.willingness === 'no_opinion') color = '#d946ef'; // 無意見-桃紅
                    else if (res.willingness === 'side_front' || res.willingness === 'side_back') color = '#10b981'; // 側巷-綠
                    else if (res.willingness === 'none' && !res.id?.startsWith('V')) color = '#64748b'; // 已註冊但未選-深灰

                    const marker = L.circleMarker([finalLat, finalLng], {
                        radius: 7,
                        fillColor: color,
                        color: (!hasAccuratePos) ? "#fff" : "#000",
                        weight: (!hasAccuratePos) ? 1.5 : 2,
                        opacity: 1,
                        fillOpacity: 0.9
                    });

                    marker.bindPopup(`
                        <div style="font-family: Inter, sans-serif; font-size:0.8rem;">
                            <strong style="color:var(--primary);">${res.address}</strong><br>
                            住戶: ${res.name || '未登錄'}<br>
                            意願: <span style="color:${color}; font-weight:bold;">${window.store.translateWillingness(res.willingness || 'none')}</span><br>
                            狀態: ${!hasAccuratePos ? '<span style="color:#f59e0b;">座標模擬中</span>' : '<span style="color:#10b981;">精確定位完成</span>'}<br>
                            <hr style="margin: 6px 0; border: 0; border-top: 1px solid var(--card-border);">
                            <button onclick="window.startManualPin('${res.address}')" style="width: 100%; padding: 4px; background: transparent; border: 1px solid var(--primary); color: var(--primary); border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 4px;">
                                📍 手動校正位置
                            </button>
                        </div>
                    `);
                    markersLayer.addLayer(marker);
                    points.push([finalLat, finalLng]);
                }
            });

            // 確保地圖一定會跳轉：即使該街廓還沒有任何住戶名單，也要把街廓本身的中心點納入計算
            targetBlocks.forEach(b => {
                if (b.lat && b.lng) points.push([b.lat, b.lng]);
            });

            if (points.length > 0) {
                mapInstance.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 18 });
            }
            mapInstance.invalidateSize();

            // 更新進度條 UI
            const total = targetAddressData.length;
            const finished = targetAddressData.filter(r => r.hasRealPos || r.geocodeAttempted).length;
            const progressContainer = document.getElementById('geocode-progress-container');
            const progressBar = document.getElementById('geocode-progress-bar');
            const progressText = document.getElementById('geocode-progress-text');

            if (progressContainer && total > 0) {
                if (finished < total) {
                    progressContainer.style.display = 'block';
                    if(progressText) progressText.style.display = 'block';
                    const percent = (finished / total) * 100;
                    progressBar.style.width = percent + '%';
                    if(progressText) progressText.innerText = `地址定位中: ${finished} / ${total}`;
                } else {
                    // 全部完成，延遲一下後收起進度條
                    progressBar.style.width = '100%';
                    if(progressText) progressText.innerText = `定位完成: ${total} 戶`;
                    setTimeout(() => {
                        if (finished === targetAddressData.length) {
                            progressContainer.style.display = 'none';
                            if(progressText) progressText.style.display = 'none';
                        }
                    }, 2000);
                }
            }
        }
    };

    const populateFilters = () => {
        const pSelect = document.getElementById('filter-project');
        const bSelect = document.getElementById('filter-block');
        const wSelect = document.getElementById('filter-water');
        
        const currentBlocks = window.store.getBlocks();
        const projects = [...new Set(currentBlocks.map(b => b.projectName))].filter(Boolean).sort(naturalSort);
        pSelect.innerHTML = '<option value="all">所有案名</option>' + projects.map(p => `<option value="${p}">${p}</option>`).join('');
        
        const updateDropdowns = () => {
            const selP = pSelect.value;
            const selB = bSelect.value;
            const selW = wSelect.value;
            
            let targetB = currentBlocks;
            if (selP !== 'all') targetB = targetB.filter(b => b.projectName === selP);
            const bOptions = [...new Set(targetB.map(b => b.blockName))].filter(Boolean).sort(naturalSort);
            bSelect.innerHTML = '<option value="all">所有街廓</option>' + bOptions.map(b => `<option value="${b}">${b}</option>`).join('');
            if (bOptions.includes(selB)) bSelect.value = selB; else bSelect.value = 'all';
            
            let targetW = targetB;
            if (bSelect.value !== 'all') targetW = targetW.filter(b => b.blockName === bSelect.value);
            const wOptions = [...new Set(targetW.map(b => b.waterSystem))].filter(Boolean).sort(naturalSort);
            wSelect.innerHTML = '<option value="all">所有水系</option>' + wOptions.map(w => `<option value="${w}">${w}</option>`).join('');
            if (wOptions.includes(selW)) wSelect.value = selW; else wSelect.value = 'all';
            
            updateUI();
        };

        pSelect.onchange = updateDropdowns;
        bSelect.onchange = updateDropdowns;
        wSelect.onchange = updateUI;
        
        // Initial setup
        initMap();
        loadLocalGeocodeDict();
        updateDropdowns();
    };
    populateFilters();

    if (container._storeUpdateHandlerChart) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerChart);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('main-chart')) {
            updateUI();
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerChart = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};

window.renderConsultantAllocationPage = function (container) {
    const blocks = window.store.getBlocks();
    const residents = window.store.getAllResidents();
    const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });

    let activeTab = 'all';

    let html = `
        <div class="glass-card card">
            <div class="card-header flex-row-stack" style="justify-content:space-between; align-items:center;">
                <h3><i data-lucide="users"></i> 住戶街廓分配管理</h3>
                <div class="flex-row-stack">
                    <select id="res-filter-project" class="form-control" style="width:auto;"><option value="all">所有案名</option></select>
                    <select id="res-filter-block" class="form-control" style="width:auto;"><option value="all">所有街廓</option></select>
                    <select id="res-filter-water" class="form-control" style="width:auto;"><option value="all">所有水系</option></select>
                    <button class="btn btn-outline btn-sm" id="export-excel-btn" style="background: #16a34a; color: white; border: none;"><i data-lucide="file-spreadsheet"></i> 匯出 Excel</button>
                    <button class="btn btn-outline btn-sm" id="import-addr-btn"><i data-lucide="file-up"></i> 匯入地址</button>
                    <button class="btn btn-primary btn-sm" id="batch-save-btn">一鍵儲存</button>
                </div>
            </div>
            
            <div class="tabs-container" style="padding:0 15px; margin-top:10px; display:flex; gap:20px; border-bottom:1px solid var(--card-border);">
                <div class="tab-item active" data-tab="all" style="padding:10px 5px; cursor:pointer; font-weight:bold; border-bottom:3px solid var(--primary);">全部</div>
                <div class="tab-item" data-tab="dispute" style="padding:10px 5px; cursor:pointer; color:var(--danger);">待處理/意見 <span id="dispute-count" class="badge badge-danger">0</span></div>
                <div class="tab-item" data-tab="assigned" style="padding:10px 5px; cursor:pointer; color:var(--text-muted);">已核定</div>
                <div class="tab-item" data-tab="unassigned" style="padding:10px 5px; cursor:pointer; color:var(--text-muted);">未分配</div>
            </div>

            <div style="padding:15px;">
                <div id="allocation-table-container" style="overflow-x:auto; border:1px solid var(--card-border); border-radius:8px;"></div>
            </div>
        </div>

        <div id="feedback-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
            <div class="glass-card card" style="width:90%; max-width:600px; padding:20px;">
                <div class="flex-row-stack mb-4" style="justify-content:space-between;">
                    <h3>住戶意見與照片</h3>
                    <button class="icon-btn" id="close-feedback-btn"><i data-lucide="x"></i></button>
                </div>
                <div id="feedback-content" style="max-height:60vh; overflow-y:auto;"></div>
            </div>
        </div>

        <div id="addr-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:2000; align-items:center; justify-content:center;">
            <div class="glass-card card" style="width:90%; max-width:500px; padding:20px;">
                <h3>地址批次匯入</h3>
                <textarea id="addr-input" class="form-control mt-4" style="height:200px;" placeholder="每行一個地址..."></textarea>
                <div class="flex-row-stack mt-4">
                    <button class="btn btn-primary w-full" id="save-addr-btn">儲存匯入</button>
                    <button class="btn btn-outline w-full" id="close-addr-btn">取消</button>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = html;
    lucide.createIcons();

    const normalizeAddress = (addr) => {
        if (!addr) return '';
        return addr.replace(/臺/g, '台').replace(/\s+/g, '').trim();
    };

    const renderTable = (addressList, residentList, selP, tests, allResidents) => {
        let allRows = [];
        addressList.forEach(addr => {
            const normAddr = normalizeAddress(addr.address);
            // 從「所有」住戶清單中尋找，並優先選擇「資料最完整」的那一筆
            const matchedRes = allResidents
                .filter(r => normalizeAddress(r.address) === normAddr)
                .sort((a, b) => {
                    const scoreA = (a.willingness && a.willingness !== 'none' ? 10 : 0) + (a.name && a.name !== '未登錄' ? 5 : 0);
                    const scoreB = (b.willingness && b.willingness !== 'none' ? 10 : 0) + (b.name && b.name !== '未登錄' ? 5 : 0);
                    return scoreB - scoreA;
                })[0];
            allRows.push({ address: addr.address, resident: matchedRes, blockId: addr.blockId });
        });
        
        // 將那些沒有在預載門牌清單中的例外住戶（手動新增）也加進來
        residentList.forEach(res => {
            const normResAddr = normalizeAddress(res.address);
            if (!addressList.some(addr => normalizeAddress(addr.address) === normResAddr)) {
                allRows.push({ address: res.address, resident: res, blockId: res.blockId });
            }
        });

        // 過濾邏輯
        let filteredRows = allRows;
        if (activeTab === 'assigned') filteredRows = allRows.filter(r => r.resident && r.resident.status === 'processed');
        else if (activeTab === 'dispute') filteredRows = allRows.filter(r => r.resident && r.resident.status === 'dispute');
        else if (activeTab === 'unassigned') filteredRows = allRows.filter(r => !r.resident || (r.resident.status !== 'processed' && r.resident.status !== 'dispute'));

        // 更新紅字計數
        const dCount = allRows.filter(r => r.resident && r.resident.status === 'dispute').length;
        document.getElementById('dispute-count').innerText = dCount;

        const currentBlocks = window.store.getBlocks();

        return `
            <table class="responsive-table text-sm">
                <thead><tr><th>地址</th><th>姓名</th><th>電話</th><th>意願</th><th>試水建議</th><th>回饋</th><th style="min-width:120px;">核定街廓</th><th style="min-width:120px;">核定水系</th><th>操作</th></tr></thead>
                <tbody>${filteredRows.map(row => {
            const d = row.resident || { id: 'TMP_' + row.address, name: '', phone: '', willingness: 'none' };
            const rowBlocks = currentBlocks.filter(b => selP === 'all' || b.projectName === selP);
            const currentBlock = currentBlocks.find(b => b.id === (d.blockId || row.blockId));
            const currentBName = currentBlock ? currentBlock.blockName : '';

            // 強化試水紀錄尋找邏輯：優先用 ID，找不到就用地址
            const hasTest = tests.some(t => {
                if (d && d.id && t.residentId === d.id) return true;
                const res = residentList.find(r => r.id === t.residentId);
                return res && res.address === row.address;
            });
            const latestTest = hasTest ? tests.filter(t => {
                if (d && d.id && t.residentId === d.id) return true;
                const res = residentList.find(r => r.id === t.residentId);
                return res && res.address === row.address;
            }).pop() : null;
            const testResult = latestTest ? latestTest.result : 'none';

            return `
                        <tr>
                            <td data-label="地址">
                                <div class="flex-row-stack" style="gap:5px;">
                                    <input type="text" class="edit-addr form-control" value="${row.address}" style="width:220px; padding:4px; font-size:0.8rem;">
                                    <a href="https://www.google.com/maps/search/${encodeURIComponent(row.address)}" target="_blank" title="查看 Google 地圖" style="color:var(--primary);">
                                        <i data-lucide="external-link" style="width:14px;"></i>
                                    </a>
                                </div>
                            </td>
                            <td data-label="姓名"><input type="text" class="edit-name form-control" value="${d.name || ''}" placeholder="未登錄" style="width:80px; padding:4px; font-size:0.8rem;"></td>
                            <td data-label="電話"><input type="text" class="edit-phone form-control" value="${d.phone || ''}" placeholder="未填" style="width:100px; padding:4px; font-size:0.8rem;"></td>
                            <td data-label="意願">
                                <select class="edit-will form-control" style="width:80px; padding:4px; font-size:0.8rem;">
                                    <option value="none" ${!d.willingness || d.willingness === 'none' ? 'selected' : ''}>未表達</option>
                                    <option value="front" ${d.willingness === 'front' ? 'selected' : ''}>前巷</option>
                                    <option value="back" ${d.willingness === 'back' ? 'selected' : ''}>後巷</option>
                                    <option value="side" ${d.willingness === 'side' ? 'selected' : ''}>側巷</option>
                                    <option value="no_opinion" ${d.willingness === 'no_opinion' ? 'selected' : ''}>無意見</option>
                                </select>
                            </td>
                            <td data-label="試水建議">
                                <select class="edit-test form-control" style="width:80px; padding:4px; font-size:0.8rem;">
                                    <option value="none" ${testResult === 'none' ? 'selected' : ''}>未試水</option>
                                    <option value="front" ${testResult === 'front' ? 'selected' : ''}>前巷</option>
                                    <option value="back" ${testResult === 'back' ? 'selected' : ''}>後巷</option>
                                    <option value="side_front" ${testResult === 'side_front' ? 'selected' : ''}>側(前)</option>
                                    <option value="side_back" ${testResult === 'side_back' ? 'selected' : ''}>側(後)</option>
                                </select>
                            </td>
                            <td data-label="回饋">${(d.notes || d.photo) ? `<button class="btn btn-outline btn-xs view-feedback" data-id="${d.id}">查看回饋 ${d.photo ? '📷' : ''}</button>` : '無'}</td>
                            <td data-label="核定街廓">
                                <select class="edit-blk-name" data-id="${d.id}" style="width:100%; font-size:0.7rem;">
                                    <option value="">--街廓--</option>
                                    ${[...new Set(rowBlocks.map(b => b.blockName))].sort(naturalSort).map(bn => `<option value="${bn}" ${currentBName === bn ? 'selected' : ''}>${bn}</option>`).join('')}
                                </select>
                            </td>
                            <td data-label="核定水系">
                                <select class="edit-blk-id" data-id="${d.id}" style="width:100%; font-size:0.7rem;">
                                    <option value="">--水系--</option>
                                    ${rowBlocks.filter(b => b.blockName === currentBName).map(b => `<option value="${b.id}" ${(d.blockId || row.blockId) === b.id ? 'selected' : ''}>${b.waterSystem}</option>`).join('')}
                                </select>
                            </td>
                            <td data-label="操作">
                                <div style="display:flex; gap:5px; align-items:center;">
                                    <button class="btn btn-primary btn-sm save-action" data-id="${d.id}">核定</button>
                                    ${!d.id.startsWith('TMP_') ? `<button class="btn btn-outline btn-sm text-danger del-action" data-id="${d.id}" title="刪除此紀錄"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>
                    `;
        }).join('')}</tbody>
            </table>
        `;
    };

    const updateAllocationUI = () => {
        const selP = document.getElementById('res-filter-project').value;
        const selB = document.getElementById('res-filter-block').value;
        const selW = document.getElementById('res-filter-water').value;
        
        const currentBlocks = window.store.getBlocks();
        const currentResidents = window.store.getAllResidents();
        const tests = window.store.getData().waterTests || [];

        let filteredAddrs = [];
        currentBlocks.filter(b => 
            (selP === 'all' || b.projectName === selP) && 
            (selB === 'all' || b.blockName === selB) &&
            (selW === 'all' || b.waterSystem === selW)
        ).forEach(blk => {
            filteredAddrs = [...filteredAddrs, ...window.store.getAddressesByBlock(blk.id)];
        });
        const filteredRes = currentResidents.filter(r => 
            (selP === 'all' || r.projectName === selP) && 
            (selB === 'all' || r.blockName === selB) &&
            (selW === 'all' || r.waterSystem === selW)
        );

        document.getElementById('allocation-table-container').innerHTML = renderTable(filteredAddrs, filteredRes, selP, tests, currentResidents);
        lucide.createIcons();

        // 核定下拉連動
        document.querySelectorAll('.edit-blk-name').forEach(sel => {
            sel.onchange = () => {
                const row = sel.closest('tr');
                const waterSel = row.querySelector('.edit-blk-id');
                const filtered = blocks.filter(b => (selP === 'all' || b.projectName === selP) && b.blockName === sel.value);
                waterSel.innerHTML = '<option value="">--水系--</option>' + filtered.map(b => `<option value="${b.id}">${b.waterSystem}</option>`).join('');
            };
        });

        // 查看回饋照片
        document.querySelectorAll('.view-feedback').forEach(btn => {
            btn.onclick = () => {
                const res = currentResidents.find(r => r.id === btn.dataset.id);
                document.getElementById('feedback-content').innerHTML = `
                    <div class="mb-4"><strong>文字備註：</strong><p class="p-3 bg-light mt-2">${res.notes || '無文字備註'}</p></div>
                    ${res.photo ? `<img src="${res.photo}" style="width:100%; border-radius:8px;">` : ''}
                `;
                document.getElementById('feedback-modal').style.display = 'flex';
            };
        });

        // 儲存核定
        document.querySelectorAll('.save-action').forEach(btn => {
            btn.onclick = () => {
                const row = btn.closest('tr');
                const bId = row.querySelector('.edit-blk-id').value;
                const newAddr = row.querySelector('.edit-addr').value;
                const newName = row.querySelector('.edit-name').value;
                const newPhone = row.querySelector('.edit-phone').value;
                const newWill = row.querySelector('.edit-will').value;
                const newTest = row.querySelector('.edit-test').value;

                if (!bId) return alert('請選擇核定水系');

                const id = btn.dataset.id;
                
                // 一次性取得所有資料，進行原子操作
                const allData = window.store.getData();
                const residents = [...(allData.residents || [])];
                let waterTests = [...(allData.waterTests || [])];
                let finalRid = id;

                if (id.startsWith('TMP_')) {
                    const blockObj = currentBlocks.find(b => b.id === bId);
                    const newId = 'R' + Date.now() + Math.random().toString(36).substr(2, 5);
                    residents.push({
                        id: newId,
                        name: newName || '未登錄',
                        phone: newPhone || '未填',
                        address: newAddr,
                        idNumber: 'none',
                        blockId: bId,
                        projectName: blockObj.projectName,
                        blockName: blockObj.blockName,
                        waterSystem: blockObj.waterSystem,
                        willingness: newWill,
                        status: 'processed'
                    });
                    finalRid = newId;
                } else {
                    const idx = residents.findIndex(r => r.id === id);
                    if (idx !== -1) {
                        residents[idx] = { ...residents[idx], name: newName, phone: newPhone, address: newAddr, willingness: newWill, blockId: bId, status: 'processed' };
                    }
                }

                // 處理試水資料（徹底覆蓋模式）
                // 移除該住戶所有舊紀錄
                waterTests = waterTests.filter(t => t.residentId !== finalRid);
                
                if (newTest !== 'none') {
                    waterTests.push({ residentId: finalRid, result: newTest, date: new Date().toISOString() });
                }

                // 一次原子寫入
                window.store.saveData({ ...allData, residents, waterTests });

                alert('核定與資料更新完成');
                updateAllocationUI();
            };
        });

        // 刪除按鈕邏輯
        document.querySelectorAll('.del-action').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                if (!confirm('確定要刪除這筆登記的住戶資料嗎？刪除後無法恢復。')) return;

                const allData = window.store.getData();
                const residents = (allData.residents || []).filter(r => r.id !== id);
                const waterTests = (allData.waterTests || []).filter(t => t.residentId !== id);

                window.store.saveData({ ...allData, residents, waterTests });
                alert('刪除成功');
                updateAllocationUI();
            };
        });
    };

    document.querySelectorAll('.tabs-container .tab-item').forEach(tab => {
        tab.onclick = () => {
            activeTab = tab.dataset.tab;
            
            // 清除所有標籤的樣式
            document.querySelectorAll('.tabs-container .tab-item').forEach(t => {
                t.classList.remove('active');
                t.style.borderBottom = 'none';
                t.style.fontWeight = 'normal';
                // 恢復原始預設顏色 (根據 data-tab 決定)
                if (t.dataset.tab === 'dispute') t.style.color = 'var(--danger)';
                else t.style.color = 'var(--text-muted)';
            });

            // 設定選中標籤的樣式
            tab.classList.add('active');
            tab.style.borderBottom = '3px solid var(--primary)';
            tab.style.fontWeight = 'bold';
            tab.style.color = 'var(--primary)';
            
            updateAllocationUI();
        };
    });
 stories:

    // 匯入按鈕
    document.getElementById('import-addr-btn').onclick = () => document.getElementById('addr-modal').style.display = 'flex';
    document.getElementById('close-addr-btn').onclick = () => document.getElementById('addr-modal').style.display = 'none';
    document.getElementById('save-addr-btn').onclick = () => {
        const selP = document.getElementById('res-filter-project').value;
        const selB = document.getElementById('res-filter-block').value;
        const selW = document.getElementById('res-filter-water').value;
        const currentBlocks = window.store.getBlocks();
        const block = currentBlocks.find(b => b.projectName === selP && b.blockName === selB && (selW === 'all' || b.waterSystem === selW));
        if (!block) return alert('請先在上方正確選擇案名、街廓與對應的水系');
        const list = document.getElementById('addr-input').value.split('\n').filter(Boolean);
        window.store.importAddresses(block.id, list);
        alert('匯入完成');
        document.getElementById('addr-modal').style.display = 'none';
        updateAllocationUI();
    };

    // 一鍵儲存按鈕 (改進為原子操作，防止資料覆蓋錯誤)
    document.getElementById('batch-save-btn').onclick = () => {
        const rows = document.querySelectorAll('#allocation-table-container tbody tr');
        if (rows.length === 0) return alert('無可儲存的資料');

        if (!confirm(`確定要將目前列表中所有已選取水系的資料進行批次核定嗎？`)) return;

        const allData = window.store.getData();
        const residents = [...(allData.residents || [])];
        let waterTests = [...(allData.waterTests || [])];
        const currentBlocks = window.store.getBlocks();
        let count = 0;

        rows.forEach(row => {
            const bId = row.querySelector('.edit-blk-id').value;
            if (!bId) return;

            const id = row.querySelector('.save-action').dataset.id;
            const newAddr = row.querySelector('.edit-addr').value;
            const newName = row.querySelector('.edit-name').value;
            const newPhone = row.querySelector('.edit-phone').value;
            const newWill = row.querySelector('.edit-will').value;
            const newTest = row.querySelector('.edit-test').value;

            let finalRid = id;

            if (id.startsWith('TMP_')) {
                const blockObj = currentBlocks.find(b => b.id === bId);
                const newId = 'R' + Date.now() + Math.random().toString(36).substr(2, 5);
                residents.push({
                    id: newId,
                    name: newName || '未登錄',
                    phone: newPhone || '未填',
                    address: newAddr,
                    idNumber: 'none',
                    blockId: bId,
                    projectName: blockObj.projectName,
                    blockName: blockObj.blockName,
                    waterSystem: blockObj.waterSystem,
                    willingness: newWill,
                    status: 'processed'
                });
                finalRid = newId;
            } else {
                const idx = residents.findIndex(r => r.id === id);
                if (idx !== -1) {
                    residents[idx] = { ...residents[idx], name: newName, phone: newPhone, address: newAddr, willingness: newWill, blockId: bId, status: 'processed' };
                }
            }

            // 處理試水資料批次覆蓋
            // 先移除該住戶的所有舊紀錄
            waterTests = waterTests.filter(t => t.residentId !== finalRid);
            
            if (newTest !== 'none') {
                waterTests.push({ residentId: finalRid, result: newTest, date: new Date().toISOString() });
            }
            count++;
        });

        if (count > 0) {
            window.store.saveData({ ...allData, residents, waterTests });
            alert(`已成功批次核定並同步 ${count} 筆資料`);
            updateAllocationUI();
        } else {
            alert('請先為住戶選擇核定水系再進行儲存');
        }
    };

    // 案名、街廓與水系篩選連動
    const pSel = document.getElementById('res-filter-project');
    const bSel = document.getElementById('res-filter-block');
    const wSel = document.getElementById('res-filter-water');
    const projects = [...new Set(blocks.map(b => b.projectName))].filter(Boolean).sort(naturalSort);
    pSel.innerHTML = '<option value="all">所有案名</option>' + projects.map(p => `<option value="${p}">${p}</option>`).join('');

    const updateAllocationDropdowns = () => {
        const selP = pSel.value;
        const selB = bSel.value;
        const selW = wSel.value;

        // 更新街廓選單
        const filteredForB = selP === 'all' ? blocks : blocks.filter(b => b.projectName === selP);
        const bOptions = [...new Set(filteredForB.map(b => b.blockName))].sort(naturalSort);
        bSel.innerHTML = '<option value="all">所有街廓</option>' + bOptions.map(bn => `<option value="${bn}">${bn}</option>`).join('');
        if (bOptions.includes(selB)) bSel.value = selB; else bSel.value = 'all';

        // 更新水系選單
        let filteredForW = filteredForB;
        if (bSel.value !== 'all') filteredForW = filteredForW.filter(b => b.blockName === bSel.value);
        const wOptions = [...new Set(filteredForW.map(b => b.waterSystem))].sort(naturalSort);
        wSel.innerHTML = '<option value="all">所有水系</option>' + wOptions.map(wn => `<option value="${wn}">${wn}</option>`).join('');
        if (wOptions.includes(selW)) wSel.value = selW; else wSel.value = 'all';

        updateAllocationUI();
    };

    pSel.onchange = updateAllocationDropdowns;
    bSel.onchange = updateAllocationDropdowns;
    wSel.onchange = updateAllocationUI;
    
    // 匯出 Excel 功能
    document.getElementById('export-excel-btn').onclick = () => {
        const selP = pSel.value;
        const selB = bSel.value;
        const selW = wSel.value;
        
        const currentBlocks = window.store.getBlocks();
        const currentResidents = window.store.getAllResidents();
        const tests = window.store.getData().waterTests || [];

        // 1. 抓取符合篩選條件的資料
        let exportData = [];
        const targetBlocks = currentBlocks.filter(b => 
            (selP === 'all' || b.projectName === selP) && 
            (selB === 'all' || b.blockName === selB) &&
            (selW === 'all' || b.waterSystem === selW)
        );

        targetBlocks.forEach(blk => {
            const blockAddrs = window.store.getAddressesByBlock(blk.id);
            blockAddrs.forEach(addr => {
                const res = currentResidents.find(r => r.address === addr.address) || {};
                const test = tests.find(t => t.residentId === res.id) || 
                             tests.find(t => {
                                 const found = currentResidents.find(r2 => r2.id === t.residentId);
                                 return found && found.address === addr.address;
                             }) || {};

                exportData.push({
                    '案名': blk.projectName,
                    '街廓': blk.blockName,
                    '水系': blk.waterSystem,
                    '地址': addr.address,
                    '姓名': res.name || '未登錄',
                    '電話': res.phone || '未填',
                    '意願': window.store.translateWillingness(res.willingness || 'none'),
                    '試水資料': window.store.translateWillingness(test.result || 'none'),
                    '回饋備註': res.notes || '無'
                });
            });
        });

        if (exportData.length === 0) return alert('目前條件下無資料可匯出');

        // 2. 使用 SheetJS 產生 Excel
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "住戶分配資料");
        
        // 3. 檔名包含篩選資訊
        const fileName = `住戶調查_${selP === 'all' ? '全區' : selP}_${selB === 'all' ? '' : selB + '_'}${selW === 'all' ? '' : selW + '_'}${new Date().toLocaleDateString()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    document.getElementById('close-feedback-btn').onclick = () => document.getElementById('feedback-modal').style.display = 'none';
    updateAllocationUI();

    if (container._storeUpdateHandlerAllocation) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerAllocation);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('allocation-table-container')) {
            updateAllocationUI();
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerAllocation = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};
