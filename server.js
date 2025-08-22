const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

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

// MongoDB连接配置 - 严格按照优先级：DATABASE_URL > MONGO_URL > MONGOHOST > 本地连接
let mongoUri;
let connectionMethod = '';

// 优先级1: DATABASE_URL (Railway标准)
if (process.env.DATABASE_URL) {
  mongoUri = process.env.DATABASE_URL;
  connectionMethod = 'DATABASE_URL (Railway标准数据库连接)';
  console.log('✅ 使用DATABASE_URL连接');
} 
// 优先级2: MONGO_URL (Railway私有网络)
else if (process.env.MONGO_URL) {
  // 第二优先级：MONGO_URL（Railway私有网络连接，避免出口费用）
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

// MongoDB连接选项 - 移除废弃选项
const mongoOptions = {
  maxPoolSize: 5, // 减少连接池大小适应Railway限制
  serverSelectionTimeoutMS: 10000, // 增加超时时间
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  family: 4, // 强制使用IPv4
  retryWrites: true,
  w: 'majority',
  directConnection: false, // 允许副本集连接
  heartbeatFrequencyMS: 10000
};

// 连接重试机制
let retryCount = 0;
const maxRetries = 3; // 减少重试次数
const baseDelay = 2000; // 增加基础延迟

async function connectWithRetry() {
  while (retryCount < maxRetries) {
    try {
      retryCount++;
      console.log(`MongoDB连接尝试 ${retryCount}/${maxRetries}`);
      console.log('连接目标:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      
      await mongoose.connect(mongoUri, mongoOptions);
      console.log('✅ MongoDB连接成功!');
      console.log('数据库状态:', mongoose.connection.readyState);
      return;
    } catch (error) {
      console.log(`❌ MongoDB连接失败 (尝试 ${retryCount}/${maxRetries}):`, error.message);
      console.log('错误详情:', {
        code: error.code,
        codeName: error.codeName,
        name: error.name
      });
      
      if (retryCount >= maxRetries) {
        console.log('💥 MongoDB连接失败，已达到最大重试次数');
        console.log('⚠️ 应用将在没有数据库连接的情况下启动');
        
        // 设置一个标志表示数据库不可用
        global.dbAvailable = false;
        break;
      }
      
      const delay = baseDelay * retryCount; // 线性增加延迟
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
console.log('- DATABASE_URL存在:', !!process.env.DATABASE_URL, process.env.DATABASE_URL ? '✅ (Railway标准)' : '❌');
console.log('- MONGO_URL存在:', !!process.env.MONGO_URL, process.env.MONGO_URL ? '✅ (推荐-私有网络)' : '❌');
console.log('- MONGO_PUBLIC_URL存在:', !!process.env.MONGO_PUBLIC_URL, process.env.MONGO_PUBLIC_URL ? '⚠️ (警告-产生出口费用)' : '✅');
console.log('- MONGODB_URI存在:', !!process.env.MONGODB_URI, process.env.MONGODB_URI ? '⚠️ (已跳过使用)' : '✅');
console.log('- MONGOHOST存在:', !!process.env.MONGOHOST, process.env.MONGOHOST ? '✅' : '❌');
console.log('- MONGOUSER存在:', !!process.env.MONGOUSER, process.env.MONGOUSER ? '✅' : '❌');
console.log('- MONGOPASSWORD存在:', !!process.env.MONGOPASSWORD, process.env.MONGOPASSWORD ? '✅' : '❌');
console.log('- MONGOPORT:', process.env.MONGOPORT || '未设置');
console.log('- MONGODATABASE:', process.env.MONGODATABASE || '未设置');
console.log('🎯 实际使用的连接方式：' + connectionMethod);
console.log('🔧 连接优先级：DATABASE_URL > MONGO_URL > MONGOHOST组合 > 本地连接');

connectWithRetry();

// 导入API路由
const healthRoute = require('./routes/health');
const keyRecordsRoute = require('./routes/key-records');
const statsRoute = require('./routes/stats');
const taiwanPk10Route = require('./routes/taiwan-pk10');
const taiwanPk10DataRoute = require('./routes/taiwan-pk10-data');
const taiwanPk10LiveRoute = require('./routes/taiwan-pk10-live');
const updateTaiwanPk10Route = require('./routes/update-taiwan-pk10');

// 健康检查端点（在其他路由之前）
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  const isHealthy = global.dbAvailable && dbStatus === 1;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    database: {
      available: global.dbAvailable,
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

// 静态文件路由
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/TWPK.html', (req, res) => {
  res.sendFile(__dirname + '/TWPK.html');
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

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: '请求的资源不存在'
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;