import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, TextField } from '../../components/ui';
import { homeFor, useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApiError, errorMessage } from '../../services/api';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(100),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirm: z.string(),
    institution: z.string().trim().max(150).optional(),
    enrollmentId: z.string().trim().max(50).optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Form = z.infer<typeof registerSchema>;

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async ({ confirm: _confirm, ...values }) => {
    setServerError(null);
    try {
      const user = await signUp(values);
      toast.success('Account created. Welcome to LexVault.');
      navigate(homeFor(user.role), { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('email', { message: e.message });
      else setServerError(errorMessage(e));
    }
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <h1 className="text-2xl font-semibold">Create a student account</h1>
        <p className="mt-1 text-sm text-slate-600">Faculty and administrator accounts are issued by your institution administrator.</p>
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          {serverError && <Alert kind="error">{serverError}</Alert>}
          <TextField label="Full name" autoComplete="name" required error={errors.name?.message} {...register('name')} />
          <TextField label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Password" type="password" autoComplete="new-password" required error={errors.password?.message}
              hint="8+ characters with a letter and a number" {...register('password')} />
            <TextField label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Institution" error={errors.institution?.message} {...register('institution')} />
            <TextField label="Enrollment ID" error={errors.enrollmentId?.message} {...register('enrollmentId')} />
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>Create account</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered? <Link to="/login" className="font-medium text-navy-700 underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
