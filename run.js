const puppeteer = require('puppeteer');
const fs = require('fs');

async function get_xhs_note_data(url) {
  console.log('开始处理请求:', url);
  console.log('当前环境:', {
    NODE_ENV: process.env.NODE_ENV,
    OS: process.platform,
    ARCH: process.arch,
    NODE_VERSION: process.version
  });
  
  let browser = null;
  
  try {
    console.log('启动内置 Chromium 浏览器...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      dumpio: true // 输出浏览器的控制台信息
    });
    console.log('内置 Chromium 浏览器启动成功');

    
    console.log('浏览器启动成功');
    
    const page = await browser.newPage();
    console.log('新页面创建成功');
    
    // 监听页面控制台消息
    page.on('console', msg => {
      console.log('页面控制台:', msg.text());
    });
    
    // 监听页面错误
    page.on('error', err => {
      console.error('页面错误:', err);
    });
    
    // 监听页面崩溃
    page.on('crash', () => {
      console.error('页面崩溃');
    });
    
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
    };

    await page.setUserAgent(device_config.userAgent);
    await page.setViewport(device_config.viewport);
    console.log('设备配置设置完成');

    // 监听导航开始
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 60000 // 增加超时时间
    });

    console.log('开始访问页面:', url);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 增加超时时间
    });

    console.log('页面加载完成，等待导航完成');
    await navigationPromise;
    console.log('导航完成');
    
    // 等待一段时间，确保页面完全加载
    await page.waitForTimeout(2000);
    console.log('等待页面稳定');
    
    
    // 在页面上下文中执行代码，获取window对象下的数据
    const windowData = await page.evaluate(() => {
      try {
        console.log('开始解析页面数据');
        if (!window.__INITIAL_STATE__) {
          console.error('window.__INITIAL_STATE__ 不存在');
          return { error: 'window.__INITIAL_STATE__ 不存在' };
        }
        
        console.log('__INITIAL_STATE__ 存在，包含字段:', Object.keys(window.__INITIAL_STATE__));
        
        if (!window.__INITIAL_STATE__.noteData) {
          console.error('noteData 不存在');
          // 尝试其他可能的路径
          if (window.__INITIAL_STATE__.note) {
            console.log('找到 note 字段');
            let data = window.__INITIAL_STATE__.note;
            if (data.noteId) {
              let result = {
                xhs_user_id: data.userId || data.user?.userId,
                xhs_note_id: data.noteId,
                note_data: data
              };
              return result;
            }
          }
          return { error: 'noteData 不存在' };
        }
        
        let data = window.__INITIAL_STATE__.noteData;
        console.log('noteData 存在，包含字段:', Object.keys(data));
        
        if (data.data && data.data.noteData) {
          let note_data = data.data.noteData;
          let xhs_note_id = note_data.noteId;

          let result = {
            xhs_user_id: data.realUserId,
            xhs_note_id,
            note_data
          };

          return result;
        } else if (data.noteId) {
          // 直接使用 noteData 作为数据源
          let result = {
            xhs_user_id: data.userId || data.user?.userId,
            xhs_note_id: data.noteId,
            note_data: data
          };
          return result;
        } else if (data.note) {
          // 尝试 note 字段
          let note_data = data.note;
          let xhs_note_id = note_data.noteId;
          let result = {
            xhs_user_id: data.realUserId || note_data.userId,
            xhs_note_id,
            note_data
          };
          return result;
        } else {
          console.error('noteData 结构不符合预期');
          return { 
            error: 'noteData 结构不符合预期',
            rawData: JSON.stringify(data)
          };
        }
      } catch (e) {
        console.error('页面执行错误:', e.message);
        return { 
          error: e.message,
          stack: e.stack
        };
      }
    });

    console.log('页面数据获取完成:', JSON.stringify(windowData, null, 2));

    await browser.close();
    console.log('浏览器已关闭');

    return windowData;
    
  } catch (error) {
    console.error('执行过程中发生错误:', error);
    console.error('错误堆栈:', error.stack);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('关闭浏览器时发生错误:', closeError);
      }
    }
    // 返回错误信息，便于调试
    return { 
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports =  {
  get_xhs_note_data
}



