FROM node:18
WORKDIR /opt/app

COPY package*.json ./
RUN npm install

COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD [ "./entrypoint.sh" ]