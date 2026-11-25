import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { LegalCase } from '../types';
import { CaseCard } from './CaseCard';
import { ErrorBoundary } from './ErrorBoundary';

// The dashboard endpoints return a partial case (no tags/keyHoldings). This once crashed the whole app.
const partial = { _id: '1', title: 'Partial case', caseNumber: 'WP 1/2000', court: 'Supreme Court of India', year: 2000, category: 'Other', status: 'PUBLISHED', summary: 'Short.' } as unknown as LegalCase;

describe('CaseCard', () => {
  it('renders a case that has no tags field', () => {
    render(<MemoryRouter><CaseCard c={partial} /></MemoryRouter>);
    expect(screen.getByText('Partial case')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('shows a recoverable message instead of a blank page when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = () => { throw new Error('boom'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    spy.mockRestore();
  });
});
