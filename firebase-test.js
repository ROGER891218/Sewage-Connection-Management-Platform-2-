const autocannon = require('autocannon');

// Firebase 資料庫 URL
const FIREBASE_URL = 'https://resident-willingness-app-default-rtdb.firebaseio.com/app_data/residents.json'; 

function runFirebaseTest() {
    console.log('🚀 [開始測試] 正在模擬 50 個併發使用者提交意願表單...');
    console.log('持續時間: 20 秒\n');

    const instance = autocannon({
        url: FIREBASE_URL,
        connections: 50,      
        duration: 20,         
        method: 'POST',       
        body: JSON.stringify({
            name: '壓力測試住戶',
            phone: '0900000000',
            address: '壓力測試專用路段',
            willingness: 'front',
            projectName: '測試專案',
            blockName: '測試街廓',
            waterSystem: '測試水系',
            status: 'pending',
            timestamp: new Date().toISOString()
        }),
        headers: {
            'content-type': 'application/json'
        }
    }, (err, result) => {
        if (err) {
            console.error('❌ 測試出錯:', err);
            return;
        }
        console.log('\n✅ [測試報告完成]');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`總請求數: ${result.requests.total} 次`);
        console.log(`每秒處理 (Throughput): ${result.requests.average.toFixed(2)} req/sec`);
        console.log(`平均延遲 (Latency): ${result.latency.average.toFixed(2)} ms`);
        console.log(`失敗請求: ${result.errors + result.non2xx} 次`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('💡 提示：接下來您可以執行 node cleanup-test.js 來刪除產生的測試資料。');
    });

    autocannon.track(instance, { renderProgressBar: true });
}

runFirebaseTest();
