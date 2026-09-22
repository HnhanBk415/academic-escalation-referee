# ── Stage 1: Node builder ────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps (use cache layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Point API base to relative path so nginx proxy handles it
ENV VITE_API_BASE_URL=""

RUN npm run build

# ── Stage 2: Nginx runtime ───────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/aer.conf

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
