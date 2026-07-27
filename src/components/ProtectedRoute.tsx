import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requireRole?: 'admin' | 'installer';
}

const ProtectedRoute = ({ children, requireRole }: Props) => {
  const { user, loading, roles } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && !roles.includes(requireRole)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-4 text-center">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
};

export default ProtectedRoute;
