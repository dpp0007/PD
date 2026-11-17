import "./globals.css";

export const metadata = { title: "PortalDump", description: "Your data. Your files. Your control." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
