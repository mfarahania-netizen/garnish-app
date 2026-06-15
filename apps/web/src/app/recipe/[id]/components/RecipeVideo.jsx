// features/recipe/[id]/components/RecipeVideo.jsx
// RECIPE-L4-07: thin FUNCTIONAL surfacing of recipe.videoUrl (no visual/brand design).
// Sanitizes/allowlists the source; degrades gracefully (renders nothing) if absent or unsupported.
import { Paper, Text, Group, Anchor } from '@mantine/core';
import { IconVideo } from '@tabler/icons-react';

const ALLOWED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.aparat.com', 'aparat.com'];

// Returns { kind: 'embed'|'file'|'link', src } or null if the URL is unsafe/unsupported.
function sanitizeVideoUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== 'https:') return null; // https only
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') return { kind: 'embed', src: `https://www.youtube.com/embed/${url.pathname.slice(1)}` };
  if (host.endsWith('youtube.com')) {
    const v = url.searchParams.get('v');
    return v ? { kind: 'embed', src: `https://www.youtube.com/embed/${v}` } : null;
  }
  if (host.endsWith('vimeo.com')) return { kind: 'embed', src: `https://player.vimeo.com/video/${url.pathname.split('/').filter(Boolean).pop()}` };
  if (host.endsWith('aparat.com')) return { kind: 'link', src: url.href };
  if (ALLOWED_HOSTS.includes(host) && url.pathname.endsWith('.mp4')) return { kind: 'file', src: url.href };
  return null;
}

export default function RecipeVideo({ recipe }) {
  const { videoUrl } = recipe || {};
  const safe = sanitizeVideoUrl(videoUrl);
  if (!safe) return null; // no video / unsupported source → degrade silently

  return (
    <Paper p="sm" radius="lg" mb="lg" withBorder data-testid="recipe-video">
      <Group gap="xs" mb="xs"><IconVideo size={18} color="#FF6B35" /><Text size="sm" fw={700}>ویدیوی آموزشی</Text></Group>
      {safe.kind === 'embed' && (
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe src={safe.src} title="recipe video" allow="encrypted-media; picture-in-picture" allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }} />
        </div>
      )}
      {safe.kind === 'file' && <video src={safe.src} controls style={{ width: '100%', borderRadius: 12 }} />}
      {safe.kind === 'link' && <Anchor href={safe.src} target="_blank" rel="noopener noreferrer">تماشای ویدیو</Anchor>}
    </Paper>
  );
}
