import { describe, expect, it, vi } from 'vitest';
import { requestWorkflowAction } from './AttentionQueue';

describe('AttentionQueue workflow reasons', () => {
  it('returns a trimmed audit reason with the alert id', () => {
    const prompt = vi.fn().mockReturnValue('  incident verified  ');
    expect(requestWorkflowAction('alert-1', 'reason?', prompt)).toEqual({ id: 'alert-1', reason: 'incident verified' });
  });

  it.each([null, '', '  ', 'ab'])('cancels the action when the reason is absent or too short: %s', (value) => {
    expect(requestWorkflowAction('alert-1', 'reason?', () => value)).toBeNull();
  });
});
