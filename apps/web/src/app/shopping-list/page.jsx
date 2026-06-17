import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconRefresh, IconCheck, IconPlus, IconShoppingCart, IconWand, IconCloudOff, IconShieldCheck } from '@tabler/icons-react';
import { useShopping } from './useShopping';
import { toFaDigits } from '../../components/ges/format';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';

function GroceryRow({ item, checked, onToggle, first }) {
  return (
    <UnstyledButton type="button" onClick={onToggle} aria-pressed={checked} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 48, paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', borderBlockStart: first ? 'none' : '1px solid var(--g-color-border-subtle)', opacity: checked ? 0.6 : 1 }}>
      <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 24, blockSize: 24, borderRadius: 'var(--g-radius-chip)', border: checked ? 'none' : '1.5px solid var(--g-color-border-strong)', background: checked ? 'var(--g-color-brand-600)' : 'transparent', color: 'var(--g-color-text-inverse)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <IconCheck size={14} stroke={2.4} /> : null}
      </Box>
      <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: checked ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</Text>
      {checked ? (
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)', whiteSpace: 'nowrap' }}>گرفتم</Text>
      ) : item.amount || item.unit ? (
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap' }}>{toFaDigits([item.amount, item.unit].filter(Boolean).join(' '))}</Text>
      ) : null}
    </UnstyledButton>
  );
}

function ShoppingEmpty({ onFromPlan, busy }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)', marginBlockEnd: 'var(--g-space-2)' }}><IconShoppingCart size={28} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>لیستت خالیه</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>از روی برنامهٔ هفته بسازش؟</Text>
      <UnstyledButton type="button" onClick={onFromPlan} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconWand size={16} stroke={1.8} aria-hidden="true" />{busy ? 'در حال ساختن…' : 'ساختن از برنامه'}</UnstyledButton>
    </Box>
  );
}

function ShoppingError({ onRetry }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-1)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>یه مشکلی پیش اومد</Text>
      <Text component="p" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)', margin: 'var(--g-space-1) 0 0' }}><IconShieldCheck size={13} stroke={1.8} aria-hidden="true" />لیستت روی حسابت محفوظه</Text>
      <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
    </Box>
  );
}

export default function ShoppingListPage() {
  const navigate = useNavigate();
  const s = useShopping();
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => { clearTimeout(toastTimer.current); setToast({ message, Icon }); toastTimer.current = setTimeout(() => setToast(null), 2200); }, []);

  const onFromPlan = async () => {
    const r = await s.buildFromPlan();
    if (!r.ok) { showToast('الان نشد — دوباره امتحان کن', IconCloudOff); return; }
    if (r.noPlan) { showToast('اول یک برنامهٔ هفته بچین', IconWand); navigate('/plan'); return; }
    if (!r.added && !r.merged) { showToast('همه‌چیز از قبل توی لیسته', IconCheck); return; }
    const flag = r.flagged ? ` · ${toFaDigits(r.flagged)} نیاز به بررسی واحد` : '';
    showToast(`از برنامه ساخته شد · ${toFaDigits(r.added)} مورد${r.merged ? ` · ${toFaDigits(r.merged)} ادغام` : ''}${flag}`, IconWand);
  };
  const onAdd = async () => { const ok = await s.addManual(draft); if (ok) { setDraft(''); showToast('به لیست اضافه شد', IconPlus); } else showToast('اضافه نشد — دوباره امتحان کن', IconCloudOff); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', minBlockSize: '70dvh' }}>
      {/* header */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Box>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>لیست خرید</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 0' }}>
            {s.total > 0 ? `${toFaDigits(s.done)} از ${toFaDigits(s.total)} گرفته شد` : 'لیستِ خرید هفته'}
          </Text>
        </Box>
        <UnstyledButton type="button" onClick={onFromPlan} disabled={s.busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-brand-200)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}><IconRefresh size={14} stroke={1.8} aria-hidden="true" />از روی برنامه</UnstyledButton>
      </Box>

      <Box style={{ flex: 1 }}>
        {s.status === 'loading' ? (
          <Box style={{ padding: 'var(--g-space-4)' }}>
            <SkeletonLine w="40%" h={14} />
            <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-3)' }}>
              {[0, 1, 2].map((i) => <Box key={i} style={{ minBlockSize: 48, borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none', display: 'flex', alignItems: 'center', paddingInline: 'var(--g-space-4)' }}><SkeletonLine w="60%" h={12} /></Box>)}
            </Box>
          </Box>
        ) : s.status === 'error' ? <ShoppingError onRetry={s.refetch} />
          : s.status === 'empty' ? <ShoppingEmpty onFromPlan={onFromPlan} busy={s.busy} />
            : (
              <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-4)' }}>
                {s.groups.map((g) => (
                  <Box key={g.key} style={{ marginBlockEnd: 'var(--g-space-5)' }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginInline: 2, marginBlockEnd: 'var(--g-space-2)' }}>
                      <g.Icon size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{g.label}</Text>
                    </Box>
                    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
                      {g.items.map((it, i) => <GroceryRow key={it.id} item={it} checked={s.checkedOf(it)} onToggle={() => s.toggle(it)} first={i === 0} />)}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
      </Box>

      {/* manual add */}
      <Box style={{ position: 'sticky', insetBlockEnd: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)' }}>
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 46, paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)' }}>
          <IconPlus size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
          <Box component="input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }} placeholder="افزودنِ دستی…" aria-label="افزودن آیتم" style={{ flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }} />
        </Box>
        <UnstyledButton type="button" onClick={onAdd} aria-label="افزودن" disabled={s.busy || !draft.trim()} style={{ inlineSize: 46, blockSize: 46, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--g-radius-input)', background: draft.trim() ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)', color: 'var(--g-color-text-inverse)' }}><IconPlus size={20} stroke={1.8} /></UnstyledButton>
      </Box>

      <Toast toast={toast} />
    </Box>
  );
}
