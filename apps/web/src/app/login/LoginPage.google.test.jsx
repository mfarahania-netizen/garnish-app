import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './page';

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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<div>ONBOARDING_PAGE</div>} />
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
});
