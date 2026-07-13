import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavDrawer from './NavDrawer';

const authState = vi.hoisted(() => ({ current: {} }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState.current,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
}));

vi.mock('../lib/apiClient', () => ({ default: { get: vi.fn() } }));

vi.mock('@mantine/hooks', () => ({ useReducedMotion: () => true }));

vi.mock('./navConfig', () => ({
  DRAWER_PRIMARY: [{ to: '/', label: 'خانه', Icon: () => null, end: true }],
  DRAWER_SECONDARY: [],
}));

vi.mock('@mantine/core', () => ({
  Box: ({ component: Component = 'div', children, ...props }) => <Component {...props}>{children}</Component>,
  Drawer: ({ opened, children, ...props }) => (opened ? <aside {...props}>{children}</aside> : null),
  Text: ({ component: Component = 'span', children, ...props }) => <Component {...props}>{children}</Component>,
  UnstyledButton: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconX: () => null,
  IconLeaf: () => null,
  IconLogout: () => null,
  IconLayoutDashboard: () => null,
  IconLogin2: () => null,
}));

function mount() {
  return render(
    <MemoryRouter>
      <NavDrawer opened onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.current = {
    token: 'guest-token',
    user: { id: 'guest-1', isGuest: true },
    logout: vi.fn(),
    guestEnabled: false,
  };
});

describe('NavDrawer launch auth behavior', () => {
  it('does not show guest CTA when guest mode is disabled', () => {
    mount();
    expect(screen.queryByText('خروج از حالت دمو')).not.toBeInTheDocument();
    expect(screen.getByText('خروج')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'خروج از حساب' })).toBeInTheDocument();
  });
});
