import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconHeart,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconThumbDown,
  IconTrash,
  IconWifiOff,
} from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import styles from './onboarding.module.css';

const MAX_LIKES = 3;
const MAX_DISLIKES = 2;

const normalizeResults = (data) => {
  const source = Array.isArray(data) ? data : data?.items || data?.recipes || data?.data || [];
  if (!Array.isArray(source)) return [];
  return source.slice(0, 6).map((entry) => {
    const recipe = entry?.recipe || entry;
    return {
      id: String(recipe?.id || entry?.recipeId || ''),
      name: recipe?.title || recipe?.name || '',
      imageUrl: recipe?.imageUrl || recipe?.image || null,
    };
  }).filter((entry) => entry.id && entry.name);
};

function SelectedGroup({ title, hint, items, stance, onRemove }) {
  if (!items.length) return null;
  return (
    <section className={styles.selectedGroup} aria-label={title}>
      <Box className={styles.selectedGroupHeader}>
        <Text component="h3" className={styles.selectedGroupTitle}>{title}</Text>
        <Text component="span" className={styles.selectedGroupHint}>{hint}</Text>
      </Box>
      <Box className={styles.selectedList}>
        {items.map((item) => (
          <Box className={styles.selectedRow} key={`${stance}:${item.id}`}>
            <Box className={styles.selectedRowCopy}>
              <Text component="span" className={styles.selectedRowTitle}>{item.name}</Text>
              <Text component="span" className={styles.selectedRowTone}>
                {stance === 'like' ? 'بیشتر شبیه این' : 'کمتر شبیه این'}
              </Text>
            </Box>
            <UnstyledButton
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(stance, item.id)}
              aria-label={`حذف ${item.name} از انتخاب‌ها`}
            >
              <IconTrash size={18} stroke={1.8} aria-hidden="true" />
            </UnstyledButton>
          </Box>
        ))}
      </Box>
    </section>
  );
}

