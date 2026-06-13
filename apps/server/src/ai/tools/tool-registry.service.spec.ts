import { ToolRegistryService } from './tool-registry.service';

describe('ToolRegistryService', () => {
  const registry = new ToolRegistryService();

  it('registers EXACTLY the four approved tools', () => {
    expect([...registry.list()].sort()).toEqual(
      ['explain_recommendation', 'get_user_food_context', 'log_ai_feedback', 'search_recipes'],
    );
    expect(registry.getTools()).toHaveLength(4);
  });

  it('resolves a known tool and returns undefined for unknown', () => {
    expect(registry.getTool('search_recipes')).toBeDefined();
    expect(registry.has('log_ai_feedback')).toBe(true);
    expect(registry.getTool('autonomous_meal_planner')).toBeUndefined();
    expect(registry.has('grocery_agent')).toBe(false);
  });

  it('every registered tool exposes a name, description and read-only handler', async () => {
    for (const tool of registry.getTools()) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.handler).toBe('function');
      const out = await tool.handler({}, { userId: 'u1', snapshot: { userId: 'u1', generatedAt: 'now', schemaVersion: 1 } });
      expect(out).toBeDefined();
    }
  });
});
