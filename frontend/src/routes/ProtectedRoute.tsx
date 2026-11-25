import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, Spinner } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';
import type { Role } from '../types';

/**
 * Client-side route guard. This is a usability layer only: every API call is authorized again
 * on the server, so bypassing this component never grants access to data.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState icon={<ShieldAlert className="h-10 w-10" />} title="You do not have access to this page"
          description={`Your ${user.role.toLowerCase()} account is not permitted to view this area.`}
          action={<Link to={homeFor(user.role)}><Button>Go to your dashboard</Button></Link>} />
      </div>
    );
  }
  return <Outlet />;
}

/** Keeps signed-in users out of login/register. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
