import chromium from '@sparticuz/chromium';

// Puppeteer配置 - 针对Railway容器环境优化
const puppeteerConfig = {
  // 基础配置
  headless: true, // 强制无头模式
  
  // Railway容器环境优化参数
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // 单进程模式，减少内存使用
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--memory-pressure-off',
    '--max_old_space_size=4096'
  ],
  
  // 超时设置
  timeout: 30000,
  
  // 视口设置
  defaultViewport: {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: false
  }
};

// 获取适合Railway环境的Puppeteer启动配置
function getRailwayPuppeteerConfig() {
  const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
  
  if (isRailway) {
    return {
      ...puppeteerConfig,
      executablePath: chromium.executablePath,
      args: [...puppeteerConfig.args, ...chromium.args]
    };
  }
  
  // 本地开发环境
  return {
    ...puppeteerConfig,
    // 本地环境可以使用系统安装的Chrome
    args: puppeteerConfig.args.filter(arg => arg !== '--single-process')
  };
}

// 创建浏览器实例的辅助函数
async function createBrowser(puppeteer) {
  const config = getRailwayPuppeteerConfig();
  
  try {
    const browser = await puppeteer.launch(config);
    console.log('Puppeteer browser launched successfully');
    return browser;
  } catch (error) {
    console.error('Failed to launch Puppeteer browser:', error);
    throw error;
  }
}

export default {
  puppeteerConfig,
  getRailwayPuppeteerConfig,
  createBrowser
};

export {
  puppeteerConfig,
  getRailwayPuppeteerConfig,
  createBrowser
};