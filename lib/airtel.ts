import { createHash } from "node:crypto";
import { normDate, type NormRecord } from "./sync";

const s = (v: unknown) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);

// "₹1,299.00" / "Rs. 499" / "$12.50" -> { amount: 1299, currency: "INR" }. Original string is kept in `source`.
export function normMoney(v: unknown): { amount: number | null; currency: string | null } {
  const t = s(v);
  const m = t?.match(/(₹|rs\.?|inr|\$|usd|€|eur)?\s*(-?[\d,]+(?:\.\d+)?)/i);
  if (!m) return { amount: null, currency: null };
  const sym = (m[1] ?? "").toLowerCase();
  const currency = sym === "₹" || sym.startsWith("rs") || sym === "inr" ? "INR" : sym === "$" || sym === "usd" ? "USD" : sym === "€" || sym === "eur" ? "EUR" : null;
  return { amount: Number(m[2].replace(/,/g, "")), currency };
}

const TYPES = new Set(["recharge", "bill", "payment", "other"]);

// Key: the portal's own transaction/bill id when shown; else a composite (never date alone).
export function normAirtel(row: Record<string, unknown>): NormRecord {
  const id = s(row.id), date = normDate(row.date), account = s(row.account);
  const { amount, currency } = normMoney(row.amount);
  const t = s(row.type)?.toLowerCase() ?? "other";
  const type = TYPES.has(t) ? t : "other";
  const issues: string[] = [];
  if (!date) issues.push(row.date == null ? "missing date" : `unparseable date: ${String(row.date)}`);
  if (amount == null) issues.push(row.amount == null ? "missing amount" : `unparseable amount: ${String(row.amount)}`);
  const data = { id, date, type, description: s(row.description), amount, currency, status: s(row.status), account, hasInvoice: row.hasInvoice === true, source: row };
  const key = id ? `id:${id}` : date && amount != null ? `${date}|${type}|${amount}|${account ?? ""}` : `UNPARSED|${createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16)}`;
  const { source: _s, ...cmp } = data;
  return { key, hash: createHash("sha256").update(JSON.stringify(cmp)).digest("hex"), status: issues.length ? "incomplete" : "valid", issues, data };
}
