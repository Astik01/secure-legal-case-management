import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, ErrorState, PageHeader, SelectField, Spinner, TextAreaField, TextField } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { ApiError, compact, errorMessage } from '../../services/api';
import { caseApi } from '../../services/endpoints';
import { CASE_CATEGORIES } from '../../types';

const lines = (s?: string) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

const schema = z.object({
  title: z.string().trim().min(3, 'Enter the case title').max(300),
  caseNumber: z.string().trim().min(1, 'Case number is required').max(100),
  citation: z.string().trim().max(200).optional(),
  court: z.string().trim().min(2, 'Court is required').max(200),
  year: z.coerce.number({ invalid_type_error: 'Enter a year' }).int().min(1700, 'Year is too early').max(2100, 'Year is too late'),
  category: z.enum(CASE_CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
  petitioner: z.string().trim().max(300).optional(),
  respondent: z.string().trim().max(300).optional(),
  bench: z.string().trim().max(500).optional(),
  decisionDate: z.string().optional(),
  summary: z.string().trim().min(10, 'Write at least a short summary (10+ characters)').max(10000),
  keyHoldings: z.string().optional(),
  tags: z.string().optional(),
  sourceUrl: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//.test(v), 'Must start with http:// or https://').optional(),
});
type Form = z.infer<typeof schema>;

export default function CaseForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useAsync(async () => (id ? caseApi.get(id) : null), [id]);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { year: new Date().getFullYear(), court: 'Supreme Court of India' } as Partial<Form>,
  });

  useEffect(() => {
    const c = existing.data;
    if (!c) return;
    reset({
      title: c.title, caseNumber: c.caseNumber, citation: c.citation ?? '', court: c.court, year: c.year,
      category: c.category as Form['category'], petitioner: c.petitioner ?? '', respondent: c.respondent ?? '',
      bench: c.bench ?? '', decisionDate: c.decisionDate ? c.decisionDate.slice(0, 10) : '', summary: c.summary,
      keyHoldings: c.keyHoldings.join('\n'), tags: c.tags.join(', '), sourceUrl: c.sourceUrl ?? '',
    });
  }, [existing.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const body = compact({
      ...v,
      keyHoldings: lines(v.keyHoldings),
      tags: (v.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      decisionDate: v.decisionDate || undefined,
    });
    try {
      const saved = editing ? await caseApi.update(id!, body) : await caseApi.create(body);
      toast.success(editing ? 'Case updated' : 'Case created as a draft. Upload a document or submit it for approval.');
      navigate(`/cases/${saved._id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /case ?number/i.test(e.message)) setError('caseNumber', { message: 'This case number already exists' });
      else if (e instanceof ApiError && e.details) e.details.forEach((d) => setError(d.path as keyof Form, { message: d.message }));
      else toast.error(errorMessage(e));
    }
  });

  if (editing && existing.loading && !existing.data) return <Spinner label="Loading case" />;
  if (editing && existing.error) return <ErrorState message={existing.error} onRetry={existing.reload} />;

  return (
    <>
      <PageHeader title={editing ? 'Edit legal case' : 'Add legal case'}
        description={editing ? 'Update the case record. Rejected cases return to draft when saved.' : 'New cases start as drafts. Submit for approval when ready; only approved cases are visible to students.'} />
      {editing && existing.data?.status === 'REJECTED' && existing.data.reviewNote && (
        <div className="mb-5"><Alert kind="warning" title="Reviewer feedback">{existing.data.reviewNote}</Alert></div>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Case identification</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><TextField label="Title" required error={errors.title?.message} placeholder="Party A v. Party B" {...register('title')} /></div>
            <TextField label="Case number" required error={errors.caseNumber?.message} {...register('caseNumber')} />
            <TextField label="Citation" error={errors.citation?.message} placeholder="(1978) 1 SCC 248" {...register('citation')} />
            <TextField label="Court" required error={errors.court?.message} {...register('court')} />
            <TextField label="Year" type="number" required error={errors.year?.message} {...register('year')} />
            <SelectField label="Category" required error={errors.category?.message} defaultValue="" {...register('category')}>
              <option value="" disabled>Select a category</option>
              {CASE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </SelectField>
            <TextField label="Decision date" type="date" error={errors.decisionDate?.message} {...register('decisionDate')} />
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Parties and bench</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Petitioner" error={errors.petitioner?.message} {...register('petitioner')} />
            <TextField label="Respondent" error={errors.respondent?.message} {...register('respondent')} />
            <div className="md:col-span-2"><TextField label="Bench" error={errors.bench?.message} {...register('bench')} /></div>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Content</h2>
          <div className="space-y-4">
            <TextAreaField label="Summary" required rows={6} error={errors.summary?.message}
              hint="Write in your own words. Do not paste copyrighted headnotes or invent judgment text." {...register('summary')} />
            <TextAreaField label="Key holdings" rows={4} hint="One holding per line" error={errors.keyHoldings?.message} {...register('keyHoldings')} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Tags" hint="Comma separated" error={errors.tags?.message} {...register('tags')} />
              <TextField label="Source URL" error={errors.sourceUrl?.message} placeholder="https://" {...register('sourceUrl')} />
            </div>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Create case'}</Button>
        </div>
      </form>
    </>
  );
}
