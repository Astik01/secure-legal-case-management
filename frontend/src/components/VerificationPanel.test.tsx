import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { VerificationResult, VerificationStatus } from '../types';
import { VerificationResultView } from './VerificationPanel';

const base: VerificationResult = {
  status: 'VERIFIED', message: 'The document matches its blockchain record.', documentId: 'd1',
  documentKey: '0x' + 'a'.repeat(64), version: 2, source: 'STORED_FILE',
  originalHash: '0x' + '1'.repeat(64), currentHash: '0x' + '1'.repeat(64), databaseHash: '1'.repeat(64),
  registeredAt: '2026-01-01T00:00:00.000Z', txHash: '0x' + '2'.repeat(64), blockNumber: 7,
  registrar: '0x' + '3'.repeat(40), verifiedAt: '2026-01-02T00:00:00.000Z',
};

describe('VerificationResultView', () => {
  it('shows both hashes, version, transaction and block for a verified document', () => {
    render(<VerificationResultView r={base} />);
    expect(screen.getByText('Document verified')).toBeInTheDocument();
    expect(screen.getAllByText('0x' + '1'.repeat(64))).toHaveLength(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('0x' + '2'.repeat(64))).toBeInTheDocument();
  });

  it('reports tampering as an error with differing hashes', () => {
    render(<VerificationResultView r={{ ...base, status: 'TAMPERED', currentHash: '0x' + '9'.repeat(64), message: 'altered' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('does not match');
    expect(screen.getByText('0x' + '9'.repeat(64))).toBeInTheDocument();
  });

  it.each<[VerificationStatus, string]>([
    ['NOT_REGISTERED', 'No blockchain registration found'],
    ['VERIFICATION_ERROR', 'Verification could not be completed'],
  ])('labels %s clearly and never as verified', (status, title) => {
    render(<VerificationResultView r={{ ...base, status, originalHash: null, txHash: null, blockNumber: null, registeredAt: null }} />);
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByText('Document verified')).not.toBeInTheDocument();
  });
});
