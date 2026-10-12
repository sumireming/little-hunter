const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { EventEmitter } = require('events');
const zlib = require('zlib');
const { parseNoteHtml, validateUrl } = require('../html');
const id = '6acce120000000001a028224';
const url = 'https://www.xiaohongshu.com/discovery/item/' + id;
const note = { noteId: id, user: { userId: 'author' }, title: '西洋橱', desc: 'undefined 字样保留', imageList: [{ url: 'image' }], tagList: [] };
const html = state => '<script>window.__INITIAL_STATE__=' + JSON.stringify(state) + ';</script>';

function mockRequest(responses) {
  const seen = [];
  const transport = { get(target, options, callback) {
    seen.push(String(target));
    const request = new EventEmitter();
    request.destroy = error => request.emit('error', error);
    process.nextTick(() => {
      const response = new EventEmitter();
      Object.assign(response, responses.shift());
      response.resume = () => {};
      callback(response);
      if (response.body) response.emit('data', response.body);
      response.emit('end');
    });
    return request;
  } };
  const context = { module: { exports: {} }, URL, Buffer, Date, setTimeout, clearTimeout,
    require: name => name === 'http' || name === 'https' ? transport : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../html.js'), 'utf8'), context);
  return { ...context.module.exports, seen };
}

async function checkModes() {
  for (const [mode, error, expectedHtml, expectedBrowser] of [
    ['', null, 1, 0], ['', 'HTML 请求超时', 1, 1],
    ['', '小红书要求安全验证', 1, 0], ['html', 'HTML 请求超时', 1, 0],
    ['browser', null, 0, 1]
  ]) {
    let htmlCalls = 0, browserCalls = 0;
    const context = { module: { exports: {} }, process: { env: { XHS_FETCH_MODE: mode } },
      URL, console: { log() {}, error() {} },
      require: name => name === 'puppeteer'
        ? { launch: async () => { browserCalls++; throw new Error('browser-test'); } }
        : { validateUrl, getNoteFromHtml: async () => {
          htmlCalls++;
          if (error) throw new Error(error);
          return { xhs_user_id: 'author', xhs_note_id: id, note_data: note };
        } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../run.js'), 'utf8'), context);
    const result = await context.module.exports.get_xhs_note_data(url);
    assert.equal(htmlCalls, expectedHtml);
    assert.equal(browserCalls, expectedBrowser);
    if (expectedBrowser) assert.equal(result.error, 'browser-test');
    else if (error) assert.equal(result.error, error);
    else assert.equal(result.xhs_note_id, id);
  }
}

(async () => {
  const parsed = parseNoteHtml(html({ noteData: { realUserId: '', data: { noteData: note } } }), url);
  assert.equal(parsed.xhs_user_id, 'author');
  assert.equal(parsed.xhs_note_id, id);
  assert.equal(parsed.note_data.imageList.length, 1);
  const withUndefined = html({ noteData: note }).replace('"noteData":', '"unused":undefined,"noteData":');
  assert.equal(parseNoteHtml(withUndefined, url).note_data.desc, note.desc);
  assert.equal(parseNoteHtml(html({ note: note }), url).xhs_note_id, id);
  assert.equal(parseNoteHtml(html({ noteData: { note } }), url).xhs_note_id, id);
  assert.throws(() => parseNoteHtml('<title>安全验证</title>', url), /安全验证/);
  assert.throws(() => parseNoteHtml('', 'https://www.xiaohongshu.com/website-login/captcha'), /安全验证/);
  assert.throws(() => parseNoteHtml('<html></html>', url), /未包含/);
  assert.throws(() => parseNoteHtml(html({ noteData: { noteId: id } }), url), /完整/);
  assert.throws(() => parseNoteHtml(html({ noteData: note }), url.replace(id, '000000000000000000000000')), /不匹配/);
  assert.throws(() => parseNoteHtml('<script>window.__INITIAL_STATE__={};process.exit()</script>', url), /格式不支持/);
  for (const invalid of ['file:///tmp/a', 'http://127.0.0.1', 'https://xiaohongshu.com.evil.test', 'https://user:pass@xhslink.cn']) {
    assert.throws(() => validateUrl(invalid));
  }
  let mock = mockRequest([{ statusCode: 302, headers: { location: url } }, { statusCode: 200, headers: {}, body: Buffer.from(html({ noteData: note })) }]);
  assert.equal((await mock.getNoteFromHtml('https://xhslink.cn/o/test')).xhs_note_id, id);
  assert.equal(mock.seen.length, 2);
  mock = mockRequest([{ statusCode: 302, headers: { location: 'http://127.0.0.1' } }]);
  await assert.rejects(mock.requestHtml('https://xhslink.cn/o/test'), /仅支持/);
  assert.equal(mock.seen.length, 1);
  mock = mockRequest([{ statusCode: 429, headers: {} }]);
  await assert.rejects(mock.requestHtml(url), /429/);
  mock = mockRequest([{ statusCode: 200, headers: { 'content-encoding': 'gzip' }, body: zlib.gzipSync(Buffer.from(html({ noteData: note }))) }]);
  assert.equal((await mock.getNoteFromHtml(url)).xhs_note_id, id);
  mock = mockRequest([{ statusCode: 302, headers: { location: 'http://[' } }]);
  await assert.rejects(mock.requestHtml(url), /重定向异常/);
  await checkModes();
  console.log('HTML 解析、作者字段、重定向、错误识别及浏览器回退开关检查通过');
})().catch(error => { console.error(error); process.exitCode = 1; });
