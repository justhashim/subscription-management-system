import { createSeedData, type MockData } from "./seed";

const STORAGE_KEY = "orbit.mock-data.v1";

let memoryData: MockData | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadMockData(): MockData {
  if (!canUseStorage()) {
    memoryData ??= createSeedData();
    return memoryData;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      return JSON.parse(stored) as MockData;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const seeded = createSeedData();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveMockData(data: MockData) {
  memoryData = data;

  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function resetMockData() {
  memoryData = createSeedData();

  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryData));
  }

  return memoryData;
}

export function createId(prefix: string) {
  const value =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${value}`;
}

export function wait(ms = 260) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
