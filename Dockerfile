FROM node:18

RUN apt update && apt install -y \
  libglib2.0-0 \
  libnss3 \
  libxss1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libgbm-dev

WORKDIR /app
COPY . .
RUN npm install

CMD ["node", "index.js"]
