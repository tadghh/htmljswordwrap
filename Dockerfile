FROM alpine:3.19

# Install Node.js and minification tools
RUN apk add \
    lighttpd \
    nodejs \
    npm \
    brotli \
    && npm install -g html-minifier terser clean-css-cli \
    && mkdir -p /var/tmp/lighttpd/cache/compress

# Set working directory
WORKDIR /var/www/html

# Copy configuration and source files
COPY lighttpd.conf /etc/lighttpd/lighttpd.conf
COPY *.html *.js *.css *.png *.svg *.ico ./

# Minify and compress files
RUN for file in *.html; do \
        if [ -f "$file" ]; then \
            html-minifier --collapse-whitespace --remove-comments --remove-optional-tags \
            --remove-redundant-attributes --remove-script-type-attributes \
            --remove-tag-whitespace --use-short-doctype --minify-css true \
            --minify-js true "$file" -o "temp.$file" && mv "temp.$file" "$file"; \
        fi \
    done && \
    for file in *.js; do \
        if [ -f "$file" ]; then \
            terser "$file" -c -m -o "temp.$file" && mv "temp.$file" "$file"; \
        fi \
    done && \
    for file in *.css; do \
        if [ -f "$file" ]; then \
            cleancss -o "temp.$file" "$file" && mv "temp.$file" "$file"; \
        fi \
    done && \
    for file in *.html *.js *.css; do \
        if [ -f "$file" ]; then \
            gzip -9 -k "$file"; \
            brotli -9 -k "$file"; \
        fi \
    done && \
    # Cleanup
    npm uninstall -g html-minifier terser clean-css-cli && \
    apk del nodejs npm && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 80

CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]