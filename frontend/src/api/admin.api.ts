/**
 * Admin panel API (live view).
 * ⚠️ MOCK: "other device" = another tab of the same browser
 *          (state shared via localStorage).
 *          Eventually: GET /api/live/viewer (or push over WS/SSE).
 */
import type { LiveViewerInput } from "@/types/api/input/useAdmin";
import type { LiveViewerOutput, ViewerStatus } from "@/types/api/output/useAdmin";
import { USE_MOCKS, http } from "./client";
import { readDb } from "./mocks/mockDb";
import { generateMockReel } from "./mocks/reels.mock";

/** No heartbeat for longer than this = offline (a visible tab sends every 2 s). */
const OFFLINE_AFTER_MS = 8_000;
/** A background tab is throttled by the browser, so we give it much more time. */
const BACKGROUND_OFFLINE_AFTER_MS = 5 * 60_000;

const OFFLINE: LiveViewerOutput = {
  status: "offline", sessionId: null, subjectName: null, reel: null, reelIndex: 0,
  lastSeenMsAgo: null, viewStartedAtMs: null, playback: null, heartbeatAtMs: null, face: null, prediction: null,
};

export async function fetchLiveViewer(input: LiveViewerInput): Promise<LiveViewerOutput> {
  if (!USE_MOCKS) {
    const q = input.sessionId ? `?session_id=${encodeURIComponent(input.sessionId)}` : "";
    return http<LiveViewerOutput>(`/api/live/viewer${q}`);
  }

  // --- MOCK ---
  const a = readDb().activeReel;
  if (!a || (input.sessionId && a.sessionId !== input.sessionId)) return OFFLINE;
  const ago = Date.now() - a.heartbeatAtMs;
  const status: ViewerStatus = a.left
    ? "offline"
    : !a.visible
      ? ago < BACKGROUND_OFFLINE_AFTER_MS ? "background" : "offline"
      : ago < OFFLINE_AFTER_MS ? "online" : "offline";

  return {
    status,
    sessionId: a.sessionId,
    subjectName: a.subjectName,
    reel: generateMockReel(Number(a.reelId.replace("reel_", ""))),
    reelIndex: a.reelIndex,
    lastSeenMsAgo: ago,
    viewStartedAtMs: a.viewStartedAtMs,
    playback: a.playback,
    heartbeatAtMs: a.heartbeatAtMs,
    face: a.face,
    prediction: a.prediction ?? null,
  };
}
