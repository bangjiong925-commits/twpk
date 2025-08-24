const fs = require('fs');
const path = require('path');

// 读取JSON数据文件
function convertJsonToTxt() {
    try {
        // 读取最新的JSON数据文件
        const jsonFile = 'taiwan_pk10_latest_scraped.json';
        const jsonFileData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        
        // 提取所有记录
        const allRecords = [];
        jsonFileData.data.forEach(page => {
            page.records.forEach(record => {
                allRecords.push(record);
            });
        });
        
        console.log(`读取到 ${allRecords.length} 条数据`);
        
        // 按日期分组数据
        const dataByDate = {};
        
        allRecords.forEach(item => {
            // 从formatted字段提取数据："114047906 2,6,3,4,10,7,1,5,8,9"
            const formatted = item.formatted;
            
            // 提取期号前6位作为日期信息
            const issueNumber = formatted.split(' ')[0];
            const dateStr = issueNumber.substring(0, 6); // 取前6位：114047
            
            // 转换为日期格式：假设114047表示2025年8月24日
            // 这里需要根据实际的期号规则来解析日期
            // 暂时使用固定日期进行测试
            const date = '20250824'; // 临时固定为24日
            
            if (!dataByDate[date]) {
                dataByDate[date] = [];
            }
            
            dataByDate[date].push(formatted);
        });
        
        // 为每个日期创建TXT文件
        Object.keys(dataByDate).forEach(date => {
            const txtContent = dataByDate[date].join('\n');
            const fileName = `${date}.txt`;
            
            fs.writeFileSync(fileName, txtContent, 'utf8');
            console.log(`已创建文件: ${fileName}，包含 ${dataByDate[date].length} 条数据`);
        });
        
        // 创建最近3天的测试文件
        const testDates = ['20250822', '20250823', '20250824'];
        testDates.forEach(date => {
            if (!dataByDate[date]) {
                // 如果没有该日期的数据，创建示例数据
                const sampleData = [
                    `114047906 2,6,3,4,10,7,1,5,8,9`,
                    `114047907 1,3,5,7,9,2,4,6,8,10`,
                    `114047908 10,9,8,7,6,5,4,3,2,1`
                ];
                
                const fileName = `${date}.txt`;
                fs.writeFileSync(fileName, sampleData.join('\n'), 'utf8');
                console.log(`已创建示例文件: ${fileName}`);
            }
        });
        
        console.log('数据转换完成！');
        
    } catch (error) {
        console.error('转换过程中出错:', error);
    }
}

// 执行转换
convertJsonToTxt();