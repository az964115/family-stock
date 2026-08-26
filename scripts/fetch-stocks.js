const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const targetUrl = 'https://www.cmoney.tw/forum/stock/rank';
    
    // 使用 fetch 抓取網頁內容
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const html = await res.text();

    // 存成 json 靜態檔案供前端讀取
    const outputData = {
      updatedAt: new Date().toISOString(),
      htmlContent: html
    };

    const outputPath = path.join(__dirname, '../potential-stocks.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(' Successfully fetched and saved potential-stocks.json');
  } catch (err) {
    console.error(' Fetch failed:', err);
    process.exit(1);
  }
}

run();