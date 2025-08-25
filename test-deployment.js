#!/usr/bin/env node

/**
 * 台湾PK10项目 - 部署测试脚本
 * 用于验证Vercel部署后的各项功能
 * 
 * 使用方法:
 *   node test-deployment.js <BASE_URL>
 *   
 * 示例:
 *   node test-deployment.js https://your-project.vercel.app
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 日志函数
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.cyan}[TEST]${colors.reset} ${msg}`)
};

// HTTP请求函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Taiwan-PK10-Test-Script/1.0',
        ...options.headers
      },
      timeout: options.timeout || 30000
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 测试用例类
class TestCase {
  constructor(name, url, expectedStatus = 200, validator = null) {
    this.name = name;
    this.url = url;
    this.expectedStatus = expectedStatus;
    this.validator = validator;
    this.result = null;
    this.error = null;
    this.duration = 0;
  }
  
  async run() {
    const startTime = Date.now();
    
    try {
      log.test(`运行测试: ${this.name}`);
      
      const response = await makeRequest(this.url);
      this.duration = Date.now() - startTime;
      
      // 检查状态码
      if (response.statusCode !== this.expectedStatus) {
        throw new Error(`状态码不匹配: 期望 ${this.expectedStatus}, 实际 ${response.statusCode}`);
      }
      
      // 运行自定义验证器
      if (this.validator) {
        const validationResult = this.validator(response);
        if (validationResult !== true) {
          throw new Error(validationResult || '验证失败');
        }
      }
      
      this.result = {
        success: true,
        response: response,
        message: `✓ ${this.name} (${this.duration}ms)`
      };
      
      log.success(this.result.message);
      
    } catch (error) {
      this.duration = Date.now() - startTime;
      this.error = error;
      this.result = {
        success: false,
        error: error,
        message: `✗ ${this.name} - ${error.message} (${this.duration}ms)`
      };
      
      log.error(this.result.message);
    }
    
    return this.result;
  }
}

// 测试套件类
class TestSuite {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.tests = [];
    this.results = [];
  }
  
  addTest(name, path, expectedStatus = 200, validator = null) {
    const url = `${this.baseUrl}${path}`;
    this.tests.push(new TestCase(name, url, expectedStatus, validator));
  }
  
  async runAll() {
    log.info(`开始测试部署: ${this.baseUrl}`);
    log.info(`总共 ${this.tests.length} 个测试用例`);
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    for (const test of this.tests) {
      const result = await test.run();
      this.results.push(result);
      
      // 在测试之间添加小延迟，避免过于频繁的请求
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const totalTime = Date.now() - startTime;
    
    this.printSummary(totalTime);
  }
  
  printSummary(totalTime) {
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    log.info(`测试完成: ${passed} 通过, ${failed} 失败 (总耗时: ${totalTime}ms)`);
    
    if (failed > 0) {
      console.log();
      log.error('失败的测试:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.message}`);
        });
    }
    
    console.log();
    
    if (passed === this.tests.length) {
      log.success('🎉 所有测试通过！部署验证成功！');
      
      console.log();
      log.info('有用的链接:');
      console.log(`  🌐 应用主页: ${this.baseUrl}/`);
      console.log(`  📊 数据展示: ${this.baseUrl}/index.html`);
      console.log(`  🔑 密钥管理: ${this.baseUrl}/key-management.html`);
      console.log(`  ❤️  健康检查: ${this.baseUrl}/health`);
      console.log(`  📈 数据统计: ${this.baseUrl}/stats`);
      console.log(`  🐍 抓取器状态: ${this.baseUrl}/scheduler?action=health`);
      console.log(`  🔄 触发抓取: ${this.baseUrl}/scheduler?action=scrape`);
      
      process.exit(0);
    } else {
      log.error('❌ 部分测试失败，请检查部署配置');
      process.exit(1);
    }
  }
}

// 验证器函数
const validators = {
  // 验证JSON响应
  isValidJson: (response) => {
    if (!response.data) {
      return '响应不是有效的JSON格式';
    }
    return true;
  },
  
  // 验证健康检查响应
  healthCheck: (response) => {
    if (!response.data) {
      return '健康检查响应不是JSON格式';
    }
    
    if (response.data.status !== 'ok' && response.data.status !== 'healthy') {
      return `健康检查状态异常: ${response.data.status}`;
    }
    
    return true;
  },
  
  // 验证数据响应
  dataResponse: (response) => {
    if (!response.data) {
      return '数据响应不是JSON格式';
    }
    
    if (!response.data.success) {
      return `数据请求失败: ${response.data.message || '未知错误'}`;
    }
    
    if (!Array.isArray(response.data.data)) {
      return '数据格式错误: data字段应该是数组';
    }
    
    return true;
  },
  
  // 验证统计响应
  statsResponse: (response) => {
    if (!response.data) {
      return '统计响应不是JSON格式';
    }
    
    const requiredFields = ['total_records', 'collections_count'];
    for (const field of requiredFields) {
      if (typeof response.data[field] === 'undefined') {
        return `统计响应缺少字段: ${field}`;
      }
    }
    
    return true;
  },
  
  // 验证Python抓取器响应
  pythonScheduler: (response) => {
    if (!response.data) {
      return 'Python抓取器响应不是JSON格式';
    }
    
    if (response.data.status !== 'ok' && response.data.status !== 'success') {
      return `Python抓取器状态异常: ${response.data.status}`;
    }
    
    return true;
  },
  
  // 验证HTML响应
  isHtml: (response) => {
    if (!response.rawData || !response.rawData.includes('<html')) {
      return '响应不是有效的HTML格式';
    }
    return true;
  }
};

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('台湾PK10项目 - 部署测试脚本');
    console.log();
    console.log('使用方法:');
    console.log('  node test-deployment.js <BASE_URL>');
    console.log();
    console.log('示例:');
    console.log('  node test-deployment.js https://your-project.vercel.app');
    console.log('  node test-deployment.js http://localhost:3000');
    console.log();
    process.exit(0);
  }
  
  const baseUrl = args[0];
  
  // 验证URL格式
  try {
    new URL(baseUrl);
  } catch (error) {
    log.error(`无效的URL格式: ${baseUrl}`);
    process.exit(1);
  }
  
  // 创建测试套件
  const suite = new TestSuite(baseUrl);
  
  // 添加测试用例
  
  // 1. 基础端点测试
  suite.addTest('主页访问', '/', 200, validators.isHtml);
  suite.addTest('健康检查端点', '/health', 200, validators.healthCheck);
  
  // 2. API端点测试
  suite.addTest('最新数据API', '/latest-data', 200, validators.dataResponse);
  suite.addTest('历史数据API', '/historical-data', 200, validators.dataResponse);
  suite.addTest('数据统计API', '/stats', 200, validators.statsResponse);
  
  // 3. 静态文件测试
  suite.addTest('数据展示页面', '/index.html', 200, validators.isHtml);
  suite.addTest('密钥管理页面', '/key-management.html', 200, validators.isHtml);
  
  // 4. Python Functions测试
  suite.addTest('Python抓取器健康检查', '/scheduler?action=health', 200, validators.pythonScheduler);
  suite.addTest('Python抓取器状态查询', '/scheduler?action=status', 200, validators.isValidJson);
  
  // 5. 错误处理测试
  suite.addTest('404错误处理', '/non-existent-endpoint', 404);
  
  // 6. API参数测试
  suite.addTest('历史数据分页', '/historical-data?page=1&limit=10', 200, validators.dataResponse);
  suite.addTest('按日期查询', '/historical-data?date=2024-01-01', 200, validators.dataResponse);
  
  // 运行所有测试
  await suite.runAll();
}

// 错误处理
process.on('uncaughtException', (error) => {
  log.error(`未捕获的异常: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`未处理的Promise拒绝: ${reason}`);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main().catch((error) => {
    log.error(`测试执行失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { TestCase, TestSuite, validators };