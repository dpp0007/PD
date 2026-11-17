import Link from "next/link";
import { notFound } from "next/navigation";
import { bySlug } from "@/lib/portals";
import Workspace from "./workspace";

export default async function PortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const portal = bySlug(slug);
  if (!portal || !portal.available) notFound();
  return (
    <div className="space-y-6">
      <Link href="/app/portals" className="text-sm text-mute hover:text-ink">← All portals</Link>
      <Workspace portal={portal} />
    </div>
  );
}
