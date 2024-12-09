FROM node:20.11-bullseye-slim

RUN apt update -y
RUN groupadd -r nonrootuser && useradd -m -r -g nonrootuser nonrootuser
WORKDIR /home/nonrootuser
COPY . .
RUN npm install 
USER nonrootuser

ENTRYPOINT ["npm","start"]
