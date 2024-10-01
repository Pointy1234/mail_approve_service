# Используем официальный образ Node.js
FROM node:20-alpine

# Создаем директорию для приложения
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./
COPY node_modules ./node_modules
COPY . .

# Открываем порт, который будет использовать приложение
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
