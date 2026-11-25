import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ to = '/', light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${light ? 'bg-white/10 text-white' : 'bg-navy-900 text-white'}`}>
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </span>
      <span className={light ? 'text-white' : 'text-navy-900'}>LexVault</span>
    </Link>
  );
}
