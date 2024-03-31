FROM node AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy the rest of the project files to the working directory
COPY . .

# Create placeholder env vars
RUN echo "VITE_DEFAULT_INVIDIOUS_INSTANCE=VITE_DEFAULT_INVIDIOUS_INSTANCE_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_FRONTEND_URL=VITE_DEFAULT_FRONTEND_URL_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_SPONSERBLOCK_INSTANCE=VITE_DEFAULT_SPONSERBLOCK_INSTANCE_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE=VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE_PLACEHOLDER" >> .env

# Install dependencies and build the project
RUN npm install && npm run build

FROM nginx:alpine

# Remove the default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy the nginx.conf file to the container
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the built Vite project from the builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose the desired port
EXPOSE 80

# Copy the replace_env_vars.sh script
COPY replace_env_vars.sh /replace_env_vars.sh
RUN chmod +x /replace_env_vars.sh

# Replace env vars & Start nginx
CMD ["/bin/sh", "-c", "/replace_env_vars.sh && nginx -g \"daemon off;\""]