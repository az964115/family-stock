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
      waitUntil: 'networkidle', // 改為等待網路空閒，確保 Vue/React 組件完全渲染
      timeout: 60000
    });

    // 1. 等待表格主體渲染完成
    console.log('⏳ 等待 DOM 元素渲染...');
    await page.waitForSelector('tbody tr', { timeout: 15000 });

    // 2. 在瀏覽器環境中解析資料
    const stocks = await page.evaluate(() => {
      const items = [];
      const seenSymbols = new Set();

      function parseSection(sectionId, categoryName) {
        // 若有指定的 sectionId 則限縮範圍，否則對全頁表格進行尋找
        const root = sectionId ? document.querySelector(`section#${sectionId}`) : document;
        if (!root) return;

        const rows = root.querySelectorAll('tbody tr');
        let count = 0;

        rows.forEach(row => {
          if (count >= 10) return; // 每個區塊只抓前 10 名

          // 直接利用網頁專屬的 Class 精準抓取
          const nameEl = row.querySelector('.table__stockName');
          const idEl = row.querySelector('.table__stockId');
          // 股價位於第 3 個 td (index 2)
          const priceTd = row.querySelectorAll('td')[2];

          if (idEl && nameEl) {
            const symbol = idEl.innerText.trim();
            const name = nameEl.innerText.trim();
            const priceText = priceTd ? priceTd.innerText.trim().replace(/,/g, '') : '0';
            const price = parseFloat(priceText) || 0;

            if (symbol && !seenSymbols.has(symbol)) {
              seenSymbols.add(symbol);
              items.push({
                symbol: symbol,         // 例: "4609"
                name: name,             // 例: "唐鋒" (不會再抓成數字了)
                category: categoryName,
                price: price,
                rank: count + 1
              });
              count++;
            }
          }
        });
      }

      // 嘗試依序解析各個 section，若無識別 sectionId 則作為整體表格解析
      parseSection('ChangeUp', '漲幅排行');
      parseSection('Volume', '成交量排行');
      parseSection('InstitutionalInvestorBuy', '法人買超');

      // 備用機制：若指定 Section 找不到，直接解析頁面現有的主要表格
      if (items.length === 0) {
        parseSection(null, '熱門排行');
      }

      return items;
    });

    console.log(`✅ 成功擷取到 ${stocks.length} 筆排行榜資料`);

    // 防呆驗證
    if (stocks.length === 0) {
      throw new Error('未成功解析到任何股票資料，請檢查頁面 DOM 結構或反爬蟲機制。');
    }

    // 3. 寫入 JSON 檔
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
