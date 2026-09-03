# RMD · Build Path（构建路径）

> 任务按依赖与风险排序。无远端仓库 → git 本地提交，PR/merge 记 skipped。测试命令统一：
> `deno test --unstable-kv --allow-read --allow-write --allow-env tests/` ｜ 类型检查：`deno check src/ tests/`

## 任务清单

| ID | 任务 | 验收 | 回滚点 | Git checkpoint |
| --- | --- | --- | --- | --- |
| RMD-TASK-001 | 骨架：deno.json、src/types.ts、src/db.ts、main.ts（空 Hono + KV + 静态服务 + /api/health） | `deno check` 通过，health 200 | 删除新增文件 | 分支 feat/001 提交 |
| RMD-TASK-002 | 认证：src/auth.ts（login/logout/me + 认证中间件） | TEST-029..033 通过 | 回滚 auth.ts | 分支 feat/002 提交 |
| RMD-TASK-003 | 测试支撑：tests/helper.ts + 静态/未知 API 测试 | TEST-026/027 通过 | 回滚 helper | 分支 feat/003 提交 |
| RMD-TASK-004 | customers 路由 + 测试（含级联删除） | TEST-001..005,028 通过 | 回滚 customers | 分支 feat/004 提交 |
| RMD-TASK-005 | cases + activities 路由 + 测试 | TEST-006..014 通过 | 回滚 cases | 分支 feat/005 提交 |
| RMD-TASK-006 | fees/payments 路由 + 测试 | TEST-015..020 通过 | 回滚 fees | 分支 feat/006 提交 |
| RMD-TASK-007 | deadlines 路由 + 测试 | TEST-021..024 通过 | 回滚 deadlines | 分支 feat/007 提交 |
| RMD-TASK-008 | dashboard 聚合 + 测试 | TEST-025 通过 | 回滚 dashboard | 分支 feat/008 提交 |
| RMD-TASK-009 | 前端 public/index.html（登录 + 看板/客户/案件/费用/期限） | 浏览器验证 | 回滚 index.html | 分支 feat/009 提交 |
| RMD-TASK-010 | 端到端验证（测试全绿 + 浏览器走查 + README） | 全部测试通过 | — | 分支 feat/010 提交并标记 release |

## STOP 条件
- 任一接口缺契约 → 回 MDD。
- 任一测试无 oracle → 回 TDD。
- 级联删除行为与 ADD-COUP-001 不符 → 回 ADD。
- 认证绕过（未登录可访问业务 API）→ 回 MDD-API-001。
- 所有测试未通过前不做部署。

## 部署步骤（部署是独立动作，需用户确认）
```bash
deno login                 # 浏览器授权
deno deploy --project=ip-crm --env=IPCRM_USERNAME=alimjan --env=IPCRM_PASSWORD=alimjan580
```
- 本地 KV 与云端 KV 相互独立；部署后为空库。
- 部署时推荐显式设置环境变量凭证（代码内置同值作为 fallback）。
