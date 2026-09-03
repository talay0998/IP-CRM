# TDD · Check Plan（检查计划）

> 每个测试给出 oracle（什么结果算通过）。测试用 Deno 内置测试 + 内存 KV。

## 测试工具
- `tests/helper.ts`：`newTestDb()` 创建临时目录的 KV；`makeApp()` 组装 Hono app；`get(path)`, `post(path, body)`, `put`, `del` 辅助函数。

## 测试用例

### 客户
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-001 | 创建合法客户 | POST 完整字段 | 201；返回含 id；字段回显 |
| TDD-TEST-002 | 创建缺姓名 | POST name 空 | 400 `姓名不能为空` |
| TDD-TEST-003 | 客户不存在 | GET/PUT/DELETE /:id | 404 |
| TDD-TEST-004 | 更新部分字段 | PUT 只改 phone | 200；phone 变，其他不变 |
| TDD-TEST-005 | 列表排序与搜索 | GET ?q= | 仅匹配项；按 updatedAt 倒序 |

### 案件
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-006 | 创建合法商标案件 | POST trademark/注册申请 | 201；类型/子类正确 |
| TDD-TEST-007 | 创建非法子类 | POST copyright/注册申请 | 400 |
| TDD-TEST-008 | 客户不存在时建案 | POST customerId=假 | 400 |
| TDD-TEST-009 | 缺案件标题 | POST 无 title | 400 |
| TDD-TEST-010 | 筛选组合 | GET ?type=&status=&customerId=&q= | 结果满足全部条件 |
| TDD-TEST-011 | 案件不存在 | GET/PUT/DELETE /:id | 404 |

### 节点
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-012 | 添加节点并同步 stage | POST activity | 201；案件 stage 更新为该节点 stage |
| TDD-TEST-013 | 空节点内容 | POST content 空 | 400 |
| TDD-TEST-014 | 节点时间线倒序 | 添加多条后 GET | 最新在前 |

### 费用
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-015 | 创建费用 | POST kind=official | 201；received=0；status=unpaid |
| TDD-TEST-016 | 非法金额 | POST amount=-1 | 400 |
| TDD-TEST-017 | 登记收款联动状态 | 应收100元，到账30→70→100 | 到账30元received=3000 status=partial；累计70元 received=7000 status=partial；累计100元 received=10000 status=paid |
| TDD-TEST-018 | 删除收款状态回退 | 删除最后一笔到账 | received=0 status=unpaid |
| TDD-TEST-019 | 删除费用 | DELETE /api/fees/:id | ok；列表为空 |
| TDD-TEST-020 | 费用不存在 | GET/PUT/DELETE | 404 |

### 期限
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-021 | 创建期限 | POST 缺 dueDate | 400；合法则 201 |
| TDD-TEST-022 | upcoming 过滤 | 建 30 天内与 90 天后两条，GET ?upcoming=30 | 仅含 30 天内条 |
| TDD-TEST-023 | 逾期派生 | dueDate 昨天 + pending | 返回 overdue=true |
| TDD-TEST-024 | toggle 完成 | POST toggle | status=pending↔done 切换 |

### 看板
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-025 | 统计正确 | 建多类型案件/费用/期限 | caseCounts/feeTotals 数值精确；30天内期限在 upcomingDeadlines |

### 认证
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-029 | 未登录访问业务 API | GET /api/customers | 401 |
| TDD-TEST-030 | 错误凭证登录 | POST /api/login 错误密码 | 401 |
| TDD-TEST-031 | 正确凭证登录 | POST /api/login alimjan/alimjan580 | 200；响应带 `set-cookie`；随后带 Cookie 访问业务 API 成功 |
| TDD-TEST-032 | 登出后失效 | 登录→logout→带旧 Cookie 访问 | 401 |
| TDD-TEST-033 | /api/login 免认证 | POST /api/login | 不经过中间件，正常 200/401 |

### 静态/安全
| ID | 场景 | 操作 | Oracle |
| --- | --- | --- | --- |
| TDD-TEST-026 | 首页可访问 | GET / | 200 且含 `<html` |
| TDD-TEST-027 | 未知 API | GET /api/xxx | 404 JSON |
| TDD-TEST-028 | 级联删除客户 | 客户挂2案+费用+期限后 DELETE | `deletedCases=2`；各前缀无残留（直接查 KV） |

## 覆盖映射
- 所有 URD-AC-001..005 均有对应测试；负向用例覆盖非法输入、不存在实体、金额边界。
