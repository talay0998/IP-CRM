---
type: interface
title: 接口契约
description: REST API 一览与错误约定
source_ids: [MDD-MOD-003]
tags: [api, rest]
timestamp: 2026-08-04
---

# 端点

- 客户：`GET/POST /api/customers`，`GET/PUT/DELETE /api/customers/:id`（DELETE 返回 `{ok, deletedCases}`）
- 案件：`GET/POST /api/cases`（GET 过滤 type/status/customerId/q），`GET/PUT/DELETE /api/cases/:id`
- 节点：`GET/POST /api/cases/:id/activities`
- 费用：`GET/POST /api/cases/:id/fees`，`PUT/DELETE /api/fees/:feeId`，`POST /api/fees/:feeId/payments`，`DELETE /api/fees/:feeId/payments/:pid`
- 期限：`GET /api/deadlines?upcoming=30`，`POST /api/deadlines`，`PUT/DELETE /api/deadlines/:id`，`POST /api/deadlines/:id/toggle`
- 看板：`GET /api/dashboard`

# 认证

- `POST /api/login` `{username,password}` → 200 + HttpOnly Cookie `ipcrm_session` / 401
- `POST /api/logout` → 200，删会话
- `GET /api/me` → 200 `{username}` / 401
- 认证中间件挂载所有 `/api/*`（除 login），校验 Cookie→KV `sessions/{token}`，无效返回 401。

# 约定

- 错误统一 `{ error: string }`，400/401/404/500。
- 金额非法（非数字或 <=0）→ 400。
- 静态文件在 API 之后兜底；未知 API 路径返回 JSON 404。
