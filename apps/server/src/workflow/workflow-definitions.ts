/**
 * The first 5 workflows (spec §B6), defined as data (graph JSON) and seeded idempotently by key. ①② are the
 * non-negotiable launch-day guardrails. All run on real data today (gates simply don't fire until a real
 * threshold is crossed — honest, not fake). Persian titles/bodies because the alerts are for the founder.
 */
export interface WorkflowDef {
  key: string;
  name: string;
  description: string;
  triggerType: 'schedule' | 'event' | 'manual';
  intervalSec?: number;
  eventType?: string;
  defaultSeverity: 'info' | 'warning' | 'critical';
  graph: { nodes: Array<{ id: string; type: string; params?: Record<string, any>; next?: string[] }> };
}

/**
 * P1-14 (advisor): per-workflow operating runbook — owner, the expected first action, concrete steps, and the
 * escalation window (minutes; 0 = immediate). Static config (no migration). Attached to listWorkflows so an
 * operator who sees an alert knows who owns it and exactly what to do — not just that "something fired".
 */
export interface WorkflowRunbook {
  ownerRole: string;
  expectedAction: string;
  steps: string;
  escalateAfterMin: number;
}
export const WORKFLOW_RUNBOOK: Record<string, WorkflowRunbook> = {
  'ai-cost-guardrail': {
    ownerRole: 'مالک / مهندسِ مسئول',
    expectedAction: 'سقفِ هزینهٔ امروز را بررسی کن؛ اگر واقعی است، مدلِ گران را موقتاً خاموش یا محدود کن.',
    steps: 'AICallLogِ امروز → مدلِ پرهزینه را پیدا کن → در .env سقف/مدل را عوض کن → ری‌استارت → تأیید.',
    escalateAfterMin: 30,
  },
  'allergy-safety-sentinel': {
    ownerRole: 'مالک — تحملِ صفر',
    expectedAction: 'فوراً: کدام رسپی/کاربر؟ فیلترِ سختِ آلرژی را بررسی کن؛ تا رفع، surfaceِ مربوط را ببند.',
    steps: 'logِ assessRecipeFit/analyzeRecipeIntegrity → ورودیِ نشت → تستِ گیت → hotfix → تأییدِ leaks=۰.',
    escalateAfterMin: 0,
  },
  'ai-reliability-watch': {
    ownerRole: 'مهندسِ مسئول',
    expectedAction: 'سلامتِ مدلِ اصلی را چک کن؛ اگر پایین است، کلید/مدلِ پشتیبان را بررسی کن.',
    steps: 'AICallLogِ ۱ساعتِ اخیر → کدام مدل fail می‌شود → کلید/کوتا/۴۲۹ → چرخشِ مدل.',
    escalateAfterMin: 60,
  },
  'daily-ops-brief': {
    ownerRole: 'مالک (مرورِ روزانه)',
    expectedAction: 'فقط مرور؛ اگر عددی پرت بود، workflowِ مربوط را باز کن.',
    steps: 'خلاصه را بخوان → هر عددِ غیرعادی را به تبِ مربوط دنبال کن.',
    escalateAfterMin: 1440,
  },
  'recipe-catalog-audit': {
    ownerRole: 'مسئولِ محتوا',
    expectedAction: 'فهرستِ کمبودها را به backlogِ نویسندگی ببر (کالری/آلرژن/عکس/مراحل).',
    steps: 'تبِ محتوا → رسپی‌های ناقص → کاملشان کن یا واگذار کن.',
    escalateAfterMin: 1440,
  },
  'content-gap-digest': {
    ownerRole: 'مسئولِ محتوا',
    expectedAction: 'جست‌وجوهای بی‌نتیجه را به نامزدِ رسپیِ تازه تبدیل کن.',
    steps: 'فهرستِ search_unmet → پرتکرارها → رسپیِ تازه بنویس/سفارش بده.',
    escalateAfterMin: 10080,
  },
};

