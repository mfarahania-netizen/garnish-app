import { describe, expect, it } from 'vitest';
import { describeOverviewFailures } from './OverviewTab';

describe('OverviewTab source failure copy', () => {
  it('names the exact failed endpoints', () => {
    const copy = describeOverviewFailures(['user-stats', 'activity-trends']);
    expect(copy).toContain('/admin/analytics/user-stats');
    expect(copy).toContain('/admin/analytics/trends');
    expect(copy).not.toContain('سلامت + ایمنی');
  });
});
