const https = require('https');

const FIREBASE_URL = 'https://resident-willingness-app-default-rtdb.firebaseio.com/app_data/residents.json';

console.log('🔍 [正在掃描] 搜尋名為「壓力測試住戶」的垃圾資料...');

// 第一步：獲取所有住戶資料
https.get(FIREBASE_URL, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const residents = JSON.parse(data);
        if (!residents) {
            console.log('✅ 資料庫目前是空的，無需清理。');
            return;
        }

        const keysToDelete = Object.keys(residents).filter(key => 
            residents[key].name === '壓力測試住戶'
        );

        if (keysToDelete.length === 0) {
            console.log('✅ 未發現任何測試資料。');
            return;
        }

        console.log(`⚠️ 發現 ${keysToDelete.length} 筆測試資料，準備開始刪除...`);

        // 第二步：逐一刪除 (REST API DELETE)
        let deletedCount = 0;
        keysToDelete.forEach(key => {
            const deleteUrl = `https://resident-willingness-app-default-rtdb.firebaseio.com/app_data/residents/${key}.json`;
            const req = https.request(deleteUrl, { method: 'DELETE' }, (res) => {
                deletedCount++;
                if (deletedCount === keysToDelete.length) {
                    console.log(`\n🎉 [清理完成] 已成功刪除所有 ${deletedCount} 筆測試資料！`);
                    console.log('您的資料庫現在已恢復乾淨狀態。');
                }
            });
            req.on('error', (e) => console.error(`刪除失敗 (${key}):`, e));
            req.end();
        });
    });
}).on('error', (e) => {
    console.error('連線失敗:', e);
});
