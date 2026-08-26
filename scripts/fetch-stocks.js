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
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 1. 等待頁面與 DOM 元素渲染完成
    console.log('⏳ 等待 DOM 元素渲染...');
    await page.waitForTimeout(5000); // 等待 SPA 腳本與資料載入

    // 2. 在瀏覽器環境中解析三個關鍵 Section 的前 10 名
    const stocks = await page.evaluate(() => {
      const items = [];
      const seenSymbols = new Set();

      // 定義通用解析輔助函式
      function parseSection(sectionId, categoryName) {
        const section = document.querySelector(`section#${sectionId}`);
        if (!section) return;

        // 搜尋區塊內的表格列或列表項目 (支援常見表格 tr 或 flex 列表)
        const rows = section.querySelectorAll('tbody tr, table tr, a[href*="/stock/"]');
        let count = 0;

        rows.forEach(row => {
          if (count >= 10) return; // 嚴格限制只取前 10 名

          // 抓取包含股票代號的連結與文字
          const link = row.tagName === 'A' ? row : row.querySelector('a[href*="/stock/"], a[href*="/forum/stock/"]');
          if (!link) return;

          const href = link.getAttribute('href') || '';
          const match = href.match(/\/stock\/(\d{4,6})/);

          if (match) {
            const symbol = match[1];
            // 取得名稱文字（濾除數字代號）
            const text = row.innerText || link.innerText || '';
            const nameMatch = text.replace(symbol, '').split('\n')[0].trim();
            
            // 提取股價 (若有顯示)
            const priceEl = row.querySelector('.price, td:nth-child(3), span[class*="price"]');
            const price = priceEl ? parseFloat(priceEl.innerText.replace(/,/g, '')) || 0 : 0;

            items.push({
              symbol: symbol,
              name: nameMatch || symbol,
              category: categoryName,
              price: price,
              rank: count + 1
            });

            count++;
          }
        });
      }

      // 1. 上市櫃行情排行：成交量前十名
      parseSection('ChangeUp', '成交量');

      // 2. 上市櫃法人排行：買超前十名
      parseSection('InstitutionalInvestorBuy', '法人買超');

      // 3. 上市櫃基本面排行：營收月增/年增/EPS前十名
      parseSection('RevenueGrowthMom', '基本面');

      // 備用防呆：如果精準 ID 沒對應到，自動退回搜尋頁面上所有股票連結
      if (items.length === 0) {
        const allLinks = Array.from(document.querySelectorAll('a[href*="/stock/"]'));
        allLinks.forEach(link => {
          if (items.length >= 30) return;
          const href = link.getAttribute('href') || '';
          const match = href.match(/\/stock\/(\d{4,6})/);
          if (match) {
            const symbol = match[1];
            if (!seenSymbols.has(symbol)) {
              seenSymbols.add(symbol);
              items.push({
                symbol: symbol,
                name: link.innerText.replace(symbol, '').trim() || symbol,
                category: '熱門排行',
                price: 0
              });
            }
          }
        });
      }

      return items;
    });

    console.log(`✅ 成功擷取到 ${stocks.length} 筆排行榜資料`);

    // 防呆驗證
    if (stocks.length === 0) {
      throw new Error('未成功解析到任何股票資料，請檢查頁面 DOM 結構或反爬蟲機制。');
    }

    // 3. 寫入 JSON 檔 (包含分類資訊與更新時間)
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
