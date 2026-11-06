#!/bin/bash
# 停止并移除 Multica 移动端 H5 容器（镜像与数据不受影响）
set -e

cd "$(dirname "$0")" || exit 1

COMPOSE_FILE="./docker-compose.yml"
ENV_FILE="./.env"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: $COMPOSE_FILE not found!"
    exit 1
fi

# compose 标签里有 ${MULTICA_TARO_DOMAIN} 插值，down 时同样需要变量
set -a
[ -f "$ENV_FILE" ] && source "$ENV_FILE"
[ -f "./.env.secrets" ] && source "./.env.secrets"
set +a

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [ -n "${MULTICA_TARO_ALLOWED_CIDRS:-}" ] && [ -f "./docker-compose.access.yml" ]; then
    COMPOSE_ARGS+=(-f "./docker-compose.access.yml")
fi

echo "Stopping Multica mobile H5 ..."
docker compose "${COMPOSE_ARGS[@]}" down
echo "Cleanup completed."
