# CHANGELOG

## 2026-08-04
- 初始化 ip-crm 项目（从 crm-demo 升级为知识产权代理 CRM，范围商标/版权，无专利）。
- URD：确认需求（客户/案件/费用/期限/看板）、决策（每笔到账明细、空库开始）。
- ADD：FR×DP 矩阵判定 decoupled，记录级联删除已接受耦合 ADD-COUP-001。
- MDD：模块划分、数据结构、REST 契约。
- TDD：28 条测试计划。
- RMD：9 个构建任务 + git checkpoint 计划。
- TRACE/OKF 建立追踪链。

## 变更（登录认证）
- URD-REQ-018..020：新增登录需求（默认凭证 alimjan/alimjan580，环境变量可覆盖，Session Cookie）。
- ADD-FR-008 / DP-008：会话认证模块；认证中间件统一保护业务 API。
- MDD-MOD-006：src/auth.ts；新增 /api/login、/logout、/me 契约与 MDD-API-001 中间件。
- TDD：新增 TEST-029..033（未登录 401、错误凭证、登录成功、登出失效、免认证）。
- RMD：插入 RMD-TASK-002 认证任务，后续任务顺延至 010。
- URD-AC-006 新增认证成功标准；URD-CON-005 凭证安全约束。

## 变更（实现后端 + 前端）
- RMD-TASK-001..003：骨架（deno.json/types.ts/db.ts/app.ts/main.ts）、认证（src/auth.ts）、测试支撑（tests/helper.ts）——测试全绿。
- RMD-TASK-004：客户 CRUD + 搜索 + 级联删除（ADD-COUP-001），TEST-001..005。
- RMD-TASK-005：案件 CRUD + 筛选 + 节点时间线（stage 同步 MDD-DATA-001），TEST-006..014。
- RMD-TASK-006：费用 CRUD + 收款登记（received/status 派生 MDD-DATA-002），TEST-015..020。
- RMD-TASK-007：期限 CRUD + upcoming 过滤 + overdue 派生 + toggle，TEST-021..024。
- RMD-TASK-008：看板聚合（caseCounts/feeTotals/upcomingDeadlines/recentCases），TEST-025；级联删除 TEST-028。
- RMD-TASK-009：前端单页应用（登录 + 看板/客户/案件/期限，案件详情抽屉含节点/费用/期限 Tab）。
- TDD-TEST-017 oracle 修正：应收 100 元需累计 100 元才 paid（原文档 70 元即 paid 与 MDD-DATA-002 矛盾）。
- 端到端走查（真实服务）：登录→建客户/案件/节点/费用/收款/期限→看板→级联删除→无残留，11/11 通过。

## 变更（前端 UI 改版）
- 视觉采用 Apple 设计风格：系统字体与光学排版（负 tracking 大标题）、玻璃拟态（backdrop-filter）、大圆角卡片、流体动效（spring 曲线、press 反馈）、深浅色主题自动跟随 prefers-color-scheme、prefers-reduced-motion/transparency 适配。
- 布局改为 vue-admin 模式：左侧玻璃侧边栏（logo + 菜单 + 退出，移动端汉堡抽屉）+ 玻璃顶栏（面包屑 + 用户）+ 内容区。
- 客户/案件列表改为卡片网格（头像/徽章/操作区），期限提醒改为日期卡片行，看板改为统计卡 + 面板。
- 业务逻辑与 API 全部不变，端到端走查仍 11/11 通过。

## 变更（扩展为完整管理系统）
- 操作日志：新增 `src/log.ts` writeLog，全部写操作（客户/案件/节点/费用/收款/期限增改删）+ 登录/登出/导出/备份恢复/更新配置/清空日志埋点；`src/auth.ts` Vars 注入 username，路由改 `Hono<{ Variables: Vars }>`；`/api/logs?limit=&clear=`。
- 系统设置：`/api/settings` GET/PUT（系统标题/联系人/SMTP 配置，密码不传保留旧值，非法端口 400）；`POST /api/settings/test-smtp` 用 Deno 原生 socket 手写握手（EHLO→STARTTLS→AUTH LOGIN→QUIT，10s 超时，多行应答完整读取，隐式 TLS 465 与 STARTTLS 587 双路径）。
- JSON 备份：`/api/backup/export` 导出全量 JSON、`/meta` 统计、`/restore` 校验格式后恢复（新增备份专用 /api/backup 未鉴权配置不含 token）。
- CSV 导出：`/api/export/customers|cases|activities|fees|deadlines`，中文表头 + UTF-8 BOM，文件名含日期。
- 业务统计：`/api/stats` 案件分布（类型/状态）+ 近 6 个月费用趋势 + 客户费用排名 TOP10。
- 财务管理：`/api/finance` join 客户/案件/费用的全局列表 + 汇总（应收/实收/待收），支持 keyword 与 status 筛选。
- 前端：菜单扩为 8 项（管理面板/客户管理/业务管理/期限提醒 ｜ 财务管理/业务统计/操作日志/系统管理，nav-sep 分组），新增 4 个页面（财务搜索+状态筛选、统计进度条+柱状图+排名、日志 limit+清空、系统管理四 Tab：标题/联系人/备份/导出/通知含 doBackup/doRestore/testSmtp），Blob 下载解析 Content-Disposition。
- 测试：tests/system_test.ts 新增 LOG/SET/BAK/EXP/STA/FIN 7 条，全量 40/40 通过；端到端走查覆盖全部新端点。

