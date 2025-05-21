# Koristi zvaničnu sliku za Azure Functions
FROM mcr.microsoft.com/azure-functions/node:4

# Postavi radni direktorijum u kontejneru
WORKDIR /home/site/wwwroot

# Kopiraj package.json i package-lock.json (ako ih imaš) za instalaciju zavisnosti
COPY package*.json ./

# Instaliraj sve Node.js zavisnosti
RUN npm install

# Kopiraj ostatak aplikacije u kontejner
COPY . .

# Postavi port za Azure Functions
EXPOSE 7071

# Pokreni Azure Functions runtime
CMD [ "npm", "start" ]
