---
type: path
title: 构建路径
description: 实现顺序与测试命令
source_ids: [RMD-TASK-001, RMD-TASK-009]
tags: [build, roadmap]
timestamp: 2026-08-04
---

# 顺序

1. 骨架（deno.json / types / db / main）
2. 认证 auth（login/logout/me + 中间件）
3. 测试支撑 helper
4. customers
5. cases + activities
6. fees + payments
7. deadlines
8. dashboard
9. 前端
10. 端到端验证 + 部署

# 命令

- 测试：`deno test --unstable-kv --allow-read --allow-write --allow-env tests/`
- 类型检查：`deno check src/ tests/`
- 本地运行：`deno task start`
- 部署：`deno login` → `deno deploy --project=ip-crm`
