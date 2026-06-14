import {
  validateEventType,
  classifyEventFamily,
  getEventTypeMigrationStatus,
  isKnownEventType,
  EVENT_FAMILY_DEFAULTS,
  EVENT_FAMILIES,
  EventTaxonomyContract,
  EventFamily,
} from './event-taxonomy.contract';
import {
  ConsentPurposeEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
  VisibilityEnum,
} from './event-envelope.schema';

describe('E43-A2 event taxonomy contract', () => {
  describe('validateEventType', () => {
    it('accepts a known legacy eventType in strict mode', () => {
      const r = validateEventType('recipe_view', { mode: 'strict' });
      expect(r.ok).toBe(true);
      expect(r.known).toBe(true);
      expect(r.migrationStatus).toBe('legacy_active');
      expect(r.errors).toEqual([]);
    });

    it('rejects an unknown eventType in strict mode', () => {
      const r = validateEventType('totally_made_up_event', { mode: 'strict' });
      expect(r.ok).toBe(false);
      expect(r.known).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    });

    it('allows an unknown eventType in shadow/migration mode but WARNS (never silently OK)', () => {
      for (const mode of ['shadow', 'migration'] as const) {
        const r = validateEventType('totally_made_up_event', { mode });
        expect(r.ok).toBe(true);
        expect(r.known).toBe(false);
        expect(r.warnings.some((w) => w.includes('NOT production-ready'))).toBe(true);
      }
    });

    it('flags canonical/planned event types as not-yet-produced (warning), still ok', () => {
      const r = validateEventType('cook_complete', { mode: 'strict' });
      expect(r.ok).toBe(true); // it IS a known canonical type
      expect(r.migrationStatus).toBe('canonical_planned');
      expect(r.warnings.some((w) => w.includes('canonical/planned'))).toBe(true);
    });

    it('rejects empty/non-string eventType without throwing', () => {
      expect(() => validateEventType('', { mode: 'strict' })).not.toThrow();
      expect(validateEventType('', { mode: 'strict' }).ok).toBe(false);
      expect(validateEventType(undefined as any, { mode: 'shadow' }).ok).toBe(false);
    });

    it('defaults to strict mode when no mode given', () => {
      expect(validateEventType('nope_unknown').ok).toBe(false);
    });
  });

  describe('migration status', () => {
    it('legacy enum value → legacy_active', () => {
      expect(getEventTypeMigrationStatus('ai_message_send')).toBe('legacy_active');
      expect(isKnownEventType('ai_message_send')).toBe(true);
    });
    it('canonical example type not in enum → canonical_planned', () => {
      expect(getEventTypeMigrationStatus('consent_granted')).toBe('canonical_planned');
      expect(getEventTypeMigrationStatus('workflow_run')).toBe('canonical_planned');
      expect(isKnownEventType('workflow_run')).toBe(true);
    });
    it('unrecognized → unknown', () => {
      expect(getEventTypeMigrationStatus('xyzzy')).toBe('unknown');
      expect(isKnownEventType('xyzzy')).toBe(false);
    });
    it('does NOT report planned categories as implemented/legacy', () => {
      for (const planned of ['cook_complete', 'workflow_run', 'ai_guard_block', 'notif_suppressed', 'consent_granted']) {
        expect(getEventTypeMigrationStatus(planned)).not.toBe('legacy_active');
      }
    });
  });

  describe('classifyEventFamily', () => {
    const cases: Array<[string, EventFamily]> = [
      ['recipe_view', 'recipe'],
      ['favorite_add', 'recipe'],
      ['nutrition_read', 'recipe'],
      ['cook_complete', 'cook'],
      ['start_cooking_click', 'cook'],
      ['ai_message_send', 'ai'],
      ['notification_generate', 'notification'],
      ['notif_suppressed', 'notification'],
      ['recommendation_impression', 'recommendation'],
      ['not_interested', 'recommendation'],
      ['shopping_item_add', 'grocery'],
      ['mealplan_add', 'planner'],
      ['consent_granted', 'consent'],
      ['admin_view', 'admin'],
      ['workflow_run', 'workflow'],
      ['login', 'behavior'],
      ['cron_behavior_engine_run', 'behavior'],
    ];
    it.each(cases)('classifies %s → %s', (et, fam) => {
      expect(classifyEventFamily(et)).toBe(fam);
    });
    it('classifies the social/b2b canonical-planned types (not unknown)', () => {
      expect(classifyEventFamily('cooked_share')).toBe('cook');
      expect(classifyEventFamily('circle_recipe_share')).toBe('recipe');
      expect(classifyEventFamily('community_post_published')).toBe('recipe');
      expect(classifyEventFamily('b2b_aggregate_snapshot')).toBe('workflow');
    });

    it('EVERY known canonical-planned type classifies to a real family (contract promise)', () => {
      for (const t of EventTaxonomyContract.canonicalPlannedEventTypes) {
        expect(classifyEventFamily(t)).not.toBe('unknown');
      }
    });

    it('returns unknown for unclassifiable input (no silent bucketing)', () => {
      expect(classifyEventFamily('zzz_nonsense')).toBe('unknown');
      expect(classifyEventFamily('')).toBe('unknown');
    });
  });

  describe('family defaults', () => {
    it('exist for ALL 11 required families with all 5 default keys', () => {
      expect(EVENT_FAMILIES.length).toBe(11);
      for (const fam of EVENT_FAMILIES) {
        const d = EVENT_FAMILY_DEFAULTS[fam];
        expect(d).toBeDefined();
        expect(Object.values(ConsentPurposeEnum)).toContain(d.consentPurpose);
        expect(Object.values(PrivacyClassEnum)).toContain(d.privacyClass);
        expect(Object.values(RetentionPolicyEnum)).toContain(d.retentionPolicy);
        expect(Object.values(VisibilityEnum)).toContain(d.visibility);
        expect(typeof d.surface).toBe('string');
        expect(d.surface.length).toBeGreaterThan(0);
      }
    });
    it('consent + admin families use audit-long retention', () => {
      expect(EVENT_FAMILY_DEFAULTS.consent.retentionPolicy).toBe(RetentionPolicyEnum.auditLong);
      expect(EVENT_FAMILY_DEFAULTS.admin.retentionPolicy).toBe(RetentionPolicyEnum.auditLong);
    });
  });

  describe('contract descriptor', () => {
    it('reports legacy vs canonical-planned counts honestly', () => {
      expect(EventTaxonomyContract.legacyEventTypeCount).toBeGreaterThan(50);
      expect(EventTaxonomyContract.canonicalPlannedEventTypeCount).toBeGreaterThan(0);
      // planned set must not overlap legacy set
      for (const p of EventTaxonomyContract.canonicalPlannedEventTypes) {
        expect(EventTaxonomyContract.legacyEventTypes).not.toContain(p);
      }
    });
  });
});
