const fs = require('fs');
const path = require('path');

// 获取历史数据文件
function getHistoricalData(req, res) {
    try {
        const { days = 3 } = req.query;
        let allData = [];
        
        // 获取最近几天的数据文件
        const today = new Date();
        const dataFiles = [];
        
        for (let i = parseInt(days) - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '').slice(2); // YYMMDD格式
            const fileName = `${dateStr}.txt`;
            const filePath = path.join(__dirname, '..', fileName);
            
            if (fs.existsSync(filePath)) {
                dataFiles.push(filePath);
            }
        }
        
        // 读取所有文件内容
        dataFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.trim().split('\n').filter(line => line.trim());
                allData = allData.concat(lines);
            }
        });
        
        // 按期号排序（降序）
        allData.sort((a, b) => {
            const periodA = parseInt(a.split(' ')[0]);
            const periodB = parseInt(b.split(' ')[0]);
            return periodB - periodA;
        });
        
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        
        if (allData.length === 0) {
            res.status(200).send('暂无历史数据');
            return;
        }
        
        res.status(200).send(allData.join('\n'));
        
    } catch (error) {
        console.error('获取历史数据失败:', error);
        res.status(500).json({
            success: false,
            error: '服务器内部错误',
            message: error.message
        });
    }
}

module.exports = getHistoricalData;

// 如果直接运行此文件，启动服务器
if (require.main === module) {
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3002;
    
    app.use(express.json());
    app.get('/api/historical-data', getHistoricalData);
    
    app.listen(PORT, () => {
        console.log(`历史数据API服务器运行在端口 ${PORT}`);
    });
}