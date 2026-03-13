import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deep Work - AI Native QA Platform',
  description: 'Bug reporting, session replay, and visual regression testing powered by AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="w-60 border-r border-gray-200 bg-white p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-indigo-600">Deep Work</h1>
        <p className="text-xs text-gray-400 mt-1">AI Native QA Platform</p>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        <NavItem href="/" icon="📊" label="대시보드" />
        <NavItem href="/bug-reports" icon="🐛" label="버그 리포트" />
        <NavItem href="/sessions" icon="🎬" label="세션 리플레이" />
        <NavItem href="/visual" icon="👁" label="시각적 테스트" />
      </nav>
      <div className="pt-4 border-t border-gray-200">
        <NavItem href="/settings" icon="⚙" label="설정" />
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
