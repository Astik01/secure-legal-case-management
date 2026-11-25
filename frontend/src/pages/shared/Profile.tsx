import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, Button, Card, PageHeader, TextField } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../services/api';
import { userApi } from '../../services/endpoints';
import { formatDate } from '../../utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100),
  institution: z.string().trim().max(150).optional(),
  enrollmentId: z.string().trim().max(50).optional(),
});
type Form = z.infer<typeof schema>;

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const u = user!;
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: u.name, institution: u.institution ?? '', enrollmentId: u.enrollmentId ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await userApi.update(u._id, values);
      setUser(updated);
      reset({ name: updated.name, institution: updated.institution ?? '', enrollmentId: updated.enrollmentId ?? '' });
      toast.success('Profile updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <>
      <PageHeader title="Profile" description="Your account details." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Institution" error={errors.institution?.message} {...register('institution')} />
              <TextField label="Enrollment ID" error={errors.enrollmentId?.message} {...register('enrollmentId')} />
            </div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt><dd>{u.email}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Role</dt><dd><Badge tone="blue">{u.role}</Badge></dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Member since</dt><dd>{formatDate(u.createdAt)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Last sign-in</dt><dd>{formatDate(u.lastLoginAt, true)}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">Email and role can only be changed by an administrator.</p>
        </Card>
      </div>
    </>
  );
}
