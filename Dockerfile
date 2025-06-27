# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /usr/src

# Copy package.json and pnpm-lock.yaml to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install pnpm and project dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy the rest of the application's source code
COPY . .

# Build the TypeScript source code into JavaScript
RUN pnpm build

# Expose the port the app runs on
EXPOSE 3001

# Define the command to run the application
CMD ["node", "dist/index.js"]
