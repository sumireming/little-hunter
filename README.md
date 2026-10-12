# little-hunter


## node版本
node/18.0.0

## 安装步骤
1. 安装node
2. 安装项目依赖
   在项目目录下执行``npm install``
3. 启动服务
   执行``node index.js``
4. 访问路径 ``/nodeapi/xhsnote?url=http%3A%2F%2Fxhslink.com%2Fo%2F4rks7DRJi0c``

   

## HTML 抓取与回退（2026-10-12）

默认先直接请求分享页 HTML，解析 `window.__INITIAL_STATE__`，失败时使用原 Chromium 流程。
遇到明确的安全验证页直接返回错误。接口路径及 `xhs_user_id`、`xhs_note_id`、`note_data` 保持兼容。
未增加依赖。部署前运行 `npm test`。

- `XHS_FETCH_MODE=html`：仅使用 HTML，适合在服务器验证新方式。
- `XHS_FETCH_MODE=browser`：直接使用原浏览器流程，适合紧急回退。
- 不设置该变量：HTML 优先，普通失败后尝试浏览器。

原版本：`a0f504e6a8b31bc03f5a35acec87dd7929838312`。
本地回退标签：`rollback-before-html-20261012`（未推送）。
若需要重新部署完全原版，应从该提交生成部署包；例如：

```bash
git archive rollback-before-html-20261012 | tar -x -C /path/to/empty-rollback-directory
```

在容器环境变量设置 `XHS_FETCH_MODE=browser` 并重启服务可快速切换，不需要先改源码。
HTML 在本机成功不代表服务器必定成功，部署后应先验证失败投稿与已成功投稿。
