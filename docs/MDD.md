# MDD · Building Blocks（模块与契约）

> 来源需求引用 URD 编号，不重复 URD 原文。

## 1. 模块划分

| ID | 模块 | 文件 | 职责 |
| --- | --- | --- | --- |
| MDD-MOD-001 | 类型与常量 | `src/types.ts` | 全部实体类型、枚举、状态常量、校验函数 |
| MDD-MOD-002 | 数据访问层 | `src/db.ts` | KV 前缀封装：读写/列表/删除/原子操作 |
| MDD-MOD-003 | 路由层 | `src/routes/*.ts` + `main.ts` | REST 端点、静态服务、错误处理 |
| MDD-MOD-004 | 前端 | `public/index.html` | 单页应用：看板/客户/案件/费用/期限 |
| MDD-MOD-005 | 测试支撑 | `tests/helper.ts` | 内存 KV 测试库、测试客户端 |
| MDD-MOD-006 | 会话认证 | `src/auth.ts` | 登录/登出/会话校验、HttpOnly Cookie、认证中间件 |

## 2. 数据结构（KV 布局）

- 实体 key 前缀：
  - `customers/{id}` → Customer
  - `cases/{id}` → Case（含 customerId）
  - `activities/{caseId}/{id}` → CaseActivity
  - `fees/{caseId}/{feeId}` → Fee（payments 内嵌数组）
  - `deadlines/{id}` → Deadline
  - `sessions/{token}` → Session（`{ token, createdAt, expiresAt }`）
- 全部实体 value 为 JSON 对象；金额字段以**分**存储（Number）。

### Customer
```ts
interface Customer {
  id: string; name: string; company: string; phone: string;
  email: string; note: string; createdAt: number; updatedAt: number;
}
```

### Case
```ts
type CaseType = "trademark" | "copyright";
type CaseStatus = "active" | "completed" | "terminated";
interface Case {
  id: string; customerId: string; type: CaseType;
  category: string;        // 商标/版权子类
  title: string;           // 商标名 / 作品名
  appNo: string;           // 申请号
  applyDate: string;       // YYYY-MM-DD
  status: CaseStatus;
  stage: string;           // 当前阶段文本
  note: string; createdAt: number; updatedAt: number;
}
```
- 子类合法值：商标 = 注册申请/驳回复审/异议/无效宣告/续展/变更/转让；版权 = 作品登记/变更/撤销。
- 每案新增节点时，`stage` 同步为该节点阶段（MDD-DATA-001）。

### CaseActivity
```ts
interface CaseActivity {
  id: string; caseId: string; stage: string;
  content: string; type: string; createdAt: number;
}
```

### Fee
```ts
interface Payment {
  id: string; date: string;   // YYYY-MM-DD
  amount: number;             // 分
  note: string; createdAt: number;
}
interface Fee {
  id: string; caseId: string;
  name: string; kind: "official" | "agency";
  amount: number;             // 应收（分）
  dueDate: string;            // YYYY-MM-DD
  note: string;
  payments: Payment[];
  createdAt: number; updatedAt: number;
}
```
- 派生字段（不落库，接口返回时计算）：
  - `received` = Σ payments.amount
  - `status` = payments 为空 ? "unpaid" : received >= amount ? "paid" : "partial"
  - 对应 MDD-DATA-002。

### Deadline
```ts
type DeadlineType = "renewal" | "official_reply" | "fee";
type DeadlineStatus = "pending" | "done";
interface Deadline {
  id: string; caseId: string;
  title: string; type: DeadlineType;
  dueDate: string;            // YYYY-MM-DD
  status: DeadlineStatus;
  note: string; createdAt: number; updatedAt: number;
}
```
- `overdue` 为派生：dueDate < today 且 status=pending。
- 关联客户名/案件标题在看板聚合时 join（MDD-DATA-003）。

## 3. 接口契约（REST）

