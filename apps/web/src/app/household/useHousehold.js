import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import householdApi from './householdApi';

const POLL_MS = 15_000;

const SAFE_CONFLICT_COPY = {
  household_limit_reached: ['به سقف خانه‌ها رسیدی', 'برای خانهٔ تازه، ابتدا یکی از خانه‌های فعلی را ترک کن.'],
  household_member_limit_reached: ['ظرفیت این خانه پر است', 'برای عضو تازه، ابتدا فهرست اعضا را مدیریت کن.'],
  household_invite_limit_reached: ['دعوتِ در انتظار زیادی دارید', 'یکی از دعوت‌های در انتظار را لغو کن.'],
  shopping_item_limit_reached: ['فهرست خرید پر شده', 'چند قلم تمام‌شده یا غیرضروری را جمع کن.'],
  household_invite_not_available: ['این دعوت دیگر قابل استفاده نیست', 'ممکن است پاسخ داده شده یا منقضی شده باشد.'],
  household_invite_not_found: ['این دعوت دیگر قابل استفاده نیست', 'ممکن است پاسخ داده شده یا منقضی شده باشد.'],
  household_invite_closed: ['این دعوت بسته شده', 'قبلاً پاسخ داده شده یا منقضی شده؛ فهرست دعوت‌ها را تازه کن.'],
  shopping_item_already_exists: ['این قلم از قبل در فهرست هست', 'همان قلم موجود را ویرایش یا تکمیل کن.'],
  shopping_decision_already_open: ['برای این قلم یک تصمیم باز هست', 'همان تصمیم را پاسخ بده؛ تصمیم تکراری ساخته نشد.'],
  shopping_decision_open: ['برای این قلم یک تصمیم باز هست', 'ابتدا تصمیم فعلی را جمع‌بندی کن.'],
  household_decision_self_resolution_forbidden: ['این تصمیم را یکی از اعضای دیگر پاسخ می‌دهد', 'می‌توانی منتظر پاسخ بمانی یا درخواست خودت را لغو کنی.'],
  household_decision_requires_other_member: ['برای پرسیدن، عضو دیگری لازم است', 'ابتدا یک عضو را به خانه دعوت کن؛ بعد درخواست جایگزین را بفرست.'],
  last_owner_transfer_required: ['اول مالکیت را منتقل کن', 'از بخش اعضای خانه یک مالک جدید انتخاب کن.'],
};

