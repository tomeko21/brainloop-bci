/**
 * ============================================================
 *  MOCK BACKEND "DATABASE" (localStorage)
 * ============================================================
 * Imitates server state: likes, sessions, the currently watched reel.
 * Because we keep it in localStorage, an admin panel open in ANOTHER TAB
 * of the same browser sees live what the user is scrolling.
 * Across different devices only a real backend can do this.
 */
import type { ReportActiveReelInput } from "@/types/api/input/useFeed";
import type { SessionInfo } from "@/types/domain";

const KEY = "brainloop.mockdb.v2";

export interface MockDbState {
  likes: Record<string, boolean>;
  sessions: Record<string, SessionInfo>;
  activeReel: (ReportActiveReelInput & { heartbeatAtMs: number; viewStartedAtMs: number }) | null;
}

const EMPTY: MockDbState = { likes: {}, sessions: {}, activeReel: null };

export function readDb(): MockDbState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as MockDbState) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function writeDb(update: (db: MockDbState) => MockDbState): MockDbState {
  const next = update(readDb());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* MOCK: no localStorage (private mode) – ignore */
  }
  return next;
}
