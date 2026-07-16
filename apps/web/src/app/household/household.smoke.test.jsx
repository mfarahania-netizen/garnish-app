import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import HouseholdPage from './page';

vi.mock('./useHousehold', () => ({ useHousehold: vi.fn() }));
import { useHousehold } from './useHousehold';

vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn(() => ({ token: 'test-token', user: { id: 'u1', phoneVerified: true }, isLoading: false })),
}));
import { useAuth } from '../../context/AuthContext';

function baseModel(overrides = {}) {
  return {
    status: 'ready',
    online: true,
    busyAction: null,
    reconciliationRequired: false,
    operationError: null,
    clearOperationError: vi.fn(),
    households: [],
    household: null,
    selectHousehold: vi.fn(),
    members: [],
    capabilities: [],
    invites: [],
    incomingInvitesStatus: 'ready',
    refreshIncomingInvites: vi.fn(),
    outgoingInvites: [],
    outgoingInvitesStatus: 'ready',
    refreshOutgoingInvites: vi.fn(),
    list: null,
    items: [],
    decisions: [],
    activeSession: null,
    refresh: vi.fn(),
    createHousehold: vi.fn(async () => ({ ok: true })),
    inviteMember: vi.fn(async () => ({ ok: true })),
    revokeInvite: vi.fn(async () => ({ ok: true })),
    respondToInvite: vi.fn(async () => ({ ok: true })),
    addItem: vi.fn(async () => ({ ok: true })),
    updateItem: vi.fn(async () => ({ ok: true })),
    removeItem: vi.fn(async () => ({ ok: true })),
    markUnavailable: vi.fn(async () => ({ ok: true })),
    resolveDecision: vi.fn(async () => ({ ok: true })),
    cancelDecision: vi.fn(async () => ({ ok: true })),
    startSession: vi.fn(async () => ({ ok: true })),
    endSession: vi.fn(async () => ({ ok: true })),
    removeMember: vi.fn(async () => ({ ok: true })),
    leaveHousehold: vi.fn(async () => ({ ok: true })),
    transferOwner: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

function renderPage(model, props = {}) {
  useHousehold.mockReturnValue(model);
  return renderWithProviders(<HouseholdPage enabled {...props} />, { route: '/household' });
}

describe('HouseholdPage thin-slice smoke', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: 'test-token', user: { id: 'u1', phoneVerified: true }, isLoading: false });
  });

  it('keeps the route safely unavailable when the feature flag is off', () => {
    const model = baseModel({ status: 'disabled' });
    useHousehold.mockReturnValue(model);
    renderWithProviders(<HouseholdPage enabled={false} />, { route: '/household' });

    expect(screen.getByRole('heading', { name: 'خرید مشترک هنوز فعال نیست' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'رفتن به لیست خرید' })).toBeInTheDocument();
  });

  it('blocks guest accounts before any Household query is enabled', () => {
    useAuth.mockReturnValue({ token: 'guest-token', user: { id: 'guest-1', isGuest: true }, isLoading: false });
    useHousehold.mockReturnValue(baseModel({ status: 'disabled' }));
    renderWithProviders(<HouseholdPage enabled />, { route: '/household' });

    expect(screen.getByRole('heading', { name: 'برای خرید مشترک، اول با شماره وارد شو' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود با شماره' })).toBeInTheDocument();
    expect(useHousehold).toHaveBeenCalledWith({ enabled: false });
  });

  it('keeps the pilot unavailable to durable accounts without a verified phone', () => {
    useAuth.mockReturnValue({ token: 'google-token', user: { id: 'google-1', phoneVerified: false }, isLoading: false });
    useHousehold.mockReturnValue(baseModel({ status: 'disabled' }));
    renderWithProviders(<HouseholdPage enabled />, { route: '/household' });

    expect(screen.getByRole('heading', { name: 'شمارهٔ تأییدشده لازم است' })).toBeInTheDocument();
    expect(screen.getByText(/امکان اتصال شماره به حساب گوگل هنوز فراهم نیست/)).toBeInTheDocument();
    expect(useHousehold).toHaveBeenCalledWith({ enabled: false });
  });

  it('shows targeted pending invites before creation and creates a named home', async () => {
    const model = baseModel({
      invites: [{ id: 'inv-1', household: { id: 'h2', name: 'خانهٔ مادر' }, invitedBy: { name: 'سارا' } }],
    });
    renderPage(model);

    const inviteHeading = screen.getByRole('heading', { name: 'دعوت‌های تو' });
    const createHeading = screen.getByRole('heading', { name: 'یک خانه بساز' });
    expect(inviteHeading.compareDocumentPosition(createHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(screen.getByLabelText('نام خانه'), { target: { value: 'خانهٔ ما' } });
    fireEvent.click(screen.getByRole('button', { name: 'ساختن خانه' }));
    await waitFor(() => expect(model.createHousehold).toHaveBeenCalledWith('خانهٔ ما'));
  });

  it('keeps personal planning and shopping one tap away from خرید باهم', () => {
    renderPage(baseModel());

    expect(screen.getByRole('heading', { level: 1, name: 'خرید باهم' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /برنامه هفتگی/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /لیست خرید شخصی/ })).toBeInTheDocument();
  });

  it('invites by phone, keeps outgoing rows generic, and revokes with two taps', async () => {
    const outgoingInvite = { id: 'out-1', status: 'PENDING', createdAt: '2026-07-15T12:00:00Z' };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 2 }],
      members: [{ id: 'm1' }, { id: 'm2' }],
      outgoingInvites: [outgoingInvite],
    });
    renderPage(model);

    fireEvent.click(screen.getByRole('button', { name: 'دعوت یک نفر' }));
    fireEvent.change(screen.getByLabelText('شمارهٔ موبایل عضو'), { target: { value: '۰۹۱۲ ۱۲۳ ۴۵۶۷' } });
    fireEvent.click(screen.getByRole('button', { name: 'ثبت دعوت داخل اپ' }));

    await waitFor(() => expect(model.inviteMember).toHaveBeenCalledWith('09121234567'));
    expect(await screen.findByText(/دعوت داخل اپ ثبت شد؛ پیامکی ارسال نمی‌شود/)).toBeInTheDocument();
    expect(screen.getByText('دعوت در انتظار')).toBeInTheDocument();
    expect(screen.getByText(/ثبت‌شده در.*شماره و وضعیت حساب نمایش داده نمی‌شود/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'لغو دعوت' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید لغو' }));
    await waitFor(() => expect(model.revokeInvite).toHaveBeenCalledWith(outgoingInvite));
  });

  it('adds, buys, and can repeat unavailable after a substitution was approved', async () => {
    const milk = { id: 'i1', name: 'شیر کم‌چرب', amount: '۲', unit: 'عدد', status: 'SUBSTITUTION_APPROVED', version: 3 };
    const similarMilk = { id: 'i2', name: 'شیر کم‌چرب بدون لاکتوز برند ب با بسته‌بندی خانوادگی', status: 'NEEDED', version: 1 };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      items: [milk, similarMilk],
    });
    renderPage(model);

    expect(screen.getByText(similarMilk.name)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('افزودن به لیست مشترک'), { target: { value: 'گوجه' } });
    fireEvent.click(screen.getByRole('button', { name: 'افزودن' }));
    await waitFor(() => expect(model.addItem).toHaveBeenCalledWith('گوجه'));

    fireEvent.click(screen.getByRole('button', { name: 'خریدم: شیر کم‌چرب' }));
    await waitFor(() => expect(model.updateItem).toHaveBeenCalledWith(milk, { status: 'BOUGHT' }));

    fireEvent.click(screen.getByRole('button', { name: 'پیدا نشد: شیر کم‌چرب' }));
    expect(screen.getByLabelText('اگر این نبود، چی بگیریم؟')).toHaveAttribute('maxlength', '80');
    fireEvent.change(screen.getByLabelText('اگر این نبود، چی بگیریم؟'), { target: { value: 'شیر کم‌چرب' } });
    fireEvent.click(screen.getByRole('button', { name: 'پرسیدن از خانه' }));
    await waitFor(() => expect(model.markUnavailable).toHaveBeenCalledWith(milk, 'شیر کم‌چرب'));
  });

  it('closes and clears the unavailable form when the item becomes waiting after a successful submit', async () => {
    const item = { id: 'i1', name: 'شیر', status: 'NEEDED', version: 1 };
    const waitingDecision = {
      id: 'd1',
      itemId: item.id,
      question: '«شیر» موجود نیست؛ کدام انتخاب بهتر است؟',
      options: ['شیر بدون لاکتوز', 'فعلاً نخر'],
      status: 'OPEN',
      version: 1,
      createdByMe: true,
      canResolve: false,
      canCancel: true,
    };
    let resolveUnavailable;
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      members: [{ id: 'm1' }, { id: 'm2' }],
      items: [item],
      markUnavailable: vi.fn(() => new Promise((resolve) => { resolveUnavailable = resolve; })),
    });
    const waitingModel = {
      ...model,
      items: [{ ...item, status: 'DECISION_PENDING', version: 2 }],
      decisions: [waitingDecision],
    };
    let projectedModel = model;
    useHousehold.mockImplementation(() => projectedModel);
    function RegressionHarness() {
      const [, setProjectionVersion] = useState(0);
      const projectWaiting = () => {
        projectedModel = waitingModel;
        setProjectionVersion((value) => value + 1);
      };
      return (
        <>
          <button type="button" onClick={projectWaiting}>project waiting state</button>
          <HouseholdPage enabled />
        </>
      );
    }
    renderWithProviders(<RegressionHarness />, { route: '/household' });

    fireEvent.click(screen.getByRole('button', { name: 'پیدا نشد: شیر' }));
    const alternative = screen.getByLabelText('اگر این نبود، چی بگیریم؟');
    fireEvent.change(alternative, { target: { value: 'شیر بدون لاکتوز' } });
    fireEvent.click(screen.getByRole('button', { name: 'پرسیدن از خانه' }));
    await waitFor(() => expect(model.markUnavailable).toHaveBeenCalledWith(item, 'شیر بدون لاکتوز'));

    fireEvent.click(screen.getByRole('button', { name: 'project waiting state' }));

    expect(await screen.findByText('منتظر پاسخ خانه')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('اگر این نبود، چی بگیریم؟')).not.toBeInTheDocument());

    await act(async () => { resolveUnavailable({ ok: true }); });
    expect(screen.queryByLabelText('اگر این نبود، چی بگیریم؟')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('شیر بدون لاکتوز')).not.toBeInTheDocument();
  });

  it('transfers ownership with confirmation and keeps leave available to a member', async () => {
    const owner = { id: 'm1', userId: 'u1', name: 'تو', role: 'OWNER', status: 'ACTIVE', version: 2 };
    const member = { id: 'm2', userId: 'u2', name: 'سارا', role: 'MEMBER', status: 'ACTIVE', version: 1 };
    const ownerModel = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 2, version: 4 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 2, version: 4 }],
      members: [owner, member],
    });
    const { unmount } = renderPage(ownerModel);

    fireEvent.click(screen.getByText('اعضای خانه'));
    fireEvent.click(screen.getByRole('button', { name: 'مالک کن' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأیید مالکیت' }));
    await waitFor(() => expect(ownerModel.transferOwner).toHaveBeenCalledWith(member));
    unmount();

    const formerOwner = { ...owner, role: 'MEMBER', version: 3 };
    const memberModel = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2, version: 5 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2, version: 5 }],
      members: [formerOwner, { ...member, role: 'OWNER', version: 2 }],
    });
    renderPage(memberModel);
    fireEvent.click(screen.getByText('اعضای خانه'));
    expect(screen.getByRole('button', { name: 'ترک این خانه' })).toBeInTheDocument();
  });

  it('keeps core shopping usable when optional invite queries fail locally', () => {
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 1, version: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'OWNER', memberCount: 1, version: 2 }],
      incomingInvitesStatus: 'error',
      outgoingInvitesStatus: 'error',
    });
    renderPage(model);

    expect(screen.getByText('دعوت‌های تو بارگذاری نشد.')).toBeInTheDocument();
    expect(screen.getByText('دعوت‌های در انتظار بارگذاری نشد.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'لیست خرید مشترک' })).toBeInTheDocument();
    const retries = screen.getAllByRole('button', { name: 'دوباره' });
    fireEvent.click(retries[0]);
    fireEvent.click(retries[1]);
    expect(model.refreshIncomingInvites).toHaveBeenCalledTimes(1);
    expect(model.refreshOutgoingInvites).toHaveBeenCalledTimes(1);
  });

  it('renders a targeted decision and resolves with the exact offered option', async () => {
    const decision = {
      id: 'd1',
      itemId: 'i1',
      question: 'پنیر لبنه نبود؛ پنیر خامه‌ای بگیریم؟',
      options: ['پنیر خامه‌ای', 'SKIP'],
      status: 'OPEN',
      version: 4,
      createdByMe: false,
      canResolve: true,
      canCancel: false,
    };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      decisions: [decision],
    });
    renderPage(model);

    expect(screen.getByText(decision.question)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'بگیریم: پنیر خامه‌ای' }));
    await waitFor(() => expect(model.resolveDecision).toHaveBeenCalledWith(decision, 'پنیر خامه‌ای'));
  });

  it('shows a creator waiting state and only offers cancellation', async () => {
    const decision = {
      id: 'd-own',
      itemId: 'i1',
      question: '«شیر» موجود نیست؛ کدام انتخاب بهتر است؟',
      options: ['شیر بدون لاکتوز', 'فعلاً نخر'],
      status: 'OPEN',
      version: 2,
      createdByMe: true,
      canResolve: false,
      canCancel: true,
    };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      decisions: [decision],
    });
    renderPage(model);

    expect(screen.getByText('منتظر پاسخ خانه')).toBeInTheDocument();
    expect(screen.getByText(/این درخواست را تو فرستادی/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /بگیریم:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'لغو درخواست' }));

    await waitFor(() => expect(model.cancelDecision).toHaveBeenCalledWith(decision));
    expect(model.resolveDecision).not.toHaveBeenCalled();
  });

  it('disables unavailable for a one-member home and opens the invite path honestly', async () => {
    const item = { id: 'i1', name: 'شیر', status: 'NEEDED', version: 1 };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ من', role: 'OWNER', memberCount: 1 },
      households: [{ id: 'h1', name: 'خانهٔ من', role: 'OWNER', memberCount: 1 }],
      members: [{ id: 'm1', userId: 'u1', role: 'OWNER', status: 'ACTIVE' }],
      items: [item],
    });
    renderPage(model);

    expect(screen.getByRole('button', { name: 'پیدا نشد: شیر' })).toBeDisabled();
    expect(screen.getByText(/اول یک عضو دیگر به خانه اضافه کن/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'دعوت عضو' }));

    expect(await screen.findByLabelText('شمارهٔ موبایل عضو')).toBeInTheDocument();
    expect(model.markUnavailable).not.toHaveBeenCalled();
  });

  it('requires a separate confirmation tap before removing an item', async () => {
    const item = { id: 'i1', name: 'شیر', status: 'NEEDED', version: 1 };
    const model = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      members: [{ id: 'm1' }, { id: 'm2' }],
      items: [item],
    });
    renderPage(model);

    fireEvent.click(screen.getByRole('button', { name: 'حذف شیر' }));
    expect(model.removeItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'تأیید حذف شیر' }));

    await waitFor(() => expect(model.removeItem).toHaveBeenCalledWith(item));
  });

  it('renders honest load and conflict recovery states', () => {
    const refresh = vi.fn();
    const { unmount } = renderPage(baseModel({ status: 'error', refresh }));
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();

    const conflictModel = baseModel({
      household: { id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 },
      households: [{ id: 'h1', name: 'خانهٔ ما', role: 'MEMBER', memberCount: 2 }],
      operationError: { kind: 'conflict', title: 'این مورد تازه تغییر کرده', message: 'نسخهٔ جدید را بگیر.' },
      refresh,
    });
    renderPage(conflictModel);
    fireEvent.click(screen.getByRole('button', { name: 'گرفتن نسخهٔ جدید' }));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
