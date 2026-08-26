const fs = require('fs');
const path = require('path');

async function fetchCMoneyRankings() {
  console.log('🚀 開始抓取 CMoney 股票排行資料...');

  // 設定 Request Header 模擬一般瀏覽器造訪，避免被封鎖
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.cmoney.tw/forum/stock/rank'
  };

  try {
    // 1. 抓取成交量/熱門排行 API
    // (如果 API 網址失效，腳本會回退至傳送基礎 HTML)
    const apiUrl = 'https://www.cmoney.tw/forum/api/v1/stock/rank/hot'; 
    const response = await fetch(apiUrl, { headers });

    let finalData = {};

    if (response.ok) {
      const rankData = await response.json();
      console.log('✅ 成功取得 API 資料！');
      finalData = {
        updatedAt: new Date().toISOString(),
        dataType: 'json',
        stocks: rankData
      };
    } else {
      console.warn(`⚠️ API 請求失敗 (HTTP ${response.status})，嘗試抓取備用 HTML...`);
      const htmlResp = await fetch('https://www.cmoney.tw/forum/stock/rank', { headers });
      const htmlText = await htmlResp.text();
      finalData = {
        updatedAt: new Date().toISOString(),
        dataType: 'html',
        htmlContent: htmlText
      };
    }

    // 寫入根目錄下的 potential-stocks.json
    const outputPath = path.resolve(__dirname, '../potential-stocks.json');
    fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`🎉 成功更新檔案至: ${outputPath}`);

  } catch (error) {
    console.error('❌ 抓取過程發生錯誤:', error.message);
    process.exit(1);
  }
}

fetchCMoneyRankings();
