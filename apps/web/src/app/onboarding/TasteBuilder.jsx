import { useEffect, useRef, useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconSearch, IconHeartFilled, IconThumbDownFilled, IconX, IconLoader2 } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';

/**
 * TasteBuilder — search ANY ingredient OR dish and add it as "love" or "never". Free-form (the founder's
 * requirement: pick anything, ingredients AND whole dishes, not a fixed handful). Each item carries a `type`
 * ('ingredient' | 'dish'); the parent owns likes/dislikes ([{id,name,type}]) and routes persistence by type
 * (ingredient → /profile/taste/correct; dish like → favorite; dish dislike → recommendation_dismiss signal).
 */
const chipBase = {
  display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 34, paddingInline: 'var(--g-space-3)',
  borderRadius: 'var(--g-radius-chip)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600,
};
const typeTag = (type) => (
  <Text component="span" style={{ flexShrink: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 700, paddingInline: 6, paddingBlock: 1, borderRadius: 'var(--g-radius-chip)', background: type === 'dish' ? 'var(--g-color-brand-100)' : 'var(--g-color-bg-canvas)', color: type === 'dish' ? 'var(--g-color-brand-700)' : 'var(--g-color-text-muted)' }}>
    {type === 'dish' ? 'غذا' : 'ماده'}
  </Text>
);

function SelectedGroup({ title, items, tone, onRemove }) {
  if (!items.length) return null;
  const fg = tone === 'like' ? 'var(--g-color-state-success-fg)' : 'var(--g-color-allergen-fg)';
  const bg = tone === 'like' ? 'var(--g-color-state-success-bg)' : 'var(--g-color-allergen-bg)';
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-2)' }}>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-muted)', marginBlockEnd: 'var(--g-space-1)' }}>{title}</Text>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
        {items.map((it) => (
          <Box key={`${it.type}:${it.id}`} style={{ ...chipBase, background: bg, color: fg, border: `1px solid ${fg}` }}>
            {it.type === 'dish' ? typeTag('dish') : null}
            {it.name}
            <UnstyledButton type="button" onClick={() => onRemove(it.id)} aria-label={`حذف ${it.name}`} style={{ display: 'inline-flex', color: fg, opacity: 0.8 }}>
              <IconX size={13} stroke={2.4} />
            </UnstyledButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function TasteBuilder({ likes = [], dislikes = [], onAdd, onRemove }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const mine = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const [ing, dish] = await Promise.all([
          apiClient.get('/ingredients/search', { params: { q: term, limit: 6 } }).then((r) => r.data).catch(() => []),
          apiClient.get('/recipes/search', { params: { q: term, limit: 4 } }).then((r) => r.data).catch(() => []),
        ]);
        if (mine !== reqId.current) return;
        const merged = [
          ...(Array.isArray(dish) ? dish : []).slice(0, 4).map((r) => ({ id: String(r.id), name: r.title || r.name, type: 'dish' })),
          ...(Array.isArray(ing) ? ing : []).map((i) => ({ id: String(i.id), name: i.name, type: 'ingredient' })),
        ].filter((x) => x.id && x.name);
        setResults(merged);
      } finally {
        if (mine === reqId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const chosen = new Set([...likes, ...dislikes].map((x) => `${x.type || 'ingredient'}:${x.id}`));
  const add = (stance, item) => { onAdd(stance, item); setQ(''); setResults([]); };

  return (
    <Box>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 48, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)' }}>
        {loading ? <IconLoader2 size={18} className="g-spin" aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} /> : <IconSearch size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="هر ماده یا غذایی رو بنویس… مثل قرمه‌سبزی، برنج، زعفران"
          aria-label="جستجوی ماده یا غذا"
          style={{ flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }}
        />
      </Box>

      {results.length ? (
        <Box style={{ marginBlockStart: 'var(--g-space-2)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden', background: 'var(--g-color-bg-surface)' }}>
          {results.map((it) => {
            const already = chosen.has(`${it.type}:${it.id}`);
            return (
              <Box key={`${it.type}:${it.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
                <Box style={{ flex: 1, minInlineSize: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                  {typeTag(it.type)}
                  <Text component="span" style={{ minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</Text>
                </Box>
                {already ? (
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', flexShrink: 0 }}>اضافه شد</Text>
                ) : (
                  <Box style={{ display: 'inline-flex', gap: 'var(--g-space-1)', flexShrink: 0 }}>
                    <UnstyledButton type="button" onClick={() => add('like', it)} aria-label={`دوست دارم: ${it.name}`} style={{ ...chipBase, minBlockSize: 32, background: 'var(--g-color-state-success-bg)', color: 'var(--g-color-state-success-fg)' }}>
                      <IconHeartFilled size={13} />دوست دارم
                    </UnstyledButton>
                    <UnstyledButton type="button" onClick={() => add('dislike', it)} aria-label={`دوست ندارم: ${it.name}`} style={{ ...chipBase, minBlockSize: 32, background: 'var(--g-color-allergen-bg)', color: 'var(--g-color-allergen-fg)' }}>
                      <IconThumbDownFilled size={13} />دوست ندارم
                    </UnstyledButton>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      ) : null}

      <SelectedGroup title="دوست دارم" items={likes} tone="like" onRemove={(id) => onRemove('like', id)} />
      <SelectedGroup title="هیچ‌وقت نمی‌خوام" items={dislikes} tone="dislike" onRemove={(id) => onRemove('dislike', id)} />
    </Box>
  );
}
