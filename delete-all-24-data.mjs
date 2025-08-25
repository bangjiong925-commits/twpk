import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';

async function deleteAll24Data() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
        console.log('MongoDB连接成功');
        
        // 查看删除前的数据情况
        const beforeCount = await TaiwanPK10Data.countDocuments();
        console.log('删除前总记录数:', beforeCount);
        
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
        
        // 删除所有24号的数据
        const deleteResult = await TaiwanPK10Data.deleteMany({
            drawDate: {
                $gte: new Date('2025-08-24T00:00:00.000Z'),
                $lt: new Date('2025-08-25T00:00:00.000Z')
            }
        });
        
        console.log('\n删除24号数据结果:', deleteResult.deletedCount, '条');
        
        // 查看删除后的数据情况
        const afterCount = await TaiwanPK10Data.countDocuments();
        console.log('删除后剩余记录数:', afterCount);
        
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
        
        console.log('\n删除后按日期分组的记录数:');
        if (remainingGroupByDate.length === 0) {
            console.log('数据库已清空，无剩余数据');
        } else {
            remainingGroupByDate.forEach(item => {
                console.log(`${item._id}: ${item.count}条`);
            });
        }
        
        await mongoose.disconnect();
        console.log('\n删除操作完成');
        
    } catch (error) {
        console.error('错误:', error);
        process.exit(1);
    }
}

deleteAll24Data();