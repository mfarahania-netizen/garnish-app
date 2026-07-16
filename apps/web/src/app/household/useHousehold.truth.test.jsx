import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  listHouseholds: vi.fn(),
  getHousehold: vi.fn(),
  createHousehold: vi.fn(),
  listPendingInvites: vi.fn(),
  listOutgoingInvites: vi.fn(),
  inviteMember: vi.fn(),
  revokeInvite: vi.fn(),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  getShopping: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  markUnavailable: vi.fn(),
  resolveDecision: vi.fn(),
  cancelDecision: vi.fn(),
  startSession: vi.fn(),
  endSession: vi.fn(),
  removeMember: vi.fn(),
  leaveHousehold: vi.fn(),
  transferOwner: vi.fn(),
}));

vi.mock('./householdApi', () => ({ default: api, householdApi: api }));

import { useHousehold } from './useHousehold';

const EMPTY_LIST = { households: [] };
const EMPTY_INVITES = { invites: [] };
const EMPTY_SHOPPING = { list: null, items: [], openDecisions: [], activeSession: null };

function wrapper({ children }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function detail(id, name = 'خانهٔ ما') {
  return {
    household: { id, name, role: 'OWNER', status: 'ACTIVE', version: 1 },
    members: [{ id: `member-${id}`, userId: 'u1', role: 'OWNER', status: 'ACTIVE', version: 1 }],
    capabilities: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listHouseholds.mockResolvedValue(EMPTY_LIST);
  api.listPendingInvites.mockResolvedValue(EMPTY_INVITES);
  api.listOutgoingInvites.mockResolvedValue(EMPTY_INVITES);
  api.getHousehold.mockImplementation((id) => Promise.resolve(detail(id)));
  api.getShopping.mockResolvedValue(EMPTY_SHOPPING);
});

describe('useHousehold mutation truth guarantees', () => {
  it('keeps a confirmed created home visible when its projection refresh fails', async () => {
    api.listHouseholds
      .mockResolvedValueOnce(EMPTY_LIST)
      .mockRejectedValueOnce(new Error('projection unavailable'));
    api.createHousehold.mockResolvedValue(detail('h-new'));
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let mutation;
    await act(async () => { mutation = await result.current.createHousehold('خانهٔ ما'); });

    expect(mutation).toMatchObject({ ok: true, refreshFailed: true });
    expect(result.current.household?.id).toBe('h-new');
    expect(result.current.status).not.toBe('error');
    expect(result.current.operationError).toMatchObject({ kind: 'stale_display' });
    expect(api.createHousehold).toHaveBeenCalledWith('خانهٔ ما', expect.stringMatching(/^.{8,128}$/));
  });

  it('blocks new writes after an unknown response and reuses the create intent key after reconciliation', async () => {
    api.createHousehold
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(detail('h-new'));
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.createHousehold('خانهٔ ما'); });
    const firstKey = api.createHousehold.mock.calls[0][1];
    expect(result.current.reconciliationRequired).toBe(true);

    await act(async () => { await result.current.createHousehold('خانهٔ ما'); });
    expect(api.createHousehold).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.refresh(); });
    expect(result.current.reconciliationRequired).toBe(false);

    await act(async () => { await result.current.createHousehold('خانهٔ ما'); });
    expect(api.createHousehold).toHaveBeenCalledTimes(2);
    expect(api.createHousehold.mock.calls[1][1]).toBe(firstKey);
  });

  it('selects the household returned by an accepted invite', async () => {
    const oldHome = { id: 'h-old', name: 'خانهٔ قبلی', role: 'MEMBER', status: 'ACTIVE', version: 1 };
    const joined = detail('h-joined', 'خانهٔ مادر');
    api.listHouseholds
      .mockResolvedValueOnce({ households: [oldHome] })
      .mockResolvedValueOnce({ households: [oldHome, joined.household] });
    api.acceptInvite.mockResolvedValue(joined);
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.household?.id).toBe('h-old'));

    await act(async () => { await result.current.respondToInvite('invite-1', 'accept'); });

    expect(result.current.household?.id).toBe('h-joined');
  });

  it('maps a duplicate item 409 to a business message, not a stale-version conflict', async () => {
    const home = { id: 'h1', name: 'خانهٔ ما', role: 'OWNER', status: 'ACTIVE', version: 1 };
    api.listHouseholds.mockResolvedValue({ households: [home] });
    api.updateItem.mockRejectedValue({
      response: { status: 409, data: { code: 'shopping_item_already_exists' } },
    });
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.household?.id).toBe('h1'));

    let mutation;
    await act(async () => {
      mutation = await result.current.updateItem({ id: 'i1', version: 2 }, { name: 'شیر' });
    });

    expect(mutation.error).toMatchObject({
      kind: 'business',
      code: 'shopping_item_already_exists',
      title: 'این قلم از قبل در فهرست هست',
    });
    expect(mutation.error.kind).not.toBe('conflict');
  });

  it('cancels a creator decision with the contract version and refreshes shopping', async () => {
    const home = { id: 'h1', name: 'خانهٔ ما', role: 'OWNER', status: 'ACTIVE', version: 1 };
    const decision = { id: 'd1', version: 3, createdByMe: true, canCancel: true, canResolve: false };
    api.listHouseholds.mockResolvedValue({ households: [home] });
    api.cancelDecision.mockResolvedValue({
      item: { id: 'i1', status: 'NEEDED', version: 5 },
      decision: { ...decision, status: 'CANCELLED', version: 4 },
    });
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let mutation;
    await act(async () => { mutation = await result.current.cancelDecision(decision); });

    expect(mutation.ok).toBe(true);
    expect(api.cancelDecision).toHaveBeenCalledWith('h1', 'd1', 3);
    expect(api.getShopping).toHaveBeenCalledTimes(2);
  });

  it('maps self-resolution rejection to waiting-or-cancel guidance', async () => {
    const home = { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', status: 'ACTIVE', version: 1 };
    api.listHouseholds.mockResolvedValue({ households: [home] });
    api.resolveDecision.mockRejectedValue({
      response: { status: 409, data: { code: 'household_decision_self_resolution_forbidden' } },
    });
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let mutation;
    await act(async () => {
      mutation = await result.current.resolveDecision({ id: 'd1', version: 2 }, 'شیر جایگزین');
    });

    expect(mutation.error).toMatchObject({
      kind: 'business',
      code: 'household_decision_self_resolution_forbidden',
      title: 'این تصمیم را یکی از اعضای دیگر پاسخ می‌دهد',
    });
  });

  it('maps a one-member decision rejection to an invite-member explanation', async () => {
    const home = { id: 'h1', name: 'خانهٔ من', role: 'OWNER', status: 'ACTIVE', version: 1 };
    api.listHouseholds.mockResolvedValue({ households: [home] });
    api.markUnavailable.mockRejectedValue({
      response: { status: 409, data: { code: 'household_decision_requires_other_member' } },
    });
    const { result } = renderHook(() => useHousehold(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let mutation;
    await act(async () => {
      mutation = await result.current.markUnavailable({ id: 'i1', version: 1 }, 'شیر جایگزین');
    });

    expect(mutation.error).toMatchObject({
      kind: 'business',
      code: 'household_decision_requires_other_member',
      title: 'برای پرسیدن، عضو دیگری لازم است',
    });
  });
});
