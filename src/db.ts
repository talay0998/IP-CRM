// 数据访问层（MDD-MOD-002）——Deno KV 前缀封装
import type { Customer, Case, CaseActivity, Fee, Deadline, Session, Log, AppSettings, Lead } from "./types.ts";

export type Kv = Deno.Kv;

export interface BackupData {
  customers: Customer[];
  cases: Case[];
  activities: CaseActivity[];
  fees: Fee[];
  deadlines: Deadline[];
  leads: Lead[];
  settings: AppSettings;
}

export function createDb(kv: Kv) {
  return {
    // ---- 客户 ----
    async listCustomers(): Promise<Customer[]> {
      const out: Customer[] = [];
      for await (const e of kv.list<Customer>({ prefix: ["customers"] })) out.push(e.value);
      return out;
    },
    async getCustomer(id: string): Promise<Customer | null> {
      return (await kv.get<Customer>(["customers", id])).value ?? null;
    },
    async setCustomer(c: Customer): Promise<void> {
      await kv.set(["customers", c.id], c);
    },
    async deleteCustomer(id: string): Promise<void> {
      await kv.delete(["customers", id]);
    },

    // ---- 案件 ----
    async listCases(): Promise<Case[]> {
      const out: Case[] = [];
      for await (const e of kv.list<Case>({ prefix: ["cases"] })) out.push(e.value);
      return out;
    },
    async getCase(id: string): Promise<Case | null> {
      return (await kv.get<Case>(["cases", id])).value ?? null;
    },
    async setCase(c: Case): Promise<void> {
      await kv.set(["cases", c.id], c);
    },
    async deleteCase(id: string): Promise<void> {
      await kv.delete(["cases", id]);
    },
    async countCasesByCustomer(customerId: string): Promise<number> {
      let n = 0;
      for await (const e of kv.list<Case>({ prefix: ["cases"] })) {
        if (e.value.customerId === customerId) n++;
      }
      return n;
    },

    // ---- 节点 ----
    async listActivities(caseId: string): Promise<CaseActivity[]> {
      const out: CaseActivity[] = [];
      for await (const e of kv.list<CaseActivity>({ prefix: ["activities", caseId] })) {
        out.push(e.value);
      }
      return out;
    },
    async setActivity(a: CaseActivity): Promise<void> {
      await kv.set(["activities", a.caseId, a.id], a);
    },
    async listActivitiesAll(): Promise<CaseActivity[]> {
      const out: CaseActivity[] = [];
      for await (const e of kv.list<CaseActivity>({ prefix: ["activities"] })) out.push(e.value);
      return out;
    },

    // ---- 费用 ----
    async listFees(caseId: string): Promise<Fee[]> {
      const out: Fee[] = [];
      for await (const e of kv.list<Fee>({ prefix: ["fees", caseId] })) out.push(e.value);
      return out;
    },
    async listFeesAll(): Promise<Fee[]> {
      const out: Fee[] = [];
      for await (const e of kv.list<Fee>({ prefix: ["fees"] })) out.push(e.value);
      return out;
    },
    async getFee(feeId: string): Promise<Fee | null> {
      // 需先定位 caseId：遍历 fees 前缀找 id
      for await (const e of kv.list<Fee>({ prefix: ["fees"] })) {
        if (e.value.id === feeId) return e.value;
      }
      return null;
    },
    async setFee(fee: Fee): Promise<void> {
      await kv.set(["fees", fee.caseId, fee.id], fee);
    },
    async deleteFee(fee: Fee): Promise<void> {
      await kv.delete(["fees", fee.caseId, fee.id]);
    },

    // ---- 期限 ----
    async listDeadlines(): Promise<Deadline[]> {
      const out: Deadline[] = [];
      for await (const e of kv.list<Deadline>({ prefix: ["deadlines"] })) out.push(e.value);
      return out;
    },
    async getDeadline(id: string): Promise<Deadline | null> {
      return (await kv.get<Deadline>(["deadlines", id])).value ?? null;
    },
    async setDeadline(d: Deadline): Promise<void> {
      await kv.set(["deadlines", d.id], d);
    },
    async deleteDeadline(id: string): Promise<void> {
      await kv.delete(["deadlines", id]);
    },

    // ---- 销售线索 ----
    async listLeads(): Promise<Lead[]> {
      const out: Lead[] = [];
      for await (const e of kv.list<Lead>({ prefix: ["leads"] })) out.push(e.value);
      return out;
    },
    async getLead(id: string): Promise<Lead | null> {
      return (await kv.get<Lead>(["leads", id])).value ?? null;
    },
    async setLead(l: Lead): Promise<void> {
      await kv.set(["leads", l.id], l);
    },
    async deleteLead(id: string): Promise<void> {
      await kv.delete(["leads", id]);
    },

    // ---- 会话 ----
    async getSession(token: string): Promise<Session | null> {
      return (await kv.get<Session>(["sessions", token])).value ?? null;
    },
    async setSession(s: Session): Promise<void> {
      await kv.set(["sessions", s.token], s);
    },
    async deleteSession(token: string): Promise<void> {
      await kv.delete(["sessions", token]);
    },

    // ---- 操作日志 ----
    async addLog(log: Log): Promise<void> {
      await kv.set(["logs", log.id], log);
    },
    async listLogs(limit = 200): Promise<Log[]> {
      const out: Log[] = [];
      for await (const e of kv.list<Log>({ prefix: ["logs"] })) out.push(e.value);
      out.sort((a, b) => b.createdAt - a.createdAt);
      return out.slice(0, limit);
    },
    async clearLogs(): Promise<void> {
      const it = kv.list({ prefix: ["logs"] });
      for await (const e of it) await kv.delete(e.key);
    },

    // ---- 系统设置 ----
    async getSettings(): Promise<AppSettings | null> {
      return (await kv.get<AppSettings>(["settings"])).value ?? null;
    },
    async setSettings(s: AppSettings): Promise<void> {
      await kv.set(["settings"], s);
    },

    // ---- 备份 / 导入导出 ----
    async listAllData(): Promise<BackupData> {
      const customers: Customer[] = [];
      const cases: Case[] = [];
      const activities: CaseActivity[] = [];
      const fees: Fee[] = [];
      const deadlines: Deadline[] = [];
      const leads: Lead[] = [];
      for await (const e of kv.list<Customer>({ prefix: ["customers"] })) customers.push(e.value);
      for await (const e of kv.list<Case>({ prefix: ["cases"] })) cases.push(e.value);
      for await (const e of kv.list<CaseActivity>({ prefix: ["activities"] })) activities.push(e.value);
      for await (const e of kv.list<Fee>({ prefix: ["fees"] })) fees.push(e.value);
      for await (const e of kv.list<Deadline>({ prefix: ["deadlines"] })) deadlines.push(e.value);
      for await (const e of kv.list<Lead>({ prefix: ["leads"] })) leads.push(e.value);
      const settings = await this.getSettings();
      return {
        customers,
        cases,
        activities,
        fees,
        deadlines,
        leads,
        settings: settings ?? { siteTitle: "IP-CRM 知识产权代理管理", contact: { name: "", company: "", phone: "", email: "" }, company: { fullName: "", shortName: "", address: "", scope: "", business: "", icp: "", website: "", logo: "" }, smtp: { host: "", port: 465, username: "", password: "", from: "", secure: true, enabled: false }, ocr: { secretId: "", secretKey: "", region: "ap-guangzhou", enabled: false }, updatedAt: 0 },
      };
    },
    async clearBusinessData(): Promise<void> {
      for (const prefix of ["customers", "cases", "activities", "fees", "deadlines", "leads", "settings"]) {
        const it = kv.list({ prefix: [prefix] });
        for await (const e of it) await kv.delete(e.key);
      }
    },
    async importAllData(data: BackupData): Promise<void> {
      await this.clearBusinessData();
      for (const c of data.customers) await kv.set(["customers", c.id], c);
      for (const c of data.cases) await kv.set(["cases", c.id], c);
      for (const a of data.activities) await kv.set(["activities", a.caseId, a.id], a);
      for (const f of data.fees) await kv.set(["fees", f.caseId, f.id], f);
      for (const d of data.deadlines) await kv.set(["deadlines", d.id], d);
      for (const l of data.leads ?? []) await kv.set(["leads", l.id], l);
      if (data.settings) await kv.set(["settings"], data.settings);
    },

    // ---- 级联删除（ADD-COUP-001）----
    /** 删除客户及其名下所有案件、节点、费用、期限；返回删除的案件数 */
    async deleteCustomerCascade(customerId: string): Promise<number> {
      const op = kv.atomic();
      op.delete(["customers", customerId]);
      let caseCount = 0;
      for await (const e of kv.list<Case>({ prefix: ["cases"] })) {
        if (e.value.customerId !== customerId) continue;
        caseCount++;
        op.delete(e.key);
        for await (const a of kv.list({ prefix: ["activities", e.value.id] })) op.delete(a.key);
        for await (const f of kv.list({ prefix: ["fees", e.value.id] })) op.delete(f.key);
        for await (const d of kv.list<Deadline>({ prefix: ["deadlines"] })) {
          if (d.value.caseId === e.value.id) op.delete(d.key);
        }
      }
      await op.commit();
      return caseCount;
    },

    /** 删除案件及其节点、费用、期限 */
    async deleteCaseCascade(caseId: string): Promise<void> {
      const op = kv.atomic();
      op.delete(["cases", caseId]);
      for await (const a of kv.list({ prefix: ["activities", caseId] })) op.delete(a.key);
      for await (const f of kv.list({ prefix: ["fees", caseId] })) op.delete(f.key);
      for await (const d of kv.list<Deadline>({ prefix: ["deadlines"] })) {
        if (d.value.caseId === caseId) op.delete(d.key);
      }
      await op.commit();
    },

    kv,
  };
}

/**
 * 数据访问接口：仅包含业务方法，不含底层存储句柄（kv / client），
 * 以便 KV 版（createDb）与 SQL 版（createSqlDb）可互换使用。
 */
export type Db = Omit<ReturnType<typeof createDb>, "kv">;
