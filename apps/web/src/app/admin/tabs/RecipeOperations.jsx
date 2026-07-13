import { useEffect, useState } from 'react';
import { Box, Loader, Modal, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Awaiting, ErrorState, Note, Panel, Section, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);

export function buildRecipeQuery({ q = '', status = 'all', visibility = 'all', sort = 'updatedAt:desc', page = 1, limit = 20 } = {}) {
  const [sortField, direction] = String(sort).split(':');
  return new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status,
    visibility,
    sort: sortField,
    direction,
    ...(q.trim() ? { q: q.trim() } : {}),
  }).toString();
}

export const recipeStatusLabel = (status) => ({ pending: 'در انتظار', active: 'فعال', rejected: 'ردشده', archived: 'آرشیو' }[status] || 'نامشخص');
export const RECIPE_OPERATIONS_COPY = {
  title: 'عملیات دستورهای غذا',
  subtitle: 'نمای لحظه‌ای سبک از دستورهای غذا؛ تغییر انتشار فقط با مجوز محتوا، دلیل اپراتور و گزارش ممیزی',
  approval: 'تأیید یعنی دستور غذا فعال و برای همهٔ کاربران قابل مشاهده می‌شود؛ دلیل اپراتور در گزارش ممیزی ثبت خواهد شد.',
};
const date = (value) => value ? new Date(value).toLocaleDateString('fa-IR') : '—';
const control = { minBlockSize: 36, borderRadius: '9px', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', paddingInline: 9 };
const td = { padding: '9px 8px', borderBlockEnd: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-primary)', verticalAlign: 'middle' };
const action = (danger = false) => ({ minBlockSize: 29, paddingInline: 9, borderRadius: '7px', border: `1px solid ${danger ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-border-subtle)'}`, color: danger ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-brand-600)', fontFamily: 'var(--g-font-fa)', fontSize: '10.5px' });

export default function RecipeOperations() {
  const qc = useQueryClient();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [sort, setSort] = useState('updatedAt:desc');
  const [page, setPage] = useState(1);
  const [moderation, setModeration] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [qInput]);

  const qs = buildRecipeQuery({ q, status, visibility, sort, page });
  const list = useQuery({ queryKey: ['admin', 'recipes', qs], queryFn: () => get('/admin/recipes?' + qs), placeholderData: (previous) => previous });
  const perms = useQuery({ queryKey: ['admin', 'me', 'permissions'], queryFn: () => get('/admin/me/permissions'), staleTime: 300000 });
  const canModerate = !!perms.data?.canApproveRecipe;
  const moderate = useMutation({
    mutationFn: ({ id, verb, reason: operatorReason }) => apiClient.patch(`/admin/recipes/${id}/${verb}`, { reason: operatorReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recipes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'recipes-stats'] });
      setModeration(null);
      setReason('');
    },
  });

  const rows = list.data?.data || [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (list.data?.limit || 20)));
  const range = list.data?.range || { from: 0, to: 0 };
  const openModeration = (recipe, verb) => { moderate.reset(); setReason(''); setModeration({ recipe, verb }); };

  return (
    <>
      <Section title={RECIPE_OPERATIONS_COPY.title} sub={RECIPE_OPERATIONS_COPY.subtitle} />
      {perms.isError ? <Note tone="warn">مجوزهای اپراتور خوانده نشد؛ عملیات تأیید و رد غیرفعال است.</Note> : null}
      <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBlockEnd: 11 }}>
        <Box style={{ position: 'relative', flex: 1, minInlineSize: 210 }}>
          <IconSearch size={15} stroke={1.8} style={{ position: 'absolute', insetInlineStart: 11, insetBlockStart: '50%', transform: 'translateY(-50%)', color: 'var(--g-color-text-muted)' }} />
          <input value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="جستجو در عنوان دستور غذا…" style={{ ...control, inlineSize: '100%', paddingInlineStart: 34 }} />
        </Box>
        <select aria-label="وضعیت دستور غذا" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} style={control}>
          <option value="all">همهٔ وضعیت‌ها</option><option value="pending">در انتظار</option><option value="active">فعال</option><option value="rejected">ردشده</option><option value="archived">آرشیو</option>
        </select>
        <select aria-label="نمایانی دستور غذا" value={visibility} onChange={(event) => { setVisibility(event.target.value); setPage(1); }} style={control}>
          <option value="all">عمومی و خصوصی</option><option value="public">عمومی</option><option value="private">خصوصی</option>
        </select>
        <select aria-label="ترتیب دستور غذا" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} style={control}>
          <option value="updatedAt:desc">آخرین ویرایش</option><option value="createdAt:desc">جدیدترین ساخت</option><option value="createdAt:asc">قدیمی‌ترین ساخت</option><option value="title:asc">عنوان</option><option value="status:asc">وضعیت</option>
        </select>
      </Box>

      <Panel>
        {list.isError ? <ErrorState note="فهرست دستورهای غذا از سرور خوانده نشد." onRetry={() => list.refetch()} />
          : list.isLoading && !list.data ? <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 28 }}><Loader size="sm" color="var(--g-color-brand-600)" /></Box>
            : rows.length ? (
              <>
                <Box style={{ overflowX: 'auto' }}>
                  <Box component="table" style={{ inlineSize: '100%', borderCollapse: 'collapse' }}>
                    <Box component="thead"><Box component="tr">{['عنوان', 'وضعیت', 'نمایانی', 'تکمیل', 'نویسنده', 'به‌روزرسانی', 'عملیات'].map((heading) => <Box component="th" key={heading} style={{ ...td, color: 'var(--g-color-text-muted)', fontSize: '10.5px', fontWeight: 500, textAlign: 'start', whiteSpace: 'nowrap' }}>{heading}</Box>)}</Box></Box>
                    <Box component="tbody">{rows.map((recipe) => (
                      <Box component="tr" key={recipe.id}>
                        <Box component="td" style={{ ...td, fontWeight: 600 }}>{recipe.title}<Text component="div" style={{ fontSize: '10.5px', color: 'var(--g-color-text-muted)', fontWeight: 400 }}>{recipe.category || 'بدون دسته'} · {recipe.hasImage ? 'تصویر دارد' : 'بدون تصویر'}</Text></Box>
                        <Box component="td" style={td}>{recipeStatusLabel(recipe.status)}</Box>
                        <Box component="td" style={td}>{recipe.isPublic ? 'عمومی' : 'خصوصی'}</Box>
                        <Box component="td" style={td}>{toFaDigits(recipe.ingredientCount)} ماده · {toFaDigits(recipe.stepCount)} مرحله</Box>
                        <Box component="td" style={td}>{recipe.authorName || 'سیستمی/نامعلوم'}</Box>
                        <Box component="td" style={{ ...td, color: 'var(--g-color-text-muted)' }}>{date(recipe.updatedAt)}</Box>
                        <Box component="td" style={td}>{canModerate ? <Box style={{ display: 'inline-flex', gap: 5 }}>
                          {recipe.status === 'active' && recipe.isPublic ? null : <UnstyledButton type="button" onClick={() => openModeration(recipe, 'approve')} style={action()}><IconCheck size={12} /> تأیید</UnstyledButton>}
                          {recipe.status === 'rejected' ? null : <UnstyledButton type="button" onClick={() => openModeration(recipe, 'reject')} style={action(true)}><IconX size={12} /> رد</UnstyledButton>}
                        </Box> : <Text component="span" style={{ color: 'var(--g-color-text-muted)', fontSize: '10.5px' }}>فقط مشاهده</Text>}</Box>
                      </Box>
                    ))}</Box>
                  </Box>
                </Box>
                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBlockStart: 12 }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-muted)' }}>{toFaDigits(range.from)} تا {toFaDigits(range.to)} از {toFaDigits(total)} · نمای لحظه‌ای: {list.data?.asOf ? new Date(list.data.asOf).toLocaleString('fa-IR') : 'نامعلوم'}</Text>
                  <Box style={{ display: 'inline-flex', gap: 6 }}><UnstyledButton type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} style={{ ...action(), opacity: page <= 1 ? 0.45 : 1 }}>قبلی</UnstyledButton><UnstyledButton type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} style={{ ...action(), opacity: page >= pages ? 0.45 : 1 }}>بعدی</UnstyledButton></Box>
                </Box>
              </>
            ) : <Awaiting note="دستور غذایی با این فیلتر پیدا نشد." />}
      </Panel>

      <Modal opened={!!moderation} onClose={() => { setModeration(null); setReason(''); }} centered title={moderation?.verb === 'approve' ? 'تأیید و انتشار دستور غذا' : 'رد و خارج‌کردن از انتشار'} styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 600 } }}>
        <Box style={{ display: 'grid', gap: 11 }}>
          <Note tone={moderation?.verb === 'reject' ? 'warn' : 'info'}>{moderation?.recipe?.title || 'دستور غذا'}؛ {RECIPE_OPERATIONS_COPY.approval}</Note>
          {moderate.isError ? <Text style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-state-danger-fg, #b3261e)' }}>عملیات ناموفق بود: {String(moderate.error?.response?.data?.message || 'خطای سرور')}</Text> : null}
          <TextInput label="دلیل (حداقل ۳ کاراکتر)" value={reason} onChange={(event) => setReason(event.target.value)} styles={{ input: { fontFamily: 'var(--g-font-fa)' }, label: { fontFamily: 'var(--g-font-fa)', fontSize: '12px' } }} />
          <UnstyledButton type="button" disabled={reason.trim().length < 3 || moderate.isPending} onClick={() => moderate.mutate({ id: moderation.recipe.id, verb: moderation.verb, reason: reason.trim() })} style={{ minBlockSize: 42, borderRadius: '10px', background: moderation?.verb === 'reject' ? 'var(--g-color-state-danger-fg, #b3261e)' : 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse, #fff)', fontFamily: 'var(--g-font-fa)', fontSize: '13px', opacity: reason.trim().length < 3 ? 0.5 : 1 }}>{moderate.isPending ? 'در حال ثبت…' : 'ثبت تغییر'}</UnstyledButton>
        </Box>
      </Modal>
    </>
  );
}