export default function TasteBuilder({ likes = [], dislikes = [], onAdd, onRemove }) {
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [suggestionsAttempt, setSuggestionsAttempt] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestions([]);
    apiClient.get('/onboarding/v2/candidates', { params: { limit: 6 } })
      .then(({ data }) => {
        if (!cancelled) setSuggestions(normalizeResults(data));
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestionsError('پیشنهادهای شروع بارگذاری نشدند؛ می‌توانی جست‌وجو کنی یا این مرحله را رد کنی.');
        }
      })
      .finally(() => { if (!cancelled) setSuggestionsLoading(false); });
    return () => { cancelled = true; };
  }, [suggestionsAttempt]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      setSearchError(null);
      setSearched(false);
      return undefined;
    }
    if (!online) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      setSearchError('برای جست‌وجوی غذا دوباره به اینترنت وصل شو.');
      return undefined;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);
    setSearchError(null);
    const timer = window.setTimeout(async () => {
      try {
        // Use the onboarding-specific search so the uncommitted safety draft is
        // enforced before a recipe is offered for taste calibration.
        const { data } = await apiClient.get('/onboarding/v2/candidates', { params: { q: term, limit: 6 } });
        if (currentRequest !== requestId.current) return;
        setResults(normalizeResults(data));
        setSearched(true);
      } catch {
        if (currentRequest !== requestId.current) return;
        setResults([]);
        setSearched(true);
        setSearchError('جست‌وجو انجام نشد. دوباره تلاش کن.');
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [online, query, searchAttempt]);

  const selectedIds = useMemo(
    () => new Set([...likes, ...dislikes].map((item) => String(item.id))),
    [dislikes, likes],
  );

  const choose = (stance, item) => {
    onAdd(stance, item);
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const searchStatus = searchError
    || (loading ? 'در حال جست‌وجو…' : null)
    || (searched && !results.length ? 'غذایی با این عبارت پیدا نشد.' : null);

  return (
    <Box className={styles.tasteBuilder}>
      <section className={styles.quickSection} aria-labelledby={`${resultsId}-quick-title`}>
        <Box className={styles.quickHeader}>
          <Text id={`${resultsId}-quick-title`} component="h3" className={styles.sectionTitle}>کدام‌ها به ذائقه‌ات نزدیک‌ترند؟</Text>
          <Text component="span" className={styles.selectedGroupHint}>{likes.length + dislikes.length} انتخاب</Text>
        </Box>
        <Text component="p" className={styles.sectionHelp}>یک یا دو انتخاب هم برای شروع کافی است.</Text>

        {suggestionsLoading ? (
          <Box className={styles.quickGrid} role="status" aria-label="در حال آماده‌کردن غذاهای پیشنهادی">
            {Array.from({ length: 4 }, (_, index) => <Box className={styles.quickSkeleton} key={index} />)}
          </Box>
        ) : null}

        {suggestionsError ? (
          <Box className={styles.inlineState} role="status">
            <span>{suggestionsError}</span>
            <UnstyledButton
              type="button"
              className={styles.inlineRetry}
              onClick={() => setSuggestionsAttempt((value) => value + 1)}
            >
              <IconRefresh size={15} stroke={1.8} aria-hidden="true" />
              تلاش دوباره
            </UnstyledButton>
          </Box>
        ) : null}

        {!suggestionsLoading && !suggestionsError && !suggestions.length ? (
          <Box className={styles.inlineState}>فعلاً غذای مناسبی برای کالیبراسیون پیدا نشد؛ این مرحله اختیاری است.</Box>
        ) : null}

        {suggestions.length ? (
          <Box className={styles.quickGrid}>
            {suggestions.map((item) => {
              const selected = selectedIds.has(item.id);
              return (
                <Box className={styles.quickCard} key={item.id} data-selected={selected || undefined}>
                  <Text component="span" className={styles.quickTitle}>{item.name}</Text>
                  {selected ? (
                    <Text component="span" className={styles.searchResultSelected}>انتخاب شد</Text>
                  ) : (
                    <Box className={styles.quickActions}>
                      <UnstyledButton
                        type="button"
                        className={styles.quickAction}
                        data-tone="like"
                        disabled={likes.length >= MAX_LIKES}
                        onClick={() => choose('like', item)}
                        aria-label={`غذای ${item.name} را می‌پسندم`}
                      >
                        <IconHeart size={17} stroke={1.9} aria-hidden="true" />
                      </UnstyledButton>
                      <UnstyledButton
                        type="button"
                        className={styles.quickAction}
                        data-tone="dislike"
                        disabled={dislikes.length >= MAX_DISLIKES}
                        onClick={() => choose('dislike', item)}
                        aria-label={`غذای ${item.name} را نمی‌پسندم`}
                      >
                        <IconThumbDown size={17} stroke={1.9} aria-hidden="true" />
                      </UnstyledButton>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : null}
      </section>

      <details className={styles.details}>
        <summary className={styles.detailsSummary}>غذای دیگری در ذهن داری؟ جست‌وجو کن</summary>
        <Box className={styles.detailsBody}>
      <Box className={styles.searchField} data-loading={loading || undefined}>
        {loading
          ? <IconLoader2 className={styles.spinner} size={20} aria-hidden="true" />
          : online
            ? <IconSearch size={20} stroke={1.8} aria-hidden="true" />
            : <IconWifiOff size={20} stroke={1.8} aria-hidden="true" />}
        <input
          className={styles.searchInput}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="جست‌وجوی غذا"
          aria-controls={results.length ? resultsId : undefined}
          aria-busy={loading}
          aria-describedby={`${resultsId}-hint`}
          autoComplete="off"
          placeholder="مثلاً عدس‌پلو یا سالاد سزار"
        />
      </Box>
      <Text id={`${resultsId}-hint`} component="p" className={styles.fieldHint}>
        نام یک غذای واقعی را بنویس؛ حداکثر ۳ پسند و ۲ نپسند.
      </Text>

      <Box className={styles.srStatus} role="status" aria-live="polite">
        {searchStatus || ''}
      </Box>
      <Box className={styles.srStatus} role="status" aria-live="polite">
        {`${likes.length} پسند و ${dislikes.length} نپسند ثبت شده`}
      </Box>

      {searchError ? (
        <Box className={styles.inlineState} data-tone="error" role="alert">
          <span>{searchError}</span>
          <UnstyledButton
            type="button"
            className={styles.inlineRetry}
            disabled={!online}
            onClick={() => setSearchAttempt((value) => value + 1)}
          >
            <IconRefresh size={15} stroke={1.8} aria-hidden="true" />
            تلاش دوباره
          </UnstyledButton>
        </Box>
      ) : null}

      {!searchError && searched && !loading && !results.length ? (
        <Box className={styles.inlineState}>غذایی با این عبارت پیدا نشد؛ املای دیگری را امتحان کن.</Box>
      ) : null}

      {results.length ? (
        <ul id={resultsId} className={styles.searchResults} aria-label="نتایج جست‌وجوی غذا">
          {results.map((item) => {
            const selected = selectedIds.has(item.id);
            const likeLimit = likes.length >= MAX_LIKES;
            const dislikeLimit = dislikes.length >= MAX_DISLIKES;
            return (
              <li className={styles.searchResult} key={item.id}>
                <Box className={styles.searchResultCopy}>
                  <Text component="span" className={styles.searchResultTitle}>{item.name}</Text>
                  {selected ? <Text component="span" className={styles.searchResultSelected}>انتخاب شده</Text> : null}
                </Box>
                {!selected ? (
                  <Box className={styles.searchResultActions} aria-label={`نظر دربارهٔ ${item.name}`}>
                    <UnstyledButton
                      type="button"
                      className={styles.stanceButton}
                      data-tone="like"
                      disabled={likeLimit}
                      aria-label={`غذای ${item.name} را می‌پسندم`}
                      onClick={() => choose('like', item)}
                    >
                      <IconHeart size={17} stroke={1.9} aria-hidden="true" />
                      می‌پسندم
                    </UnstyledButton>
                    <UnstyledButton
                      type="button"
                      className={styles.stanceButton}
                      data-tone="dislike"
                      disabled={dislikeLimit}
                      aria-label={`غذای ${item.name} را نمی‌پسندم`}
                      onClick={() => choose('dislike', item)}
                    >
                      <IconThumbDown size={17} stroke={1.9} aria-hidden="true" />
                      نمی‌پسندم
                    </UnstyledButton>
                  </Box>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
        </Box>
      </details>

      <SelectedGroup
        title="می‌پسندم"
        hint={`${likes.length} از ${MAX_LIKES}`}
        items={likes}
        stance="like"
        onRemove={onRemove}
      />
      <SelectedGroup
        title="نمی‌پسندم"
        hint={`${dislikes.length} از ${MAX_DISLIKES}`}
        items={dislikes}
        stance="dislike"
        onRemove={onRemove}
      />
    </Box>
  );
}
