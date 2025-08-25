import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';

async function checkDataSource() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
        console.log('MongoDB连接成功');
        
        const totalCount = await TaiwanPK10Data.countDocuments();
        console.log('总记录数:', totalCount);
        
        // 查看最新10条记录
        const latest10 = await TaiwanPK10Data.find()
            .sort({ drawDate: -1, period: -1 })
            .limit(10);
        
        console.log('\n最新10条记录:');
        latest10.forEach((item, index) => {
            console.log(`${index + 1}. 期号: ${item.period}`);
            console.log(`   开奖号码: [${item.drawNumbers.join(', ')}]`);
            console.log(`   开奖日期: ${item.drawDate.toISOString().split('T')[0]}`);
            console.log(`   开奖时间: ${item.drawTime}`);
            console.log(`   数据来源: ${item.dataSource}`);
            console.log(`   抓取时间: ${item.scrapedAt ? item.scrapedAt.toISOString() : 'N/A'}`);
            console.log('---');
        });
        
        // 查看最早10条记录
        const earliest10 = await TaiwanPK10Data.find()
            .sort({ drawDate: 1, period: 1 })
            .limit(10);
        
        console.log('\n最早10条记录:');
        earliest10.forEach((item, index) => {
            console.log(`${index + 1}. 期号: ${item.period}`);
            console.log(`   开奖号码: [${item.drawNumbers.join(', ')}]`);
            console.log(`   开奖日期: ${item.drawDate.toISOString().split('T')[0]}`);
            console.log(`   开奖时间: ${item.drawTime}`);
            console.log(`   数据来源: ${item.dataSource}`);
            console.log(`   抓取时间: ${item.scrapedAt ? item.scrapedAt.toISOString() : 'N/A'}`);
            console.log('---');
        });
        
        // 按数据来源分组统计
        const sourceStats = await TaiwanPK10Data.aggregate([
            {
                $group: {
                    _id: '$dataSource',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        console.log('\n按数据来源分组统计:');
        sourceStats.forEach(item => {
            console.log(`${item._id || '未知来源'}: ${item.count}条`);
        });
        
        // 按抓取时间分组统计（按小时）
        const scrapedStats = await TaiwanPK10Data.aggregate([
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d %H:00',
                            date: '$scrapedAt'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 10 }
        ]);
        
        console.log('\n最近的抓取时间统计（按小时）:');
        scrapedStats.forEach(item => {
            console.log(`${item._id}: ${item.count}条`);
        });
        
        await mongoose.disconnect();
        console.log('\n检查完成');
        
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

checkDataSource();