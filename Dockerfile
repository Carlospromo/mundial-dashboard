FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy application files
COPY . .

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
