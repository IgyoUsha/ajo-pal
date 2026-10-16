import { useCallback, useState } from "react";

// Prototype identity: no accounts yet, so the chosen member is stored per
// group in localStorage. Guarded with try/catch so private-mode browsers
// still render fine when storage is unavailable.

const keyFor = (groupId: string) => `ajowaya-me-${groupId}`;

export function readMyMemberId(groupId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(groupId));
  } catch {
    return null;
  }
}

export function writeMyMemberId(groupId: string, memberId: string) {
  try {
    window.localStorage.setItem(keyFor(groupId), memberId);
  } catch {
    /* storage unavailable — selection just won't persist */
  }
}

export function useMyMember(groupId: string) {
  const [memberId, setMemberId] = useState<string | null>(() => readMyMemberId(groupId));
  const choose = useCallback(
    (id: string) => {
      writeMyMemberId(groupId, id);
      rememberGroup(groupId);
      setMemberId(id);
    },
    [groupId],
  );
  const clear = useCallback(() => setMemberId(null), []);
  return { memberId, choose, clear };
}

// Groups this device has used, newest first. No accounts yet, so this is how
// the home page knows which groups to show.

const GROUPS_KEY = "ajowaya-groups";

export function readRememberedGroups(): string[] {
  try {
    const raw = window.localStorage.getItem(GROUPS_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter((x): x is string => typeof x === "string"))];
  } catch {
    return [];
  }
}

export function rememberGroup(groupId: string) {
  try {
    const next = [groupId, ...readRememberedGroups().filter((id) => id !== groupId)];
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}
