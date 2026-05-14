window.renderResidentPage = function (container, currentUserId) {
    // 取得當前登入的使用者資訊
    const user = currentUserId || window.currentUser;
    const userId = (user && typeof user === 'object') ? user.id : user;

    // 如果沒登入或不是住戶，顯示錯誤 (保險機制)
    if (!userId) {
        container.innerHTML = '<div class="p-8 text-center text-danger">請重新登入</div>';
        return;
    }

    // 從 store 取得最新的住戶資料
    const resident = window.store.getResident(userId);

    if (!resident) {
        container.innerHTML = '<div class="p-8 text-center text-danger">找不到住戶資料，請重新登入</div>';
        return;
    }

    let photoBase64 = resident.photo || null;

    container.innerHTML = `
        <div class="glass-card card p-6">
            <div class="flex-row-stack mb-6" style="justify-content:space-between; align-items:center;">
                <h2 style="font-size:1.5rem;"><i data-lucide="user"></i> 您好，${resident.name || '住戶'}</h2>
                <span class="badge ${resident.status === 'processed' ? 'badge-success' : 'badge-outline'}">
                    ${resident.status === 'processed' ? '已核定' : (resident.status === 'dispute' ? '異議處理中' : '待核定')}
                </span>
            </div>
            
            <p class="text-muted mb-6">您的地址：${resident.address || '未提供'}</p>
            
            <div class="form-group">
                <label class="font-bold mb-2 block">1. 接管意願確認</label>
                <select id="res-willingness" class="form-control" style="width:100%; height:45px;">
                    <option value="none" ${!resident.willingness || resident.willingness === 'none' ? 'selected' : ''}>-- 請選擇 --</option>
                    <option value="front" ${resident.willingness === 'front' ? 'selected' : ''}>前巷接管</option>
                    <option value="back" ${resident.willingness === 'back' ? 'selected' : ''}>後巷接管</option>
                    <option value="no_opinion" ${resident.willingness === 'no_opinion' ? 'selected' : ''}>無意見 (依多數決)</option>
                </select>
            </div>

            <div class="form-group mt-6">
                <label class="font-bold mb-2 block">2. 意見回饋 (如有施工疑慮請說明)</label>
                <textarea id="res-notes" class="form-control" style="width:100%; height:120px; padding:10px;" placeholder="例如：後巷有增建、化糞池位置不明...">${resident.notes || ''}</textarea>
            </div>

            <div class="form-group mt-6">
                <label class="font-bold mb-2 block">3. 現場照片上傳 (施工參考)</label>
                <div class="flex-row-stack" style="gap:10px;">
                    <input type="file" id="res-photo" class="form-control" accept="image/*" style="flex:1;">
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('res-photo').click()">
                        <i data-lucide="camera"></i> 選擇照片
                    </button>
                </div>
                <div id="photo-preview" class="mt-4" style="max-width:300px; border:1px dashed #ccc; border-radius:8px; overflow:hidden; min-height:100px; display:flex; align-items:center; justify-content:center; background:#f9f9f9;">
                    ${resident.photo ? `<img src="${resident.photo}" style="width:100%;">` : '<span class="text-muted">尚無照片</span>'}
                </div>
            </div>

            <button id="submit-willingness-btn" class="btn btn-primary w-full mt-8" style="height:50px; font-size:1.1rem;">
                <i data-lucide="send"></i> 送出意願與意見
            </button>
        </div>
    `;

    // 取得統計與試水結果
    if (resident.blockId) {
        const tests = window.store.getData().waterTests || [];
        const myTests = tests.filter(t => t.residentId === resident.id);
        const latestTest = myTests.length > 0 ? myTests[myTests.length - 1].result : null;
        
        const stats = window.store.getBlockStats(resident.blockId);
        
        const testMatch = latestTest && resident.willingness !== 'none' 
            ? (latestTest === resident.willingness ? '<span class="text-success" style="display:flex; align-items:center; gap:5px;"><i data-lucide="check-circle" style="width:16px;"></i> 與您的意願相符</span>' : '<span class="text-danger" style="display:flex; align-items:center; gap:5px;"><i data-lucide="alert-triangle" style="width:16px;"></i> 與您的意願衝突</span>')
            : '<span class="text-muted">尚無對比資料</span>';

        container.innerHTML += `
            <div class="glass-card card p-6 mt-6">
                <h3 class="mb-4" style="display:flex; align-items:center; gap:8px;"><i data-lucide="bar-chart-2"></i> 區域接管現況與評估</h3>
                <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div class="p-4 rounded" style="background: rgba(var(--primary-rgb), 0.05); border: 1px solid rgba(var(--primary-rgb), 0.1);">
                        <h4 class="mb-2 font-bold text-primary">廠商試水建議</h4>
                        <p class="text-lg font-bold">${latestTest ? window.store.translateWillingness(latestTest) : '尚未進行試水'}</p>
                        <div class="mt-2 text-sm">${testMatch}</div>
                    </div>
                    <div class="p-4 rounded" style="background: rgba(var(--primary-rgb), 0.05); border: 1px solid rgba(var(--primary-rgb), 0.1);">
                        <h4 class="mb-2 font-bold text-primary">同水系鄰居意願統計</h4>
                        <ul class="text-sm" style="line-height:1.8;">
                            <li>前巷接管：<span class="font-bold">${stats.front + stats.side_front}</span> 戶</li>
                            <li>後巷接管：<span class="font-bold">${stats.back + stats.side_back}</span> 戶</li>
                            <li>無意見：<span class="font-bold">${stats.no_opinion}</span> 戶</li>
                            <li>尚未表達：<span class="font-bold">${stats.unexpressed}</span> 戶</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    // 重新載入圖示
    if (window.lucide) lucide.createIcons();

    // 處理照片轉 Base64
    const photoInput = document.getElementById('res-photo');
    if (photoInput) {
        photoInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    photoBase64 = event.target.result;
                    document.getElementById('photo-preview').innerHTML = `<img src="${photoBase64}" style="width:100%;">`;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // 處理送出
    const submitBtn = document.getElementById('submit-willingness-btn');
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const w = document.getElementById('res-willingness').value;
            const notes = document.getElementById('res-notes').value;
            const photo = photoBase64;

            if (w === 'none') {
                alert('請先選擇接管意願');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerText = '正在傳送...';

            try {
                // 呼叫核心 store 儲存資料
                await window.store.submitWillingness(resident.id, w, notes, photo);
                alert('您的意願已成功送出！');
                location.reload(); // 重新載入頁面確認資料
            } catch (err) {
                alert('傳送失敗，請稍後再試');
                submitBtn.disabled = false;
                submitBtn.innerText = '送出意願與意見';
            }
        };
    }
    // 重新載入圖示
    if (window.lucide) lucide.createIcons();

    if (container._storeUpdateHandlerResident) {
        window.removeEventListener('storeUpdated', container._storeUpdateHandlerResident);
    }
    const storeUpdateHandler = () => {
        if (document.getElementById('res-willingness')) {
            window.renderResidentPage(container, userId);
        } else {
            window.removeEventListener('storeUpdated', storeUpdateHandler);
        }
    };
    container._storeUpdateHandlerResident = storeUpdateHandler;
    window.addEventListener('storeUpdated', storeUpdateHandler);
};
