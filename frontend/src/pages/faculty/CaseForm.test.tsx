import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';
import { ApiError } from '../../services/api';
import { caseApi } from '../../services/endpoints';
import CaseForm from './CaseForm';

vi.mock('../../services/endpoints', () => ({ caseApi: { create: vi.fn(), update: vi.fn(), get: vi.fn() } }));
const api = vi.mocked(caseApi);

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={['/faculty/cases/new']}>
      <ToastProvider>
        <Routes>
          <Route path="/faculty/cases/new" element={<CaseForm />} />
          <Route path="/cases/:id" element={<h1>Case page</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

async function fillRequired() {
  await userEvent.type(screen.getByLabelText(/^Title/), 'Maneka Gandhi v. Union of India');
  await userEvent.type(screen.getByLabelText(/^Case number/), 'WP 231/1977');
  await userEvent.selectOptions(screen.getByLabelText(/^Category/), 'Constitutional Law');
  await userEvent.type(screen.getByLabelText(/^Summary/), 'Expanded Article 21 and due process.');
}

beforeEach(() => vi.resetAllMocks());

describe('CaseForm', () => {
  it('blocks submission and shows field errors when required data is missing', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    expect(await screen.findByText('Enter the case title')).toBeInTheDocument();
    expect(screen.getByText('Case number is required')).toBeInTheDocument();
    expect(screen.getByText('Choose a category')).toBeInTheDocument();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('sends holdings and tags as arrays and omits empty optional fields', async () => {
    api.create.mockResolvedValue({ _id: 'c1' } as never);
    renderForm();
    await fillRequired();
    await userEvent.type(screen.getByLabelText(/^Key holdings/), 'Procedure must be fair{enter}Articles 14, 19, 21 interlink');
    await userEvent.type(screen.getByLabelText(/^Tags/), 'article 21, due process');
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    const body = api.create.mock.calls[0][0] as Record<string, unknown>;
    expect(body.keyHoldings).toEqual(['Procedure must be fair', 'Articles 14, 19, 21 interlink']);
    expect(body.tags).toEqual(['article 21', 'due process']);
    expect(body.year).toEqual(expect.any(Number));
    expect(body).not.toHaveProperty('citation');
    expect(body).not.toHaveProperty('status');
    expect(await screen.findByText('Case page')).toBeInTheDocument();
  });

  it('flags a duplicate case number on that field', async () => {
    api.create.mockRejectedValue(new ApiError('Duplicate value for: caseNumber', 409));
    renderForm();
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Create case' }));
    expect(await screen.findByText('This case number already exists')).toBeInTheDocument();
  });
});
