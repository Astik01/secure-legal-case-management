import { Link, NavLink, Outlet } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';

export function PublicLayout() {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-navy-900' : 'text-slate-600 hover:text-navy-900'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Brand />
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={link}>Home</NavLink>
            <NavLink to="/about" className={link}>About</NavLink>
            {user ? (
              <Link to={homeFor(user.role)}><Button size="sm" className="ml-2">Open dashboard</Button></Link>
            ) : (
              <>
                <NavLink to="/login" className={link}>Sign in</NavLink>
                <Link to="/register"><Button size="sm" className="ml-1">Create account</Button></Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>LexVault: final-year engineering project. Sample cases are public Indian Supreme Court decisions; generated documents are demonstration material only.</p>
          <p>Not legal advice.</p>
        </div>
      </footer>
    </div>
  );
}
