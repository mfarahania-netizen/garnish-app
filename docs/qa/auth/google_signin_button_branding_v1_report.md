# Google Sign-In Button Branding v1

## Verdict

PASS

The handmade Google sign-in button was removed from the login form. The login screen now uses the official Google Identity Services rendered button via `google.accounts.id.renderButton`.

## Files Changed

- `apps/web/src/components/auth/GoogleSignInButton.jsx`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/components/auth/AuthForm.test.jsx`
- `apps/web/src/app/login/LoginPage.google.test.jsx`
- `docs/qa/auth/screenshots/google_signin_button_branding_v1.png`
- `docs/qa/auth/google_signin_button_branding_v1_report.md`

## Official GIS RenderButton Config

```js
google.accounts.id.renderButton(buttonContainer, {
  type: 'standard',
  theme: 'outline',
  size: 'large',
  shape: 'pill',
  text: 'continue_with',
  logo_alignment: 'left',
  width: 320,
});
```

Initialization uses:

```js
window.google.accounts.id.initialize({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  callback: handleCredentialResponse,
  auto_select: false,
});
```

The Client ID is read from `VITE_GOOGLE_CLIENT_ID`; it is not hardcoded in source files.

## Screenshot

`docs/qa/auth/screenshots/google_signin_button_branding_v1.png`

Browser smoke confirmed an official Google iframe:

- `https://accounts.google.com/gsi/button?...`
- title: `دکمه «ورود به سیستم با Google»`

## Build And Test Result

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx src/app/login/LoginPage.google.test.jsx`: PASS, 12 tests.
- `pnpm --dir apps/web build`: PASS.
- `pnpm --dir apps/server build`: PASS.

## Guardrails Checked

- No Google Client Secret used.
- No Gmail, Drive, Calendar, Contacts, or Google Fit scopes requested.
- OTP login remains available.
- Guest mode was not re-enabled.
- No manual Google logo asset was added.
- No custom fake Google button remains in source.
- No recipe or ingredient data changed.
- Production was not touched.

## Remaining Risks

- Real account-picker smoke still depends on Google Cloud Authorized JavaScript Origins matching the active local/prod origin.
- If Vite falls back from `5173` to another port, that port must also be allowed in Google Cloud for local testing.
