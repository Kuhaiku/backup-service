# Imagem base oficial do Node.js
FROM node:20

# Definir o diretório de trabalho dentro do container
WORKDIR /app

# Copiar os arquivos package.json e package-lock.json (se houver)
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar todo o restante do projeto para o container
COPY . .

# Criar a pasta 'uploads' caso ela não exista
RUN mkdir -p /app/uploads

# Expor a porta que a aplicação usa
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["node", "server.js"]
