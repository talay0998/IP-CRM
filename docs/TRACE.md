# TRACE · 项目地图

## 追踪链（需求 → 设计 → 模块 → 接口 → 测试 → 任务）

| 需求 | 设计 | 模块 | 接口 | 测试 | 任务 |
| --- | --- | --- | --- | --- | --- |
| URD-REQ-001,002 | ADD-FR-001 | MDD-MOD-003 | /api/customers* | TDD-TEST-001..005 | RMD-TASK-004 |
| URD-REQ-003..007 | ADD-FR-002 | MDD-MOD-003 | /api/cases* | TDD-TEST-006..011 | RMD-TASK-005 |
| URD-REQ-008 | ADD-FR-003 | MDD-MOD-003 | /api/cases/:id/activities | TDD-TEST-012..014 | RMD-TASK-005 |
| URD-REQ-009 | ADD-FR-004 | MDD-MOD-002,003 | /api/cases?过滤 | TDD-TEST-010 | RMD-TASK-005 |
| URD-REQ-010..013 | ADD-FR-005 | MDD-MOD-002,003 | /api/cases/:id/fees, /api/fees/* | TDD-TEST-015..020 | RMD-TASK-006 |
| URD-REQ-014..016 | ADD-FR-006 | MDD-MOD-002,003 | /api/deadlines* | TDD-TEST-021..024 | RMD-TASK-007 |
| URD-REQ-017 | ADD-FR-007 | MDD-MOD-002,003 | /api/dashboard | TDD-TEST-025 | RMD-TASK-008 |
| URD-REQ-018..020 | ADD-FR-008 | MDD-MOD-006 | /api/login, /logout, /me | TDD-TEST-029..033 | RMD-TASK-002 |
| URD-AC-001..006 | ADD-FR-001..008 | MDD-MOD-001..006 | 全部 | TDD-TEST-001..033 | RMD-TASK-001..010 |
| ADD-COUP-001 | — | MDD-MOD-003 | DELETE /api/customers/:id | TDD-TEST-028 | RMD-TASK-004 |

## OKF 概念页映射
- okf/index.md（导航）
- okf/requirements/scope.md ← URD
- okf/modules/data-model.md ← MDD
- okf/interfaces/api.md ← MDD 契约
- okf/paths/build.md ← RMD
- okf/terms/glossary.md ← URD 术语
- okf/decisions/decisions.md ← URD-DEC/ADD-COUP
