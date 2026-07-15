import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_BUTTON_WIDTH = 320;
const GOOGLE_BUTTON_MIN_WIDTH = 100;

function getResponsiveButtonWidth(container) {
  const availableWidth = Math.floor(container.getBoundingClientRect().width);
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return GOOGLE_BUTTON_WIDTH;
  return Math.max(GOOGLE_BUTTON_MIN_WIDTH, Math.min(GOOGLE_BUTTON_WIDTH, availableWidth));
}

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
  const loginWithGoogleRef = useRef(loginWithGoogle);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const enabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    loginWithGoogleRef.current = loginWithGoogle;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [loginWithGoogle, onError, onSuccess]);

  useEffect(() => {
    if (!enabled || !clientId) return undefined;
    let cancelled = false;
    let initialized = false;
    let lastWidth = null;
    let resizeObserver;

    const renderOfficialButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
      const width = getResponsiveButtonWidth(containerRef.current);
      if (!initialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: async (response) => {
            const credential = response?.credential;
            if (!credential) return;
            try {
              const user = await loginWithGoogleRef.current(credential);
              onSuccessRef.current?.(user);
            } catch (error) {
              onErrorRef.current?.(error);
            }
          },
        });
        initialized = true;
      }
      if (lastWidth === width) return;
      containerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width,
      });
      lastWidth = width;
      setReady(true);
    };

    const observeContainer = () => {
      renderOfficialButton();
      if (resizeObserver || typeof ResizeObserver === 'undefined' || !containerRef.current) return;
      resizeObserver = new ResizeObserver(renderOfficialButton);
      resizeObserver.observe(containerRef.current);
    };

    const handleScriptError = () => {
      if (!cancelled) onErrorRef.current?.(new Error('google_identity_script_failed'));
    };

    if (window.google?.accounts?.id) {
      observeContainer();
      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
      };
    }

    const script = loadGoogleIdentityScript();
    script.addEventListener('load', observeContainer);
    script.addEventListener('error', handleScriptError);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      script.removeEventListener('load', observeContainer);
      script.removeEventListener('error', handleScriptError);
    };
  }, [clientId, enabled]);

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
