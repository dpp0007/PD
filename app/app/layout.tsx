import { Logo } from "@/components/ui";
import Nav from "./nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3">
          <Logo href="/app" />
          <Nav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}
