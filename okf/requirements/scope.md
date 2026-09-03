---
type: requirements
title: 范围与需求
description: 知识产权代理 CRM 的确认范围与非范围
source_ids: [URD-REQ-001, URD-REQ-017, URD-ASM-001]
tags: [crm, trademark, copyright, scope]
timestamp: 2026-08-04
---

# 范围

- 单用户，需账号密码登录（URD-ROLE-001, URD-REQ-018..020）；默认 `alimjan`/`alimjan580`，可被环境变量覆盖。
- 业务：客户、案件（商标/版权）、流程节点、费用台账（官费/代理费 + 每笔到账）、期限提醒（续展/官方答复/费用）、看板。
- 明确排除：专利、多用户/审计、邮件短信、外部检索对接、附件导出。
- 数据规模假设：千级以内，KV 全量扫描可接受。
