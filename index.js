const http = require('http');
const url = require('url');
const { get_xhs_note_data } = require('./run.js')



const server = http.createServer(async (req, res) => {
  // 解析URL和查询参数
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  
  // 设置响应头为JSON格式
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  // 根据不同路径返回不同数据
  if (pathname === '/nodeapi/xhsnote') {

    try {
       let url 
      let result

      if (query && query.url) {
        url = decodeURIComponent(query.url)
        result = await get_xhs_note_data(url)
      }

      const response = {
        data: result
      };

      res.end(JSON.stringify(response, null, 2));
    } catch (e) {
      const response = {
        success: false,
        message: '解析失败',
      };
      res.end(JSON.stringify(response, null, 2));
    }

   
  } 
  else {
    const response = {
      success: false,
      message: '路径不存在',
    };
    res.end(JSON.stringify(response, null, 2));
  }
});

const PORT = 18333;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});