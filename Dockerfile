# 使用 Node.js 16 基础镜像
FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libxss1 \
    libx11 \
    libxcb \
    libxext \
    libxfixes \
    libxrandr \
    libxrender \
    libxcursor \
    libxi \
    libxtst \
    dbus \
    udev

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目代码
COPY . .

# 设置环境变量
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 暴露端口
EXPOSE 18333

# 启动命令
CMD ["node", "index.js"]
