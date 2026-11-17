"use client";
import { useState } from "react";
import { PORTALS } from "@/lib/portals";

export default function Settings() {
  const [msg, setMsg] = useState("");
  async function wipe(portal?: string) {
    if (!confirm(portal ? "Delete this portal's runs and records? This cannot be undone." : "Delete ALL runs and records for every portal? This cannot be undone.")) return;
    await fetch("/api/runs" + (portal ? `?portal=${portal}` : ""), { method: "DELETE" });
    setMsg("Deleted.");
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings &amp; privacy</h1>
        <p className="mt-1 text-sm text-mute">What PortalDump keeps, and how to remove it.</p>
      </div>

      <section className="card divide-y divide-line">
        {[
          ["Passwords and authenticator secrets", "Never stored. 1Password portals: the 6-digit code is read from your own 1Password app at sign-in time. SMS portals: you type the code once and it is not kept."],
          ["Sign-in sessions", "A temporary browser profile is created for each run and deleted when the run ends or is cancelled."],
          ["Collected records", "Stored on this computer in the app's data folder until you delete them. Nothing is sent to an AI service other than the TinyFish browser agent doing the collection."],
          ["Documents", "No file downloads yet. TinyFish documents no download API, so PDFs and invoices are not collected."],
          ["Retention", "Records stay until you delete them here."],
        ].map(([t, d]) => (
          <div key={t} className="px-4 py-3.5"><div className="font-medium">{t}</div><p className="mt-1 text-sm text-mute">{d}</p></div>
        ))}
      </section>

      <section>
        <h2 className="label mb-3">Delete your data</h2>
        <div className="card divide-y divide-line">
          {PORTALS.filter((p) => p.available).map((p) => (
            <div key={p.slug} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm font-medium">{p.name}</span>
              <button onClick={() => wipe(p.slug)} className="btn-danger">Delete data</button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm font-medium">Everything</span>
            <button onClick={() => wipe()} className="btn-danger">Delete all data</button>
          </div>
        </div>
        <p aria-live="polite" className="mt-3 text-sm text-accent">{msg}</p>
      </section>
    </div>
  );
}
