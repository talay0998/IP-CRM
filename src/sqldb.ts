// 数据访问层（SQL 版）——Turso / libSQL
// 与 src/db.ts 的 createDb 保持完全一致的方法签名，路由层无需改动。
import type { Client } from "@libsql/client/web";
import type { Customer, Case, CaseActivity, Fee, Deadline, Session, Log, AppSettings, Lead } from "./types.ts";
import { defaultSettings } from "./types.ts";
import type { BackupData } from "./db.ts";

/** 建表：所有业务实体整行以 JSON 存 data 列，需要过滤/排序的字段单独抽列建索引 */
export async function initSchema(client: Client): Promise<void> {
  const stmts = [
    `create table if not exists customers (
      id text primary key,
      data text not null
    )`,
    `create table if not exists cases (
      id text primary key,
      customer_id text not null,
      data text not null
    )`,
    `create index if not exists idx_cases_customer on cases(customer_id)`,
    `create table if not exists activities (
      id text primary key,
      case_id text not null,
      data text not null
    )`,
    `create index if not exists idx_activities_case on activities(case_id)`,
    `create table if not exists fees (
      id text primary key,
      case_id text not null,
      data text not null
    )`,
    `create index if not exists idx_fees_case on fees(case_id)`,
    `create table if not exists deadlines (
      id text primary key,
      case_id text not null,
      data text not null
    )`,
    `create index if not exists idx_deadlines_case on deadlines(case_id)`,
    `create table if not exists leads (
      id text primary key,
      data text not null
    )`,
    `create table if not exists sessions (
      token text primary key,
      expires_at integer not null,
      data text not null
    )`,
    `create table if not exists logs (
      id text primary key,
      created_at integer not null,
      data text not null
    )`,
    `create index if not exists idx_logs_created on logs(created_at desc)`,
    `create table if not exists settings (
      id integer primary key check (id = 1),
      data text not null
    )`,
  ];
  for (const sql of stmts) await client.execute(sql);
}

type Row = Record<string, unknown>;

function parse<T>(rows: Row[]): T[] {
  return rows.map((r) => JSON.parse(String(r.data)) as T);
}

function parseOne<T>(rows: Row[]): T | null {
  return rows.length ? (JSON.parse(String(rows[0].data)) as T) : null;
}

