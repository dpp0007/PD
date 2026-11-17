"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [["/app", "Dashboard"], ["/app/portals", "Portals"], ["/app/settings", "Settings & privacy"]];

export default function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 text-sm">
      {LINKS.map(([href, label]) => {
        const on = href === "/app" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${on ? "bg-ink font-medium text-bg" : "text-mute hover:text-ink"}`}>{label}</Link>
        );
      })}
    </nav>
  );
}
