import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Badge } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { navFor } from './nav';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;

  const sections = navFor[user.role];
  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  const sidebar = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-navy-300">{s.title}</p>}
          <ul className="space-y-0.5">
            {s.items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10 hover:text-white'
                    }`
                  }>
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="px-5 py-5"><Brand to={homeFor(user.role)} light /></div>
        <div className="min-h-0 flex-1">{sidebar}</div>
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-72 flex-col bg-navy-900">
            <div className="flex items-center justify-between px-5 py-5">
              <Brand to={homeFor(user.role)} light />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded p-1 text-slate-600 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <Badge tone="blue">{roleLabel}</Badge>
            <button
              onClick={async () => {
                await logout();
                toast.info('You have been signed out');
                navigate('/login');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </header>
        <main id="content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
