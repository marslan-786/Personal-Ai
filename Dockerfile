# Base Image
FROM node:20

# Install Ollama and dependencies
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://ollama.com/install.sh | sh

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Create a startup script to run both Ollama and Node
RUN echo '#!/bin/bash\nollama serve & sleep 10 && ollama pull llama3.1:8b && npm start' > start.sh
RUN chmod +x start.sh

# Expose the port
EXPOSE 8080

# Run the startup script
CMD ["./start.sh"]
