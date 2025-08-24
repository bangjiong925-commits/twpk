// 测试数据格式化功能
const testData = {
    column_0: '23:50',
    column_1: '114047907',
    column_2: '38107591264'
};

console.log('原始数据:', testData);

// 检查是否包含期号格式的数据（8位以上数字）
let hasValidPeriod = false;
let periodColumn = -1;
Object.entries(testData).forEach(([key, value]) => {
    if (value && /^\d{8,}$/.test(value)) {
        hasValidPeriod = true;
        periodColumn = parseInt(key.replace('column_', ''));
        console.log(`找到期号列: ${key}, 值: ${value}`);
    }
});

if (hasValidPeriod) {
    // 检查是否有开奖号码列（通常在期号列的下一列）
    const numbersColumn = `column_${periodColumn + 1}`;
    console.log(`检查开奖号码列: ${numbersColumn}`);
    if (testData[numbersColumn]) {
        // 如果开奖号码是连续数字，需要分割成逗号分隔的格式
        const numbersText = testData[numbersColumn];
        console.log(`开奖号码原始值: ${numbersText}`);
        console.log(`是否匹配数字格式: ${/^\d{10,}$/.test(numbersText)}`);
        console.log(`长度是否>=10: ${numbersText.length >= 10}`);
        
        if (/^\d{10,}$/.test(numbersText) && numbersText.length >= 10) {
            // 台湾PK10是10个数字，取前10位并分割
            const numbers = numbersText.substring(0, 10).split('').join(',');
            testData[numbersColumn] = numbers;
            console.log(`转换后的开奖号码: ${numbers}`);
        }
    }
}

console.log('处理后数据:', testData);