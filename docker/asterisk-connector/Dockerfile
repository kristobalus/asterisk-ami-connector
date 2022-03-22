FROM node:15.5.1-buster-slim
RUN apt-get update && apt-get install -y python build-essential
RUN mkdir -p /opt
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "tsconfig.json", "/opt/"]
WORKDIR /opt
RUN npm install --production
# RUN npm install --production --silent && mv node_modules ../
COPY . /opt
RUN npm run clean
RUN npm run build
CMD ["node", "/opt/build/app/asterisk-connector.js"]
