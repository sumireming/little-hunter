const puppeteer = require('puppeteer-core');

async function get_xhs_note_data(url) {

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const device_config = {
    name: 'iPhone 13',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    viewport: {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    }
  }

  await page.setUserAgent(device_config.userAgent);
  await page.setViewport(device_config.viewport);


  // 监听导航开始
  const navigationPromise = page.waitForNavigation({
    waitUntil: 'networkidle2', // 等待网络空闲
    timeout: 30000
  });

  await page.goto(url, {
    waitUntil: 'domcontentloaded'
  });

  // 等待导航完成
  await navigationPromise;
    

  // 在页面上下文中执行代码，获取window对象下的数据
  const windowData = await page.evaluate(() => {

    try {
      let data = window.__INITIAL_STATE__.noteData;
      let note_data = data.data.noteData
      let xhs_note_id = note_data.noteId

      let result = {
        xhs_user_id: data.realUserId,
        xhs_note_id,
        note_data
      }

      return result
    } catch (e) {
      return e.message
    }

    

  });

  await browser.close();

  return windowData;

}

module.exports =  {
  get_xhs_note_data
}



