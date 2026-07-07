import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';

const authState = vi.hoisted(() => ({ current: {} }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.current,
}));

function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>APP_OK</div>} />
        </Route>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/onboarding" element={<div>ONBOARDING_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  authState.current = {
    token: '',
    user: null,
    isGuest: false,
    isLoading: false,
    guestEnabled: false,
    clearAuth: vi.fn(),
  };
});

describe('RequireAuth launch state machine', () => {
  it('redirects no-token users to /login', () => {
    mount('/');
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
  });

  it('redirects registered incomplete users to onboarding', () => {
    authState.current = { ...authState.current, token: 't', user: { id: 'u1', isGuest: false, onboardingComplete: false } };
    mount('/');
    expect(screen.getByText('ONBOARDING_PAGE')).toBeInTheDocument();
  });

  it('renders app for registered complete users', () => {
    authState.current = { ...authState.current, token: 't', user: { id: 'u1', isGuest: false, onboardingComplete: true } };
    mount('/');
    expect(screen.getByText('APP_OK')).toBeInTheDocument();
  });

  it('clears disabled guest sessions and redirects to login', () => {
    const clearAuth = vi.fn();
    authState.current = { ...authState.current, token: 'g', user: { id: 'g1', isGuest: true }, isGuest: true, guestEnabled: false, clearAuth };
    mount('/');
    expect(clearAuth).toHaveBeenCalled();
    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
  });
});
