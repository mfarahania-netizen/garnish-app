import { AiSafetyGuardService } from './ai-safety.guard';

describe('AiSafetyGuardService', () => {
  const guard = new AiSafetyGuardService();

  it('blocks medical diagnosis / treatment', () => {
    expect(guard.inspect('Can you diagnose my illness?').blocked).toBe(true);
    expect(guard.inspect('prescribe medication for my headache').blocked).toBe(true);
    expect(guard.inspect('what treatment for my high blood pressure').blocked).toBe(true);
    expect(guard.inspect('تشخیص بیماری من چیست').blocked).toBe(true);
  });

  it('blocks strict / therapeutic diet planning', () => {
    expect(guard.inspect('make me a therapeutic diet').blocked).toBe(true);
    expect(guard.inspect('a strict diet for fast results').blocked).toBe(true);
    expect(guard.inspect('a diet plan for my diabetes').blocked).toBe(true);
    expect(guard.inspect('یک رژیم درمانی بده').blocked).toBe(true);
  });

  it('blocks allergy-unsafe claims', () => {
    expect(guard.inspect('this dish is allergy-safe for you').blocked).toBe(true);
    expect(guard.inspect('it is safe for your allergy, go ahead').blocked).toBe(true);
  });

  it('blocks fake vision / image-recognition claims', () => {
    expect(guard.inspect('From the photo you uploaded, I can see tomatoes').blocked).toBe(true);
    expect(guard.inspect('Analyzing your image now').blocked).toBe(true);
    expect(guard.inspect('از عکس یخچال شما مواد را تشخیص دادم').blocked).toBe(true);
  });

  it('reports the matched category and allows safe prompts', () => {
    const r = guard.inspect('diagnose my disease');
    expect(r.reasons).toContain('medical_diagnosis_treatment');
    expect(guard.inspect('Suggest a cozy vegetarian stew for dinner').blocked).toBe(false);
  });
});
