const express = require('express');
const KeyRecord = require('../models/KeyRecord');
const router = express.Router();

// 获取统计数据
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 使用MongoDB聚合查询统计数据
    const stats = await KeyRecord.aggregate([
      {
        $facet: {
          // 总密钥数
          totalKeys: [
            { $count: "count" }
          ],
          // 已验证的密钥（未过期的）
          verifiedKeys: [
            {
              $match: {
                expiresAt: { $gt: now },
                verified: true
              }
            },
            { $count: "count" }
          ],
          // 已使用的密钥
          usedKeys: [
            {
              $match: {
                used: true
              }
            },
            { $count: "count" }
          ],
          // 今日验证的密钥
          todayKeys: [
            {
              $match: {
                usedAt: {
                  $gte: today,
                  $lt: tomorrow
                }
              }
            },
            { $count: "count" }
          ],
          // 过期的密钥
          expiredKeys: [
            {
              $match: {
                expiresAt: { $lte: now }
              }
            },
            { $count: "count" }
          ],
          // 本周统计
          weeklyKeys: [
            {
              $match: {
                usedAt: {
                  $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                }
              }
            },
            { $count: "count" }
          ],
          // 本月统计
          monthlyKeys: [
            {
              $match: {
                usedAt: {
                  $gte: new Date(now.getFullYear(), now.getMonth(), 1)
                }
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);
    
    const result = stats[0];
    
    // 格式化结果
    const formattedStats = {
      totalKeys: result.totalKeys[0]?.count || 0,
      verifiedKeys: result.verifiedKeys[0]?.count || 0,
      usedKeys: result.usedKeys[0]?.count || 0,
      todayKeys: result.todayKeys[0]?.count || 0,
      expiredKeys: result.expiredKeys[0]?.count || 0,
      weeklyKeys: result.weeklyKeys[0]?.count || 0,
      monthlyKeys: result.monthlyKeys[0]?.count || 0,
      timestamp: now.toISOString()
    };
    
    res.json(formattedStats);
    
  } catch (error) {
    console.error('统计API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 获取详细统计信息（按日期分组）
router.get('/detailed', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysCount = parseInt(days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    startDate.setHours(0, 0, 0, 0);
    
    // 按日期分组统计
    const dailyStats = await KeyRecord.aggregate([
      {
        $match: {
          usedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$usedAt" },
            month: { $month: "$usedAt" },
            day: { $dayOfMonth: "$usedAt" }
          },
          count: { $sum: 1 },
          verified: {
            $sum: {
              $cond: [{ $eq: ["$verified", true] }, 1, 0]
            }
          },
          used: {
            $sum: {
              $cond: [{ $eq: ["$used", true] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);
    
    // 格式化日期
    const formattedStats = dailyStats.map(stat => ({
      date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`,
      total: stat.count,
      verified: stat.verified,
      used: stat.used
    }));
    
    res.json({
      success: true,
      period: `${daysCount} days`,
      data: formattedStats
    });
    
  } catch (error) {
    console.error('详细统计API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;