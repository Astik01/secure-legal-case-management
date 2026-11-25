import { BookMarked } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseCard } from '../../components/CaseCard';
import { Button, EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { errorMessage } from '../../services/api';
import { bookmarkApi } from '../../services/endpoints';

export default function Bookmarks() {
  const [page, setPage] = useState(1);
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => bookmarkApi.list({ page, limit: 10 }), [page]);

  const remove = async (id: string) => {
    try {
      await bookmarkApi.remove(id);
      toast.success('Bookmark removed');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Bookmarks" description="Cases you saved for later." />
      {error ? <ErrorState message={error} onRetry={reload} />
        : loading && !data ? <Spinner />
        : data && data.items.length === 0 ? (
          <EmptyState icon={<BookMarked className="h-10 w-10" />} title="No bookmarks yet"
            description="Bookmark a case from its details page to find it quickly here."
            action={<Link to="/cases"><Button>Browse cases</Button></Link>} />
        ) : (
          <div className="space-y-3">
            {data?.items.map((b) => (
              <div key={b._id} className="relative">
                <CaseCard c={b.legalCase} />
                <div className="absolute bottom-4 right-4">
                  <Button size="sm" variant="ghost" onClick={() => remove(b._id)}>Remove</Button>
                </div>
              </div>
            ))}
            {data && <Pagination meta={data.meta} onPage={setPage} />}
          </div>
        )}
    </>
  );
}
