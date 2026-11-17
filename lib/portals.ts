// Client-safe portal metadata. `verified` stays null until a real, user-authorized test succeeds.
export type Col = { key: string; label: string };
export type Portal = {
  slug: string;
  name: string;
  category: string;
  site: string;
  dataTypes: string[];
  available: boolean; // an extraction engine exists (NOT the same as verified)
  engines?: ("agent" | "script")[]; // which extraction engines this portal offers (first = default)
  auth: "op" | "sms" | null; // op = 1Password CLI TOTP; sms = you type the SMS code
  authNote: string;
  collects: string; // what one run collects, shown before consent
  columns: Col[];
  limits: string;
  verified: null | { at: string; notes: string };
};

export const PORTALS: Portal[] = [
  {
    slug: "galgotias-erp", name: "Galgotias University ERP", category: "Education", site: "gustudent.icloudems.com",
    dataTypes: ["Attendance"], available: true, engines: ["script", "agent"], auth: "op",
    authNote: "Mobile number + authenticator code. PortalDump reads the current 6-digit code from your 1Password app on this computer; the secret never leaves 1Password.",
    collects: "Day-wise attendance (every lecture slot marked present or absent) for your currently selected semester.",
    columns: [{ key: "date", label: "Date" }, { key: "slot", label: "Lecture slot" }, { key: "course", label: "Course" }, { key: "status", label: "Status" }],
    limits: "Current semester only for now. Results, fees and receipts are not built yet.",
    verified: { at: "2026-11-17", notes: "Confirmed working on a real account by the owner." },
  },
  {
    slug: "airtel", name: "Airtel Thanks", category: "Telecom", site: "airtel.in",
    dataTypes: ["Payments", "Recharges", "Bills"], available: true, auth: "sms",
    authNote: "Mobile number + SMS code. You type the code here; PortalDump forwards it into the secure browser session and does not store it.",
    collects: "Payment, recharge and bill history shown on your Airtel account web pages. Invoice PDFs are not downloaded.",
    columns: [{ key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "description", label: "Description" }, { key: "amount", label: "Amount" }, { key: "status", label: "Status" }, { key: "id", label: "Reference" }],
    limits: "Airtel may block automated browsers; if so the run reports it and nothing is exported.",
    verified: { at: "2026-11-17", notes: "Confirmed working on a real account by the owner." },
  },
  { slug: "amazon-in", name: "Amazon India", category: "Shopping", site: "amazon.in", dataTypes: ["Orders", "Invoices"], available: false, auth: null, authNote: "", collects: "", columns: [], limits: "Planned.", verified: null },
  { slug: "uppcl", name: "UPPCL", category: "Utilities", site: "uppcl.org", dataTypes: ["Electricity bills"], available: false, auth: null, authNote: "", collects: "", columns: [], limits: "Planned.", verified: null },
  { slug: "irctc", name: "IRCTC", category: "Travel", site: "irctc.co.in", dataTypes: ["Bookings", "Tickets"], available: false, auth: null, authNote: "", collects: "", columns: [], limits: "Planned.", verified: null },
  { slug: "jio", name: "Jio", category: "Telecom", site: "jio.com", dataTypes: ["Bills", "Recharges"], available: false, auth: null, authNote: "", collects: "", columns: [], limits: "Planned.", verified: null },
];
export const bySlug = (s: string) => PORTALS.find((p) => p.slug === s);
export const status = (p: Portal) => (p.verified ? "Verified working" : p.available ? "Not yet verified" : "Planned");
