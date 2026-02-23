import type { HandGesture } from "./visionStore";

interface Landmark {
  x: number;
  y: number;
  z: number;
}

// Frame history for velocity and stability tracking
const HISTORY_SIZE = 10;
const STABILITY_FRAMES = 2;

interface HandHistory {
  positions: Array<{ x: number; y: number; timestamp: number }>;
  lastGesture: HandGesture["type"];
  stableCount: number;
}

const handHistories: Map<string, HandHistory> = new Map();

function getHistory(handedness: string): HandHistory {
  if (!handHistories.has(handedness)) {
    handHistories.set(handedness, {
      positions: [],
      lastGesture: "none",
      stableCount: 0,
    });
  }
  return handHistories.get(handedness)!;
}

function distance(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// MediaPipe hand landmark indices
// 0: wrist, 4: thumb tip, 8: index tip, 12: middle tip, 16: ring tip, 20: pinky tip
// MCP joints: 2 (thumb), 5 (index), 9 (middle), 13 (ring), 17 (pinky)

function isFingerExtended(landmarks: Landmark[], tipIdx: number, mcpIdx: number, wristIdx: number = 0): boolean {
  const tipDist = distance(landmarks[tipIdx], landmarks[wristIdx]);
  const mcpDist = distance(landmarks[mcpIdx], landmarks[wristIdx]);
  return tipDist > mcpDist;
}

function detectPinch(landmarks: Landmark[]): { isPinch: boolean; pinchDistance: number } {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const d = distance(thumbTip, indexTip);
  return { isPinch: d < 0.05, pinchDistance: Math.min(d / 0.15, 1) };
}

function detectGrab(landmarks: Landmark[]): boolean {
  // All fingertips closer to wrist than their MCP joints
  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];
  return tips.every((tip, i) => !isFingerExtended(landmarks, tip, mcps[i]));
}

function detectOpenPalm(landmarks: Landmark[]): boolean {
  const tips = [8, 12, 16, 20];
  const mcps = [5, 9, 13, 17];
  return tips.every((tip, i) => isFingerExtended(landmarks, tip, mcps[i]));
}

function detectPoint(landmarks: Landmark[]): boolean {
  const indexExtended = isFingerExtended(landmarks, 8, 5);
  const middleCurled = !isFingerExtended(landmarks, 12, 9);
  const ringCurled = !isFingerExtended(landmarks, 16, 13);
  const pinkyCurled = !isFingerExtended(landmarks, 20, 17);
  return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

function detectThumbsUp(landmarks: Landmark[]): boolean {
  const thumbTip = landmarks[4];
  const thumbMcp = landmarks[2];
  const thumbUp = thumbTip.y < thumbMcp.y; // y decreases upward in normalized coords
  const othersCurled =
    !isFingerExtended(landmarks, 8, 5) &&
    !isFingerExtended(landmarks, 12, 9) &&
    !isFingerExtended(landmarks, 16, 13) &&
    !isFingerExtended(landmarks, 20, 17);
  return thumbUp && othersCurled;
}

function detectSwipe(history: HandHistory): { type: "swipe_left" | "swipe_right" | null; velocity: { x: number; y: number } } {
  const positions = history.positions;
  if (positions.length < 5) return { type: null, velocity: { x: 0, y: 0 } };

  const recent = positions.slice(-5);
  const oldest = recent[0];
  const newest = recent[recent.length - 1];
  const dt = (newest.timestamp - oldest.timestamp) / 1000;
  if (dt === 0) return { type: null, velocity: { x: 0, y: 0 } };

  const vx = (newest.x - oldest.x) / dt;
  const vy = (newest.y - oldest.y) / dt;
  const speed = Math.sqrt(vx * vx + vy * vy);

  const SWIPE_THRESHOLD = 1.5;
  if (speed > SWIPE_THRESHOLD && Math.abs(vx) > Math.abs(vy)) {
    return {
      type: vx > 0 ? "swipe_right" : "swipe_left",
      velocity: { x: vx, y: vy },
    };
  }

  return { type: null, velocity: { x: vx, y: vy } };
}

export function interpretHand(
  landmarks: Landmark[],
  handedness: string,
  timestamp: number
): HandGesture {
  const history = getHistory(handedness);
  const wrist = landmarks[0];

  // Update position history
  history.positions.push({ x: wrist.x, y: wrist.y, timestamp });
  if (history.positions.length > HISTORY_SIZE) {
    history.positions.shift();
  }

  // Detect gestures in priority order
  let rawGesture: HandGesture["type"] = "none";
  let pinchDistance: number | undefined;
  let velocity: { x: number; y: number } | undefined;

  const pinch = detectPinch(landmarks);
  const swipe = detectSwipe(history);

  if (pinch.isPinch) {
    rawGesture = "pinch";
    pinchDistance = pinch.pinchDistance;
  } else if (detectThumbsUp(landmarks)) {
    rawGesture = "thumbs_up";
  } else if (detectPoint(landmarks)) {
    rawGesture = "point";
  } else if (detectGrab(landmarks)) {
    rawGesture = "grab";
    velocity = swipe.velocity;
  } else if (swipe.type) {
    rawGesture = swipe.type;
    velocity = swipe.velocity;
  } else if (detectOpenPalm(landmarks)) {
    rawGesture = "open_palm";
  }

  // Stability filter: require N stable frames before emitting a new gesture
  if (rawGesture === history.lastGesture) {
    history.stableCount = Math.min(history.stableCount + 1, STABILITY_FRAMES + 1);
  } else {
    history.stableCount = 1;
    history.lastGesture = rawGesture;
  }

  const stableGesture =
    history.stableCount >= STABILITY_FRAMES ? rawGesture : "none";

  return {
    type: stableGesture,
    confidence: history.stableCount >= STABILITY_FRAMES ? 1 : history.stableCount / STABILITY_FRAMES,
    position: { x: wrist.x, y: wrist.y, z: wrist.z },
    pinchDistance: stableGesture === "pinch" ? pinchDistance : undefined,
    velocity,
    handedness: handedness as "Left" | "Right",
  };
}

export function interpretHands(
  results: Array<{ landmarks: Landmark[]; handedness: string }>,
  timestamp: number
): HandGesture[] {
  return results.map((r) => interpretHand(r.landmarks, r.handedness, timestamp));
}

export function clearHistory(): void {
  handHistories.clear();
}
