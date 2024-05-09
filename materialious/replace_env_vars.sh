#!/bin/sh
ROOT_DIR=/usr/share/nginx/html

# Replace env vars in JavaScript and HTML files served by NGINX
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_INVIDIOUS_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_INVIDIOUS_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_SPONSERBLOCK_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_SPONSERBLOCK_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_DEARROW_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_DEARROW_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_PEERJS_HOST_PLACEHOLDER|'"$VITE_DEFAULT_PEERJS_HOST"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_PEERJS_PATH_PLACEHOLDER|'"$VITE_DEFAULT_PEERJS_PATH"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_PEERJS_PORT_PLACEHOLDER|'"$VITE_DEFAULT_PEERJS_PORT"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_SYNCIOUS_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_SYNCIOUS_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_SETTINGS_PLACEHOLDER|'"$VITE_DEFAULT_SETTINGS"'|g' {} +
