import { Check, Minus } from 'lucide-react';
import { useState } from 'react';
import { Badge, Card, ConfirmDialog, ErrorState, PageHeader, Pagination, Spinner, Table, Td } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { userApi } from '../../services/endpoints';
import type { Role, User } from '../../types';

const MATRIX: [string, boolean, boolean, boolean][] = [
  ['Browse and search published cases', true, true, true],
  ['View case details, preview and download documents', true, true, true],
  ['Verify document integrity', true, true, true],
  ['Bookmark cases', true, true, true],
  ['Create and edit own cases', false, true, true],
  ['Upload documents and register hashes', false, true, true],
  ['Submit cases for approval', false, true, true],
  ['View relevant audit logs', false, true, true],
  ['Approve or reject submissions', false, false, true],
  ['Archive and delete cases', false, false, true],
  ['Manage users and roles', false, false, true],
  ['View all audit logs, blockchain records, analytics', false, false, true],
];

export default function RoleManagement() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => userApi.list({ page, limit: 10 }), [page]);
  const [pending, setPending] = useState<{ user: User; role: Role } | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await userApi.setRole(pending.user._id, pending.role);
      toast.success(`${pending.user.name} is now ${pending.role.toLowerCase()}`);
      setPending(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Role management" description="Assign roles. Changes take effect on the user's next request." />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Spinner /> : data && (
            <div className="space-y-4">
              <Table headers={['User', 'Current role', 'Change to']} caption="Role assignments">
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <Td><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></Td>
                    <Td><Badge tone="blue">{u.role}</Badge></Td>
                    <Td>
                      {u._id === me!._id ? <span className="text-xs text-slate-400">You cannot change your own role</span> : (
                        <select aria-label={`Change role for ${u.name}`} className="input !w-auto !py-1" value={u.role}
                          onChange={(e) => setPending({ user: u, role: e.target.value as Role })}>
                          <option value="STUDENT">Student</option><option value="FACULTY">Faculty</option><option value="ADMIN">Administrator</option>
                        </select>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
              <Pagination meta={data.meta} onPage={setPage} />
            </div>
          )}
        </div>
        <Card className="xl:col-span-2" padded={false}>
          <div className="px-5 pt-5"><h2 className="text-lg font-semibold">Permission matrix</h2><p className="mt-1 text-xs text-slate-500">Enforced by the API, not only the interface.</p></div>
          <div className="overflow-x-auto p-3">
            <table className="w-full text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2 text-left">Capability</th><th className="px-2">Student</th><th className="px-2">Faculty</th><th className="px-2">Admin</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {MATRIX.map(([label, ...flags]) => (
                  <tr key={label}>
                    <td className="px-2 py-2 text-slate-700">{label}</td>
                    {flags.map((f, i) => (
                      <td key={i} className="px-2 text-center">
                        {f ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="Not allowed" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <ConfirmDialog open={!!pending} loading={busy} onCancel={() => setPending(null)} onConfirm={apply} confirmLabel="Change role"
        danger={pending?.role === 'ADMIN'} title="Change role"
        message={pending ? `Change ${pending.user.name} from ${pending.user.role.toLowerCase()} to ${pending.role.toLowerCase()}?${pending.role === 'ADMIN' ? ' Administrators have full access to the system.' : ''}` : ''} />
    </>
  );
}
