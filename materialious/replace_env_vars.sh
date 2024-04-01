#!/bin/sh
ROOT_DIR=./

# Replace env vars in JavaScript and HTML files served by NGINX
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_INVIDIOUS_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_INVIDIOUS_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_FRONTEND_URL_PLACEHOLDER|'"$VITE_DEFAULT_FRONTEND_URL"'|g' {} +
find "$ROOT_DIR" -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's|VITE_DEFAULT_SPONSERBLOCK_INSTANCE_PLACEHOLDER|'"$VITE_DEFAULT_SPONSERBLOCK_INSTANCE"'|g' {} +