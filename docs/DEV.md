## Work in Progress
This documentation is under active development and subject to change.

### Development Environment Setup

#### Invidious Deployment
To deploy Invidious, use Docker Compose with the following configuration:

```yaml
services:
  invidious:
    image: quay.io/invidious/invidious:latest
    # For ARM64/AArch64 devices, uncomment the line below:
    # image: quay.io/invidious/invidious:latest-arm64
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      # Refer to the official Invidious config for all available options:
      # https://github.com/iv-org/invidious/blob/master/config/config.example.yml
      INVIDIOUS_CONFIG: |
        db:
          dbname: invidious
          user: kemal
          password: kemal
          host: invidious-db
          port: 5432
        check_tables: true
        https_only: true
        external_port: 443
        use_innertube_for_captions: true
        domain: invidious.localhost
        hmac_key: "some-insecure-or-secure-key-for-local-development"
    healthcheck:
      test: wget -nv --tries=1 --spider http://127.0.0.1:3000/api/v1/trending || exit 1
      interval: 30s
      timeout: 5s
      retries: 2
    logging:
      options:
        max-size: "1G"
        max-file: "4"
    depends_on:
      - invidious-db

  invidious-db:
    image: docker.io/library/postgres:14
    restart: unless-stopped
    volumes:
      - postgresdata:/var/lib/postgresql/data
      - ./config/sql:/config/sql
      - ./docker/init-invidious-db.sh:/docker-entrypoint-initdb.d/init-invidious-db.sh
    ports:
      - 5432:5432
    environment:
      POSTGRES_DB: invidious
      POSTGRES_USER: kemal
      POSTGRES_PASSWORD: kemal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]

volumes:
  postgresdata:
```

#### Caddy Configuration

Configure Caddy for reverse proxying Invidious and Materialious with CORS headers:

```caddy
invidious.localhost {
	@cors_preflight {
		method OPTIONS
	}
	respond @cors_preflight 204

	header Access-Control-Allow-Credentials true
    header Access-Control-Allow-Origin "https://materialious.localhost" {
		defer
	}
    header Access-Control-Allow-Methods "GET,POST,OPTIONS,HEAD,PATCH,PUT,DELETE"
    header Access-Control-Allow-Headers "User-Agent,Authorization,Content-Type"

	header /ggpht/* Cross-Origin-Resource-Policy cross-origin

	reverse_proxy localhost:3000
}

materialious.localhost {
	reverse_proxy localhost:5173

    header {
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Embedder-Policy "require-corp"
    }
}
```

#### Install Materialious

1. Clone the Materialious repository:

   ```bash
   git clone https://github.com/Materialious/Materialious.git
   ```

2. Navigate into the project directory:

   ```bash
   cd Materialious/materialious
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file with the following content:

   ```bash
   VITE_DEFAULT_INVIDIOUS_INSTANCE="https://invidious.localhost"
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

#### Access the Applications

- Visit `invidious.localhost` in your browser and click "Continue."
- Visit `materialious.localhost` in your browser and click "Continue."