### 客户
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/customers` | query: q | Customer[]（按 updatedAt 倒序） |
| POST | `/api/customers` | body 缺省 name | 201 Customer / 400 姓名必填 |
| GET | `/api/customers/:id` | — | Customer / 404 |
| PUT | `/api/customers/:id` | body 部分字段 | Customer / 404 |
| DELETE | `/api/customers/:id` | — | `{ ok, deletedCases }`，级联删案件/节点/费用/期限 / 404 |

### 案件
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/cases` | type, status, customerId, q | Case[] 倒序 |
| POST | `/api/cases` | body | 201 Case / 400 缺 title 或非法 type/category/customerId |
| GET | `/api/cases/:id` | — | Case / 404 |
| PUT | `/api/cases/:id` | body 部分字段 | Case / 404 |
| DELETE | `/api/cases/:id` | — | `{ ok }`，级联节点/费用/期限 / 404 |

### 节点
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/cases/:id/activities` | — | CaseActivity[]（createdAt 倒序） |
| POST | `/api/cases/:id/activities` | stage, content, type | 201 + 同步更新案件 stage / 404 |

### 费用
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/cases/:id/fees` | — | Fee[]（含派生 received/status） |
| POST | `/api/cases/:id/fees` | body | 201 Fee / 400 非法金额或 kind |
| PUT | `/api/fees/:feeId` | body 部分字段 | Fee / 404 |
| DELETE | `/api/fees/:feeId` | — | `{ ok }` / 404 |
| POST | `/api/fees/:feeId/payments` | date, amount | 201 Fee（含新支付）+ 状态重算 / 400 金额<=0 |
| DELETE | `/api/fees/:feeId/payments/:pid` | — | `{ ok }` / 404 |

### 期限
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/api/deadlines` | query: upcoming(天) | Deadline[] 含 caseTitle/customerName join、overdue 派生 |
| POST | `/api/deadlines` | body | 201 Deadline / 400 缺 dueDate/title |
| PUT | `/api/deadlines/:id` | body 部分字段 | Deadline / 404 |
| DELETE | `/api/deadlines/:id` | — | `{ ok }` / 404 |
| POST | `/api/deadlines/:id/toggle` | — | Deadline（pending↔done）/ 404 |

### 看板
| 方法 | 路径 | 出参 |
| --- | --- | --- |
| GET | `/api/dashboard` | `{ caseCounts, feeTotals, upcomingDeadlines, recentCases }` |
- `caseCounts`：`{ total, trademark, copyright, active, completed, terminated }`
- `feeTotals`：`{ receivable, received, pending }`（分）
- `upcomingDeadlines`：30 天内到期或已逾期且未完成，含案件/客户 join
- `recentCases`：最近更新的 5 个案件

### 认证
| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| POST | `/api/login` | `{ username, password }` | 200 `{ ok }` + 设置 HttpOnly Cookie `ipcrm_session`（7 天）/ 401 凭证错误 |
| POST | `/api/logout` | Cookie | 200 `{ ok }`，删除会话 |
| GET | `/api/me` | Cookie | 200 `{ username }` / 401 |

### 认证中间件（MDD-API-001）
- 所有 `/api/*` 路由（除 `/api/login`）挂载认证中间件。
- 校验 Cookie `ipcrm_session` → KV 查 `sessions/{token}` → 未命中或过期返回 401。
- 中间件在业务路由注册前统一挂载。

## 4. 错误处理契约
- 统一 JSON：`{ error: string }`；状态码 400/404/500。
- 金额字段入参非法（非数字/≤0）→ 400。
- 前端对 400 直接展示 error 文案。

## 5. 前端（public/index.html）视图
- 顶部导航：看板 / 客户 / 案件。
- 看板：统计卡片 + 近期案件 + 到期提醒列表（可跳转）。
- 客户：列表 + 搜索 + 新增/编辑弹窗 + 删除确认（显示名下案件数）。
- 案件：筛选栏 + 列表；详情抽屉含 Tab（信息 / 流程节点 / 费用 / 期限）。
- 所有表单均含必填校验与错误 toast。
