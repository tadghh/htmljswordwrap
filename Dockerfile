FROM alpine:3.19
RUN apk add --no-cache lighttpd
COPY lighttpd.conf /etc/lighttpd/lighttpd.conf
COPY *.html *.js *.css *.png /var/www/html/
WORKDIR /var/www/html
EXPOSE 80
CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]