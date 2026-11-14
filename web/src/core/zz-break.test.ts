import { test, expect } from 'vitest';

// Throwaway: checks that a failing test blocks merging. This PR gets closed.
test('deliberately broken', () => expect(1).toBe(2));
