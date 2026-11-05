# Multica Taro 移动端

基于 [Taro 4](https://taro.zone) + React 18 的 Multica 移动客户端，H5 优先，同一套代码可编译到微信小程序 / 支付宝 / 字节小程序。

连接现有服务：`https://multica.wnbgj.com`（Multica `v10.7.2`）。

## 功能

| 模块 | 能力 |
| --- | --- |
| 登录 | 邮箱一次性验证码登录，会话持久化，401 自动退出 |
| 收件箱 | 全部 / 未读筛选、通知类型与严重度、标为已读/未读、归档、全部已读、归档已读、已归档列表与取消归档 |
| 任务 | 服务端搜索、状态 / 优先级 / 我负责的筛选、按最近活动排序、无限滚动、下拉刷新 |
| 任务详情 | 标题与描述就地编辑、状态 / 优先级 / 负责人（成员·智能体·小队）/ 项目 / 截止日期修改、时间线与评论、发表评论 |
| 派发任务 | 两种模式：直接创建（可指派成员/智能体/小队）与「派发给智能体」（一句话 prompt 走 `quick-create`，由智能体建单并执行） |
| 工作区 | 多工作区切换、跨工作区未读角标 |
| 设置 | 账号信息、工作区入口、归档通知、退出登录 |

## 技术栈与取舍

- **UI**：Taro 原生组件 + 自建设计系统（`src/components/ui.tsx`、`src/app.scss`）。没有引入 antd-mobile / NutUI：H5 场景下它们可用，但会绑定 `react-dom`，小程序端无法编译，且包体明显增大。自建组件只依赖 `@tarojs/components`，H5 与小程序共用。
- **服务端状态**：TanStack Query（缓存、失效、无限分页、乐观更新）。
- **客户端状态**：Zustand 只保存会话、当前工作区等平台状态，不缓存服务端数据。
- **类型**：手工对齐 Multica monorepo 的 `packages/core/types` 与 `packages/core/api/client.ts`（状态/优先级是开放字符串，自定义状态有回退展示）。

## 目录

```
config/                 Taro 构建配置（dev 代理、API 基地址注入）
src/api/                ApiClient、类型、各资源端点
src/hooks/              Query hooks、登录守卫、工作区引导
src/stores/             auth / workspace（Zustand）
src/components/ui.tsx   通用 UI 组件（Avatar、StatusBadge、OptionSheet…）
src/pages/              inbox / issues / issue-detail / create / workspace / settings / inbox-archive / login
```

## 本地开发

要求 Node.js >= 18。

```bash
npm install --legacy-peer-deps   # @babel/preset-env@8 与 babel-preset-taro 的 peer 声明冲突，仓库内已用 .npmrc 固化
npm run dev:h5                   # http://localhost:10086
npm run typecheck
npm run build:h5
```

开发服务器通过 `config/dev.ts` 的 webpack proxy 把 `/api`、`/auth` 转发到 `https://multica.wnbgj.com`，因此浏览器同源、无 CORS 问题。

## 连接后端与部署

Multica 后端没有为任意 Origin 开启 CORS，浏览器不能直连 `multica.wnbgj.com`。H5 构建默认使用**相对路径**请求，部署时把 `/api`、`/auth` 反代到后端即可：

```nginx
location /api/  { proxy_pass https://multica.wnbgj.com/api/;  proxy_set_header Host multica.wnbgj.com; }
location /auth/ { proxy_pass https://multica.wnbgj.com/auth/; proxy_set_header Host multica.wnbgj.com; }
location /      { root /var/www/multica-taro; try_files $uri $uri/ /index.html; }
```

如果后端为你的域名配置了 `CORS_ALLOWED_ORIGINS`，也可以直接指定绝对地址构建：

```bash
TARO_APP_API_BASE=https://multica.wnbgj.com npm run build:h5
```

小程序构建没有同源代理，必须使用绝对地址，并在小程序后台把该域名加入 request 合法域名：

```bash
TARO_APP_API_BASE=https://multica.wnbgj.com npm run build:weapp
```

部署在子路径（例如 GitHub Pages 项目页 `/multica-taro/`）时，资源前缀和路由 basename 必须一起改：

```bash
TARO_APP_H5_BASE=/multica-taro/ npm run build:h5
```

## 持续集成与自动构建（GitHub Actions）

| Workflow | 触发 | 做什么 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push `main` / PR | 类型检查，构建 H5 与微信小程序，上传 `h5-dist` / `weapp-dist` artifact（保留 14 天） |
| `.github/workflows/release.yml` | 推送 `v*` tag 或手动 | 构建 `h5` / `weapp` 产物 zip，附到 GitHub Release |
| `.github/workflows/deploy-h5-pages.yml` | 手动 | 构建 H5 并部署到 GitHub Pages（可选，见下方限制） |
| `.github/workflows/weapp-upload.yml` | 手动 | 构建并用 `miniprogram-ci` 上传微信体验版（需要 secrets） |
| `.github/dependabot.yml` | 每周 / 每月 | 依赖与 GitHub Actions 更新 PR |

产物位置：

- **CI artifact**：在 Actions 运行页下载 `h5-dist.zip`（静态站点）或 `weapp-dist.zip`（含 `project.config.json`，可直接用微信开发者工具打开仓库根，`miniprogramRoot` 指向 `dist/`）。
- **Release 附件**：`multica-taro-h5-vX.Y.Z.zip` 与 `multica-taro-weapp-vX.Y.Z.zip`。

需要的仓库配置：

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `WEAPP_APPID` | Secret | 微信小程序 AppID（CI 会写入 `project.config.json`，仓库里是占位值） |
| `WEAPP_PRIVATE_KEY` | Secret | 微信公众平台下载的代码上传密钥 |
| `TARO_APP_API_BASE` | Variable | Pages 部署时前端直连的 API 地址 |

**GitHub Pages 的限制**：Pages 只托管静态文件，无法把 `/api`、`/auth` 反代到 Multica 后端。Pages 上的 H5 必须直连 API，需要后端把 Pages 域名加入 `CORS_ALLOWED_ORIGINS`；否则请使用上一节的 nginx / Netlify / Cloudflare 反代方案。小程序上传后还需在微信公众平台配置 request 合法域名，真机才能访问 API。

## Traefik 部署（推荐）

本仓库提供了一套可直接放进现有 deploy 仓库的部署单元，位于 `deploy/multica-taro/`：

- `Dockerfile`：Node 构建 H5 → nginx 托管，运行时镜像不含 Node。
- `docker/nginx.conf.template`：静态文件 + SPA fallback；`/api`、`/auth`、`/ws` 同源反代到 `multica-backend:8080`。
- `.github/workflows/docker-publish.yml`：推送 `v*` tag 时构建并推送镜像 `sjzsdu/multica-taro`。
- `deploy/multica-taro/`：deploy 仓库的 `docker-compose.yml` / `setup.sh` / `cleanup.sh` / `.env.example` 模板。

由于 H5 与 API 同源，**不需要**把部署域名加入后端 `CORS_ALLOWED_ORIGINS`，也不需要 GitHub Pages。接入步骤（DNS、Docker Hub secrets、部署/回滚）见 `deploy/multica-taro/README.md`。

## API 契约要点

- 鉴权：`Authorization: Bearer <token>`，工作区由 `X-Workspace-Slug` 指定（登录后在 `/api/workspaces` 中选择并持久化）。
- 登录：`POST /auth/send-code`、`POST /auth/verify-code`（返回 `{ token, user }`）。
- 列表：`GET /api/issues` 返回 `{ issues, total }`；`/api/inbox`、`/api/workspaces`、`/api/agents`、`/api/squads`、`/api/issues/:id/timeline` 直接返回数组。
- `POST /api/issues/quick-create` 用于把一句话 prompt 派发给智能体/小队。
- 客户端对 401 统一清会话并跳转登录页。

## 已知限制

- 暂无 WebSocket 实时推送：收件箱与任务列表通过页面重新可见时刷新 + 下拉刷新更新。
- 未实现附件上传、富文本 / Markdown 渲染；描述与评论按纯文本展示。
- H5 没有浏览器原生导航栏，子页面（详情、新建、工作区、归档）使用自绘返回栏；小程序端同样使用自绘栏以保持一致。
- 客户端不创建/加入工作区，工作区需先在网页端创建。
