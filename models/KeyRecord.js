const mongoose = require('mongoose');

const keyRecordSchema = new mongoose.Schema({
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nonce: {
    type: String,
    required: false
  },
  deviceId: {
    type: String,
    default: 'unknown'
  },
  deviceInfo: {
    type: String,
    default: 'unknown'
  },
  userAgent: {
    type: String,
    default: 'unknown'
  },
  ipAddress: {
    type: String,
    default: 'N/A'
  },
  usedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
  },
  createdTime: {
    type: Date,
    default: Date.now
  },
  used: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'keyRecords'
});

// 添加索引
keyRecordSchema.index({ usedAt: -1 });
keyRecordSchema.index({ expiresAt: 1 });

// 添加虚拟字段计算剩余时间
keyRecordSchema.virtual('remainingTime').get(function() {
  return Math.max(0, this.expiresAt - new Date());
});

// 确保虚拟字段在JSON序列化时包含
keyRecordSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('KeyRecord', keyRecordSchema);