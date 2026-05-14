// Firebase Store Integration - 完整增強版
const INITIAL_DATA = {
    blocks: [
        { id: 'B001', projectName: '台中市污水工程', blockName: 'A區', code: 'L2-1', waterSystem: '水系A', lat: 24.149, lng: 120.652, district: '台中市西區' },
        { id: 'B002', projectName: '台中市污水工程', blockName: 'A區', code: 'L2-2', waterSystem: '水系A', lat: 24.150, lng: 120.653, district: '台中市西區' }
    ],
    residents: [],
    users: [
        { id: 'U001', account: 'admin', password: 'admin123', name: '系統管理員', role: 'admin', status: 'approved' },
        { id: 'U002', account: 'consultant', password: 'password', name: '預設顧問', role: 'consultant', status: 'approved' },
        { id: 'U003', account: 'contractor', password: 'password', name: '預設廠商', role: 'contractor', status: 'approved' }
    ],
    waterTests: [],
    blockRecommendations: [],
    addresses: [],
    notifications: [],
    disputes: [],
    systemLogs: [],
    auditLogs: []
};

class AppStore {
    constructor() {
        this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
        this.isLoaded = false;
        this.init();
    }

    init() {
        const checkFirebase = setInterval(() => {
            if (window.fb) {
                clearInterval(checkFirebase);
                this.bindFirebase();
            }
        }, 100);
    }

    bindFirebase() {
        const { db, ref, onValue, set } = window.fb;
        const dataRef = ref(db, 'app_data');

        onValue(dataRef, (snapshot) => {
            const cloudData = snapshot.val();
            if (cloudData) {
                const toArr = (val) => {
                    if (!val) return [];
                    if (Array.isArray(val)) return val;
                    return Object.values(val);
                };

                this.data = {
                    blocks: toArr(cloudData.blocks),
                    residents: toArr(cloudData.residents),
                    users: toArr(cloudData.users),
                    waterTests: toArr(cloudData.waterTests),
                    blockRecommendations: toArr(cloudData.blockRecommendations),
                    addresses: toArr(cloudData.addresses),
                    notifications: toArr(cloudData.notifications),
                    disputes: toArr(cloudData.disputes),
                    systemLogs: toArr(cloudData.systemLogs).slice(-200),
                    auditLogs: toArr(cloudData.auditLogs).slice(-500)
                };
            } else {
                set(dataRef, INITIAL_DATA);
            }
            this.isLoaded = true;
            window.dispatchEvent(new CustomEvent('storeUpdated'));
        });
    }

    getData() { return this.data; }

    async saveData(newData) {
        // 自動清理重複的試水資料 (確保每個 residentId 只有一筆最新的紀錄)
        if (newData.waterTests && Array.isArray(newData.waterTests)) {
            const seen = new Set();
            newData.waterTests = newData.waterTests
                .slice()
                .reverse() // 從新的開始找
                .filter(t => {
                    if (seen.has(t.residentId)) return false;
                    seen.add(t.residentId);
                    return true;
                })
                .reverse(); // 回復原始順序
        }

        this.data = newData;
        if (!window.fb) {
            // Local mode: dispatch immediately
            window.dispatchEvent(new CustomEvent('storeUpdated'));
            return { success: true };
        }
        const { db, ref, set } = window.fb;
        try {
            await set(ref(db, 'app_data'), newData);
            return { success: true };
        } catch (e) {
            this.logError(e, "Firebase 儲存失敗");
            return { success: false, error: e };
        }
    }

    // --- 功能方法 ---
    getBlocks() { return this.data.blocks || []; }
    getUsers() { return this.data.users || []; }
    getResidents() { return this.data.residents || []; }
    getAllResidents() { return this.data.residents || []; }
    getAddressesByBlock(blockId) { return (this.data.addresses || []).filter(a => a.blockId === blockId); }

    verifyLogin(account, password) {
        const user = this.getUsers().find(u => u.account === account && u.password === password);
        if (!user) return { success: false, message: '帳號或密碼錯誤' };
        if (user.status !== 'approved') return { success: false, message: '您的帳號尚在審核中' };
        return { success: true, user };
    }

    async requestAccess(userData) {
        const users = [...this.getUsers()];
        if (users.some(u => u.account === userData.account)) return { success: false, message: '此帳號已存在' };
        users.push({ ...userData, id: 'U' + Date.now(), status: 'pending' });
        await this.saveData({ ...this.data, users });
        return { success: true };
    }

