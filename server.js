import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
// Railway环境中PORT可能被MongoDB占用，需要特殊处理
let PORT;
if (process.env.RAILWAY_ENVIRONMENT) {
  // Railway环境：如果PORT是27017（MongoDB端口），使用默认的HTTP端口
  PORT = (process.env.PORT === '27017') ? 3000 : (process.env.PORT || 3000);
} else {
  // 本地环境
  PORT = process.env.PORT || 3000;
}
console.log(`HTTP服务器将启动在端口: ${PORT}`);
console.log(`当前环境PORT变量: ${process.env.PORT}`);
console.log(`Railway环境: ${process.env.RAILWAY_ENVIRONMENT || 'false'}`);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Railway环境检测
const isRailwayEnvironment = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID);

// MongoDB连接配置 - 严格按照优先级：DATABASE_URL (MongoDB Atlas) > TCP_PROXY > MONGO_PUBLIC_URL > MONGO_URL > MONGOHOST > 本地连接
let mongoUri;
let connectionMethod = '';

// 优先级1: DATABASE_URL (MongoDB Atlas 或 Railway标准)
if (process.env.DATABASE_URL) {
  mongoUri = process.env.DATABASE_URL;
  // 检测是否为MongoDB Atlas连接
  if (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net')) {
    connectionMethod = 'DATABASE_URL (MongoDB Atlas云数据库)';
    console.log('✅ 使用DATABASE_URL连接MongoDB Atlas云数据库');
  } else {
    connectionMethod = 'DATABASE_URL (Railway标准数据库连接)';
    console.log('✅ 使用DATABASE_URL连接Railway数据库');
  }
} 
// 优先级2: Railway TCP代理 (公共网络连接，解决DNS问题)
else if (process.env.RAILWAY_TCP_PROXY_DOMAIN && process.env.RAILWAY_TCP_PROXY_PORT && process.env.MONGO_URL) {
  // 从MONGO_URL中提取用户名和密码
  const mongoUrlMatch = process.env.MONGO_URL.match(/mongodb:\/\/([^:]+):([^@]+)@/);
  if (mongoUrlMatch) {
    const [, username, password] = mongoUrlMatch;
    mongoUri = `mongodb://${username}:${password}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/railway`;
    connectionMethod = 'Railway TCP代理 (公共网络连接)';
    console.log('✅ 使用Railway TCP代理连接（解决DNS问题）');
  } else {
    // 如果无法解析MONGO_URL，回退到下一个选项
    mongoUri = process.env.MONGO_URL;
    connectionMethod = 'MONGO_URL (私有网络连接)';
    console.log('⚠️ 无法解析MONGO_URL，使用原始连接');
  }
}
// 优先级3: MONGO_PUBLIC_URL (Railway公共连接)
else if (process.env.MONGO_PUBLIC_URL) {
  mongoUri = process.env.MONGO_PUBLIC_URL;
  connectionMethod = 'MONGO_PUBLIC_URL (公共网络连接)';
  console.log('✅ 使用MONGO_PUBLIC_URL环境变量（公共网络连接）');
} 
// 优先级4: MONGO_URL (Railway私有网络)
else if (process.env.MONGO_URL) {
  // 第四优先级：MONGO_URL（Railway私有网络连接，可能有DNS问题）
  mongoUri = process.env.MONGO_URL;
  connectionMethod = 'MONGO_URL (私有网络连接)';
  console.log('✅ 使用MONGO_URL环境变量（私有网络连接）');
} 
// 优先级3: MONGOHOST组合变量 (传统配置)
else if (process.env.MONGOHOST && process.env.MONGOUSER && process.env.MONGOPASSWORD) {
  // 第三优先级：MONGOHOST组合变量
  const host = process.env.MONGOHOST.includes('railway.internal') ? 
    process.env.MONGOHOST.replace('mongodb.railway.internal', 'mongodb.railway.internal') : 
    process.env.MONGOHOST;
  mongoUri = `mongodb://${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@${host}:${process.env.MONGOPORT}/${process.env.MONGODATABASE}`;
  connectionMethod = 'MONGOHOST组合变量';
  console.log('✅ 使用MONGOHOST环境变量构建连接字符串');
} 
// Railway环境但缺少数据库连接变量的特殊处理
else if (isRailwayEnvironment) {
  console.log('⚠️ 检测到Railway环境但缺少数据库连接变量');
  console.log('请确保在Railway控制台中:');
  console.log('1. 已添加MongoDB服务到项目');
  console.log('2. MongoDB服务已关联到当前应用服务');
  console.log('3. 环境变量已自动生成并可见');
  
  // 尝试使用可能的Railway内部服务名称
  const railwayServiceName = process.env.RAILWAY_SERVICE_NAME || 'mongodb';
  mongoUri = `mongodb://${railwayServiceName}:27017/twpk`;
  connectionMethod = 'Railway内部服务发现 (实验性)';
  console.log(`⚠️ 尝试Railway内部服务连接: ${railwayServiceName}`);
} 
// 优先级4: 本地连接 (开发环境)
else {
  // 第四优先级：本地连接
  mongoUri = 'mongodb://localhost:27017/twpk';
  connectionMethod = '本地MongoDB连接';
  console.log('✅ 使用本地MongoDB连接');
}

