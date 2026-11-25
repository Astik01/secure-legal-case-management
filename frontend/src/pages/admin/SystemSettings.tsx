import { Alert, Badge, Card, ErrorState, PageHeader, Spinner } from '../../components/ui';
import { HashText } from '../../components/badges';
import { useAsync } from '../../hooks/useAsync';
import { statsApi } from '../../services/endpoints';

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid gap-1 py-2.5 sm:grid-cols-3"><dt className="text-sm text-slate-500">{k}</dt><dd className="text-sm text-slate-800 sm:col-span-2">{children}</dd></div>
);

export default function SystemSettings() {
  const { data: s, loading, error, reload } = useAsync(() => statsApi.settings(), []);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !s) return <Spinner />;
  const chain = s.blockchain;

  return (
    <>
      <PageHeader title="System settings" description="Read-only view of the running configuration. Secrets are never shown; change settings through environment variables." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Blockchain</h2>
          {!chain.connected && <div className="mt-3"><Alert kind="error" title="Blockchain unreachable">{chain.error}. Registrations will fail and verification will report VERIFICATION ERROR until it is back.</Alert></div>}
          <dl className="mt-2 divide-y divide-slate-100">
            <Row k="Connection">{chain.connected ? <Badge tone="green">Connected</Badge> : <Badge tone="red">Disconnected</Badge>}</Row>
            <Row k="RPC endpoint">{chain.rpcUrl}</Row>
            {chain.connected && <>
              <Row k="Chain ID">{chain.chainId}</Row>
              <Row k="Latest block">{chain.latestBlock}</Row>
              <Row k="Contract address"><HashText value={chain.contractAddress} full /></Row>
              <Row k="Registrar account"><HashText value={chain.registrarAddress} full /></Row>
              <Row k="Registrar authorized">{chain.registrarAuthorized ? <Badge tone="green">Yes</Badge> : <Badge tone="red">No</Badge>}</Row>
              <Row k="Registrar balance">{Number(chain.registrarBalanceEth).toFixed(4)} ETH</Row>
            </>}
          </dl>
        </Card>
        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold">Documents</h2>
            <dl className="mt-2 divide-y divide-slate-100">
              <Row k="Allowed types">{s.upload.allowedTypes.join(', ')}</Row>
              <Row k="Maximum size">{s.upload.maxUploadMb} MB</Row>
              <Row k="Storage">{s.upload.storage} (not web-accessible)</Row>
            </dl>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Security</h2>
            <dl className="mt-2 divide-y divide-slate-100">
              <Row k="Environment">{s.environment}</Row>
              <Row k="Session lifetime">{s.security.jwtExpiresIn}</Row>
              <Row k="Password hashing">{s.security.passwordHashing}</Row>
              <Row k="Rate limiting">{s.security.rateLimiting ? 'Enabled' : 'Disabled'}</Row>
              <Row k="Session cookie">HttpOnly, SameSite=Lax</Row>
            </dl>
          </Card>
          <Alert kind="info" title="Audit trail">{s.auditTrail.note}</Alert>
        </div>
      </div>
    </>
  );
}
