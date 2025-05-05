# Minification stage
FROM node:alpine AS builder

WORKDIR /build

RUN npm install -g html-minifier terser clean-css-cli

# Copy source files
COPY *.html *.js *.css ./

# HTML
RUN for file in *.html; do \
    html-minifier --remove-comments --collapse-whitespace --remove-redundant-attributes \
    --remove-script-type-attributes --remove-style-link-type-attributes \
    --minify-js true --minify-css true "$file" -o "$file.min"; \
    mv "$file.min" "$file"; \
    done

# JS
RUN for file in *.js; do \
    terser "$file" --compress --mangle -o "$file.min"; \
    mv "$file.min" "$file"; \
    done

# CSS
RUN for file in *.css; do \
    cleancss -o "$file.min" "$file"; \
    mv "$file.min" "$file"; \
    done

FROM alpine:3.19 AS runner
RUN apk add --no-cache lighttpd
WORKDIR /var/www/html

# Copy minified contents from builder stage
COPY --from=builder /build/* ./

COPY *.svg *.ico *.png ./

# Copy lighttpd configuration
COPY lighttpd.conf /etc/lighttpd/lighttpd.conf
EXPOSE 80
CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]