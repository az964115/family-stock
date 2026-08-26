const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function fetchWithPuppeteer() {
  console.log('🚀 啟動無頭瀏覽器抓取 CMoney 資料...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // 模擬真實瀏覽器的 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 開啟 CMoney 排行頁面
    await page.goto('https://www.cmoney.tw/forum/stock/rank', {
      waitUntil: 'networkidle2', // 等待網絡請求完成，確保 DOM 載入
      timeout: 60000
    });

    // 等待核心排行榜元素出現
    await page.waitForSelector('section', { timeout: 15000 }).catch(() => console.log('⚠️ 等待 section 逾時，嘗試直接抓取內容...'));

    // 取得完整渲染後的 HTML
    const htmlContent = await page.content();

    const outputData = {
      updatedAt: new Date().toISOString(),
      htmlContent: htmlContent
    };

    const outputPath = path.resolve(__dirname, '../potential-stocks.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');
    console.log('🎉 成功取得動態渲染內容並寫入 potential-stocks.json！');

  } catch (error) {
    console.error('❌ Puppeteer 抓取失敗:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

fetchWithPuppeteer();
