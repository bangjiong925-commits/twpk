import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';

async function delete25Data() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
        console.log('MongoDB连接成功');
        
        // 查看当前数据情况
        const count = await TaiwanPK10Data.countDocuments();
        console.log('删除前总记录数:', count);
        
        // 按日期分组查看数据分布
        const groupByDate = await TaiwanPK10Data.aggregate([
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$drawDate'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('删除前按日期分组的记录数:');
        groupByDate.forEach(item => {
            console.log(`${item._id}: ${item.count}条`);
        });
        
        // 删除25号的数据
        const deleteResult = await TaiwanPK10Data.deleteMany({
            drawDate: {
                $gte: new Date('2025-08-25T00:00:00.000Z'),
                $lt: new Date('2025-08-26T00:00:00.000Z')
            }
        });
        
        console.log('删除25号数据结果:', deleteResult.deletedCount, '条');
        
        // 查看删除后的数据情况
        const remainingCount = await TaiwanPK10Data.countDocuments();
        console.log('删除后剩余记录数:', remainingCount);
        
        // 再次按日期分组查看剩余数据
        const remainingGroupByDate = await TaiwanPK10Data.aggregate([
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$drawDate'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        console.log('删除后按日期分组的记录数:');
        remainingGroupByDate.forEach(item => {
            console.log(`${item._id}: ${item.count}条`);
        });
        
        await mongoose.disconnect();
        console.log('操作完成');
        
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

delete25Data();