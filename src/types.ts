// 领域类型与常量（MDD-MOD-001）

// ---- 枚举 ----
export const CASE_TYPES = [
  "trademark",
  "copyright",
  "software-copyright",
  "legal-consult",
  "registration",
  "software",
  "service",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const TRADEMARK_CATEGORIES = [
  "注册申请",
  "驳回复审",
  "异议",
  "无效宣告",
  "续展",
  "变更",
  "转让",
] as const;

export const COPYRIGHT_CATEGORIES = [
  "作品登记",
  "变更",
  "撤销",
] as const;

export const SOFTWARE_COPYRIGHT_CATEGORIES = [
  "软件著作权登记",
  "变更",
  "补发证书",
] as const;

export const LEGAL_CONSULT_CATEGORIES = [
  "一般咨询",
  "合同审查",
  "法律意见",
  "侵权分析",
  "非诉代理",
] as const;

export const REGISTRATION_CATEGORIES = [
  "公司设立",
  "公司变更",
  "个体户注册",
  "注销",
  "年报",
] as const;

export const SOFTWARE_CATEGORIES = [
  "项目开发",
  "软件销售",
  "定制开发",
  "系统集成",
] as const;

export const SERVICE_CATEGORIES = [
  "数据服务",
  "信息系统运维",
  "云计算服务",
  "网络安全服务",
] as const;

export const CATEGORIES_BY_TYPE: Record<string, readonly string[]> = {
  trademark: TRADEMARK_CATEGORIES,
  copyright: COPYRIGHT_CATEGORIES,
  "software-copyright": SOFTWARE_COPYRIGHT_CATEGORIES,
  "legal-consult": LEGAL_CONSULT_CATEGORIES,
  registration: REGISTRATION_CATEGORIES,
  software: SOFTWARE_CATEGORIES,
  service: SERVICE_CATEGORIES,
};

export const CASE_TYPE_LABEL: Record<CaseType, string> = {
  trademark: "商标代理",
  copyright: "版权代理",
  "software-copyright": "软件著作权",
  "legal-consult": "法律咨询",
  registration: "注册登记",
  software: "软件开发",
  service: "数据服务",
};

export const CASE_STATUSES = ["active", "completed", "terminated"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// ---- 销售线索 ----
export const LEAD_STATUSES = ["new", "contacted", "qualified", "negotiating", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = ["referral", "website", "ad", "cold-call", "walk-in", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "新线索",
  contacted: "已联系",
  qualified: "有意向",
  negotiating: "洽谈中",
  won: "已成交",
  lost: "已流失",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  referral: "转介绍",
  website: "官网咨询",
  ad: "广告投放",
  "cold-call": "主动联系",
  "walk-in": "上门",
  other: "其他",
};

export const CUSTOMER_KINDS = ["individual", "sole", "company", "org"] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  individual: "个人",
  sole: "个体户",
  company: "公司",
  org: "其他组织",
};

export const CUSTOMER_KIND_ID_LABEL: Record<CustomerKind, string> = {
  individual: "身份证号",
  sole: "营业执照注册号",
  company: "统一社会信用代码",
  org: "统一社会信用代码",
};

export const FEE_KINDS = ["official", "agency"] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export const FEE_STATUSES = ["unpaid", "partial", "paid"] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const DEADLINE_TYPES = ["renewal", "official_reply", "fee"] as const;
export type DeadlineType = (typeof DEADLINE_TYPES)[number];

export const DEADLINE_STATUSES = ["pending", "done"] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

export const DEADLINE_TYPE_LABEL: Record<DeadlineType, string> = {
  renewal: "续展提醒",
  official_reply: "官方答复",
  fee: "费用缴纳",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  active: "进行中",
  completed: "已完成",
  terminated: "已终止",
};

export const FEE_KIND_LABEL: Record<FeeKind, string> = {
  official: "官费",
  agency: "代理费",
};

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  unpaid: "未收",
  partial: "部分",
  paid: "已收",
};

// ---- 实体 ----
export interface Customer {
  id: string;
  name: string;
  kind: CustomerKind; // 主体类型：个人/个体户/公司/其他组织
  company: string; // 单位全称（公司=注册全称，个体户=字号）
  idNo: string; // 证照号：身份证号 / 营业执照注册号 / 统一社会信用代码
  address: string; // 注册地址
  phone: string;
  email: string;
  contactName: string; // 经办人
  contactPhone: string; // 经办人电话
  contactEmail: string; // 经办人邮箱
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface Case {
  id: string;
  customerId: string;
  type: CaseType;
  category: string;
  title: string;
  appNo: string;
  applyDate: string; // YYYY-MM-DD
  status: CaseStatus;
  stage: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface CaseActivity {
  id: string;
  caseId: string;
  stage: string;
  content: string;
  type: string;
  createdAt: number;
}

export interface Payment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // 分
  note: string;
  createdAt: number;
}

export interface Fee {
  id: string;
  caseId: string;
  name: string;
  kind: FeeKind;
  amount: number; // 应收（分）
  dueDate: string; // YYYY-MM-DD
  note: string;
  payments: Payment[];
  createdAt: number;
  updatedAt: number;
}

export interface Deadline {
  id: string;
  caseId: string;
  title: string;
  type: DeadlineType;
  dueDate: string; // YYYY-MM-DD
  status: DeadlineStatus;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface Lead {
  id: string;
  name: string; // 线索联系人/名称
  phone: string;
  email: string;
  company: string;
  source: LeadSource; // 来源
  status: LeadStatus; // 状态
  businessType: string; // 意向业务类型（对应 CaseType）
  intention: string; // 意向说明
  amount: number; // 预计金额（分，可选）
  note: string;
  customerId: string; // 转化为客户后回填
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface Log {
  id: string;
  operator: string;
  module: string; // 客户/案件/节点/费用/期限/认证/系统
  action: string; // 新增/修改/删除/收款/完成/登录/登出/导出/导入/更新配置/清空日志
  detail: string;
  createdAt: number;
}

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  secure: boolean;
  enabled: boolean;
}

export interface ContactInfo {
  name: string;
  company: string;
  phone: string;
  email: string;
}

export interface OcrConfig {
  secretId: string;
  secretKey: string;
  region: string;
  enabled: boolean;
}

/** 对外公司展示信息（电子名片） */
export interface CompanyProfile {
  fullName: string; // 公司全称
  shortName: string; // 简称
  address: string; // 注册/办公地址
  scope: string; // 经营范围
  business: string; // 主营业务简介
  icp: string; // ICP 备案号
  website: string; // 官网
  logo: string; // 未启用展示预留
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  fullName: "",
  shortName: "",
  address: "",
  scope: "",
  business: "",
  icp: "",
  website: "",
  logo: "",
};

export interface AppSettings {
  siteTitle: string;
  contact: ContactInfo;
  company: CompanyProfile;
  smtp: SmtpConfig;
  ocr: OcrConfig;
  updatedAt: number;
}

export function defaultSettings(): AppSettings {
  return {
    siteTitle: "IP-CRM 知识产权代理管理",
    contact: { name: "", company: "", phone: "", email: "" },
    company: { ...DEFAULT_COMPANY_PROFILE },
    smtp: { host: "", port: 465, username: "", password: "", from: "", secure: true, enabled: false },
    ocr: { secretId: "", secretKey: "", region: "ap-guangzhou", enabled: false },
    updatedAt: 0,
  };
}

// ---- 派生计算 ----
export function feeReceived(fee: Fee): number {
  return fee.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function feeStatus(fee: Fee): FeeStatus {
  const received = feeReceived(fee);
  if (received <= 0) return "unpaid";
  return received >= fee.amount ? "paid" : "partial";
}

// ---- 校验 ----
export function isValidCaseCategory(type: string, category: string): boolean {
  const set = CATEGORIES_BY_TYPE[type];
  return set !== undefined && (set as readonly string[]).includes(category);
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00"));
}

// ---- 工具 ----
export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

/** 本地时区 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 由 YYYY-MM-DD 加天数得到新日期字符串 */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isValidPositiveAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** 任意值转字符串；null/undefined → 空串 */
export function toStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}
