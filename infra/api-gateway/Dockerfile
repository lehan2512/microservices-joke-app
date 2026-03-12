FROM kong:latest
USER root
RUN apt-get update && \
    apt-get install -y git unzip gcc make libpcre3 libpcre3-dev wget && \
    luarocks install kong-oidc-v3
USER kong