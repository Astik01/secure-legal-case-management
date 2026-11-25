export const formatDate = (iso?: string | null, withTime = false) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export const shortHash = (h?: string | null, head = 10, tail = 8) =>
  !h ? '-' : h.length <= head + tail + 3 ? h : `${h.slice(0, head)}...${h.slice(-tail)}`;

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const personName = (v: string | { name: string } | undefined | null) =>
  !v ? '-' : typeof v === 'string' ? v : v.name;
