window.renderContractorPage = function(container, initialFilters = null) {
    const residents = window.store.getAllResidents();
    
    let html = `
        <div class="glass-card card mb-4">
            <div class="card-header">
                <h3><i data-lucide="droplet"></i> 現場試水回報</h3>
                <p class="text-muted" style="font-size:0.9rem;">輸入實際試水結果，系統將自動比對住戶意願</p>
            </div>
            <form id="water-test-form">
                <div class="flex-row-stack" style="margin-bottom: 15px;">
                    <div class="form-group mb-0" style="flex:1;">
                        <label>案名</label>
                        <select id="form-project" class="form-control" style="font-size:0.85rem; padding:4px 8px;">
                            <option value="all">所有案名</option>
                        </select>
                    </div>
                    <div class="form-group mb-0" style="flex:1;">
                        <label>街廓</label>
                        <select id="form-block" class="form-control" style="font-size:0.85rem; padding:4px 8px;">
                            <option value="all">所有街廓</option>
                        </select>
                    </div>
                    <div class="form-group mb-0" style="flex:1;">
                        <label>水系</label>
                        <select id="form-water" class="form-control" style="font-size:0.85rem; padding:4px 8px;">
                            <option value="all">所有水系</option>
                        </select>
                    </div>
                </div>
                <div class="flex-row-stack" style="margin-bottom: 15px;">
                    <div class="form-group mb-0" style="flex:2;">
                        <label>選取住戶 (留空則套用至上方篩選的所有戶)</label>
                        <select id="resident-select">
                            <option value="">-- 批次套用至全區 --</option>
                        </select>
                    </div>
                    <div class="form-group mb-0" style="flex:1;">
                        <label>試水建議方向</label>
                        <select id="result-select" required>
                            <option value="">請選擇...</option>
                            <option value="front">前巷</option>
                            <option value="back">後巷</option>
                            <option value="side_front">側(前)</option>
                            <option value="side_back">側(後)</option>
                            <option value="none">無意見</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">送出試水結果</button>
            </form>
        </div>

        <div class="glass-card card">
            <div class="card-header flex-row-stack" style="justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <h3><i data-lucide="list"></i> 試水紀錄表</h3>
                <div class="tabs flex-row-stack" id="test-list-tabs">
                    <span class="tab-item active" data-tab="untested" style="cursor:pointer; font-weight:600; color:var(--primary); border-bottom:3px solid var(--primary); padding-bottom:5px;">未試水</span>
                    <span class="tab-item" data-tab="tested" style="cursor:pointer; font-weight:600; color:var(--text-light); padding-bottom:5px;">已試水</span>
                </div>
            </div>
            <div id="water-test-list-container" style="overflow-x: auto;">
                <!-- Injected by updateWaterTestList -->
            </div>
        </div>
    `;
    container.innerHTML = html;
    lucide.createIcons();

    if (initialFilters) {
        Object.keys(initialFilters).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = initialFilters[id];
        });
    }

    const blocks = window.store.getBlocks();
    const allResidents = window.store.getAllResidents();

    const naturalSort = (a, b) => {
        const re = /(\d+)/g;
        const aParts = String(a).split(re);
        const bParts = String(b).split(re);
        const len = Math.min(aParts.length, bParts.length);
        for (let i = 0; i < len; i++) {
            if (aParts[i] !== bParts[i]) {
                const aNum = parseInt(aParts[i], 10);
                const bNum = parseInt(bParts[i], 10);
                if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                return aParts[i].localeCompare(bParts[i]);
            }
        }
        return aParts.length - bParts.length;
    };

    const populateCascading = (prefix) => {
        const pSelect = document.getElementById(`${prefix}-project`);
        const bSelect = document.getElementById(`${prefix}-block`);
        const wSelect = document.getElementById(`${prefix}-water`);
        
        const curP = pSelect.value;
        const curB = bSelect.value;
        const curW = wSelect.value;
        
        // Projects
        const projects = [...new Set(blocks.map(b => b.projectName))].filter(Boolean).sort(naturalSort);
        pSelect.innerHTML = `<option value="all">${prefix==='form'?'所有案名':'案名篩選'}</option>` + 
            projects.map(p => `<option value="${p}" ${p===curP?'selected':''}>${p}</option>`).join('');

        // Blocks
        const filteredForB = curP === 'all' ? blocks : blocks.filter(b => b.projectName === curP);
        const blockNames = [...new Set(filteredForB.map(b => b.blockName))].filter(Boolean).sort(naturalSort);
        bSelect.innerHTML = `<option value="all">${prefix==='form'?'所有街廓':'街廓篩選'}</option>` + 
            blockNames.map(b => `<option value="${b}" ${b===curB?'selected':''}>${b}</option>`).join('');

        // Waters
        let filteredForW = filteredForB;
        if (curB !== 'all') filteredForW = filteredForW.filter(b => b.blockName === curB);
        const waters = [...new Set(filteredForW.map(b => b.waterSystem))].filter(Boolean).sort(naturalSort);
        wSelect.innerHTML = `<option value="all">${prefix==='form'?'所有水系':'水系篩選'}</option>` + 
            waters.map(w => `<option value="${w}" ${w===curW?'selected':''}>${w}</option>`).join('');
    };

    const updateResidentDropdown = () => {
        const p = document.getElementById('form-project').value;
        const bName = document.getElementById('form-block').value;
        const w = document.getElementById('form-water').value;
        const select = document.getElementById('resident-select');

        const currentBlocks = window.store.getBlocks();
        const currentResidents = window.store.getAllResidents();

        const filteredResidents = currentResidents.filter(r => {
            const block = currentBlocks.find(bl => bl.id === r.blockId);
            const matchP = (p === 'all' || (block ? block.projectName === p : r.projectName === p));
            const matchB = (bName === 'all' || (block ? block.blockName === bName : r.blockName === bName));
            const matchW = (w === 'all' || (block ? block.waterSystem === w : r.waterSystem === w));
            return matchP && matchB && matchW;
        });
        const targetBlocks = currentBlocks.filter(b => 
            (p === 'all' || b.projectName === p) &&
            (bName === 'all' || b.blockName === bName) &&
            (w === 'all' || b.waterSystem === w)
        );

        let filteredAddresses = [];
        targetBlocks.forEach(blk => {
            filteredAddresses = [...filteredAddresses, ...window.store.getAddressesByBlock(blk.id)];
        });

        // Exclude addresses that already have a registered resident
        const predefinedOnly = filteredAddresses.filter(a => !currentResidents.some(r => r.address === a.address));

        const options = [];
        filteredResidents.forEach(r => {
            options.push(`<option value="RES_${r.id}">${r.name || '未登錄'} - ${r.address}</option>`);
        });
        predefinedOnly.forEach(a => {
            options.push(`<option value="ADDR_${a.id}_${a.blockId}">${a.address} (預設地址)</option>`);
        });
        select.innerHTML = '<option value="">-- 批次套用至全區 --</option>' + options.join('');
    };

    const updateWaterTestList = () => {
        const p = document.getElementById('form-project').value;
        const bName = document.getElementById('form-block').value;
        const w = document.getElementById('form-water').value;
        const activeTab = document.querySelector('#test-list-tabs .active').dataset.tab;
        
        const currentBlocks = window.store.getBlocks();
        const currentResidents = window.store.getAllResidents();

        const targetBlocks = currentBlocks.filter(b => 
            (p === 'all' || b.projectName === p) &&
            (bName === 'all' || b.blockName === bName) &&
            (w === 'all' || b.waterSystem === w)
        );

        let filteredAddresses = [];
        targetBlocks.forEach(blk => {
            filteredAddresses = [...filteredAddresses, ...window.store.getAddressesByBlock(blk.id)];
        });

        const filteredResidents = currentResidents.filter(r => {
            const block = currentBlocks.find(bl => bl.id === r.blockId);
            const matchP = (p === 'all' || (block ? block.projectName === p : r.projectName === p));
            const matchB = (bName === 'all' || (block ? block.blockName === bName : r.blockName === bName));
            const matchW = (w === 'all' || (block ? block.waterSystem === w : r.waterSystem === w));
            return matchP && matchB && matchW;
        });

        const predefinedOnly = filteredAddresses.filter(a => !filteredResidents.some(r => r.address === a.address));

        const allItems = [
            ...filteredResidents.map(r => ({ ...r, type: 'RES', block: currentBlocks.find(b => b.id === r.blockId) })),
            ...predefinedOnly.map(a => ({ ...a, type: 'ADDR', block: currentBlocks.find(b => b.id === a.blockId) }))
        ];

        const tests = window.store.getData().waterTests || [];
        
        const rows = allItems.filter(item => {
            // 判斷是否已試水：不論 RES 或 ADDR，只要地址有試水紀錄就視為已試水
            const hasTest = tests.some(t => {
                if (item.type === 'RES' && t.residentId === item.id) return true;
                const res = currentResidents.find(r => r.id === t.residentId);
                return res && res.address === item.address;
            });
            
            if (activeTab === 'tested') return hasTest;
            if (activeTab === 'untested') return !hasTest;
            return true;
        }).map(item => {
            const hasTest = tests.some(t => {
                if (item.type === 'RES' && t.residentId === item.id) return true;
                const res = currentResidents.find(r => r.id === t.residentId);
                return res && res.address === item.address;
            });
            const latestTest = hasTest ? tests.filter(t => {
                if (item.type === 'RES' && t.residentId === item.id) return true;
                const res = currentResidents.find(r => r.id === t.residentId);
                return res && res.address === item.address;
            }).pop() : null;
            const b = item.block;
            const pName = b ? b.projectName : (item.projectName || '-');
            const blkName = b ? b.blockName : (item.blockName || '-');
            const wName = b ? b.waterSystem : (item.waterSystem || '-');
            
            const oldWillingness = item.willingness || 'none';
            const testResult = latestTest ? latestTest.result : 'none';
            const match = hasTest && ((oldWillingness === testResult) || (oldWillingness === 'none'));

            return `
                <tr>
                    <td data-label="最後測試日期">${latestTest ? new Date(latestTest.date).toLocaleString() : '-'}</td>
                    <td data-label="案名">${pName}</td>
                    <td data-label="街廓">${blkName}</td>
                    <td data-label="水系">${wName}</td>
                    <td data-label="住戶地址" class="text-truncate text-wrap" style="max-width:200px;">${item.address}</td>
                    <td data-label="意願">${item.type === 'RES' ? window.store.translateWillingness(oldWillingness) : '尚未表達'}</td>
                    <td data-label="試水建議">${hasTest ? window.store.translateWillingness(testResult) : '-'}</td>
                    <td data-label="比對結果">
                        ${hasTest ? `
                            <span style="color: ${match ? 'var(--success)' : 'var(--danger)'}">
                                ${match ? '<i data-lucide="check-circle" style="width:12px;"></i> 一致' : '<i data-lucide="alert-triangle" style="width:12px;"></i> 衝突'}
                            </span>
                        ` : '-'}
                    </td>
                </tr>
            `;
        });

        document.getElementById('water-test-list-container').innerHTML = `
            <table class="responsive-table text-xs">
                <thead>
                    <tr>
                        <th>最後測試日期</th>
                        <th>案名</th>
                        <th>街廓</th>
                        <th>水系</th>
                        <th>住戶地址</th>
                        <th>意願</th>
                        <th>試水建議</th>
                        <th>比對結果</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length > 0 ? rows.join('') : '<tr><td colspan="8" style="text-align:center; padding:20px;">無符合條件的資料</td></tr>'}
                </tbody>
            </table>
        `;
        lucide.createIcons();
    };

    populateCascading('form');
    updateResidentDropdown();
    updateWaterTestList();

    // Tab Listeners
    document.querySelectorAll('#test-list-tabs .tab-item').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('#test-list-tabs .tab-item').forEach(t => {
                t.classList.remove('active');
                t.style.color = 'var(--text-light)';
                t.style.borderBottom = 'none';
                t.style.fontWeight = 'normal';
            });
            tab.classList.add('active');
            tab.style.color = 'var(--primary)';
            tab.style.borderBottom = '3px solid var(--primary)';
            tab.style.fontWeight = '600';
            updateWaterTestList();
        };
    });

    ['form-project', 'form-block', 'form-water'].forEach(id => {
        document.getElementById(id).onchange = () => {
            if (id.includes('project')) document.getElementById(id.replace('project','block')).value = 'all';
            populateCascading('form');
            updateResidentDropdown();
            updateWaterTestList();
        };
    });

    document.getElementById('water-test-form').onsubmit = async (e) => {
        e.preventDefault();
        const p = document.getElementById('form-project').value;
        const bName = document.getElementById('form-block').value;
        const w = document.getElementById('form-water').value;
        const resVal = document.getElementById('resident-select').value;
        const resResult = document.getElementById('result-select').value;

        const curFilters = {
            'form-project': p,
            'form-block': bName,
            'form-water': w
        };

        const currentBlocks = window.store.getBlocks();
        const currentResidents = window.store.getAllResidents();

        const targetBlocks = currentBlocks.filter(b => 
            (p === 'all' || b.projectName === p) &&
            (bName === 'all' || b.blockName === bName) &&
            (w === 'all' || b.waterSystem === w)
        );

        let filteredAddresses = [];
        targetBlocks.forEach(blk => {
            filteredAddresses = [...filteredAddresses, ...window.store.getAddressesByBlock(blk.id)];
        });

        const filteredResidents = currentResidents.filter(r => {
            const block = currentBlocks.find(bl => bl.id === r.blockId);
            const matchP = (p === 'all' || (block ? block.projectName === p : r.projectName === p));
            const matchB = (bName === 'all' || (block ? block.blockName === bName : r.blockName === bName));
            const matchW = (w === 'all' || (block ? block.waterSystem === w : r.waterSystem === w));
            return matchP && matchB && matchW;
        });

        const predefinedOnly = filteredAddresses.filter(a => !filteredResidents.some(r => r.address === a.address));
        const allItems = [
            ...filteredResidents.map(r => ({ ...r, type: 'RES', block: currentBlocks.find(b => b.id === r.blockId) })),
            ...predefinedOnly.map(a => ({ ...a, type: 'ADDR', block: currentBlocks.find(b => b.id === a.blockId) }))
        ];

        if (resVal) {
            // 單一住戶處理
            let rid = '';
            if (resVal.startsWith('RES_')) rid = resVal.replace('RES_', '');
            else if (resVal.startsWith('ADDR_')) {
                const parts = resVal.split('_');
                const addrId = parts[1];
                const blockId = parts[2];
                const addr = window.store.getData().addresses.find(a => a.id === addrId);
                const blockObj = window.store.getBlocks().find(b => b.id === blockId);
                
                const newRes = await window.store.findOrCreateResident('未登錄', '未填', addr.address, 'none', {
                    projectName: blockObj.projectName,
                    blockName: blockObj.blockName,
                    waterSystem: blockObj.waterSystem,
                    blockId: blockObj.id
                });
                rid = newRes.id;
            }
            await window.store.submitWaterTest(rid, resResult);
            alert('試水結果已提交');
            window.renderContractorPage(container, curFilters);
        } else {
            // 批次套用處理
            if (p === 'all' || bName === 'all' || w === 'all') {
                return alert('批次套用請先選擇具體的 案名/街廓/水系');
            }
            const totalCount = allItems.length;
            if (totalCount === 0) return alert('此範圍內無住戶資料');

            if (confirm(`確定要將「${window.store.translateWillingness(resResult)}」批次套用到此範圍內的 ${totalCount} 筆資料，並設定該區的預設建議嗎？\n(已有試水紀錄者將被覆蓋)`)) {
                
                const allData = window.store.getData();
                let residentsList = [...(allData.residents || [])];
                let waterTests = [...(allData.waterTests || [])];
                
                allItems.forEach(item => {
                    let finalRid = null;
                    if (item.type === 'RES') {
                        finalRid = item.id;
                    } else { 
                        let existingResIndex = residentsList.findIndex(r => r.address === item.address);
                        const bObj = item.block || {};
                        if (existingResIndex !== -1) {
                            residentsList[existingResIndex] = {
                                ...residentsList[existingResIndex],
                                blockId: bObj.id || '',
                                projectName: bObj.projectName || '',
                                blockName: bObj.blockName || '',
                                waterSystem: bObj.waterSystem || ''
                            };
                            finalRid = residentsList[existingResIndex].id;
                        } else {
                            finalRid = 'R' + Date.now() + Math.random().toString(36).substr(2, 5);
                            residentsList.push({
                                id: finalRid,
                                name: '未登錄', phone: '未填', address: item.address, idNumber: 'none',
                                blockId: bObj.id || '', projectName: bObj.projectName || '',
                                blockName: bObj.blockName || '', waterSystem: bObj.waterSystem || '',
                                willingness: 'none', status: 'pending'
                            });
                        }
                    }
                    waterTests = waterTests.filter(t => t.residentId !== finalRid);
                    waterTests.push({ residentId: finalRid, result: resResult, date: new Date().toISOString() });
                });

                await window.store.saveData({ ...allData, residents: residentsList, waterTests });
                if (window.store.setBlockRecommendation) {
                    await window.store.setBlockRecommendation(p, bName, w, resResult);
                }
                alert(`已完成 ${totalCount} 筆批次填報覆蓋！`);
                window.renderContractorPage(container, curFilters);
            }
        }
    };

    if (container._storeUpdateHandlerContractor) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerContractor);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('water-test-form')) {
            const curFilters = {
                'form-project': document.getElementById('form-project') ? document.getElementById('form-project').value : 'all',
                'form-block': document.getElementById('form-block') ? document.getElementById('form-block').value : 'all',
                'form-water': document.getElementById('form-water') ? document.getElementById('form-water').value : 'all'
            };
            window.renderContractorPage(container, curFilters);
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerContractor = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};
