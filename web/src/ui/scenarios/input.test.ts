import { describe, expect, it } from 'vitest';
import { checkLat, checkLon, checkUtc, coordText, groupName, toBoxValue, toPickerValue, utcText } from './input';

const table = { startMs: Date.parse('2026-01-01T00:00:00Z'), endMs: Date.parse('2036-01-01T00:00:00Z') };

describe('checkLat', () => {
  it('accepts -90 to 90', () => {
    expect(checkLat('-89.5')).toEqual({ ok: true, value: -89.5 });
    expect(checkLat(' 90 ')).toEqual({ ok: true, value: 90 });
    expect(checkLat('-90')).toEqual({ ok: true, value: -90 });
  });
  it('rejects outside +-90, blanks and words', () => {
    expect(checkLat('95')).toMatchObject({ ok: false, message: 'Latitude must be between -90 and 90' });
    expect(checkLat('-90.01').ok).toBe(false);
    expect(checkLat('').ok).toBe(false);
    expect(checkLat('north').ok).toBe(false);
    expect(checkLat('Infinity').ok).toBe(false);
  });
  it('reads plain decimal numbers only: no hex, binary, octal or exponent', () => {
    // Number() alone reads "0x10" as 16 and "1e1" as 10, which would move the site.
    for (const text of ['0x10', '0X10', '0b11', '0o7', '1e1', '1E1', '1e-3', '1_0', '12abc', '1,5', '--5', '+-5', '.', '-', '+', '5..', '1.2.3', 'NaN']) {
      expect(checkLat(text), text).toMatchObject({ ok: false, message: 'Type a number of degrees, for example -89.5' });
    }
  });
  it('still reads a sign, a leading or trailing point, spaces around, and -0', () => {
    expect(checkLat('+5')).toEqual({ ok: true, value: 5 });
    expect(checkLat('.5')).toEqual({ ok: true, value: 0.5 });
    expect(checkLat('-.5')).toEqual({ ok: true, value: -0.5 });
    expect(checkLat('5.')).toEqual({ ok: true, value: 5 });
    expect(checkLat('  -89.5\t')).toEqual({ ok: true, value: -89.5 });
    expect(checkLat('007')).toEqual({ ok: true, value: 7 });
    const zero = checkLat('-0');
    expect(zero.ok && Object.is(zero.value, -0)).toBe(true);
  });
});

describe('checkLon', () => {
  it('accepts -180 to 180', () => {
    expect(checkLon('-180')).toEqual({ ok: true, value: -180 });
    expect(checkLon('180')).toEqual({ ok: true, value: 180 });
    expect(checkLon('45')).toEqual({ ok: true, value: 45 });
  });
  it('rejects outside +-180, so 0 to 360 values are caught', () => {
    expect(checkLon('270')).toMatchObject({ ok: false, message: 'Longitude must be between -180 and 180' });
    expect(checkLon('-181').ok).toBe(false);
    expect(checkLon(' ').ok).toBe(false);
  });
  it('reads plain decimal numbers only: no hex, binary or exponent', () => {
    for (const text of ['0x7f', '0b11', '1e2', '1e-2']) {
      expect(checkLon(text), text).toMatchObject({ ok: false, message: 'Type a number of degrees, for example 45' });
    }
    expect(checkLon('+45.')).toEqual({ ok: true, value: 45 });
    expect(checkLon(' -.25 ')).toEqual({ ok: true, value: -0.25 });
  });
});

describe('checkUtc', () => {
  it('reads YYYY-MM-DD HH:MM as UTC', () => {
    expect(checkUtc('2027-01-01 06:30', table)).toEqual({ ok: true, value: Date.parse('2027-01-01T06:30:00Z') });
    expect(checkUtc(' 2027-01-01 06:30:15 ', table)).toEqual({ ok: true, value: Date.parse('2027-01-01T06:30:15Z') });
    expect(checkUtc('2027-01-01T06:30', table)).toEqual({ ok: true, value: Date.parse('2027-01-01T06:30:00Z') });
  });
  it('rejects a half-typed, empty or other-order box', () => {
    expect(checkUtc('', table)).toMatchObject({ ok: false, message: 'Enter a UTC date and time as YYYY-MM-DD HH:MM' });
    expect(checkUtc('2027-01-01', table).ok).toBe(false);
    expect(checkUtc('2027-13-01 00:00', table).ok).toBe(false);
    expect(checkUtc('2027-02-30 00:00', table).ok).toBe(false);
    expect(checkUtc('2027-01-01 24:00', table).ok).toBe(false);
    expect(checkUtc('01/02/2027 06:30', table).ok).toBe(false);
  });
  it('rejects a time outside the table, including its last row', () => {
    const before = checkUtc('2025-12-31 23:00', table);
    expect(before).toMatchObject({ ok: false, message: 'The table covers 2026-01-01 00:00 to 2036-01-01 00:00 UTC' });
    expect(checkUtc('2036-01-01 00:00', table).ok).toBe(false);
    expect(checkUtc('2026-01-01 00:00', table).ok).toBe(true);
  });
  it('skips the range check while the table is loading', () => {
    expect(checkUtc('2040-01-01 00:00', null).ok).toBe(true);
  });
});

describe('formatting', () => {
  const t = Date.parse('2027-03-04T05:06:07Z');
  it('round-trips through the box value to the minute', () => {
    expect(toBoxValue(t)).toBe('2027-03-04 05:06');
    expect(toPickerValue(t)).toBe('2027-03-04T05:06');
    expect(checkUtc(toPickerValue(t), table)).toEqual({ ok: true, value: Date.parse('2027-03-04T05:06:00Z') });
    expect(checkUtc(toBoxValue(t), table)).toEqual({ ok: true, value: Date.parse('2027-03-04T05:06:00Z') });
  });
  it('writes times and coordinates for reading', () => {
    expect(utcText(t)).toBe('2027-03-04 05:06');
    expect(coordText(-89.5, 45)).toBe('-89.5000, 45.0000');
  });
  it('names the site groups', () => {
    expect(groupName('south-pole')).toBe('South pole');
    expect(groupName('apollo')).toBe('Apollo');
    expect(groupName('other')).toBe('other');
  });
});
