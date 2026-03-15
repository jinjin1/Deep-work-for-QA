import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deep Work for QA',
  description: 'Bug reporting and visual regression testing powered by AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text-primary antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-10 py-8 max-w-5xl">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-surface px-5 py-6 flex flex-col">
      <div className="mb-10">
        <h1 className="text-base font-bold tracking-tight text-text-primary">Deep Work</h1>
        <p className="text-[11px] text-text-muted tracking-wide uppercase mt-0.5">for QA</p>
      </div>
      <nav className="flex flex-col gap-0.5 flex-1 text-sm">
        <NavItem href="/" label="Dashboard" />
        <NavItem href="/bug-reports" label="Bug Reports" />
      </nav>
      <div className="pt-4 border-t border-border">
        <NavItem href="/settings" label="Settings" />
      </div>
    </aside>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block px-3 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg transition-colors"
    >
      {label}
    </a>
  );
}
