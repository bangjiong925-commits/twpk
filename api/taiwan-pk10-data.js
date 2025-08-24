import mongoose from 'mongoose';
import TaiwanPK10Data from '../models/TaiwanPK10Data.js';

// 连接MongoDB
const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taiwan_pk10';
            await mongoose.connect(mongoURI);
            console.log('MongoDB连接成功');
        } catch (error) {
            console.error('MongoDB连接失败:', error);
            throw error;
        }
    }
};

export default async function handler(req, res) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: '只支持GET请求' });
    }
    
    try {
        await connectDB();
        
        const { days = 3, date, format = 'json' } = req.query;
        
        let query = {};
        
        if (date) {
            // 查询特定日期的数据
            const targetDate = new Date(date);
            const nextDate = new Date(targetDate);
            nextDate.setDate(targetDate.getDate() + 1);
            
            query.drawDate = {
                $gte: targetDate,
                $lt: nextDate
            };
        } else {
            // 查询最近几天的数据
            const daysNum = parseInt(days);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - daysNum);
            
            query.drawDate = {
                $gte: startDate,
                $lte: endDate
            };
        }
        
        const data = await TaiwanPK10Data.find(query)
            .sort({ period: -1 })
            .select('period drawNumbers drawDate drawTime')
            .lean();
        
        if (format === 'txt') {
            // 返回文本格式
            const textData = data.map(item => {
                return `${item.period} ${item.drawNumbers.join(',')}`;
            }).join('\n');
            
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(textData);
        } else {
            // 返回JSON格式
            return res.status(200).json({
                success: true,
                count: data.length,
                data: data
            });
        }
        
    } catch (error) {
        console.error('获取台湾PK10数据失败:', error);
        return res.status(500).json({
            success: false,
            error: '获取数据失败',
            message: error.message
        });
    }
}

// 如果在Node.js环境中直接运行（用于测试）
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
    const express = require('express');
    const app = express();
    const port = 3001;
    
    app.get('/api/taiwan-pk10-data', handler);
    
    app.listen(port, () => {
        console.log(`测试服务器运行在 http://localhost:${port}`);
    });
}