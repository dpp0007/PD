import "server-only";
import type { Page } from "playwright-core";

export type Ctl = { cancelled: () => boolean; progress: (msg: string, n: number) => void };
export type Row = { date: string; slot: string; course: string | null; status: string };

const pad = (n: number | string) => String(n).padStart(2, "0");

// Read-only: clicks the portal's own Attendance link, then for each month presses Search and reads the grid.
// (Direct URL access is rejected by the portal, so we always navigate by clicking.)
export async function scrapeAttendance(page: Page, ctl: Ctl, opts: { since?: string } = {}) {
  const rows: Row[] = [];
  const notes: string[] = [];
  let complete = true;

  await page.locator('a:has-text("Attendance")').first().click({ timeout: 15000 });
  await page.waitForURL((u: URL) => u.pathname.includes("myattendance"), { timeout: 20000 });
  await page.locator("#month").waitFor({ timeout: 20000 });
  await page.waitForTimeout(2000);

  // Optional: show course names in the grid (a view toggle only).
  let courseNames = false;
  try { // find the checkbox that shares a container with the "Show Course Name" label and switch it on
    courseNames = (await page.evaluate(`(() => {
      const el = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /Show Course Name/i.test(e.textContent || ""));
      for (let p = el, i = 0; p && i < 6; p = p.parentElement, i++) {
        const c = p.querySelector('input[type="checkbox"]');
        if (c) { if (!c.checked) c.click(); return c.checked; }
      }
      return false;
    })()`)) === true;
  } catch { /* handled below */ }
  if (!courseNames) notes.push("Could not switch on 'Show Course Name'; course names not collected.");

  const sem = await page.locator("#semNum option:checked").first().innerText().catch(() => "?");
  const acad = await page.locator("#acadyear option:checked").first().innerText().catch(() => "?");
  const months = (await page.locator("#month option").allInnerTexts()).map((t) => t.trim()).filter((t) => t && !/^select/i.test(t));
  const monthIdx = (name: string) => months.indexOf(name) + 1;
  const checked: string[] = [];
  let sample = "";

  for (const [i, name] of months.entries()) {
    if (ctl.cancelled()) { complete = false; notes.push("Cancelled before all months were read."); break; }
    if (opts.since) { // incremental: skip months before `since` (year inferred from the selected academic year)
      const y0 = parseInt(acad, 10) || new Date().getFullYear(), mi = monthIdx(name);
      if (`${mi >= 7 ? y0 : y0 + 1}-${pad(mi)}` < opts.since) { ctl.progress(`Skipping ${name} (already collected)`, i); continue; }
    }
    ctl.progress(`Reading ${name}`, i);
    try {
      await page.selectOption("#month", { label: name });
      await page.waitForTimeout(1200);
      let from = await page.inputValue("#from_date"), to = await page.inputValue("#to_date");
      const m = monthIdx(name);
      if (!from.includes(`/${pad(m)}/`)) { // portal did not auto-fill: use first/last day of this month in the academic year
        const y0 = parseInt(acad, 10) || new Date().getFullYear();
        const y = m >= 7 ? y0 : y0 + 1;
        from = `01/${pad(m)}/${y}`;
        to = `${pad(new Date(y, m, 0).getDate())}/${pad(m)}/${y}`;
        await page.fill("#from_date", from); await page.fill("#to_date", to);
      }
      const year = from.split("/")[2];
      await page.click("#getattendance");
      await page.waitForTimeout(3500);
      const grid = (await page.evaluate(`(() => {
        const t = [...document.querySelectorAll("table")].find((t) => /Lecture Timings/i.test(t.innerText));
        if (!t) return null;
        const cells = (r) => [...r.cells].map((c) => ({ text: c.innerText.trim(), title: (c.querySelector("[title]") || c).getAttribute("title") || "", html: c.innerHTML.length < 300 ? c.innerHTML : "" }));
        return { heads: [...t.rows[0].cells].map((c) => c.innerText.trim()), body: [...t.rows].slice(1).map(cells) };
      })()`)) as null | { heads: string[]; body: { text: string; title: string; html: string }[][] };
      if (!grid) continue; // no table for this month
      let got = 0;
      for (const r of grid.body) {
        const slot = r[0]?.text.replace(/\s+/g, " ");
        if (!slot || /^total$/i.test(slot)) continue;
        for (let j = 1; j < grid.heads.length - 1; j++) {
          const dm = grid.heads[j].match(/^(\d{1,2})\/(\d{1,2})$/);
          const cell = r[j];
          if (!dm || !cell?.text) continue;
          const lines = cell.text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
          const status = (lines[0] ?? "").slice(0, 12);
          if (!status) continue;
          const course = (lines.slice(1).join(" ") || cell.title || "").trim() || null;
          if (!sample && !course) sample = (cell.html || cell.text).replace(/\s+/g, " ").slice(0, 160);
          rows.push({ date: `${pad(dm[1])}/${pad(dm[2])}/${year}`, slot, course: courseNames ? course : null, status });
          got++;
        }
      }
      if (got) checked.push(name);
    } catch (e) {
      complete = false;
      notes.push(`${name}: ${(e as Error).message.split("\n")[0].slice(0, 100)}`);
    }
  }
  if (opts.since) notes.push(`Incremental scan from ${opts.since} onward.`);
  notes.unshift(`Academic year ${acad}, semester ${sem} (currently selected). Months with data: ${checked.join(", ") || "none"}.`);
  if (courseNames && rows.length && !rows.some((r) => r.course)) notes.push(`Course names not visible in cells (sample: ${sample || "n/a"}).`);
  return { loggedIn: true, blocker: null as string | null, attendance: rows, monthsCollected: checked, complete, notes: notes.join(" ") };
}
