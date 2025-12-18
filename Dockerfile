FROM node:20
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://ollama.com/install.sh | sh
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Ensuring models are pulled correctly
RUN echo '#!/bin/bash\nollama serve & sleep 15 && ollama pull llama3.1 && ollama pull llava && npm start' > start.sh
RUN chmod +x start.sh
EXPOSE 8080
CMD ["./start.sh"]
