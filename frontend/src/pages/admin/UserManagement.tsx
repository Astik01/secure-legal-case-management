import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, SelectField, Spinner, Table, Td, TextField,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { ApiError, errorMessage } from '../../services/api';
import { userApi } from '../../services/endpoints';
import type { User } from '../../types';
import { formatDate } from '../../utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']),
  institution: z.string().trim().max(150).optional(),
});
type Form = z.infer<typeof schema>;

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { role: 'FACULTY' },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await userApi.create(v);
      toast.success('User created');
      reset();
      onCreated();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('email', { message: e.message });
      else toast.error(errorMessage(e));
    }
  });
  return (
    <Modal open={open} onClose={onClose} title="Create user"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={isSubmitting}>Create user</Button></>}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" required error={errors.email?.message} {...register('email')} />
        <TextField label="Temporary password" type="password" autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
        <SelectField label="Role" error={errors.role?.message} {...register('role')}>
          <option value="STUDENT">Student</option><option value="FACULTY">Faculty</option><option value="ADMIN">Administrator</option>
        </SelectField>
        <TextField label="Institution" error={errors.institution?.message} {...register('institution')} />
        <button type="submit" className="sr-only" tabIndex={-1}>Submit</button>
      </form>
    </Modal>
  );
}

export default function UserManagement() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [toggle, setToggle] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(
    () => userApi.list({ page, limit: 10, ...(q ? { search: q } : {}), ...(role ? { role } : {}), ...(active ? { isActive: active } : {}) }),
    [page, q, role, active]);

  const confirmToggle = async () => {
    if (!toggle) return;
    setBusy(true);
    try {
      await userApi.setStatus(toggle._id, !toggle.isActive);
      toast.success(toggle.isActive ? 'User deactivated' : 'User activated');
      setToggle(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="User management" description="Create accounts and control who can sign in."
        actions={<Button onClick={() => setCreating(true)} icon={<UserPlus className="h-4 w-4" />}>Create user</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="us" className="label">Search</label><input id="us" className="input" placeholder="Name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <div><label htmlFor="ur" className="label">Role</label>
          <select id="ur" className="input" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option><option value="STUDENT">Student</option><option value="FACULTY">Faculty</option><option value="ADMIN">Administrator</option>
          </select></div>
        <div><label htmlFor="ua" className="label">Status</label>
          <select id="ua" className="input" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
            <option value="">All</option><option value="true">Active</option><option value="false">Deactivated</option>
          </select></div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? <EmptyState icon={<Users className="h-10 w-10" />} title="No users match" />
        : data && (
          <div className="space-y-4">
            <Table headers={['Name', 'Role', 'Status', 'Last sign-in', 'Joined', 'Actions']} caption="Users">
              {data.items.map((u) => (
                <tr key={u._id}>
                  <Td><p className="font-medium text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></Td>
                  <Td><Badge tone="blue">{u.role}</Badge></Td>
                  <Td>{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</Td>
                  <Td>{formatDate(u.lastLoginAt, true)}</Td>
                  <Td>{formatDate(u.createdAt)}</Td>
                  <Td>
                    {u._id === me!._id ? <span className="text-xs text-slate-400">You</span> : (
                      <Button size="sm" variant={u.isActive ? 'secondary' : 'primary'} onClick={() => setToggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={data.meta} onPage={setPage} />
          </div>
        )}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
      <ConfirmDialog open={!!toggle} danger={!!toggle?.isActive} loading={busy} onCancel={() => setToggle(null)} onConfirm={confirmToggle}
        title={toggle?.isActive ? 'Deactivate account' : 'Activate account'} confirmLabel={toggle?.isActive ? 'Deactivate' : 'Activate'}
        message={toggle?.isActive ? `${toggle.name} will be signed out and unable to sign in until reactivated.` : `${toggle?.name} will be able to sign in again.`} />
    </>
  );
}
