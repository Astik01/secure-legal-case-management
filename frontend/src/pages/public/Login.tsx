import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../services/api';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(from && from !== '/login' ? from : homeFor(user.role), { replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Access your LexVault workspace.</p>
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {serverError && <Alert kind="error">{serverError}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <TextField label="Password" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign in</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          New student? <Link to="/register" className="font-medium text-navy-700 underline">Create an account</Link>
        </p>
      </Card>
    </div>
  );
}
