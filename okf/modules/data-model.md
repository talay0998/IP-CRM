---
type: module
title: 数据模型
description: Deno KV 实体与前缀布局
source_ids: [MDD-MOD-001, MDD-MOD-002]
tags: [deno-kv, data-model]
timestamp: 2026-08-04
---

# KV 布局

- `customers/{id}` → Customer
- `cases/{id}` → Case（含 customerId）
- `activities/{caseId}/{id}` → CaseActivity
- `fees/{caseId}/{feeId}` → Fee（payments 内嵌数组）
- `deadlines/{id}` → Deadline

# 要点

- 金额一律存**分**（Number），前端 /100 显示。
- Fee 的 received/status 是**派生字段**，接口返回时计算：payments 空=unpaid；received>=amount=paid；否则 partial。
- Deadline 的 overdue 派生：dueDate < 今天 且 pending。
- 案件加节点时同步更新案件 stage（MDD-DATA-001）。
- 客户删除级联删其案件/节点/费用/期限（ADD-COUP-001，测试 TDD-TEST-028）。
