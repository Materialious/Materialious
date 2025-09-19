FROM node:latest AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy the rest of the project files to the working directory
COPY . .

# Create placeholder env vars
RUN echo "VITE_DEFAULT_INVIDIOUS_INSTANCE=VITE_DEFAULT_INVIDIOUS_INSTANCE_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_COMPANION_INSTANCE=VITE_DEFAULT_COMPANION_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_SPONSERBLOCK_INSTANCE=VITE_DEFAULT_SPONSERBLOCK_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_DEARROW_INSTANCE=VITE_DEFAULT_DEARROW_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE=VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_PEERJS_HOST=VITE_DEFAULT_PEERJS_HOST_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_PEERJS_PATH=VITE_DEFAULT_PEERJS_PATH_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_PEERJS_PORT=VITE_DEFAULT_PEERJS_PORT_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_DOWNLOAD_ENABLED=VITE_DEFAULT_DOWNLOAD_ENABLED_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_SYNCIOUS_INSTANCE=VITE_DEFAULT_SYNCIOUS_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_API_EXTENDED_INSTANCE=VITE_DEFAULT_API_EXTENDED_INSTANCE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_DASH_BITRATE=VITE_DEFAULT_DASH_BITRATE_PLACEHOLDER" >> .env && \
    echo "VITE_DEFAULT_SETTINGS='\"VITE_DEFAULT_SETTINGS_PLACEHOLDER\"'" >> .env && \
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
