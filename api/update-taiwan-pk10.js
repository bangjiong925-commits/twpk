export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 简单的认证检查（可选）
  const authToken = req.headers.authorization || req.query.token;
  const expectedToken = process.env.UPDATE_TOKEN || 'default-token';
  
  if (authToken !== `Bearer ${expectedToken}` && authToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // 调用现有的taiwan-pk10-live API获取最新数据
    const baseUrl = req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/taiwan-pk10-live`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const latestData = await response.json();
    
    // 这里我们无法直接写入文件系统，因为Vercel是无服务器环境
    // 但我们可以返回数据，让外部服务处理存储
    // 或者使用数据库/外部存储服务
    
    const updateResult = {
      success: true,
      timestamp: new Date().toISOString(),
      data: latestData,
      message: 'Data updated successfully'
    };
    
    // 如果有数据库连接，可以在这里保存数据
    // await saveToDatabase(latestData);
    
    return res.status(200).json(updateResult);
    
  } catch (error) {
    console.error('更新数据时出错:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Failed to update data'
    });
  }
}

// 辅助函数：保存到数据库（示例）
// async function saveToDatabase(data) {
//   // 这里可以连接到数据库（如MongoDB、PostgreSQL等）
//   // 保存最新的开奖数据
//   // 例如：
//   // const db = await connectToDatabase();
//   // await db.collection('taiwan_pk10').insertOne(data);
// }