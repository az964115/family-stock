const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  let browser;
  try {
    console.log('🚀 啟動 Chromium 瀏覽器...');
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'zh-TW'
    });

    const page = await context.newPage();

    console.log('🌐 正在前往 CMoney 排行榜頁面...');
    await page.goto('https://www.cmoney.tw/forum/stock/rank', {
      waitUntil: 'networkidle', 
      timeout: 60000
    });

    console.log('⏳ 等待 DOM 元素渲染...');
    await page.waitForSelector('tbody tr', { timeout: 15000 });

    const stocks = await page.evaluate(() => {
      const items = [];
      const seenSymbols = new Set();

      function parseSection(sectionId, categoryName) {
        const root = sectionId ? document.querySelector(`section#${sectionId}`) : document;
        if (!root) return;

        const rows = root.querySelectorAll('tbody tr');
        let count = 0;

        rows.forEach(row => {
          if (count >= 10) return; 

          const nameEl = row.querySelector('.table__stockName');
          const idEl = row.querySelector('.table__stockId');
          const priceTd = row.querySelectorAll('td')[2];

          if (idEl && nameEl) {
            const symbol = idEl.innerText.trim();
            const name = nameEl.innerText.trim();
            const priceText = priceTd ? priceTd.innerText.trim().replace(/,/g, '') : '0';
            const price = parseFloat(priceText) || 0;

            if (symbol && !seenSymbols.has(symbol)) {
              seenSymbols.add(symbol);
              items.push({
                symbol: symbol,         
                name: name,             
                category: categoryName,
                price: price,
                rank: count + 1
              });
              count++;
            }
          }
        });
      }

      parseSection('ChangeUp', '漲幅排行');
      parseSection('Volume', '成交量排行');
      parseSection('InstitutionalInvestorBuy', '法人買超');

      if (items.length === 0) {
        parseSection(null, '熱門排行');
      }

      return items;
    });

    console.log(`✅ 成功擷取到 ${stocks.length} 筆排行榜資料`);

    if (stocks.length === 0) {
      throw new Error('未成功解析到任何股票資料，請檢查頁面 DOM 結構或反爬蟲機制。');
    }

    const outputData = {
      status: 'success',
      updatedAt: new Date().toISOString(),
      count: stocks.length,
      stocks: stocks
    };

    fs.writeFileSync('potential-stocks.json', JSON.stringify(outputData, null, 2));
    console.log('📄 已成功儲存至 potential-stocks.json');

  } catch (error) {
    console.error('❌ 爬蟲執行失敗：', error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
