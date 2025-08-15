# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose the port your service runs on (change if needed)
EXPOSE 3001

# Start the service
CMD ["npx", "nodemon", "src/index.js"]