export const WORKFLOW_DEFINITIONS: WorkflowDef[] = [
  // ① AI cost guardrail — the bill-surprise stop (free models now → real the day the paid model lands).
  {
    key: 'ai-cost-guardrail',
    name: 'نگهبانِ هزینهٔ هوش مصنوعی',
    description: 'هزینهٔ امروزِ مدل را با سقفِ روزانه می‌سنجد؛ اگر رد شد، هشدارِ بحرانی می‌دهد.',
    triggerType: 'schedule',
    intervalSec: 900, // every 15 min
    defaultSeverity: 'critical',
    graph: {
      nodes: [
        { id: 'cost', type: 'query', params: { source: 'ai.costToday' }, next: ['gate'] },
        { id: 'gate', type: 'threshold', params: { input: 'cost.costToday', op: 'gt', threshold: 5, gate: true }, next: ['alert'] },
        {
          id: 'alert',
          type: 'alert',
          params: {
            severity: 'critical',
            metric: 'ai.costToday',
            valueRef: 'cost.costToday',
            thresholdRef: 'gate.threshold',
            title: 'هزینهٔ هوش مصنوعی از سقفِ روزانه گذشت',
            body: 'هزینهٔ امروز {{cost.costToday}} دلار شد (سقفِ ۵ دلار). توکنِ امروز: {{cost.tokensToday}} در {{cost.callsToday}} درخواست.',
          },
        },
      ],
    },
  },

  // ② Allergy-safety sentinel — zero tolerance; any leak in the hard filter pages immediately.
  {
    key: 'allergy-safety-sentinel',
    name: 'نگهبانِ ایمنیِ آلرژی',
    description: 'هر نشتِ آلرژن از فیلترِ سختِ ایمنی را بحرانی گزارش می‌کند (تحملِ صفر).',
    triggerType: 'schedule',
    intervalSec: 300, // every 5 min
    defaultSeverity: 'critical',
    graph: {
      nodes: [
        { id: 'safety', type: 'query', params: { source: 'ops.safety' }, next: ['gate'] },
        { id: 'gate', type: 'threshold', params: { input: 'safety.allergySafety.leaks', op: 'gt', threshold: 0, gate: true }, next: ['alert'] },
        {
          id: 'alert',
          type: 'alert',
          params: {
            severity: 'critical',
            metric: 'allergy.leaks',
            valueRef: 'safety.allergySafety.leaks',
            thresholdRef: 'gate.threshold',
            title: 'بحرانی: نشتِ آلرژن در فیلترِ ایمنی',
            body: 'فیلترِ سختِ آلرژی {{safety.allergySafety.leaks}} نشت داشت — باید صفر باشد. فوراً بررسی شود.',
          },
        },
      ],
    },
  },

  // ③ AI reliability watch — most turns falling to the last-resort model = the primary is down.
  {
    key: 'ai-reliability-watch',
    name: 'پایشِ پایداریِ هوش مصنوعی',
    description: 'اگر بیش از نیمی از درخواست‌ها به مدلِ پشتیبان بیفتند هشدار می‌دهد (یعنی مدلِ اصلی پایین است).',
    triggerType: 'schedule',
    intervalSec: 900,
    defaultSeverity: 'warning',
    graph: {
      nodes: [
        { id: 'obs', type: 'query', params: { source: 'ops.observability' }, next: ['gate'] },
        { id: 'gate', type: 'threshold', params: { input: 'obs.totals.fallbackRate', op: 'gt', threshold: 0.5, gate: true }, next: ['alert'] },
        {
          id: 'alert',
          type: 'alert',
          params: {
            severity: 'warning',
            metric: 'ai.fallbackRate',
            valueRef: 'obs.totals.fallbackRate',
            thresholdRef: 'gate.threshold',
            title: 'اتکای زیاد به مدلِ پشتیبان',
            body: 'نرخِ افتادن به مدلِ پشتیبان {{obs.totals.fallbackRate}} شد (آستانه ۰٫۵). احتمالاً مدلِ اصلی پایین است.',
          },
        },
      ],
    },
  },

  // ④ Daily ops brief — the 5-minute glance (deterministic now; AGENTIC LLM narration plugs in at Stage 4).
  {
    key: 'daily-ops-brief',
    name: 'خلاصهٔ روزانهٔ عملیات',
    description: 'هر روز سلامت، هزینه و پایداری را در یک خلاصهٔ کوتاه جمع می‌کند.',
    triggerType: 'schedule',
    intervalSec: 86400, // daily
    defaultSeverity: 'info',
    graph: {
      nodes: [
        { id: 'health', type: 'query', params: { source: 'ops.health' }, next: ['brief'] },
        { id: 'econ', type: 'query', params: { source: 'ops.economics' }, next: ['brief'] },
        { id: 'obs', type: 'query', params: { source: 'ops.observability' }, next: ['brief'] },
        {
          id: 'brief',
          type: 'summarize',
          params: {
            title: 'خلاصهٔ روزانهٔ عملیات',
            lines: [
              { label: 'درخواست‌های هوش مصنوعی (۲۴س)', ref: 'health.aiCalls.total' },
              { label: 'نرخِ خطا', ref: 'health.aiCalls.errorRate' },
              { label: 'تأخیرِ p95 (میلی‌ثانیه)', ref: 'obs.totals.latencyMsP95' },
              { label: 'توکنِ ۳۰روزه', ref: 'econ.usage.totalTokens' },
              { label: 'نرخِ مدلِ پشتیبان', ref: 'obs.totals.fallbackRate' },
              { label: 'کیفیتِ رویدادها', ref: 'health.eventQuality.wellFormedRate' },
            ],
          },
          next: ['alert'],
        },
        { id: 'alert', type: 'alert', params: { severity: 'info', metric: 'daily.brief', title: 'خلاصهٔ روزانهٔ عملیات', body: '{{brief.text}}' } },
      ],
    },
  },

  // ⑥ Recipe catalog audit — analytical content-ops: scans all 350 published recipes across 6 gap types and
  // hands back exactly what to complete. Non-empty + actionable today (no user traffic needed). The depth is
  // in WHAT the query computes (a 6-dimensional catalog scan), not the node count.
  {
    key: 'recipe-catalog-audit',
    name: 'ممیزیِ کاتالوگِ رسپی',
    description: 'همهٔ رسپی‌های منتشرشده را برای کمبودها چک می‌کند: بدونِ کالری، بدونِ برچسبِ آلرژن، بدونِ عکس/زمان، یا با مراحلِ ناکافی — تا بدانی دقیقاً چه را کامل کنی.',
    triggerType: 'schedule',
    intervalSec: 86400, // daily
    defaultSeverity: 'info',
    graph: {
      nodes: [
        { id: 'audit', type: 'query', params: { source: 'content.recipeAudit' }, next: ['gate'] },
        { id: 'gate', type: 'threshold', params: { input: 'audit.worstCount', op: 'gt', threshold: 0, gate: true }, next: ['alert'] },
        {
          id: 'alert',
          type: 'alert',
          params: {
            severity: 'info',
            metric: 'content.recipeGaps',
            valueRef: 'audit.worstCount',
            thresholdRef: 'gate.threshold',
            title: 'ممیزیِ کاتالوگ: رسپی‌هایی که باید کامل شوند',
            body: 'از {{audit.total}} رسپی: {{audit.noNutrition}} بدونِ کالری، {{audit.noAllergens}} بدونِ برچسبِ آلرژن، {{audit.fewSteps}} با مراحلِ ناکافی، {{audit.noImage}} بدونِ عکس، {{audit.noTime}} بدونِ زمانِ پخت.',
          },
        },
      ],
    },
  },

  // ⑤ Content-gap digest — unmet searches → the authoring backlog (the demand the corpus can't serve yet).
  {
    key: 'content-gap-digest',
    name: 'گزارشِ شکافِ محتوا',
    description: 'جست‌وجوهای بی‌نتیجه را جمع می‌کند تا فهرستِ غذاهایی که باید نوشته شوند ساخته شود.',
    triggerType: 'schedule',
    intervalSec: 604800, // weekly
    defaultSeverity: 'info',
    graph: {
      nodes: [
        { id: 'gaps', type: 'query', params: { source: 'content.gaps', args: { days: 7 } }, next: ['gate'] },
        { id: 'gate', type: 'threshold', params: { input: 'gaps.volume', op: 'gt', threshold: 0, gate: true }, next: ['alert'] },
        {
          id: 'alert',
          type: 'alert',
          params: {
            severity: 'info',
            metric: 'content.unmetSearches',
            valueRef: 'gaps.volume',
            thresholdRef: 'gate.threshold',
            title: 'شکافِ محتوا: جست‌وجوهای بی‌نتیجه',
            body: 'این هفته {{gaps.volume}} جست‌وجوی بی‌نتیجه ثبت شد — این‌ها نامزدِ نوشتنِ رسپیِ تازه‌اند.',
          },
        },
      ],
    },
  },
];
