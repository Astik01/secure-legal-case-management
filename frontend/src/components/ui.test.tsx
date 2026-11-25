import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseStatusBadge, ChainStatusBadge, VerificationBadge } from './badges';
import { Button, ConfirmDialog, EmptyState, Pagination, TextField } from './ui';

describe('design system', () => {
  it('Button shows a busy state and blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('TextField links its label, error message and invalid state for assistive tech', () => {
    render(<TextField label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('ConfirmDialog requires explicit confirmation and closes on Escape', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete case" message="This cannot be undone." danger confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Delete case' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Pagination navigates and disables edges', () => {
    const onPage = vi.fn();
    render(<Pagination meta={{ page: 1, limit: 10, total: 25, totalPages: 3 }} onPage={onPage} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText(/Showing 1-10 of 25/)).toBeInTheDocument();
  });

  it('EmptyState renders title and description', () => {
    render(<EmptyState title="No cases" description="Try another filter" />);
    expect(screen.getByText('No cases')).toBeInTheDocument();
  });

  it('badges distinguish blockchain submission from confirmation and show verification outcomes', () => {
    render(<><ChainStatusBadge status="SUBMITTED" /><ChainStatusBadge status="CONFIRMED" /><VerificationBadge status="TAMPERED" /><CaseStatusBadge status="PENDING" /></>);
    expect(screen.getByText(/Submitted \(awaiting confirmation\)/)).toBeInTheDocument();
    expect(screen.getByText('Confirmed on-chain')).toBeInTheDocument();
    expect(screen.getByText('TAMPERED')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
