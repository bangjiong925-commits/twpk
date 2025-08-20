const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 自动获取台湾PK10数据的定时任务
 * 每5秒运行一次数据抓取脚本
 */
class AutoFetchPK10 {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.dataFile = path.join(__dirname, 'taiwan_pk10_data.json');
        this.lastPeriod = null;
        this.fetchCount = 0;
    }

    /**
     * 启动自动获取
     */
    start() {
        if (this.isRunning) {
            console.log('自动获取已在运行中...');
            return;
        }

        this.isRunning = true;
        console.log('开始自动获取台湾PK10数据，每5秒更新一次...');
        
        // 立即执行一次
        this.fetchData();
        
        // 设置定时器，每5秒执行一次
        this.intervalId = setInterval(() => {
            this.fetchData();
        }, 5000);
    }

    /**
     * 停止自动获取
     */
    stop() {
        if (!this.isRunning) {
            console.log('自动获取未在运行...');
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('已停止自动获取台湾PK10数据');
    }

    /**
     * 执行数据抓取
     */
    async fetchData() {
        try {
            this.fetchCount++;
            console.log(`[${new Date().toLocaleString()}] 第${this.fetchCount}次获取数据...`);
            
            // 运行台湾PK10抓取脚本
            const result = await this.runScraper();
            
            if (result.success) {
                // 检查是否有新数据
                const currentData = this.readCurrentData();
                if (currentData && currentData.period !== this.lastPeriod) {
                    this.lastPeriod = currentData.period;
                    console.log(`✅ 获取到新数据: 期号${currentData.period}, 号码${currentData.numbersString}`);
                } else {
                    console.log('📊 数据已是最新，无需更新');
                }
            } else {
                console.log('❌ 数据获取失败:', result.error);
            }
        } catch (error) {
            console.error('❌ 获取数据时发生错误:', error.message);
        }
    }

    /**
     * 运行抓取脚本
     */
    runScraper() {
        return new Promise((resolve) => {
            const scraper = spawn('node', ['taiwan_pk10_scraper.js'], {
                cwd: __dirname,
                stdio: 'pipe'
            });

            let output = '';
            let errorOutput = '';

            scraper.stdout.on('data', (data) => {
                output += data.toString();
            });

            scraper.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            scraper.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, output });
                } else {
                    resolve({ success: false, error: errorOutput || '脚本执行失败' });
                }
            });

            scraper.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * 读取当前数据文件
     */
    readCurrentData() {
        try {
            const latestDataFile = path.join(__dirname, 'taiwan_pk10_latest.json');
            if (fs.existsSync(latestDataFile)) {
                const fileContent = fs.readFileSync(latestDataFile, 'utf8');
                return JSON.parse(fileContent);
            }
            return null;
        } catch (error) {
            console.error('读取数据时出错:', error);
            return null;
        }
    }

    /**
     * 获取运行状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            fetchCount: this.fetchCount,
            lastPeriod: this.lastPeriod,
            dataFile: this.dataFile
        };
    }
}

// 创建实例
const autoFetcher = new AutoFetchPK10();

// 处理命令行参数
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'start':
        autoFetcher.start();
        break;
    case 'stop':
        autoFetcher.stop();
        process.exit(0);
        break;
    case 'status':
        console.log('当前状态:', autoFetcher.getStatus());
        process.exit(0);
        break;
    default:
        console.log('使用方法:');
        console.log('  node auto_fetch_pk10.js start   # 启动自动获取');
        console.log('  node auto_fetch_pk10.js stop    # 停止自动获取');
        console.log('  node auto_fetch_pk10.js status  # 查看状态');
        process.exit(1);
}

// 处理退出信号
process.on('SIGINT', () => {
    console.log('\n收到退出信号，正在停止自动获取...');
    autoFetcher.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n收到终止信号，正在停止自动获取...');
    autoFetcher.stop();
    process.exit(0);
});

// 导出模块
module.exports = AutoFetchPK10;