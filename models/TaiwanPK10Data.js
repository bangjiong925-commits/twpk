import mongoose from 'mongoose';

const taiwanPK10DataSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  drawNumbers: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length === 10;
      },
      message: '开奖号码必须包含10个数字'
    }
  },
  drawDate: {
    type: Date,
    required: true,
    index: true
  },
  drawTime: {
    type: String,
    required: true
  },
  dataSource: {
    type: String,
    default: 'auto-scraper',
    enum: ['auto-scraper', 'manual', 'api']
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  isValid: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'taiwanPK10Data'
});

// 创建复合索引
taiwanPK10DataSchema.index({ drawDate: -1, period: -1 });
taiwanPK10DataSchema.index({ scrapedAt: -1 });

// 添加静态方法：删除7天前的数据
taiwanPK10DataSchema.statics.cleanOldData = function() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return this.deleteMany({
    drawDate: { $lt: sevenDaysAgo }
  });
};

// 添加静态方法：获取最新数据
taiwanPK10DataSchema.statics.getLatestData = function(days = 3) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    drawDate: { $gte: startDate },
    isValid: true
  }).sort({ period: -1 }).limit(1000);
};

// 添加静态方法：按日期获取数据
taiwanPK10DataSchema.statics.getDataByDate = function(date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    drawDate: { $gte: startOfDay, $lte: endOfDay },
    isValid: true
  }).sort({ period: -1 });
};

const TaiwanPK10Data = mongoose.model('TaiwanPK10Data', taiwanPK10DataSchema);
export default TaiwanPK10Data;