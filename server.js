const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// MongoDB连接
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk';
    await mongoose.connect(mongoURI);
    console.log('MongoDB连接成功');
  } catch (error) {
    console.error('MongoDB连接失败:', error);
    process.exit(1);
  }
};

// 连接数据库
connectDB();

// 导入API路由
const healthRoute = require('./routes/health');
const keyRecordsRoute = require('./routes/key-records');
const statsRoute = require('./routes/stats');
const taiwanPk10Route = require('./routes/taiwan-pk10');
const taiwanPk10DataRoute = require('./routes/taiwan-pk10-data');
const taiwanPk10LiveRoute = require('./routes/taiwan-pk10-live');
const updateTaiwanPk10Route = require('./routes/update-taiwan-pk10');

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

// 数据查询和比对API（新增功能）
app.post('/api/data/query', async (req, res) => {
  try {
    const { query, filters } = req.body;
    // 这里将实现数据查询逻辑
    res.json({
      success: true,
      message: '查询功能待实现',
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/data/compare', async (req, res) => {
  try {
    const { data1, data2 } = req.body;
    // 这里将实现数据比对逻辑
    res.json({
      success: true,
      message: '比对功能待实现',
      result: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;