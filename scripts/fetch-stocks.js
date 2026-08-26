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

    console.log('🌐 正在前往 CMoney 熱門股市頁面...');
    await page.goto('https://www.cmoney.tw/forum/popular/stock', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 1. 等待列表的主要容器載入（若網站結構調整，請調整此處 selector）
    console.log('⏳ 等待 DOM 元素渲染...');
    await page.waitForTimeout(5000); // 強制等待 5 秒讓 SPA 腳本執行完成

    // 2. 擷取股票資料
    const stocks = await page.evaluate(() => {
      const items = [];
      
      // 搜尋頁面上包含股票代號與名稱的連結/區塊
      // CMoney 論壇熱門標的通常會包含 /forum/stock/XXXX 的連結
      const links = Array.from(document.querySelectorAll('a[href*="/forum/stock/"]'));
      
      const seenSymbols = new Set();

      links.forEach(link => {
        const text = link.innerText.trim();
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/forum\/stock\/(\d+)/);

        if (match && text) {
          const symbol = match[1];
          if (!seenSymbols.has(symbol)) {
            seenSymbols.add(symbol);
            
            // 整理名稱與代號
            const cleanName = text.replace(symbol, '').replace(/\n/g, ' ').trim();
            items.push({
              symbol: symbol,
              name: cleanName || symbol,
              rawText: text
            });
          }
        }
      });

      return items;
    });

    console.log(`✅ 成功擷取到 ${stocks.length} 筆資料`);

    // 防呆：如果完全沒抓到資料，拋出錯誤避免覆蓋原本正常的 JSON
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
    process.exit(1); // 讓 GitHub Actions 標記為 Fail 以便收到通知
  } finally {
    if (browser) await browser.close();
  }
})();
