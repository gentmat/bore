import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockOpen = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('@tauri-apps/api/dialog', () => ({
  open: mockOpen,
}));

// Export mocks for use in tests
export { mockInvoke, mockListen, mockOpen };
