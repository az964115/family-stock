const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // 啟動無頭瀏覽器
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // 模擬真實瀏覽器的 User-Agent，避免被防火牆擋掉
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log('正在前往目標網頁...');
  await page.goto('https://www.cmoney.tw/forum/popular/stock', {
    waitUntil: 'networkidle', // 等待所有網絡 API 請求完成
    timeout: 60000
  });

  // 1. 建議方式：直接在 Playwright 中解析 DOM 並提取資料
  // （請依據實際網頁 DOM 結構修改 Selector，例如 '.stock-item' 或 'table tbody tr'）
  const stocks = await page.evaluate(() => {
    const items = [];
    // 範例：選取股票列表元素
    const rows = document.querySelectorAll('.stock-list-item'); 
    rows.forEach(row => {
      const name = row.querySelector('.stock-name')?.innerText.trim();
      const symbol = row.querySelector('.stock-symbol')?.innerText.trim();
      if (name && symbol) {
        items.push({ name, symbol });
      }
    });
    return items;
  });

  console.log(`成功擷取到 ${stocks.length} 筆資料`);

  // 2. 寫入 potential-stocks.json
  fs.writeFileSync('potential-stocks.json', JSON.stringify({
    updatedAt: new Date().toISOString(),
    stocks: stocks,
    // 若原先邏輯需要完整 htmlContent，也可透過 page.content() 取得渲染後的 HTML：
    // htmlContent: await page.content()
  }, null, 2));

  await browser.close();
})();
