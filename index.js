const http = require('http');
const url = require('url');
const { get_xhs_note_data } = require('./run.js');

const server = http.createServer(async (req, res) => {
  // 解析URL和查询参数
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  console.log('收到请求:', {
    pathname,
    query,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  
  // 设置响应头为JSON格式
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  // 根据不同路径返回不同数据
  if (pathname === '/nodeapi/xhsnote') {

    try {
      let url;
      let result;

      if (query && query.url) {
        url = decodeURIComponent(query.url);
        console.log('处理URL:', url);
        
        // 记录开始时间
        const startTime = Date.now();
        result = await get_xhs_note_data(url);
        const endTime = Date.now();
        
        console.log('处理耗时:', endTime - startTime, 'ms');
        console.log('处理结果:', JSON.stringify(result, null, 2));
        
        // 检查结果是否包含错误
        if (result.error) {
          console.error('处理过程中发生错误:', result.error);
          const response = {
            success: false,
            message: '解析失败',
            error: result.error,
            stack: result.stack
          };
          res.end(JSON.stringify(response, null, 2));
          return;
        }
      } else {
        console.error('缺少URL参数');
        const response = {
          success: false,
          message: '缺少URL参数',
        };
        res.end(JSON.stringify(response, null, 2));
        return;
      }

      const response = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.end(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error('处理请求时发生错误:', e);
      console.error('错误堆栈:', e.stack);
      const response = {
        success: false,
        message: '解析失败',
        error: e.message,
        stack: e.stack,
        timestamp: new Date().toISOString()
      };
      res.end(JSON.stringify(response, null, 2));
    }

   
  } 
  else {
    console.log('路径不存在:', pathname);
    const response = {
      success: false,
      message: '路径不存在',
      timestamp: new Date().toISOString()
    };
    res.end(JSON.stringify(response, null, 2));
  }
});

const PORT = 80;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});