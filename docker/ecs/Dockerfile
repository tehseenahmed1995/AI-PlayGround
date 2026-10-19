# Self-contained image for AWS ECS/Fargate: nginx + php-fpm + built assets in one container.
# (For local/EC2 Compose, keep using docker/app/Dockerfile instead.)

# ---- Stage 1: build frontend assets ----
FROM node:22-alpine AS assets
WORKDIR /app
COPY package*.json vite.config.js ./
RUN npm ci
COPY resources ./resources
COPY public ./public
RUN npm run build

# ---- Stage 2: PHP runtime + nginx ----
FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
    git curl zip unzip nginx supervisor \
    libpq-dev libzip-dev libpng-dev libjpeg-dev libfreetype6-dev poppler-utils \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_pgsql pgsql zip gd bcmath pcntl \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Pull the compiled Vite assets from stage 1
COPY --from=assets /app/public/build ./public/build

# nginx + supervisor config
COPY docker/ecs/nginx.conf /etc/nginx/sites-available/default
COPY docker/ecs/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
