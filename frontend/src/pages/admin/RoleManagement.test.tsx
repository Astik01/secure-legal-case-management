import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';
import { userApi } from '../../services/endpoints';
import RoleManagement from './RoleManagement';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'admin1', role: 'ADMIN' } }) }));
vi.mock('../../services/endpoints', () => ({ userApi: { list: vi.fn(), setRole: vi.fn() } }));
const api = vi.mocked(userApi);

const mk = (_id: string, name: string, role: string) => ({ _id, name, email: `${name}@x.dev`, role, isActive: true, createdAt: '2026-01-01' });

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue({
    items: [mk('admin1', 'Ada', 'ADMIN'), mk('s1', 'Stu', 'STUDENT')] as never,
    meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
  });
});

const renderPage = () => render(<MemoryRouter><ToastProvider><RoleManagement /></ToastProvider></MemoryRouter>);

describe('RoleManagement', () => {
  it('does not let an administrator change their own role', async () => {
    renderPage();
    expect(await screen.findByText('You cannot change your own role')).toBeInTheDocument();
    expect(screen.queryByLabelText('Change role for Ada')).not.toBeInTheDocument();
  });

  it('asks for confirmation before changing a role, and only then calls the API', async () => {
    api.setRole.mockResolvedValue({} as never);
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Change role for Stu'), 'ADMIN');
    expect(api.setRole).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Change role' })).toHaveTextContent(/full access/i);
    await userEvent.click(screen.getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(api.setRole).toHaveBeenCalledWith('s1', 'ADMIN'));
  });

  it('cancelling leaves the role unchanged', async () => {
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText('Change role for Stu'), 'FACULTY');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.setRole).not.toHaveBeenCalled();
  });

  it('shows the permission matrix', async () => {
    renderPage();
    expect(await screen.findByText('Permission matrix')).toBeInTheDocument();
    expect(screen.getByText('Approve or reject submissions')).toBeInTheDocument();
  });
});