// 完全跳过MONGODB_URI以避免未解析的变量问题
if (process.env.MONGODB_URI) {
  console.warn('⚠️ 检测到MONGODB_URI环境变量，但已跳过使用以避免解析问题');
  console.warn('⚠️ 当前使用连接方式：' + connectionMethod);
}

// 警告：避免使用公共端点
if (process.env.MONGO_PUBLIC_URL && !process.env.MONGO_URL) {
  console.warn('⚠️ 检测到MONGO_PUBLIC_URL但未找到MONGO_URL');
  console.warn('⚠️ 建议使用MONGO_URL以避免Railway出口费用');
}

console.log('🔗 当前连接方式：' + connectionMethod);

console.log('MongoDB连接URI:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // 隐藏密码

// MongoDB连接选项 - 根据连接类型优化配置
let mongoOptions;

// 为MongoDB Atlas优化的连接选项
if (mongoUri && (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net'))) {
  mongoOptions = {
    // MongoDB Atlas 优化配置
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000, // Atlas响应更快
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority',
    // Atlas 特定配置
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferCommands: false,
    maxIdleTimeMS: 30000,
    // 针对云数据库的优化
    compressors: ['zlib'],
    zlibCompressionLevel: 6
  };
  console.log('🔧 使用MongoDB Atlas优化配置');
} else {
  // Railway 或本地连接的配置
  mongoOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 60000,
    connectTimeoutMS: 30000,
    family: 4, // 强制使用IPv4 (Railway需要)
    retryWrites: true,
    w: 'majority',
    directConnection: false,
    heartbeatFrequencyMS: 10000,
    bufferCommands: false,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 30000
  };
  console.log('🔧 使用Railway/本地连接配置');
}

// 连接重试机制 - 针对不同数据库类型优化
let retryCount = 0;
const isAtlas = mongoUri && (mongoUri.includes('mongodb+srv://') || mongoUri.includes('mongodb.net'));
const maxRetries = isAtlas ? 5 : 3; // Atlas允许更多重试
const baseDelay = isAtlas ? 1000 : 2000; // Atlas重试间隔更短

async function connectWithRetry() {
  while (retryCount < maxRetries) {
    try {
      retryCount++;
      console.log(`MongoDB连接尝试 ${retryCount}/${maxRetries}`);
      console.log('连接目标:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      console.log('连接类型:', isAtlas ? 'MongoDB Atlas' : 'Railway/本地');
      
      await mongoose.connect(mongoUri, mongoOptions);
      console.log('✅ MongoDB连接成功!');
      console.log('数据库状态:', mongoose.connection.readyState);
      console.log('数据库名称:', mongoose.connection.db?.databaseName || 'unknown');
      
      // 重置重试计数器
      retryCount = 0;
      return;
    } catch (error) {
      console.log(`❌ MongoDB连接失败 (尝试 ${retryCount}/${maxRetries}):`, error.message);
      console.log('错误详情:', {
        code: error.code,
        codeName: error.codeName,
        name: error.name,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname
      });
      
      // MongoDB Atlas 特定错误处理
      if (isAtlas) {
        if (error.message.includes('authentication failed')) {
          console.log('🔐 MongoDB Atlas认证失败:');
          console.log('- 请检查用户名和密码是否正确');
          console.log('- 请确认数据库用户已创建并有适当权限');
          console.log('- 请检查连接字符串格式是否正确');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.log('🌐 MongoDB Atlas网络连接错误:');
          console.log('- 请检查网络连接');
          console.log('- 请确认IP地址已添加到Atlas白名单');
          console.log('- 建议添加 0.0.0.0/0 到网络访问列表');
        } else if (error.message.includes('MongoServerSelectionError')) {
          console.log('🎯 MongoDB Atlas服务器选择错误:');
          console.log('- 请检查集群是否正在运行');
          console.log('- 请确认连接字符串中的集群地址正确');
        }
      } else {
        // Railway 特定错误处理
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.log('🔍 检测到DNS解析错误:');
          console.log('- 错误类型: DNS解析失败');
          console.log('- 目标主机:', error.hostname || 'unknown');
          console.log('- 建议: 尝试使用TCP代理或公共连接');
          
          if (mongoUri.includes('mongodb.railway.internal')) {
            console.log('⚠️ Railway内部DNS解析失败，这是已知问题');
            console.log('💡 解决方案: 使用TCP代理连接或联系Railway支持');
          }
        } else if (error.message.includes('ECONNRESET')) {
          console.log('🔌 检测到连接重置错误:');
          console.log('- Railway TCP代理可能不稳定');
          console.log('- 建议使用MongoDB Atlas获得更稳定的连接');
        }
      }
      
      if (retryCount >= maxRetries) {
        console.log('💥 MongoDB连接失败，已达到最大重试次数');
        if (isAtlas) {
          console.log('❌ MongoDB Atlas连接失败，请检查:');
          console.log('1. 连接字符串是否正确');
          console.log('2. 用户名密码是否正确');
          console.log('3. 网络访问是否已配置 (0.0.0.0/0)');
          console.log('4. 集群是否正在运行');
        } else {
          console.log('❌ Railway MongoDB连接失败，建议使用MongoDB Atlas');
        }
        console.log('⚠️ 应用将在没有数据库连接的情况下启动');
        
        // 设置一个标志表示数据库不可用
        global.dbAvailable = false;
        break;
      }
      
      const delay = baseDelay * Math.pow(2, retryCount - 1); // 指数退避
      console.log(`⏳ ${delay/1000}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 全局数据库可用性标志
global.dbAvailable = true;

// 数据库连接事件监听
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose连接已建立');
  console.log('数据库名称:', mongoose.connection.db.databaseName);
  global.dbAvailable = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose连接错误:', err.message);
  global.dbAvailable = false;
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose连接已断开');
  global.dbAvailable = false;
  
  // 尝试重新连接
  setTimeout(() => {
    console.log('尝试重新连接MongoDB...');
    connectWithRetry();
  }, 5000);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB重新连接成功');
  global.dbAvailable = true;
});

// 优雅关闭数据库连接
process.on('SIGINT', async () => {
  console.log('\n🛑 收到SIGINT信号，正在关闭MongoDB连接...');
  await mongoose.connection.close();
  console.log('✅ MongoDB连接已关闭');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 收到SIGTERM信号，正在关闭MongoDB连接...');
  await mongoose.connection.close();
  console.log('✅ MongoDB连接已关闭');
  process.exit(0);
});

// 启动数据库连接
console.log('\n=== 环境检测 ===');
console.log('Railway环境:', isRailwayEnvironment);
if (isRailwayEnvironment) {
    console.log('Railway项目ID:', process.env.RAILWAY_PROJECT_ID || '未设置');
    console.log('Railway服务ID:', process.env.RAILWAY_SERVICE_ID || '未设置');
    console.log('Railway环境:', process.env.RAILWAY_ENVIRONMENT || '未设置');
}
console.log('🚀 启动MongoDB连接...');
console.log('📋 环境变量检查:');
console.log('- NODE_ENV:', process.env.NODE_ENV);

// DATABASE_URL 详细检查
if (process.env.DATABASE_URL) {
  const isAtlasUrl = process.env.DATABASE_URL.includes('mongodb+srv://') || process.env.DATABASE_URL.includes('mongodb.net');
  console.log('- DATABASE_URL存在:', '✅', isAtlasUrl ? '(MongoDB Atlas)' : '(Railway标准)');
  if (isAtlasUrl) {
    console.log('  🌟 检测到MongoDB Atlas连接字符串');
  }
} else {
  console.log('- DATABASE_URL存在:', '❌ (推荐配置MongoDB Atlas)');
}

console.log('- RAILWAY_TCP_PROXY_DOMAIN存在:', !!process.env.RAILWAY_TCP_PROXY_DOMAIN, process.env.RAILWAY_TCP_PROXY_DOMAIN ? '✅ (TCP代理域名)' : '❌');
console.log('- RAILWAY_TCP_PROXY_PORT存在:', !!process.env.RAILWAY_TCP_PROXY_PORT, process.env.RAILWAY_TCP_PROXY_PORT ? '✅ (TCP代理端口)' : '❌');
console.log('- MONGO_URL存在:', !!process.env.MONGO_URL, process.env.MONGO_URL ? '✅ (私有网络)' : '❌');
console.log('- MONGO_PUBLIC_URL存在:', !!process.env.MONGO_PUBLIC_URL, process.env.MONGO_PUBLIC_URL ? '⚠️ (警告-产生出口费用)' : '✅');
console.log('- MONGODB_URI存在:', !!process.env.MONGODB_URI, process.env.MONGODB_URI ? '⚠️ (已跳过使用)' : '✅');
console.log('- MONGOHOST存在:', !!process.env.MONGOHOST, process.env.MONGOHOST ? '✅' : '❌');
console.log('- MONGOUSER存在:', !!process.env.MONGOUSER, process.env.MONGOUSER ? '✅' : '❌');
console.log('- MONGOPASSWORD存在:', !!process.env.MONGOPASSWORD, process.env.MONGOPASSWORD ? '✅' : '❌');
console.log('- MONGOPORT:', process.env.MONGOPORT || '未设置');
console.log('- MONGODATABASE:', process.env.MONGODATABASE || '未设置');
console.log('🎯 实际使用的连接方式：' + connectionMethod);
console.log('🔧 连接优先级：DATABASE_URL (MongoDB Atlas推荐) > TCP代理 > MONGO_PUBLIC_URL > MONGO_URL > MONGOHOST组合 > 本地连接');

// 如果没有配置DATABASE_URL，提示用户配置MongoDB Atlas
if (!process.env.DATABASE_URL) {
  console.log('\n💡 建议配置MongoDB Atlas:');
  console.log('1. 注册MongoDB Atlas账户');
  console.log('2. 创建免费集群');
  console.log('3. 获取连接字符串');
  console.log('4. 设置环境变量: railway variables set DATABASE_URL="your_atlas_connection_string"');
  console.log('5. 重新部署应用');
}

connectWithRetry();

// 导入API路由
import healthRoute from './routes/health.js';
import keyRecordsRoute from './routes/key-records.js';
import statsRoute from './routes/stats.js';
import taiwanPk10Route from './routes/taiwan-pk10.js';
import taiwanPk10DataRoute from './routes/taiwan-pk10-data.js';
import taiwanPk10LiveRoute from './routes/taiwan-pk10-live.js';
import updateTaiwanPk10Route from './routes/update-taiwan-pk10.js';
import databaseDataRoute from './routes/database-data.js';
import autoFetchSaveRoute from './routes/auto-fetch-save.js';

// 健康检查端点（在其他路由之前）
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  const isHealthy = dbStatus === 1;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    database: {
      available: dbStatus === 1,
      status: dbStatusText,
      readyState: dbStatus,
      host: process.env.MONGOHOST || 'localhost',
      name: mongoose.connection.db?.databaseName || 'unknown'
    },
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      port: PORT
    }
  });
});

// 数据库连接状态辅助函数
function getConnectionState(state) {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
}

// API路由
app.use('/api/health', healthRoute);
app.use('/api/key-records', keyRecordsRoute);
app.use('/api/stats', statsRoute);
app.use('/api/taiwan-pk10', taiwanPk10Route);
app.use('/api/taiwan-pk10-data', taiwanPk10DataRoute);
app.use('/api/taiwan-pk10-live', taiwanPk10LiveRoute);
app.use('/api/update-taiwan-pk10', updateTaiwanPk10Route);
app.use('/api/database-data', databaseDataRoute);
app.use('/api/auto-fetch-save', autoFetchSaveRoute);



// 静态文件路由
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/TWPK.html', (req, res) => {
  res.sendFile(__dirname + '/TWPK.html');
});

app.get('/key-management.html', (req, res) => {
  res.sendFile(__dirname + '/key-management.html');
});

// 数据库连接检查中间件
app.use((req, res, next) => {
  // 添加数据库状态到请求对象
  req.dbAvailable = global.dbAvailable && mongoose.connection.readyState === 1;
  
  // 对于API请求，如果数据库不可用则返回错误
  if (req.path.startsWith('/api/') && !req.dbAvailable) {
    return res.status(503).json({
      error: 'Database unavailable',
      message: '数据库服务暂时不可用，请稍后重试',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
});

const checkDatabaseConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database connection unavailable',
      message: '数据库连接不可用，请稍后重试'
    });
  }
  next();
};

// 手动抓取当天数据API
app.post('/api/manual-fetch-today', checkDatabaseConnection, async (req, res) => {
  try {
    console.log('开始手动抓取当天数据...');
    
    // 动态导入抓取器
    const TaiwanPK10Scraper = (await import('./auto-scraper.js')).default;
    const { default: TaiwanPK10Data } = await import('./models/TaiwanPK10Data.js');
    const fs = await import('fs/promises');
    
    // 创建抓取器实例
    const scraper = new TaiwanPK10Scraper();
    
    // 执行抓取
    const result = await scraper.run();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: '抓取失败',
        message: result.error || '未知错误'
      });
    }
    
    console.log('抓取完成，开始保存数据到数据库...');
    
    // 读取抓取的数据文件并保存到数据库
    try {
      const data = await fs.readFile('./taiwan_pk10_latest_scraped.json', 'utf8');
      const scrapedData = JSON.parse(data);
      
      let savedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      
      // 处理所有页面的数据
      for (const pageData of scrapedData.data) {
        for (const record of pageData.records) {
          try {
            const period = record.column_1;
            const numbersStr = record.formatted.split(' ')[1];
            const drawNumbers = numbersStr.split(',').map(num => parseInt(num.trim()));
            
            // 解析时间
            const timeStr = record.formatted.split(' ')[0];
            const [hours, minutes, seconds] = timeStr.split(':').map(num => parseInt(num));
            
            const drawDate = new Date();
            drawDate.setHours(hours, minutes, seconds, 0);
            
            // 检查是否已存在
            const existingRecord = await TaiwanPK10Data.findOne({ period });
            
            if (!existingRecord) {
              const newRecord = new TaiwanPK10Data({
                period,
                drawNumbers,
                drawDate,
                drawTime: timeStr,
                scrapedAt: new Date()
              });
              
              await newRecord.save();
              savedCount++;
            } else {
              duplicateCount++;
            }
          } catch (error) {
            console.error(`保存记录失败:`, error);
            errorCount++;
          }
        }
      }
      
      console.log(`数据保存完成: 新保存${savedCount}条, 重复跳过${duplicateCount}条, 错误${errorCount}条`);
    } catch (saveError) {
      console.error('保存数据到数据库失败:', saveError);
    }
    
    // 获取今天的数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayData = await TaiwanPK10Data.find({
      drawDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ period: -1 }).limit(100);
    
    // 格式化数据为网页需要的格式
    const formattedData = todayData.map(item => ({
      period: item.period,
      drawNumbers: item.drawNumbers,
      drawDate: item.drawDate,
      drawTime: item.drawTime
    }));
    
    console.log(`手动抓取完成，获取到 ${formattedData.length} 条当天数据`);
    
    res.json({
      success: true,
      message: '手动抓取当天数据成功',
      data: formattedData,
      count: formattedData.length,
      scrapeResult: {
        totalPages: result.totalPages,
        totalRecords: result.totalRecords
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('手动抓取API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 数据查询和比对API（新增功能）
app.post('/api/data/query', checkDatabaseConnection, async (req, res) => {
  try {
    const { query, filters } = req.body;
    // 这里将实现数据查询逻辑
    res.json({
      success: true,
      message: '查询功能待实现',
      data: []
    });
  } catch (error) {
    console.error('数据查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/data/compare', checkDatabaseConnection, async (req, res) => {
  try {
    const { data1, data2 } = req.body;
    // 这里将实现数据比对逻辑
    res.json({
      success: true,
      message: '比对功能待实现',
      result: {}
    });
  } catch (error) {
    console.error('数据比对错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  console.error('全局错误处理:', error);
  
  // 数据库连接错误
  if (error.name === 'MongooseServerSelectionError' || error.name === 'MongoNetworkError') {
    return res.status(503).json({
      success: false,
      error: 'Database connection error',
      message: '数据库连接错误，请稍后重试'
    });
  }
  
  // 其他错误
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: '服务器内部错误'
  });
});

// 404处理 - 只处理API路由的404
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: '请求的API资源不存在'
  });
});

// 对于非API路由的404，返回主页（SPA路由支持）
app.use('*', (req, res) => {
  // 对于所有未匹配的路由，返回主页让前端路由处理
  res.sendFile(__dirname + '/index.html');
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

export default app;