# Build stage for minification
FROM node:18-alpine AS build

# Install minification tools
RUN npm install -g html-minifier terser clean-css-cli

# Create and set working directory
WORKDIR /build

# Copy source files
COPY *.html *.js *.css ./

# Minify HTML files
RUN for file in *.html; do \
    if [ -f "$file" ]; then \
        html-minifier --collapse-whitespace --remove-comments --remove-optional-tags \
        --remove-redundant-attributes --remove-script-type-attributes \
        --remove-tag-whitespace --use-short-doctype --minify-css true \
        --minify-js true "$file" -o "min.$file"; \
    fi \
    done

# Minify JavaScript files
RUN for file in *.js; do \
    if [ -f "$file" ]; then \
        terser "$file" -c -m -o "min.$file"; \
    fi \
    done

# Minify CSS files
RUN for file in *.css; do \
    if [ -f "$file" ]; then \
        cleancss -o "min.$file" "$file"; \
    fi \
    done

# Pre-compress files with gzip and brotli
RUN for file in min.*; do \
    if [ -f "$file" ]; then \
        gzip -9 -k "$file"; \
        brotli -9 -k "$file"; \
    fi \
    done

# Final stage
FROM alpine:3.19

# Install lighttpd
RUN apk add --no-cache lighttpd lighttpd-mod_deflate brotli

# Copy lighttpd configuration
COPY lighttpd.conf /etc/lighttpd/lighttpd.conf

# Copy minified files from build stage
COPY --from=build /build/min.*.html /var/www/html/
COPY --from=build /build/min.*.js /var/www/html/
COPY --from=build /build/min.*.css /var/www/html/
COPY --from=build /build/min.*.gz /var/www/html/
COPY --from=build /build/min.*.br /var/www/html/
COPY *.png /var/www/html/
COPY *.svg /var/www/html/

# Remove the 'min.' prefix from filenames
RUN cd /var/www/html && \
    for file in min.*; do \
        if [ -f "$file" ]; then \
            mv "$file" "${file#min.}"; \
        fi \
    done

WORKDIR /var/www/html
EXPOSE 80

CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]