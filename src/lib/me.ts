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
      setMemberId(id);
    },
    [groupId],
  );
  const clear = useCallback(() => setMemberId(null), []);
  return { memberId, choose, clear };
}