export function createSqlDb(client: Client) {
  const all = async <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
    const rs = await client.execute({ sql, args: args as never });
    return parse<T>(rs.rows as unknown as Row[]);
  };
  const one = async <T>(sql: string, args: unknown[] = []): Promise<T | null> => {
    const rs = await client.execute({ sql, args: args as never });
    return parseOne<T>(rs.rows as unknown as Row[]);
  };
  const run = async (sql: string, args: unknown[] = []): Promise<void> => {
    await client.execute({ sql, args: args as never });
  };

  return {
    // ---- 客户 ----
    listCustomers(): Promise<Customer[]> {
      return all<Customer>("select data from customers");
    },
    getCustomer(id: string): Promise<Customer | null> {
      return one<Customer>("select data from customers where id = ?", [id]);
    },
    async setCustomer(c: Customer): Promise<void> {
      await run(
        "insert into customers (id, data) values (?, ?) on conflict(id) do update set data = excluded.data",
        [c.id, JSON.stringify(c)],
      );
    },
    async deleteCustomer(id: string): Promise<void> {
      await run("delete from customers where id = ?", [id]);
    },

    // ---- 案件 ----
    listCases(): Promise<Case[]> {
      return all<Case>("select data from cases");
    },
    getCase(id: string): Promise<Case | null> {
      return one<Case>("select data from cases where id = ?", [id]);
    },
    async setCase(c: Case): Promise<void> {
      await run(
        "insert into cases (id, customer_id, data) values (?, ?, ?) on conflict(id) do update set customer_id = excluded.customer_id, data = excluded.data",
        [c.id, c.customerId, JSON.stringify(c)],
      );
    },
    async deleteCase(id: string): Promise<void> {
      await run("delete from cases where id = ?", [id]);
    },
    async countCasesByCustomer(customerId: string): Promise<number> {
      const rs = await client.execute({
        sql: "select count(*) as n from cases where customer_id = ?",
        args: [customerId],
      });
      return Number((rs.rows[0] as unknown as Row).n ?? 0);
    },

    // ---- 节点 ----
    listActivities(caseId: string): Promise<CaseActivity[]> {
      return all<CaseActivity>("select data from activities where case_id = ?", [caseId]);
    },
    async setActivity(a: CaseActivity): Promise<void> {
      await run(
        "insert into activities (id, case_id, data) values (?, ?, ?) on conflict(id) do update set case_id = excluded.case_id, data = excluded.data",
        [a.id, a.caseId, JSON.stringify(a)],
      );
    },
    listActivitiesAll(): Promise<CaseActivity[]> {
      return all<CaseActivity>("select data from activities");
    },

    // ---- 费用 ----
    listFees(caseId: string): Promise<Fee[]> {
      return all<Fee>("select data from fees where case_id = ?", [caseId]);
    },
    listFeesAll(): Promise<Fee[]> {
      return all<Fee>("select data from fees");
    },
    getFee(feeId: string): Promise<Fee | null> {
      return one<Fee>("select data from fees where id = ?", [feeId]);
    },
    async setFee(fee: Fee): Promise<void> {
      await run(
        "insert into fees (id, case_id, data) values (?, ?, ?) on conflict(id) do update set case_id = excluded.case_id, data = excluded.data",
        [fee.id, fee.caseId, JSON.stringify(fee)],
      );
    },
    async deleteFee(fee: Fee): Promise<void> {
      await run("delete from fees where id = ?", [fee.id]);
    },

    // ---- 期限 ----
    listDeadlines(): Promise<Deadline[]> {
      return all<Deadline>("select data from deadlines");
    },
    getDeadline(id: string): Promise<Deadline | null> {
      return one<Deadline>("select data from deadlines where id = ?", [id]);
    },
    async setDeadline(d: Deadline): Promise<void> {
      await run(
        "insert into deadlines (id, case_id, data) values (?, ?, ?) on conflict(id) do update set case_id = excluded.case_id, data = excluded.data",
        [d.id, d.caseId, JSON.stringify(d)],
      );
    },
    async deleteDeadline(id: string): Promise<void> {
      await run("delete from deadlines where id = ?", [id]);
    },

    // ---- 销售线索 ----
    listLeads(): Promise<Lead[]> {
      return all<Lead>("select data from leads");
    },
    getLead(id: string): Promise<Lead | null> {
      return one<Lead>("select data from leads where id = ?", [id]);
    },
    async setLead(l: Lead): Promise<void> {
      await run(
        "insert into leads (id, data) values (?, ?) on conflict(id) do update set data = excluded.data",
        [l.id, JSON.stringify(l)],
      );
    },
    async deleteLead(id: string): Promise<void> {
      await run("delete from leads where id = ?", [id]);
    },

    // ---- 会话 ----
    getSession(token: string): Promise<Session | null> {
      return one<Session>("select data from sessions where token = ?", [token]);
    },
    async setSession(s: Session): Promise<void> {
      await run(
        "insert into sessions (token, expires_at, data) values (?, ?, ?) on conflict(token) do update set expires_at = excluded.expires_at, data = excluded.data",
        [s.token, s.expiresAt, JSON.stringify(s)],
      );
    },
    async deleteSession(token: string): Promise<void> {
      await run("delete from sessions where token = ?", [token]);
    },

    // ---- 操作日志 ----
    async addLog(log: Log): Promise<void> {
      await run(
        "insert into logs (id, created_at, data) values (?, ?, ?) on conflict(id) do update set created_at = excluded.created_at, data = excluded.data",
        [log.id, log.createdAt, JSON.stringify(log)],
      );
    },
    listLogs(limit = 200): Promise<Log[]> {
      return all<Log>("select data from logs order by created_at desc limit ?", [limit]);
    },
    async clearLogs(): Promise<void> {
      await run("delete from logs");
    },

    // ---- 系统设置 ----
    getSettings(): Promise<AppSettings | null> {
      return one<AppSettings>("select data from settings where id = 1");
    },
    async setSettings(s: AppSettings): Promise<void> {
      await run(
        "insert into settings (id, data) values (1, ?) on conflict(id) do update set data = excluded.data",
        [JSON.stringify(s)],
      );
    },

    // ---- 备份 / 导入导出 ----
    async listAllData(): Promise<BackupData> {
      const [customers, cases, activities, fees, deadlines, leads, settings] = await Promise.all([
        this.listCustomers(),
        this.listCases(),
        this.listActivitiesAll(),
        this.listFeesAll(),
        this.listDeadlines(),
        this.listLeads(),
        this.getSettings(),
      ]);
      return { customers, cases, activities, fees, deadlines, leads, settings: settings ?? defaultSettings() };
    },
    async clearBusinessData(): Promise<void> {
      await client.batch(
        [
          "delete from customers",
          "delete from cases",
          "delete from activities",
          "delete from fees",
          "delete from deadlines",
          "delete from leads",
          "delete from settings",
        ],
        "write",
      );
    },
    async importAllData(data: BackupData): Promise<void> {
      await this.clearBusinessData();
      const stmts: { sql: string; args: unknown[] }[] = [];
      for (const c of data.customers) {
        stmts.push({ sql: "insert into customers (id, data) values (?, ?)", args: [c.id, JSON.stringify(c)] });
      }
      for (const c of data.cases) {
        stmts.push({
          sql: "insert into cases (id, customer_id, data) values (?, ?, ?)",
          args: [c.id, c.customerId, JSON.stringify(c)],
        });
      }
      for (const a of data.activities) {
        stmts.push({
          sql: "insert into activities (id, case_id, data) values (?, ?, ?)",
          args: [a.id, a.caseId, JSON.stringify(a)],
        });
      }
      for (const f of data.fees) {
        stmts.push({
          sql: "insert into fees (id, case_id, data) values (?, ?, ?)",
          args: [f.id, f.caseId, JSON.stringify(f)],
        });
      }
      for (const d of data.deadlines) {
        stmts.push({
          sql: "insert into deadlines (id, case_id, data) values (?, ?, ?)",
          args: [d.id, d.caseId, JSON.stringify(d)],
        });
      }
      for (const l of data.leads ?? []) {
        stmts.push({ sql: "insert into leads (id, data) values (?, ?)", args: [l.id, JSON.stringify(l)] });
      }
      if (data.settings) {
        stmts.push({ sql: "insert into settings (id, data) values (1, ?)", args: [JSON.stringify(data.settings)] });
      }
      if (stmts.length) await client.batch(stmts as never, "write");
    },

    // ---- 级联删除（ADD-COUP-001）----
    /** 删除客户及其名下所有案件、节点、费用、期限；返回删除的案件数 */
    async deleteCustomerCascade(customerId: string): Promise<number> {
      const rs = await client.execute({
        sql: "select count(*) as n from cases where customer_id = ?",
        args: [customerId],
      });
      const caseCount = Number((rs.rows[0] as unknown as Row).n ?? 0);
      const sub = "select id from cases where customer_id = ?";
      await client.batch(
        [
          { sql: `delete from activities where case_id in (${sub})`, args: [customerId] },
          { sql: `delete from fees where case_id in (${sub})`, args: [customerId] },
          { sql: `delete from deadlines where case_id in (${sub})`, args: [customerId] },
          { sql: "delete from cases where customer_id = ?", args: [customerId] },
          { sql: "delete from customers where id = ?", args: [customerId] },
        ] as never,
        "write",
      );
      return caseCount;
    },

    /** 删除案件及其节点、费用、期限 */
    async deleteCaseCascade(caseId: string): Promise<void> {
      await client.batch(
        [
          { sql: "delete from activities where case_id = ?", args: [caseId] },
          { sql: "delete from fees where case_id = ?", args: [caseId] },
          { sql: "delete from deadlines where case_id = ?", args: [caseId] },
          { sql: "delete from cases where id = ?", args: [caseId] },
        ] as never,
        "write",
      );
    },

    client,
  };
}

export type SqlDb = ReturnType<typeof createSqlDb>;
