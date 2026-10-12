const http = require('http');
const https = require('https');
const zlib = require('zlib');

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const MAX_BYTES = 4 * 1024 * 1024;

function validateUrl(value) {
  const url = new URL(value);
  const allowed = ['xhslink.cn', 'xhslink.com', 'xiaohongshu.com'];
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.port || !allowed.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
    throw new Error('仅支持小红书分享链接');
  }
  return url;
}

function requestHtml(value, redirects = 0, deadline = Date.now() + 30000) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = validateUrl(value); } catch (error) { reject(error); return; }
    const remaining = deadline - Date.now();
    if (remaining <= 0) { reject(new Error('HTML 请求超时')); return; }
    let timer;
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html', 'Accept-Encoding': 'identity' }
    }, response => {
      const status = response.statusCode;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        clearTimeout(timer);
        if (!response.headers.location || redirects >= 5) {
          reject(new Error('分享链接重定向异常')); return;
        }
        try {
          const nextUrl = new URL(response.headers.location, url).href;
          requestHtml(nextUrl, redirects + 1, deadline).then(resolve, reject);
        } catch (_) { reject(new Error('分享链接重定向异常')); }
        return;
      }
      if (status !== 200) {
        response.resume();
        clearTimeout(timer);
        reject(new Error('分享页 HTTP 状态：' + status)); return;
      }
      const chunks = [];
      let size = 0;
      response.on('error', error => { clearTimeout(timer); reject(error); });
      response.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          request.destroy(new Error('分享页内容过大')); return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        clearTimeout(timer);
        try {
          let body = Buffer.concat(chunks);
          const encoding = response.headers['content-encoding'];
          const options = { maxOutputLength: MAX_BYTES };
          if (encoding === 'gzip') body = zlib.gunzipSync(body, options);
          else if (encoding === 'deflate') body = zlib.inflateSync(body, options);
          else if (encoding === 'br') body = zlib.brotliDecompressSync(body, options);
          else if (encoding && encoding !== 'identity') throw new Error('分享页压缩格式不支持');
          resolve({ html: body.toString('utf8'), finalUrl: url.href });
        } catch (error) { reject(error); }
      });
    });
    timer = setTimeout(() => request.destroy(new Error('HTML 请求超时')), remaining);
    request.on('error', error => { clearTimeout(timer); reject(error); });
  });
}

function parseNoteHtml(html, finalUrl) {
  if (new URL(finalUrl).pathname.includes('/website-login/captcha') ||
      /<title[^>]*>\s*安全验证\s*<\/title>/i.test(html)) {
    throw new Error('小红书要求安全验证');
  }
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?)<\/script>/i);
  if (!match) throw new Error('分享页未包含笔记数据');
  // 只解析 JSON；替换字符串外的 undefined，不执行页面中的 JavaScript。
  const json = match[1].trim().replace(/;\s*$/, '').replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g,
    token => token === 'undefined' ? 'null' : token);
  let state;
  try { state = JSON.parse(json); } catch (_) { throw new Error('分享页笔记数据格式不支持'); }
  const data = state.noteData;
  const note = data && (data.data && data.data.noteData || data.noteId && data || data.note) || state.note;
  if (!note || !note.noteId || !note.user || !note.user.userId) {
    throw new Error('分享页未返回完整笔记及作者信息');
  }
  const expectedId = new URL(finalUrl).pathname.match(/\/(?:discovery\/item|explore)\/([a-f0-9]{24})(?:\/|$)/i);
  if (expectedId && expectedId[1] !== note.noteId) throw new Error('分享页笔记 ID 不匹配');
  return { xhs_user_id: note.user.userId, xhs_note_id: note.noteId, note_data: note };
}

async function getNoteFromHtml(url) {
  const page = await requestHtml(url);
  return parseNoteHtml(page.html, page.finalUrl);
}

module.exports = { validateUrl, requestHtml, parseNoteHtml, getNoteFromHtml };
