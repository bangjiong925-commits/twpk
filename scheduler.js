// 定时抓取台湾宾果开奖数据的调度器
const TaiwanBingoScraper = require('./lottery_scraper');

class LotteryScheduler {
    constructor() {
        this.scraper = new TaiwanBingoScraper();
        this.intervalId = null;
        this.isRunning = false;
    }
    
    // 开始定时抓取
    start(intervalMinutes = 5) {
        if (this.isRunning) {
            console.log('调度器已在运行中...');
            return;
        }
        
        console.log(`开始定时抓取，间隔: ${intervalMinutes} 分钟`);
        
        // 立即执行一次
        this.scrapeData();
        
        // 设置定时器
        this.intervalId = setInterval(() => {
            this.scrapeData();
        }, intervalMinutes * 60 * 1000);
        
        this.isRunning = true;
    }
    
    // 停止定时抓取
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('定时抓取已停止');
    }
    
    // 执行数据抓取
    async scrapeData() {
        try {
            console.log(`\n[${new Date().toLocaleString()}] 开始抓取数据...`);
            
            const latestData = await this.scraper.scrapeLatestData();
            
            if (latestData) {
                console.log(`✅ 成功获取期号 ${latestData.period} 的数据`);
                console.log(`   开奖时间: ${latestData.time}`);
                console.log(`   开奖号码: ${latestData.numbers}`);
            } else {
                console.log('❌ 未能获取到新数据');
            }
            
        } catch (error) {
            console.error('❌ 抓取数据时出错:', error.message);
        }
    }
    
    // 获取当前状态
    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalId: this.intervalId
        };
    }
}

// 使用示例
async function main() {
    const scheduler = new LotteryScheduler();
    
    // 处理程序退出信号
    process.on('SIGINT', () => {
        console.log('\n收到退出信号，正在停止调度器...');
        scheduler.stop();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n收到终止信号，正在停止调度器...');
        scheduler.stop();
        process.exit(0);
    });
    
    // 从命令行参数获取间隔时间（分钟）
    const intervalMinutes = process.argv[2] ? parseInt(process.argv[2]) : 5;
    
    console.log('=== 台湾宾果开奖数据定时抓取器 ===');
    console.log(`抓取间隔: ${intervalMinutes} 分钟`);
    console.log('按 Ctrl+C 停止抓取\n');
    
    // 开始定时抓取
    scheduler.start(intervalMinutes);
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = LotteryScheduler;