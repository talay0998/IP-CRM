// 业务期限规则库：根据业务类型/子类 + 申请日期，推荐官方期限与提醒类型
import { addDaysStr, todayStr, type CaseType } from "./types.ts";

export interface RuleInput {
  type: string;
  category: string;
  date?: string; // 起算日期 YYYY-MM-DD
}

export interface RuleSuggestion {
  title: string;
  deadlineType: "renewal" | "official_reply" | "fee";
  note: string;
}

/**
 * 官方期限规则：
 * - 商标：注册申请 → 初审公告后 3 个月异议期；有效期 10 年，续展提前 12 个月 / 宽展 6 个月
 * - 版权：作品登记一般 60 日内补正/审查；软件著作权登记 60 日
 * - 其他业务提供通用建议
 */
export function suggestedDeadlines(input: RuleInput): RuleSuggestion[] {
  const { type, category, date } = input;
  const base = date || todayStr();
  const list: RuleSuggestion[] = [];

  switch (type) {
    case "trademark":
      if (category === "注册申请") {
        list.push({
          title: "初审公告后异议期",
          deadlineType: "official_reply",
          note: "商标初审公告之日起 3 个月内可提出异议（按公告日起算）",
        });
      }
      list.push({
        title: "商标续展提醒",
        deadlineType: "renewal",
        note: "注册商标有效期 10 年，期满前 12 个月可办理续展，宽展期 6 个月",
      });
      break;
    case "copyright":
      list.push({
        title: "作品登记审查答复",
        deadlineType: "official_reply",
        note: "登记机构自受理之日起 60 日内完成审查；补正材料应在通知之日起 30 日内提交",
      });
      break;
    case "software-copyright":
      list.push({
        title: "软件著作权审查答复",
        deadlineType: "official_reply",
        note: "自受理之日起 60 日内审查，可申请加急",
      });
      break;
    case "registration":
      if (category === "年报") {
        list.push({
          title: "企业年报提交",
          deadlineType: "official_reply",
          note: "每年 1 月 1 日至 6 月 30 日通过国家企业信用信息公示系统报送上一年度报告",
        });
      }
      break;
    case "legal-consult":
    case "software":
    case "service":
      list.push({
        title: "合同履行节点",
        deadlineType: "official_reply",
        note: "按合同约定节点跟进，可在此补充具体到期日",
      });
      break;
    default:
      break;
  }

  // 通用：基于起算日期给出默认死线（防止空返回，便于演示）
  if (list.length === 0) {
    list.push({
      title: "业务进度跟进",
      deadlineType: "official_reply",
      note: "根据业务进度自行设置具体到期日（起算 " + base + "）",
    });
  }

  return list;
}

/** 由起算日期 + 天数生成的到期日（供前端直接用） */
export function dueFromBase(base: string, days: number): string {
  return addDaysStr(base, days);
}
