import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_BUTTON_WIDTH = 320;

function loadGoogleIdentityScript() {
  const existing = document.querySelector('script[data-garnish-google-identity="true"]');
  if (existing) return existing;
  const script = document.createElement('script');
  script.src = GOOGLE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.dataset.garnishGoogleIdentity = 'true';
  document.head.appendChild(script);
  return script;
}

export default function GoogleSignInButton({ onSuccess, onError }) {
  const { loginWithGoogle } = useAuth();
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const enabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    if (!enabled || !clientId) return undefined;
    let cancelled = false;

    const renderOfficialButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: async (response) => {
          const credential = response?.credential;
          if (!credential) return;
          try {
            const user = await loginWithGoogle(credential);
            onSuccess?.(user);
          } catch (error) {
            onError?.(error);
          }
        },
      });
      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: GOOGLE_BUTTON_WIDTH,
      });
      setReady(true);
    };

    if (window.google?.accounts?.id) {
      renderOfficialButton();
      return () => { cancelled = true; };
    }

    const script = loadGoogleIdentityScript();
    script.addEventListener('load', renderOfficialButton);
    script.addEventListener('error', () => {
      if (!cancelled) onError?.(new Error('google_identity_script_failed'));
    });

    return () => {
      cancelled = true;
      script.removeEventListener('load', renderOfficialButton);
    };
  }, [clientId, enabled, loginWithGoogle, onError, onSuccess]);

  if (!enabled || !clientId) return null;

  return (
    <div
      aria-label="ورود با گوگل"
      data-google-ready={ready ? 'true' : 'false'}
      data-testid="official-google-signin"
      ref={containerRef}
      style={{
        inlineSize: '100%',
        minBlockSize: 44,
        display: 'grid',
        placeItems: 'center',
      }}
    />
  );
}
