// 数据格式化脚本 - 提取并格式化台湾PK10数据
const fs = require('fs').promises;
const path = require('path');

class DataFormatter {
    constructor() {
        this.inputFile = 'taiwan_pk10_latest_scraped.json';
        this.outputFile = 'formatted_pk10_data.txt';
    }

    async formatData() {
        try {
            console.log('开始处理数据...');
            
            // 读取JSON文件
            const filePath = path.join(__dirname, this.inputFile);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            
            const formattedLines = [];
            
            // 遍历所有页面数据
            for (const pageData of jsonData.data) {
                if (pageData.records && Array.isArray(pageData.records)) {
                    for (const record of pageData.records) {
                        // 检查是否有column_1和column_2
                        if (record.column_1 && record.column_2) {
                            const periodNumber = record.column_1;
                            const numberString = record.column_2;
                            
                            // 只处理11位数字的数据，跳过短数字
                            if (numberString.length === 11) {
                                // 将column_2的每个数字用逗号分隔
                                const formattedNumbers = numberString.split('').join(',');
                                
                                // 格式化为要求的格式
                                const formattedLine = `${periodNumber} ${formattedNumbers}`;
                                formattedLines.push(formattedLine);
                            }
                        }
                    }
                }
            }
            
            // 保存格式化后的数据
            const outputPath = path.join(__dirname, this.outputFile);
            await fs.writeFile(outputPath, formattedLines.join('\n'), 'utf8');
            
            console.log(`数据处理完成！`);
            console.log(`共处理了 ${formattedLines.length} 条记录`);
            console.log(`结果已保存到: ${outputPath}`);
            
            // 显示前几行作为示例
            console.log('\n前5行数据示例:');
            formattedLines.slice(0, 5).forEach((line, index) => {
                console.log(`${index + 1}. ${line}`);
            });
            
            return {
                success: true,
                totalRecords: formattedLines.length,
                outputFile: outputPath
            };
            
        } catch (error) {
            console.error('处理数据时出错:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 处理特定文件
    async formatSpecificFile(inputFileName) {
        try {
            console.log(`开始处理文件: ${inputFileName}`);
            
            const filePath = path.join(__dirname, inputFileName);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            
            const formattedLines = [];
            
            // 遍历所有页面数据
            for (const pageData of jsonData.data) {
                if (pageData.records && Array.isArray(pageData.records)) {
                    for (const record of pageData.records) {
                        if (record.column_1 && record.column_2) {
                            const periodNumber = record.column_1;
                            const numberString = record.column_2;
                            
                            // 只处理11位数字的数据，跳过短数字
                            if (numberString.length === 11) {
                                // 将column_2的每个数字用逗号分隔
                                const formattedNumbers = numberString.split('').join(',');
                                
                                // 格式化为要求的格式
                                const formattedLine = `${periodNumber} ${formattedNumbers}`;
                                formattedLines.push(formattedLine);
                            }
                        }
                    }
                }
            }
            
            // 生成输出文件名
            const baseName = path.basename(inputFileName, '.json');
            const outputFileName = `formatted_${baseName}.txt`;
            const outputPath = path.join(__dirname, outputFileName);
            
            await fs.writeFile(outputPath, formattedLines.join('\n'), 'utf8');
            
            console.log(`数据处理完成！`);
            console.log(`共处理了 ${formattedLines.length} 条记录`);
            console.log(`结果已保存到: ${outputPath}`);
            
            return {
                success: true,
                totalRecords: formattedLines.length,
                outputFile: outputPath
            };
            
        } catch (error) {
            console.error('处理数据时出错:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const formatter = new DataFormatter();
    
    // 检查命令行参数
    const args = process.argv.slice(2);
    if (args.length > 0) {
        // 处理指定文件
        formatter.formatSpecificFile(args[0]).then(result => {
            console.log('处理结果:', result);
            process.exit(result.success ? 0 : 1);
        });
    } else {
        // 处理默认文件
        formatter.formatData().then(result => {
            console.log('处理结果:', result);
            process.exit(result.success ? 0 : 1);
        });
    }
}

module.exports = DataFormatter;