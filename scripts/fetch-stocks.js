const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function fetchWithPlaywright() {
  console.log('🚀 啟動 Playwright 抓取 CMoney 資料...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
    const page = await context.newPage();
    
    // 造訪 CMoney 排行榜頁面
    await page.goto('https://www.cmoney.tw/forum/stock/rank', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // 等待 DOM 元素渲染完成
    await page.waitForSelector('section', { timeout: 15000 }).catch(() => console.log('⚠️ 等待 section 逾時'));

    // 取得渲染後的完整 HTML
    const htmlContent = await page.content();

    const outputData = {
      updatedAt: new Date().toISOString(),
      htmlContent: htmlContent
    };

    const outputPath = path.resolve(__dirname, '../potential-stocks.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('🎉 成功取得動態渲染內容並更新 potential-stocks.json！');

  } catch (error) {
    console.error('❌ Playwright 抓取失敗:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

fetchWithPlaywright();
