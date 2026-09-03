---
type: decisions
title: 关键决策
description: 已确认的需求决策与已接受耦合
source_ids: [URD-DEC-001, URD-DEC-002, ADD-COUP-001]
tags: [decisions]
timestamp: 2026-08-04
---

# 决策

- **URD-DEC-001** 部分收款记录每笔到账明细，实收自动汇总。
- **URD-DEC-002** 从空库开始，不预置演示数据。
- **URD-DEC-003** 需登录；默认凭证写入代码便于开箱即用，部署推荐环境变量覆盖；Session 用 HttpOnly Cookie + 随机 token，7 天有效。
- **ADD-COUP-001** 删除客户级联删除其案件/节点/费用/期限，删除前返回名下案件数；Guard 测试 TDD-TEST-028。
