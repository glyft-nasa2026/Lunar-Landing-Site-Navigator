import { describe, expect, it } from 'vitest';
import { powerText } from './format';

describe('powerText', () => {
  it('rounds to a whole percentage', () => {
    expect(powerText(0.01745)).toBe('2 %');
    expect(powerText(0.99985)).toBe('100 %');
    expect(powerText(0.5)).toBe('50 %');
  });
  it('never shows a sliver of power as 0 %', () => {
    expect(powerText(0.004)).toBe('under 1 %');
  });
  it('shows no power, a negative or NaN as 0 % and caps at 100 %', () => {
    expect(powerText(0)).toBe('0 %');
    expect(powerText(-0.1)).toBe('0 %');
    expect(powerText(Number.NaN)).toBe('0 %');
    expect(powerText(1.2)).toBe('100 %');
  });
});
