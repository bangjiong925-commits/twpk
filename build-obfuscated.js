const fs = require('fs');
const { minify } = require('terser');
const path = require('path');

// 读取TWPK.html文件
const htmlContent = fs.readFileSync('TWPK.html', 'utf8');

// 提取JavaScript代码
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let jsCode = '';
const scriptBlocks = [];

while ((match = scriptRegex.exec(htmlContent)) !== null) {
    if (!match[0].includes('src=')) { // 只处理内联脚本
        scriptBlocks.push({
            fullMatch: match[0],
            jsContent: match[1]
        });
        jsCode += match[1] + '\n';
    }
}

// 混淆JavaScript代码
async function obfuscateCode() {
    try {
        const result = await minify(jsCode, {
            mangle: {
                toplevel: true,
                properties: {
                    regex: /^_/
                }
            },
            compress: {
                dead_code: true,
                drop_console: false, // 保留console.log用于调试
                drop_debugger: true,
                pure_funcs: ['console.info', 'console.debug'],
                passes: 3
            },
            format: {
                comments: false,
                beautify: false
            }
        });

        if (result.error) {
            console.error('混淆失败:', result.error);
            return;
        }

        // 创建混淆后的HTML文件
        let obfuscatedHtml = htmlContent;
        
        // 移除所有内联脚本
        obfuscatedHtml = obfuscatedHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, p1) => {
            if (!match.includes('src=')) {
                return ''; // 移除内联脚本
            }
            return match; // 保留外部脚本引用
        });

        // 在</body>前添加混淆后的脚本
        const obfuscatedScript = `<script>\n${result.code}\n</script>`;
        obfuscatedHtml = obfuscatedHtml.replace('</body>', obfuscatedScript + '\n</body>');

        // 写入混淆后的文件
        fs.writeFileSync('TWPK-obfuscated.html', obfuscatedHtml);
        
        console.log('✅ 代码混淆完成！');
        console.log('📁 原文件: TWPK.html');
        console.log('📁 混淆文件: TWPK-obfuscated.html');
        console.log(`📊 压缩率: ${((jsCode.length - result.code.length) / jsCode.length * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('混淆过程中出错:', error);
    }
}

obfuscateCode();