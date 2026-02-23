import type { FaceState } from "./visionStore";

function getBlendshape(blendshapes: Record<string, number>, name: string): number {
  return blendshapes[name] ?? 0;
}

function detectExpression(bs: Record<string, number>): FaceState["expression"] {
  const smileScore =
    getBlendshape(bs, "mouthSmileLeft") + getBlendshape(bs, "mouthSmileRight");
  const frownScore =
    getBlendshape(bs, "mouthFrownLeft") + getBlendshape(bs, "mouthFrownRight");
  const browInnerUp = getBlendshape(bs, "browInnerUp");
  const jawOpen = getBlendshape(bs, "jawOpen");
  const eyeSquintL = getBlendshape(bs, "eyeSquintLeft");
  const eyeSquintR = getBlendshape(bs, "eyeSquintRight");
  const browDownL = getBlendshape(bs, "browDownLeft");
  const browDownR = getBlendshape(bs, "browDownRight");
  const browOuterUpL = getBlendshape(bs, "browOuterUpLeft");
  const browOuterUpR = getBlendshape(bs, "browOuterUpRight");

  // Check in specificity order (most specific first)
  if (browInnerUp > 0.5 && jawOpen > 0.4) return "surprised";
  if (smileScore > 0.6) return "smiling";
  if (frownScore > 0.5) return "frowning";
  if (
    eyeSquintL + eyeSquintR > 0.4 &&
    (browDownL + browDownR) / 2 > 0.3
  )
    return "focused";
  // Skeptical: asymmetric brow raise
  if (Math.abs(browOuterUpL - browOuterUpR) > 0.3) return "skeptical";

  return "neutral";
}

function computeAttention(bs: Record<string, number>): number {
  const eyeOpenL = 1 - getBlendshape(bs, "eyeBlinkLeft");
  const eyeOpenR = 1 - getBlendshape(bs, "eyeBlinkRight");
  const eyeOpenness = (eyeOpenL + eyeOpenR) / 2;

  // Gaze: lower lookAway values = looking at screen
  const lookLeft = getBlendshape(bs, "eyeLookOutLeft");
  const lookRight = getBlendshape(bs, "eyeLookOutRight");
  const lookUp = getBlendshape(bs, "eyeLookUpLeft") + getBlendshape(bs, "eyeLookUpRight");
  const lookDown = getBlendshape(bs, "eyeLookDownLeft") + getBlendshape(bs, "eyeLookDownRight");
  const gazeAway = Math.min((lookLeft + lookRight + lookUp / 2 + lookDown / 2) / 2, 1);
  const gazeAtScreen = 1 - gazeAway;

  return Math.min(Math.max(eyeOpenness * 0.4 + gazeAtScreen * 0.6, 0), 1);
}

function computeEngagement(bs: Record<string, number>, attention: number): number {
  // Non-neutral facial activity
  let activity = 0;
  const keys = Object.keys(bs);
  for (const key of keys) {
    if (key.startsWith("eye") || key.startsWith("brow") || key.startsWith("mouth") || key.startsWith("jaw")) {
      activity += bs[key];
    }
  }
  const normalizedActivity = Math.min(activity / 10, 1);
  return Math.min(Math.max(attention * 0.6 + normalizedActivity * 0.4, 0), 1);
}

export function interpretFace(
  rawBlendshapes: Array<{ categoryName: string; score: number }>
): FaceState {
  // Convert array to record
  const bs: Record<string, number> = {};
  for (const { categoryName, score } of rawBlendshapes) {
    bs[categoryName] = score;
  }

  const expression = detectExpression(bs);
  const attentionLevel = computeAttention(bs);
  const engagement = computeEngagement(bs, attentionLevel);

  return {
    expression,
    attentionLevel,
    engagement,
    blendshapes: bs,
  };
}
