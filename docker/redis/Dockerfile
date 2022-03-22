FROM redis:latest
# COPY redis.conf /usr/local/etc/redis/redis.conf
RUN mkdir -p /usr/local/etc/redis
RUN echo "" > /usr/local/etc/redis/redis.conf
CMD [ "redis-server", "/usr/local/etc/redis/redis.conf" ]