const REFRESHABLE_CONFLICT_CODES = new Set([
  'version_conflict',
  'household_conflict',
  'household_invite_conflict',
  'membership_conflict',
  'shopping_item_conflict',
  'shopping_decision_conflict',
  'shopping_decision_closed',
  'shopping_session_conflict',
]);

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `hh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function useOnlineState() {
  const [online, setOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  ));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}

function operationError(error, online, requestStarted = false) {
  if (!requestStarted && !online) {
    return {
      kind: 'offline',
      title: 'اتصال برقرار نیست',
      message: 'تغییر ثبت نشد. بعد از وصل‌شدن دوباره امتحان کن.',
    };
  }
  if (!error?.response) {
    return {
      kind: 'unknown',
      title: 'وضعیت ثبت مشخص نیست',
      message: 'اتصال قطع شد. فهرست را تازه کن تا نتیجهٔ واقعی را ببینی.',
    };
  }
  if (error.response.status === 409) {
    const code = error.response.data?.code;
    const safeCopy = SAFE_CONFLICT_COPY[code];
    if (safeCopy) {
      return { kind: code === 'household_invite_closed' ? 'invite_closed' : 'business', code, title: safeCopy[0], message: safeCopy[1] };
    }
    if (!REFRESHABLE_CONFLICT_CODES.has(code)) {
      return {
        kind: 'business',
        code,
        title: 'این کار در وضعیت فعلی انجام نمی‌شود',
        message: 'درخواست ثبت نشد؛ وضعیت خانه را بررسی کن.',
      };
    }
    return {
      kind: 'conflict',
      code,
      title: 'این مورد تازه تغییر کرده',
      message: 'نسخهٔ جدید را بگیر و دوباره تصمیم بگیر.',
    };
  }
  if (error.response.status === 403) {
    return {
      kind: 'permission',
      title: 'اجازهٔ این کار را نداری',
      message: 'ممکن است نقش یا عضویتت در خانه تغییر کرده باشد.',
    };
  }
  return {
    kind: 'error',
    title: 'تغییر ثبت نشد',
    message: 'چیزی از دست نرفته؛ دوباره امتحان کن.',
  };
}

export function useHousehold({ enabled = true } = {}) {
  const online = useOnlineState();
  const [busyAction, setBusyAction] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [reconciliationRequired, setReconciliationRequired] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(null);
  const [acknowledgedHousehold, setAcknowledgedHousehold] = useState(null);
  const inFlightAction = useRef(null);
  const reconciliationRequiredRef = useRef(false);
  const createIntentRef = useRef({ name: null, key: null });

  const householdsQuery = useQuery({
    queryKey: ['household', 'list'],
    queryFn: householdApi.listHouseholds,
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: 'always',
  });
  const invitesQuery = useQuery({
    queryKey: ['household', 'invites', 'pending'],
    queryFn: householdApi.listPendingInvites,
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: 'always',
  });

  const listedHouseholds = useMemo(
    () => (Array.isArray(householdsQuery.data?.households) ? householdsQuery.data.households : []),
    [householdsQuery.data],
  );
  const households = useMemo(() => {
    if (!acknowledgedHousehold || listedHouseholds.some((item) => item.id === acknowledgedHousehold.id)) {
      return listedHouseholds;
    }
    return [acknowledgedHousehold, ...listedHouseholds];
  }, [acknowledgedHousehold, listedHouseholds]);

  useEffect(() => {
    if (!acknowledgedHousehold) return;
    if (!listedHouseholds.some((item) => item.id === acknowledgedHousehold.id)) return;
    setAcknowledgedHousehold(null);
    createIntentRef.current = { name: null, key: null };
  }, [acknowledgedHousehold, listedHouseholds]);
  const invites = useMemo(
    () => (Array.isArray(invitesQuery.data?.invites) ? invitesQuery.data.invites : []),
    [invitesQuery.data],
  );
  const household = households.find((candidate) => candidate.id === selectedHouseholdId)
    || households[0]
    || null;

  const detailsQuery = useQuery({
    queryKey: ['household', household?.id, 'details'],
    queryFn: () => householdApi.getHousehold(household.id),
    enabled: enabled && !!household?.id,
    staleTime: 10_000,
    refetchOnWindowFocus: 'always',
  });
  const shoppingQuery = useQuery({
    queryKey: ['household', household?.id, 'shopping'],
    queryFn: () => householdApi.getShopping(household.id),
    enabled: enabled && !!household?.id,
    staleTime: 5_000,
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => (
      enabled && household?.id && online && query.state.data?.activeSession ? POLL_MS : false
    ),
  });

  const outgoingInvitesQuery = useQuery({
    queryKey: ['household', household?.id, 'invites', 'outgoing'],
    queryFn: () => householdApi.listOutgoingInvites(household.id),
    enabled: enabled && !!household?.id && household.role === 'OWNER',
    staleTime: 10_000,
    refetchOnWindowFocus: 'always',
  });

  const details = detailsQuery.data || {};
  const shopping = shoppingQuery.data || {};
  const members = Array.isArray(details.members) ? details.members : [];
  const capabilities = Array.isArray(details.capabilities) ? details.capabilities : [];
  const items = Array.isArray(shopping.items) ? shopping.items : [];
  const decisions = Array.isArray(shopping.openDecisions) ? shopping.openDecisions : [];
  const outgoingInvites = Array.isArray(outgoingInvitesQuery.data?.invites)
    ? outgoingInvitesQuery.data.invites.filter((invite) => invite.status === 'PENDING')
    : [];

  const refresh = useCallback(async () => {
    const coreTasks = [householdsQuery.refetch({ throwOnError: true })];
    if (household?.id) {
      coreTasks.push(
        detailsQuery.refetch({ throwOnError: true }),
        shoppingQuery.refetch({ throwOnError: true }),
      );
    }
    // Invite reads are optional and must not decide whether a write is reconciled.
    void invitesQuery.refetch();
    if (household?.role === 'OWNER') void outgoingInvitesQuery.refetch();
    try {
      await Promise.all(coreTasks);
      reconciliationRequiredRef.current = false;
      setReconciliationRequired(false);
      setLastError(null);
      return { ok: true };
    } catch {
      const error = {
        kind: reconciliationRequiredRef.current ? 'reconciliation' : 'refresh_failed',
        title: reconciliationRequiredRef.current ? 'هنوز نتیجهٔ درخواست قبلی روشن نیست' : 'نمایش تازه نشد',
        message: 'اتصال را بررسی کن و دوباره تازه‌سازی کن.',
      };
      setLastError(error);
      return { ok: false, error };
    }
  }, [detailsQuery, household?.id, household?.role, householdsQuery, invitesQuery, outgoingInvitesQuery, shoppingQuery]);

  const run = useCallback(async (action, request, after) => {
    if (inFlightAction.current) return { ok: false, busy: true };
    if (reconciliationRequiredRef.current) {
      const error = {
        kind: 'reconciliation',
        title: 'اول نتیجهٔ درخواست قبلی را مشخص کن',
        message: 'پیش از تغییر تازه، خانه را تازه‌سازی کن تا درخواست تکراری ساخته نشود.',
      };
      setLastError(error);
      return { ok: false, reconciliationRequired: true, error };
    }
    if (!online) {
      const error = operationError(null, false);
      setLastError(error);
      return { ok: false, error };
    }
    inFlightAction.current = action;
    setBusyAction(action);
    setLastError(null);
    try {
      let data;
      try {
        data = await request();
      } catch (cause) {
        const error = operationError(cause, online, true);
        if (error.kind === 'unknown') {
          reconciliationRequiredRef.current = true;
          setReconciliationRequired(true);
        }
        setLastError(error);
        return { ok: false, error };
      }
      if (after) {
        try {
          await after(data);
        } catch {
          const error = {
            kind: 'stale_display',
            title: 'ثبت شد، نمایش تازه نشد',
            message: 'تغییر روی سرور ثبت شده؛ برای دیدن نتیجهٔ تازه دوباره بارگذاری کن.',
          };
          setLastError(error);
          return { ok: true, data, refreshFailed: true };
        }
      }
      return { ok: true, data };
    } finally {
      inFlightAction.current = null;
      setBusyAction(null);
    }
  }, [online]);

  const createHousehold = useCallback((name) => run(
    'create-household',
    () => {
      const intentName = name.trim();
      if (createIntentRef.current.name !== intentName || !createIntentRef.current.key) {
        createIntentRef.current = { name: intentName, key: newIdempotencyKey() };
      }
      return householdApi.createHousehold(intentName, createIntentRef.current.key);
    },
    async () => { await householdsQuery.refetch({ throwOnError: true }); },
  ).then((result) => {
    const created = result.data?.household;
    if (result.ok && created?.id) {
      setAcknowledgedHousehold({
        ...created,
        memberCount: Array.isArray(result.data?.members) ? result.data.members.length : 1,
      });
      setSelectedHouseholdId(created.id);
    }
    return result;
  }), [householdsQuery, run]);

  const inviteMember = useCallback((phone) => run(
    'invite-member',
    () => householdApi.inviteMember(household.id, phone),
    async () => { await outgoingInvitesQuery.refetch({ throwOnError: true }); },
  ), [household?.id, outgoingInvitesQuery, run]);

  const revokeInvite = useCallback((invite) => run(
    `revoke-invite-${invite.id}`,
    () => householdApi.revokeInvite(household.id, invite.id),
    async () => { await outgoingInvitesQuery.refetch({ throwOnError: true }); },
  ).then(async (result) => {
    if (result.error?.code === 'household_invite_closed') await outgoingInvitesQuery.refetch();
    return result;
  }), [household?.id, outgoingInvitesQuery, run]);

  const respondToInvite = useCallback((inviteId, response) => run(
    `${response}-invite`,
    () => (response === 'accept'
      ? householdApi.acceptInvite(inviteId)
      : householdApi.declineInvite(inviteId)),
    async () => {
      await Promise.all([
        invitesQuery.refetch({ throwOnError: true }),
        householdsQuery.refetch({ throwOnError: true }),
      ]);
    },
  ).then((result) => {
    const joined = response === 'accept' ? result.data?.household : null;
    if (result.ok && joined?.id) {
      setAcknowledgedHousehold({
        ...joined,
        memberCount: Array.isArray(result.data?.members) ? result.data.members.length : 1,
      });
      setSelectedHouseholdId(joined.id);
    }
    return result;
  }), [householdsQuery, invitesQuery, run]);

  const addItem = useCallback((name) => run(
    'add-item',
    () => householdApi.addItem(household.id, { name }, newIdempotencyKey()),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const updateItem = useCallback((item, patch) => run(
    `update-item-${item.id}`,
    () => householdApi.updateItem(household.id, item.id, { version: item.version, ...patch }),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const removeItem = useCallback((item) => run(
    `remove-item-${item.id}`,
    () => householdApi.removeItem(household.id, item.id, item.version),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const markUnavailable = useCallback((item, alternative) => run(
    `unavailable-item-${item.id}`,
    () => householdApi.markUnavailable(household.id, item.id, {
      version: item.version,
      alternative: alternative.trim(),
    }),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const resolveDecision = useCallback((decision, selectedOption) => run(
    `resolve-decision-${decision.id}`,
    () => householdApi.resolveDecision(household.id, decision.id, {
      version: decision.version,
      selectedOption,
    }),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const cancelDecision = useCallback((decision) => run(
    `cancel-decision-${decision.id}`,
    () => householdApi.cancelDecision(household.id, decision.id, decision.version),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const startSession = useCallback(() => run(
    'start-session',
    () => householdApi.startSession(household.id),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shoppingQuery]);

  const endSession = useCallback(() => run(
    'end-session',
    () => householdApi.endSession(household.id, shopping.activeSession.id, shopping.activeSession.version),
    async () => { await shoppingQuery.refetch({ throwOnError: true }); },
  ), [household?.id, run, shopping.activeSession, shoppingQuery]);

  const removeMember = useCallback((member) => run(
    `remove-member-${member.id}`,
    () => householdApi.removeMember(household.id, member.id, member.version),
    async () => { await detailsQuery.refetch({ throwOnError: true }); },
  ), [detailsQuery, household?.id, run]);

  const leaveHousehold = useCallback((membership) => run(
    'leave-household',
    () => householdApi.leaveHousehold(household.id, membership.version),
    async () => {
      setSelectedHouseholdId(null);
      if (acknowledgedHousehold?.id === household.id) setAcknowledgedHousehold(null);
      await householdsQuery.refetch({ throwOnError: true });
    },
  ), [acknowledgedHousehold?.id, household?.id, householdsQuery, run]);

  const transferOwner = useCallback((membership) => run(
    `transfer-owner-${membership.id}`,
    () => householdApi.transferOwner(
      household.id,
      details.household?.version ?? household.version,
      membership.id,
    ),
    async () => {
      await Promise.all([
        detailsQuery.refetch({ throwOnError: true }),
        householdsQuery.refetch({ throwOnError: true }),
      ]);
    },
  ), [details.household?.version, detailsQuery, household?.id, household?.version, householdsQuery, run]);

  const selectHousehold = useCallback((householdId) => {
    if (!households.some((candidate) => candidate.id === householdId)) return;
    setLastError(null);
    setSelectedHouseholdId(householdId);
  }, [households]);

  let status = 'ready';
  if (!enabled) status = 'disabled';
  else if (householdsQuery.isLoading) status = 'loading';
  // A confirmed create/accept response is canonical enough to keep the new
  // household visible even when the list projection cannot refresh yet.
  else if (householdsQuery.isError && !acknowledgedHousehold) status = 'error';
  else if (household && (detailsQuery.isLoading || shoppingQuery.isLoading)) status = 'loading';
  else if (household && (detailsQuery.isError || shoppingQuery.isError)) status = 'error';

  return {
    status,
    online,
    busyAction,
    reconciliationRequired,
    operationError: lastError,
    clearOperationError: () => {
      if (!reconciliationRequiredRef.current) setLastError(null);
    },
    households,
    household,
    selectHousehold,
    members,
    capabilities,
    invites,
    incomingInvitesStatus: invitesQuery.isLoading ? 'loading' : invitesQuery.isError ? 'error' : 'ready',
    refreshIncomingInvites: () => invitesQuery.refetch(),
    outgoingInvites,
    outgoingInvitesStatus: outgoingInvitesQuery.isLoading ? 'loading' : outgoingInvitesQuery.isError ? 'error' : 'ready',
    refreshOutgoingInvites: () => outgoingInvitesQuery.refetch(),
    list: shopping.list || null,
    items,
    decisions,
    activeSession: shopping.activeSession || null,
    refresh,
    createHousehold,
    inviteMember,
    revokeInvite,
    respondToInvite,
    addItem,
    updateItem,
    removeItem,
    markUnavailable,
    resolveDecision,
    cancelDecision,
    startSession,
    endSession,
    removeMember,
    leaveHousehold,
    transferOwner,
  };
}

export default useHousehold;
