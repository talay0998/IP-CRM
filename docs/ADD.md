# ADD · Design Split（拆解设计）

> 强度：standard（含 strict 补充） ｜ 方法：功能需求(FR) × 设计参数(DP) 矩阵

## 1. 功能需求（FR）

| ID | 需求 | 来源 |
| --- | --- | --- |
| ADD-FR-001 | 客户增删改查（删除需确认并提示名下案件数） | URD-REQ-001,002 |
| ADD-FR-002 | 案件增删改查 + 商标/版权类型与子类 + 案件状态 | URD-REQ-003..007 |
| ADD-FR-003 | 案件流程节点记录与时间线 | URD-REQ-008 |
| ADD-FR-004 | 案件按类型/状态/客户/关键字检索筛选 | URD-REQ-009 |
| ADD-FR-005 | 费用（官费/代理费）+ 每笔到账明细 + 状态自动计算 + 全局对账 | URD-REQ-010..013 |
| ADD-FR-006 | 期限登记/完成 + 到期预警 | URD-REQ-014..016 |
| ADD-FR-007 | 看板聚合统计 + 30 天到期提醒 | URD-REQ-017 |
| ADD-FR-008 | 登录/登出 + 会话校验（未登录拒绝业务 API） | URD-REQ-018..020 |

## 2. 设计参数（DP）

| ID | 设计参数 | 说明 |
| --- | --- | --- |
| ADD-DP-001 | customers 存储与路由 | KV 前缀 `customers` + REST |
| ADD-DP-002 | cases 存储与路由 | KV 前缀 `cases` + REST，关联 customerId |
| ADD-DP-003 | activities 存储与路由 | KV 前缀 `activities/{caseId}` 时间线 |
| ADD-DP-004 | 检索过滤 | 内存过滤查询（量级小） |
| ADD-DP-005 | fees 存储与路由 | KV 前缀 `fees/{caseId}`，payments 内嵌数组 |
| ADD-DP-006 | deadlines 存储与路由 | KV 前缀 `deadlines`，可关联案件/费用 |
| ADD-DP-007 | dashboard 聚合 | 只读聚合各实体 |
| ADD-DP-008 | 会话认证模块 | KV 前缀 `sessions`，登录发放 HttpOnly Cookie，中间件校验 |

## 3. 设计矩阵

```
          DP-001 DP-002 DP-003 DP-004 DP-005 DP-006 DP-007 DP-008
FR-001      X
FR-002             X
FR-003                    X
FR-004                           X
FR-005                                  X
FR-006                                         X
FR-007      X      X      X      X      X      X      X
FR-008                                                        X
```

## 4. 解耦判定

- 写入路径基本**对角**：客户/案件/节点/费用/期限各模块数据隔离，互不交叉写。
- **FR-007（看板）**为三角依赖：只读聚合多实体，是单向数据流，按执行顺序实现即可 → **decoupled**。
- **FR-008（认证）**为对角依赖：会话模块独立，通过 Hono 中间件对业务路由做统一前置校验 → **decoupled**。
- 需执行顺序约束的三个点：
  1. 删除客户必须先处理其名下案件（防孤儿数据）。
  2. dashboard 最后实现（依赖各实体结构已稳定）。
  3. 认证中间件需在业务路由注册前挂载。

## 5. 已接受耦合记录

- **ADD-COUP-001 客户删除级联**
  - 耦合项：`DELETE /api/customers/:id` 需同时清理该客户所有案件及其节点/费用/期限。
  - 原因：个人规模下孤儿数据风险高于模块解耦收益，级联删除配确认最实用。
  - 影响模块：customers 路由 → cases / activities / fees / deadlines。
  - 风险：误删大量关联数据。
  - Guard 测试（TDD-TEST-013）：删除客户时返回其名下案件数提示；级联后各前缀无残留。
  - 未来解除条件：引入回收站或软删除时，改为标记 + 定时清理，即可消除耦合。

## 6. 重试记录
- 首次矩阵即 decoupled（除级联点），无需结构性重试。