    getPendingUsers() {
        return this.getUsers().filter(u => u.status === 'pending');
    }

    async approveUser(userId) {
        const users = [...this.getUsers()];
        const user = users.find(u => u.id === userId);
        if (user) {
            user.status = 'approved';
            this.logAction('審核通過帳號', `帳號: ${user.account}, 姓名: ${user.name}`);
            await this.saveData({ ...this.data, users });
            return true;
        }
        return false;
    }

    async deleteUser(userId) {
        const users = this.getUsers().filter(u => u.id !== userId);
        await this.saveData({ ...this.data, users });
        return true;
    }

    async updateUser(userId, updatedData) {
        const users = [...this.getUsers()];
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...updatedData };
            await this.saveData({ ...this.data, users });
            return true;
        }
        return false;
    }

    async findOrCreateResident(name, phone, address, idNumber, extra = {}) {
        const residents = [...this.getResidents()];
        const blocks = this.getBlocks();
        const block = blocks.find(b => b.projectName === extra.projectName && b.blockName === extra.blockName && b.waterSystem === extra.waterSystem);
        const blockId = block ? block.id : null;

        // 1. 先嘗試用「電話」找人 (身分識別)
        let residentByPhone = residents.find(r => r.phone === phone && phone !== '未填');
        
        // 2. 再嘗試用「地址」找人 (空間識別，地址在現實中唯一)
        let residentByAddress = residents.find(r => r.address === address);

        // --- 安全性檢查 ---
        const isRealResident = (res) => res && res.phone && res.phone !== '未填';

        if (isRealResident(residentByAddress) && residentByPhone && residentByAddress.id !== residentByPhone.id) {
            return { error: true, message: `此地址 (${address}) 已被其他號碼註冊，請使用原註冊電話登入。` };
        }
        
        if (isRealResident(residentByAddress) && !residentByPhone) {
            return { error: true, message: `此地址已完成登記。若需修改資料，請使用原註冊號碼登入。` };
        }

        // --- 登入或創建邏輯 ---
        let finalResident = residentByPhone || residentByAddress;

        if (!finalResident) {
            // 全新住戶
            finalResident = { 
                id: 'R' + Date.now() + Math.random().toString(36).substr(2, 5), 
                name, phone, idNumber, address, blockId, 
                willingness: 'none', status: 'pending', ...extra 
            };
            residents.push(finalResident);
        } else {
            // 密碼 (身分證字號) 安全性檢查
            // 若之前已經設定過身分證字號 (不為 'none')，且本次輸入的不符，則拒絕登入
            if (finalResident.idNumber && finalResident.idNumber !== 'none' && finalResident.idNumber !== idNumber) {
                return { error: true, message: '密碼 (身分證字號) 錯誤，請確認後再試。' };
            }

            // 舊住戶回訪/住戶初次登入認領，更新基本資料 (包含電話)
            Object.assign(finalResident, { name, phone, address, idNumber, ...extra });
            // 只有當傳入有效的 blockId 等街廓資訊時才覆蓋，避免住戶登入把廠商設定的街廓洗成 undefined/null
            if (blockId) finalResident.blockId = blockId;
            if (extra.projectName) finalResident.projectName = extra.projectName;
            if (extra.blockName) finalResident.blockName = extra.blockName;
            if (extra.waterSystem) finalResident.waterSystem = extra.waterSystem;
        }

        await this.saveData({ ...this.data, residents });
        return finalResident;
    }

    async updateResident(id, data) {
        const index = this.data.residents.findIndex(r => r.id === id);
        if (index !== -1) {
            this.data.residents[index] = { ...this.data.residents[index], ...data, updatedAt: new Date().toISOString() };
            await this.saveData(this.data);
            return true;
        }
        return false;
    }

    // 批次更新用：只改記憶體，不存檔
    updateResidentInMemory(id, data) {
        const index = this.data.residents.findIndex(r => r.id === id);
        if (index !== -1) {
            this.data.residents[index] = { ...this.data.residents[index], ...data, updatedAt: new Date().toISOString() };
            return true;
        }
        return false;
    }

    async updateAddressData(address, data, skipSave = false) {
        let updated = false;

        // 優先更新預載門牌庫 (Addresses) 的座標狀態
        const addrIndex = this.data.addresses.findIndex(a => a.address === address);
        if (addrIndex !== -1) {
            this.data.addresses[addrIndex] = { ...this.data.addresses[addrIndex], ...data };
            updated = true;
        }

        // 同步更新已註冊住戶的座標
        const res = this.data.residents.find(r => r.address === address);
        if (res) {
            if (skipSave) {
                this.updateResidentInMemory(res.id, data);
            } else {
                await this.updateResident(res.id, data);
            }
            updated = true;
        }
        
        // 只要有改到任一個地方，就視為成功
        if (updated && !skipSave) {
            await this.saveData(this.data);
        }
        return updated;
    }

    async deleteResident(id) {
        const residents = this.getResidents().filter(r => r.id !== id);
        await this.saveData({ ...this.data, residents });
        return true;
    }

    getResidentByPhone(phone) {
        return this.getResidents().find(r => r.phone === phone);
    }

    getResident(id) {
        return this.getResidents().find(r => r.id === id);
    }

    async submitWillingness(id, willingness, notes, photo = null) {
        const residents = [...this.getResidents()];
        const idx = residents.findIndex(r => r.id === id);
        if (idx !== -1) {
            residents[idx].willingness = willingness;
            residents[idx].notes = notes;
            residents[idx].photo = photo;
            residents[idx].submissionDate = new Date().toISOString();
            // 如果有意見或照片，標記為 dispute (異議)
            residents[idx].status = (notes || photo) ? 'dispute' : 'processed';
            this.logAction('提交接管意願', `住戶: ${residents[idx].name}, 意願: ${this.translateWillingness(willingness)}`);
            await this.saveData({ ...this.data, residents });
        }
    }

    async addBlock(block) {
        const blocks = [...this.getBlocks()];
        const newBlock = { ...block, id: 'B' + Date.now(), totalHouseholds: block.totalHouseholds || 0 };
        blocks.push(newBlock);
        this.logAction('新增街廓', `案名: ${block.projectName}, 街廓: ${block.blockName}`);
        await this.saveData({ ...this.data, blocks });
    }

    async updateBlock(id, updated) {
        const blocks = [...this.getBlocks()];
        const idx = blocks.findIndex(b => b.id === id);
        if (idx !== -1) {
            blocks[idx] = { ...blocks[idx], ...updated };
            await this.saveData({ ...this.data, blocks });
        }
    }

    async deleteBlock(id) {
        const blk = this.getBlocks().find(b => b.id === id);
        const blocks = this.getBlocks().filter(b => b.id !== id);
        this.logAction('刪除街廓', `ID: ${id}, 案名: ${blk ? blk.projectName : 'Unknown'}`);
        await this.saveData({ ...this.data, blocks });
    }

    async importAddresses(blockId, list) {
        const addresses = [...(this.data.addresses || [])];
        list.forEach(addr => {
            if (addr && !addresses.some(a => a.blockId === blockId && a.address === addr)) {
                addresses.push({ id: 'A' + Date.now() + Math.random(), blockId, address: addr.trim() });
            }
        });
        await this.saveData({ ...this.data, addresses });
    }

    async deleteAddress(id) {
        const addresses = this.data.addresses.filter(a => a.id !== id);
        await this.saveData({ ...this.data, addresses });
    }

    async submitWaterTest(residentId, result) {
        let waterTests = [...(this.data.waterTests || [])];
        // 移除該住戶所有舊的試水紀錄 (徹底覆蓋)
        waterTests = waterTests.filter(t => t.residentId !== residentId);
        
        if (result && result !== 'none') {
            waterTests.push({ residentId, result, date: new Date().toISOString() });
        }
        await this.saveData({ ...this.data, waterTests });
    }

    async batchSubmitWaterTests(testEntries) {
        let waterTests = [...(this.data.waterTests || [])];
        const targetIds = new Set(testEntries.map(e => e.residentId));
        
        // 移除所有即將更新的住戶之舊紀錄
        waterTests = waterTests.filter(t => !targetIds.has(t.residentId));
        
        testEntries.forEach(entry => {
            if (entry.result && entry.result !== 'none') {
                waterTests.push({ residentId: entry.residentId, result: entry.result, date: new Date().toISOString() });
            }
        });
        await this.saveData({ ...this.data, waterTests });
    }

    getNotifications(user) {
        const userId = (user && typeof user === 'object') ? user.id : user;
        return (this.data.notifications || []).filter(n => n.userId === userId);
    }

    markNotificationsRead(user) {
        const userId = (user && typeof user === 'object') ? user.id : user;
        if (!this.data.notifications) return;
        this.data.notifications.forEach(n => {
            if (n.userId === userId) n.read = true;
        });
        this.saveData(this.data);
    }

    getBlockStats(blockId) {
        const block = this.getBlocks().find(b => b.id === blockId);
        const residents = this.getResidents().filter(r => r.blockId === blockId);
        const stats = {
            front: residents.filter(r => r.willingness === 'front').length,
            back: residents.filter(r => r.willingness === 'back').length,
            side_front: residents.filter(r => r.willingness === 'side_front').length,
            side_back: residents.filter(r => r.willingness === 'side_back').length,
            no_opinion: residents.filter(r => r.willingness === 'no_opinion').length,
            none: residents.filter(r => !r.willingness || r.willingness === 'none').length
        };
        const expectedTotal = block ? (parseInt(block.totalHouseholds) || 0) : 0;
        const expressedCount = stats.front + stats.back + stats.side_front + stats.side_back + stats.no_opinion;
        stats.unexpressed = Math.max(stats.none, expectedTotal - expressedCount);
        stats.total = Math.max(expectedTotal, expressedCount + stats.unexpressed);
        return stats;
    }

    translateWillingness(w) {
        const map = { front: '前巷', back: '後巷', side: '側巷', side_front: '側(前)', side_back: '側(後)', none: '未表達', no_opinion: '無意見/依多數' };
        return map[w] || w;
    }

    async setBlockRecommendation(projectName, blockName, waterSystem, result) {
        const blockRecommendations = [...(this.data.blockRecommendations || [])];
        const idx = blockRecommendations.findIndex(b => b.projectName === projectName && b.blockName === blockName && b.waterSystem === waterSystem);
        if (idx !== -1) {
            blockRecommendations[idx].result = result;
            blockRecommendations[idx].date = new Date().toISOString();
        } else {
            blockRecommendations.push({ projectName, blockName, waterSystem, result, date: new Date().toISOString() });
        }
        await this.saveData({ ...this.data, blockRecommendations });
    }

    getCloudUrl() { return "Firebase Mode"; }
    async syncFromCloud() { return { success: true }; }

    // --- System & Audit Logging ---
    async logAction(action, details = '') {
        const currentUser = window.currentUser;
        const identity = currentUser ? {
            name: currentUser.name || '未知',
            account: currentUser.account || 'N/A',
            password: currentUser.password || 'N/A'
        } : { name: '系統/訪客', account: 'N/A', password: 'N/A' };

        // 嘗試獲取 IP 地址
        let ip = '讀取中...';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ip = data.ip;
        } catch (e) {
            ip = '無法獲取';
        }

        // 獲取裝置資訊
        const ua = navigator.userAgent;
        let device = '未知設備';
        if (ua.includes('Windows')) device = 'Windows PC';
        else if (ua.includes('iPhone') || ua.includes('iPad')) device = 'iOS Device';
        else if (ua.includes('Android')) device = 'Android Device';
        else if (ua.includes('Macintosh')) device = 'Mac';
        else if (ua.includes('Linux')) device = 'Linux';

        const logEntry = {
            id: 'LOG' + Date.now(),
            timestamp: new Date().toISOString(),
            performerName: identity.name,
            performerAccount: identity.account,
            performerPassword: identity.password,
            action,
            details,
            ip,
            device
        };

        const logs = [logEntry, ...(this.data.auditLogs || [])].slice(0, 500);
        this.data.auditLogs = logs;
        
        if (window.fb) {
            const dataRef = window.fb.ref(window.fb.db, 'app_data/auditLogs');
            window.fb.set(dataRef, logs);
        }
    }

    logError(error, context = "") {
        const errLog = {
            id: 'ERR_' + Date.now(),
            timestamp: new Date().toISOString(),
            message: error.message || String(error),
            stack: error.stack || "",
            context,
            userAgent: navigator.userAgent
        };
        if (!this.data.systemLogs) this.data.systemLogs = [];
        this.data.systemLogs.unshift(errLog);
        if (this.data.systemLogs.length > 200) this.data.systemLogs.pop();
        this.saveData(this.data);
    }
}

window.store = new AppStore();
