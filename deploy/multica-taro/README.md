# multica-taro（deploy 仓库模板）

Multica 移动端 H5 的 Traefik 部署单元。目录结构与 deploy 仓库其他服务一致：
`docker-compose.yml` + `setup.sh` + `cleanup.sh` + `.env`，接入 `traefik-public` 外部网络，
不对外暴露端口。

> 本目录是给 [deploy 仓库](../../../deploy) 的模板。因为当前工作区只允许写
> `multica-taro` 仓库，需要你复制过去一次：
>
> ```bash
> cp -r /home/sjz/Codes/multica-taro/deploy/multica-taro /home/sjz/Codes/deploy/
> cd /home/sjz/Codes/deploy/multica-taro
> cp .env.example .env
> ```
>
> 之后在 deploy 仓库提交即可，根目录 `run.sh` 会自动发现该服务。

## 架构

```
浏览器 ──HTTPS──> Traefik (m.wnbgj.com)
                    │
                    ▼
              multica-taro (nginx:80)
                ├─ /            → Taro H5 静态文件 + SPA fallback
                ├─ /api/*       → http://multica-backend:8080
                ├─ /auth/*      → http://multica-backend:8080
                └─ /ws          → http://multica-backend:8080（预留实时推送）
```

关键点：H5 与 API **同源**，构建时 `TARO_APP_API_BASE` 留空，浏览器不会跨域，
因此**不需要**把 `m.wnbgj.com` 加入后端的 `CORS_ALLOWED_ORIGINS`。这也是它比
GitHub Pages 更适合这个后端的根本原因（Pages 没有反代能力）。

## 一次性准备

1. **DNS**：添加 `m.wnbgj.com` 的 A 记录指向 `115.159.58.27`。
2. **GitHub Secrets**（multica-taro 仓库）：
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`（Docker Hub Access Token，需 push 权限）
3. **构建镜像**：推一个 `v*` tag，或在 Actions 手动运行 `Publish Docker image`。
   产物为 `sjzsdu/multica-taro:latest` / `:vX.Y.Z` / `:sha-xxxxxxx`。
4. **服务器部署**：

   ```bash
   cd ~/deploy
   git pull
   cd multica-taro
   ./setup.sh
   ```

## 日常操作

| 操作 | 命令 |
| --- | --- |
| 更新到 latest | 服务器执行 `cd ~/deploy/multica-taro && ./setup.sh` |
| 固定版本 / 回滚 | 改 `.env` 的 `MULTICA_TARO_TAG=v0.1.0`，再 `./setup.sh` |
| 换域名 | 改 `.env` 的 `MULTICA_TARO_DOMAIN`，DNS 同步后 `./setup.sh` |
| 停止 | `./cleanup.sh` |
| 看日志 | `docker logs -f multica-taro` |

## 访问控制（可选）

默认不启用——应用本身有登录。需要把访问收紧到固定出口 IP 时：

1. 在 `.env` 填 CIDR（逗号分隔）：

   ```bash
   MULTICA_TARO_ALLOWED_CIDRS=1.2.3.0/24,10.0.0.0/8
   ```

2. 重跑 `./setup.sh`。脚本会自动追加 `docker-compose.access.yml`，在 Traefik 上挂
   `ipallowlist` 中间件（同时保留原有的安全响应头）。
3. 关闭：把变量清空，再跑 `./setup.sh`。

注意：

- 只影响 `MULTICA_TARO_DOMAIN` 这个站点，不影响 `multica.wnbgj.com`。
- 家宽/办公出口 IP 变化会导致自己也被挡；先确认固定出口再启用。
- 被挡的请求由 Traefik 直接返回 403，容器日志里看不到。

如果出口 IP 不固定，也可以改用 Basic Auth（与 IP allowlist 二选一，或叠加）：

```yaml
# docker-compose.access.yml 的 labels 改为：
- "traefik.http.routers.multica-taro.middlewares=multica-taro-headers,multica-taro-basic"
- "traefik.http.middlewares.multica-taro-basic.basicauth.users=${MULTICA_TARO_BASIC_AUTH_USERS}"
```

生成一行用户（密码里的 `$` 在 compose 文件中需写成 `$$`）：

```bash
printf '%s:%s\n' admin "$(openssl passwd -apr1 'change-me')" | sed 's/\$/$$/g'
```

把结果放进 `.env.secrets`（不放 `.env`），`setup.sh` 会在读取 `.env` 后自动加载它。

## 排障

- **502 / 登录失败**：`docker logs --tail 50 multica-backend` 确认后端是否健康；
  `docker exec multica-taro wget -qO- http://127.0.0.1/healthz` 确认 nginx 正常。
- **证书没签发**：确认 DNS 已生效（`dig +short m.wnbgj.com`），且 80 端口可达
  （Traefik 用 HTTP-01 challenge）。
- **静态资源 404**：镜像里 `dist` 没打包进去，检查 GitHub Actions 构建日志。
- **改完域名不生效**：Traefik 读取的是容器 label，必须 `./setup.sh` 重建容器，
  只 `restart` 不会更新 label。
- **后端重建后 502**：nginx 用 Docker DNS 每次请求解析上游，通常自动恢复；
  若仍异常，`docker restart multica-taro`。

## 不需要的东西

- `.env.secrets` 不是必需的：默认的静态托管 + IP allowlist 没有随机密钥；只有额外启用 Basic Auth 时才需要放一行 htpasswd。
- 不需要修改 `traefik.yml`：本服务通过 Docker provider 的 labels 自动注册。
- 不需要改 `CORS_ALLOWED_ORIGINS`：同源反代。
