FROM nginx:1.27-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        gnupg2 \
        ca-certificates \
        lsb-release \
        debian-archive-keyring \
    && curl https://nginx.org/keys/nginx_signing.key \
        | gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/mainline/debian $(. /etc/os-release && echo $VERSION_CODENAME) nginx" \
        > /etc/apt/sources.list.d/nginx.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nginx-module-njs \
    && rm -rf /var/lib/apt/lists/*

CMD ["nginx", "-g", "daemon off;"]