## 变更（接入 Turso 云端备份 + SMTP 真实发信）
- Turso 云端备份：`src/turso.ts` 用 `@libsql/client/web`（纯 Web 客户端，npm 原生包需 native binding 故用 web 版）将全量数据推为快照表 `backups(id, created_at, data, counts)`，保留最近 20 份；端点 `/api/backup/turso/{status,push,list,restore}`。
- 自动备份：main.ts 每日 02:00 `Deno.cron` 定时推送快照（需 `--unstable-cron`）；本地 Deno KV 仍为主存储（KV 为主 + Turso 自动备份）。
- 凭据：`.env`（已 gitignore）含 `TURSO_URL/TURSO_AUTH_TOKEN` 与 QQ SMTP；`.env.example` 作模板；deno.json tasks 加 `--env-file=.env`、`--unstable-cron`；启动时若设置未配 SMTP 则用环境变量种子。
- SMTP 真实发信：`src/smtp.ts` 抽取原生 socket 客户端（EHLO→STARTTLS→AUTH LOGIN→MAIL/RCPT/DATA），发信正文 UTF-8 base64、中文主题 RFC2047，多行应答完整读取；QQ 465 TLS / 587 STARTTLS 双路径实测通过。
- 到期提醒：`src/reminders.ts` 扫描待办期限（已逾期或 7 天内），按客户/案件/类型/截止日组装邮件；端点 `POST /api/settings/reminders-run`，每日 09:00 定时自动发送；`POST /api/settings/send-test` 发送测试邮件（QQ 实测发送成功）。
- 前端：系统管理-通知配置新增收件地址/发送测试邮件/立即发送到期提醒；数据备份 tab 新增 Turso 云端备份（状态/立即备份/云端恢复/快照列表）。
- 测试：tests/reminders_test.ts（REM-001..003 提醒组装纯函数）、tests/turso_test.ts（TUR-001 真实 push/pull/list，无凭据自动跳过；TUR-002 未配置返回 null）；全量 44/44 通过（TUR-001 在无凭据环境忽略）。

## 变更（客户主体类型优化）
- 新增主体类型：`src/types.ts` 定义 `CustomerKind`（individual 个人 / sole 个体户 / company 公司 / org 其他组织）及标签、证照号标签；`Customer` 新增 `kind`、`idNo`（证照号：身份证号/营业执照注册号/统一社会信用代码）、`address`（注册地址）、`contactName/contactPhone/contactEmail`（经办人）。
- 后端：`customers.ts` 校验 kind 枚举（非法回退 company），搜索覆盖证照号/经办人，支持 `?kind=` 筛选；`export.ts` 客户 CSV 新增主体类型/公司全称/证照号/注册地址/经办人三列。
- 前端：客户表单加主体类型下拉（动态切换证照号标签）、证照号/地址/经办人字段；卡片显示类型徽章；工具栏加类型筛选；搜索支持证照号/经办人。
- 兼容性：旧数据无 kind 时按"公司"展示与导出，KV 全字段透传无需迁移。
- 测试：tests/customers_test.ts 新增 TEST-006..008（新字段回显、非法 kind 回退、证照号/经办人搜索 + kind 筛选）；全量 47 passed | 0 failed | 1 ignored。

## 变更（腾讯云 OCR 证照识别）
- 配置：`src/types.ts` 新增 `OcrConfig { secretId, secretKey, region, enabled }` 并加入 `AppSettings.ocr`，`defaultSettings()` 提供默认值（region=ap-guangzhou、enabled=false）。
- 签名：`src/tencent.ts` TC3-HMAC-SHA256 签名（多服务通用，复用 `getTencentSignature`）。
- 后端：`src/routes/ocr.ts` 新增 `GET/PUT /api/settings/ocr`（保存/读取配置）、`POST /api/ocr/recognize`（配置缺失 400；上传图片 base64 调用腾讯云 `ocr.tencentcloudapi.com` GeneralAccurateOCR，返回 `TextDetections` 文本行 + 行内坐标 + `Language`）；统一 `requireAuth` 鉴权。
- 启动种子：main.ts 若环境变量 `TENCENT_SECRET_ID/TENCENT_SECRET_KEY` 已设且设置未配 OCR，则自动写入并启用（对齐 SMTP 种子逻辑）；`.env.example` 含 OCR 变量模板。
- 前端：系统管理新增 OCR 配置 Tab（SecretId/SecretKey/Region/启用开关，保存走 `/api/settings/ocr`）；客户表单「识别证照」按钮打开 OCR 弹窗（选文件→识别→回填主体类型/证照号/地址/名称/经办人），自动去重避免重复识别。
- 测试：tests/ocr_test.ts 新增 OCR-001..003（默认结构、保存回显、未登录 401）。
