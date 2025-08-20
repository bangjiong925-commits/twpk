// 台湾宾果开奖数据API接口
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const dataFile = path.join(process.cwd(), 'lottery_data.json');
        
        if (!fs.existsSync(dataFile)) {
            return res.status(404).json({
                success: false,
                message: '暂无开奖数据',
                data: []
            });
        }
        
        const fileContent = fs.readFileSync(dataFile, 'utf8');
        const lotteryData = JSON.parse(fileContent);
        
        // 根据查询参数返回不同数据
        const { limit = 10, latest = false } = req.query;
        
        let responseData;
        
        if (latest === 'true') {
            // 返回最新一期数据
            responseData = lotteryData[0] || null;
        } else {
            // 返回指定数量的数据
            const limitNum = parseInt(limit);
            responseData = lotteryData.slice(0, limitNum);
        }
        
        res.status(200).json({
            success: true,
            message: '获取数据成功',
            data: responseData,
            total: lotteryData.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('获取开奖数据时出错:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: error.message
        });
    }
};