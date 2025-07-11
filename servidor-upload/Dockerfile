# Dockerfile

# Passo 1: Use uma imagem base oficial do Node.js. A versão Alpine é leve.
FROM node:18-alpine AS base

# Passo 2: Crie e defina o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Passo 3: Copie os ficheiros de dependências
# Copia `package.json` e `package-lock.json` (se existir)
COPY package*.json ./

# Passo 4: Instale as dependências de produção
# O `npm ci` é mais rápido e seguro para builds contínuos, mas `install` também funciona.
RUN npm install --production

# Passo 5: Copie o resto do código da aplicação
COPY . .

# Passo 6: Exponha a porta em que a aplicação corre
EXPOSE 3000

# Passo 7: Comando para iniciar a aplicação
CMD [ "node", "server.js" ]
