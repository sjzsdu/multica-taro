#!/bin/bash
# ============================================================
# Multica 移动端 H5 部署脚本
#   1. 检查 traefik-public 网络
#   2. 提示 multica-backend 是否就绪（静态站点可独立启动）
#   3. docker compose pull + up -d
#   4. 等待容器健康检查通过
# ============================================================
set -e

cd "$(dirname "$0")" || exit 1

COMPOSE_FILE="./docker-compose.yml"
ENV_FILE="./.env"
NETWORK_NAME="traefik-public"
CONTAINER_NAME="multica-taro"
BACKEND_CONTAINER="multica-backend"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: $COMPOSE_FILE not found!"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE 不存在，请先执行："
    echo "  cp .env.example .env"
    exit 1
fi

if ! docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Error: 网络 $NETWORK_NAME 不存在，请先执行仓库根目录的 ./init.sh"
    exit 1
fi

# 加载配置供 compose 标签插值（与仓库内其他服务一致）
# .env.secrets 可选：仅在使用 Basic Auth 等需要秘密的 overlay 时创建。
set -a
source "$ENV_FILE"
if [ -f "./.env.secrets" ]; then
    source "./.env.secrets"
fi
set +a

if [ -z "${MULTICA_TARO_DOMAIN:-}" ]; then
    echo "Error: MULTICA_TARO_DOMAIN 不能为空"
    exit 1
fi

# 访问控制是可选的 overlay：只有显式配置了 CIDR 才追加，默认不启用。
COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [ -n "${MULTICA_TARO_ALLOWED_CIDRS:-}" ]; then
    if [ ! -f "./docker-compose.access.yml" ]; then
        echo "Error: MULTICA_TARO_ALLOWED_CIDRS 已设置，但 docker-compose.access.yml 不存在"
        exit 1
    fi
    COMPOSE_ARGS+=(-f "./docker-compose.access.yml")
    echo "🔒 已启用 IP allowlist：${MULTICA_TARO_ALLOWED_CIDRS}"
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then
    echo "⚠️  ${BACKEND_CONTAINER} 未运行：静态页仍可打开，但 /api 会返回 502。"
    echo "    请先执行 ../multica/setup.sh，再重跑本脚本。"
fi

echo "Pulling ${MULTICA_TARO_IMAGE:-sjzsdu/multica-taro}:${MULTICA_TARO_TAG:-latest} ..."
docker compose "${COMPOSE_ARGS[@]}" pull

echo "Starting Multica mobile H5 ..."
docker compose "${COMPOSE_ARGS[@]}" up -d --remove-orphans

echo "Waiting for container health check ..."
STATUS=""
for _ in $(seq 1 30); do
    STATUS=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || echo missing)
    if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "exited" ]; then
        break
    fi
    sleep 2
done

if [ "$STATUS" != "healthy" ]; then
    echo "⚠️  容器状态：$STATUS，最近日志："
    docker logs --tail 40 "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Multica 移动端 H5 部署完成"
echo "=========================================="
echo "  H5:  https://${MULTICA_TARO_DOMAIN}"
echo "  API: https://${MULTICA_TARO_DOMAIN}/api（同源反代到 ${MULTICA_TARO_API_UPSTREAM:-http://multica-backend:8080}）"
echo ""
echo "首次部署提醒："
echo "  1. 确认 DNS：${MULTICA_TARO_DOMAIN} A 记录指向本机，首次访问由 Traefik 签发证书"
echo "  2. 若 H5 登录报 502，先确认 multica-backend 健康：docker logs --tail 20 multica-backend"
