import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { ToastProvider } from '../../context/ToastContext';
import { ApiError } from '../../services/api';
import { authApi } from '../../services/endpoints';
import { GuestOnly, ProtectedRoute } from '../../routes/ProtectedRoute';
import Login from './Login';
import Register from './Register';

vi.mock('../../services/endpoints', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn(), me: vi.fn() },
}));
const mocked = vi.mocked(authApi);

const user = (role: 'STUDENT' | 'FACULTY' | 'ADMIN') => ({
  _id: '1', name: 'Test Person', email: 't@x.dev', role, isActive: true, createdAt: new Date().toISOString(),
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin" element={<h1>Admin area</h1>} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/student" element={<h1>Student home</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.me.mockRejectedValue(new ApiError('Authentication required', 401));
});

describe('authentication UI', () => {
  it('validates the login form before calling the API', async () => {
    renderAt('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mocked.login).not.toHaveBeenCalled();
  });

  it('shows the server error for invalid credentials', async () => {
    mocked.login.mockRejectedValue(new ApiError('Invalid email or password', 401));
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/Email/), 't@x.dev');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrongpass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('signs in and routes to the role home', async () => {
    mocked.login.mockResolvedValue({ user: user('STUDENT') });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText(/Email/), 't@x.dev');
    await userEvent.type(screen.getByLabelText(/Password/), 'Passw0rd!x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocked.login).toHaveBeenCalledWith('t@x.dev', 'Passw0rd!x'));
  });

  it('enforces registration password rules and matching confirmation', async () => {
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText(/Full name/), 'Asha Verma');
    await userEvent.type(screen.getByLabelText(/^Email/), 'asha@law.edu');
    await userEvent.type(screen.getByLabelText(/^Password/), 'short');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'different1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument();
    expect(mocked.register).not.toHaveBeenCalled();
  });

  it('reports a duplicate email on the email field', async () => {
    mocked.register.mockRejectedValue(new ApiError('An account with this email already exists', 409));
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText(/Full name/), 'Asha Verma');
    await userEvent.type(screen.getByLabelText(/^Email/), 'asha@law.edu');
    await userEvent.type(screen.getByLabelText(/^Password/), 'Str0ngPass1');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'Str0ngPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
  });
});

describe('route protection', () => {
  it('redirects anonymous users to the login page', async () => {
    renderAt('/student');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows an access-denied page when the role is not permitted', async () => {
    mocked.me.mockResolvedValue({ user: user('STUDENT') });
    renderAt('/admin');
    expect(await screen.findByText('You do not have access to this page')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('allows the permitted role', async () => {
    mocked.me.mockResolvedValue({ user: user('ADMIN') });
    renderAt('/admin');
    expect(await screen.findByText('Admin area')).toBeInTheDocument();
  });
});
