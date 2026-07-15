import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage, { sanitizeReturnPath } from './page';

vi.mock('../../components/auth/AuthForm', () => ({
  default: ({ onSuccess }) => (
    <div>
      <button type="button" onClick={() => onSuccess({ id: 'u1', onboardingComplete: false })}>google incomplete</button>
      <button type="button" onClick={() => onSuccess({ id: 'u2', onboardingComplete: true })}>google complete</button>
    </div>
  ),
}));

vi.mock('@mantine/core', () => ({
  Box: ({ component: Component = 'div', children, ...props }) => <Component {...props}>{children}</Component>,
}));

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<div>ONBOARDING_PAGE</div>} />
        <Route path="/recipes" element={<div>RECIPES_PAGE</div>} />
        <Route path="/" element={<div>HOME_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage Google routing', () => {
  it('routes incomplete Google users to onboarding', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'google incomplete' }));
    expect(screen.getByText('ONBOARDING_PAGE')).toBeInTheDocument();
  });

  it('routes complete Google users to home', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'google complete' }));
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('keeps a valid return path inside the app', () => {
    renderLogin('/login?from=%2Frecipes%3Ftab%3Dfavorites');
    fireEvent.click(screen.getByRole('button', { name: 'google complete' }));
    expect(screen.getByText('RECIPES_PAGE')).toBeInTheDocument();
  });

  it.each([
    'https://evil.example/phishing',
    '//evil.example/phishing',
    '/\\\\evil.example/phishing',
    'javascript:alert(1)',
    '/login',
  ])('rejects an unsafe return path: %s', (unsafePath) => {
    expect(sanitizeReturnPath(unsafePath)).toBe('/');
  });

  it('falls back to home when the return query points off-site', () => {
    renderLogin('/login?from=https%3A%2F%2Fevil.example%2Fphishing');
    fireEvent.click(screen.getByRole('button', { name: 'google complete' }));
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });
});
