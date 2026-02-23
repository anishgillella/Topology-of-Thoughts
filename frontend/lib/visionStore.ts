import { create } from "zustand";

export interface HandGesture {
  type:
    | "none"
    | "pinch"
    | "grab"
    | "swipe_left"
    | "swipe_right"
    | "point"
    | "open_palm"
    | "thumbs_up";
  confidence: number;
  position: { x: number; y: number; z: number };
  pinchDistance?: number;
  velocity?: { x: number; y: number };
  handedness: "Left" | "Right";
}

export interface FaceState {
  expression:
    | "neutral"
    | "smiling"
    | "frowning"
    | "surprised"
    | "focused"
    | "skeptical";
  attentionLevel: number;
  engagement: number;
  blendshapes: Record<string, number>;
}

interface VisionStore {
  cameraEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  toggleCamera: () => void;

  cameraStream: MediaStream | null;
  setCameraStream: (stream: MediaStream | null) => void;

  hands: HandGesture[];
  setHands: (hands: HandGesture[]) => void;

  activeGesture: HandGesture | null;
  setActiveGesture: (gesture: HandGesture | null) => void;

  faceState: FaceState | null;
  setFaceState: (state: FaceState | null) => void;

  visionFps: number;
  setVisionFps: (fps: number) => void;

  gestureOverlayVisible: boolean;
  setGestureOverlayVisible: (visible: boolean) => void;

  faceHudVisible: boolean;
  setFaceHudVisible: (visible: boolean) => void;

  // Raw landmarks for overlay drawing (not subscribed by React components)
  rawHandLandmarks: Array<{ landmarks: Array<{ x: number; y: number; z: number }>; handedness: string }>;
  setRawHandLandmarks: (landmarks: Array<{ landmarks: Array<{ x: number; y: number; z: number }>; handedness: string }>) => void;
}

export const useVisionStore = create<VisionStore>((set) => ({
  cameraEnabled: false,
  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
  toggleCamera: () => set((s) => ({ cameraEnabled: !s.cameraEnabled })),

  cameraStream: null,
  setCameraStream: (stream) => set({ cameraStream: stream }),

  hands: [],
  setHands: (hands) => set({ hands }),

  activeGesture: null,
  setActiveGesture: (gesture) => set({ activeGesture: gesture }),

  faceState: null,
  setFaceState: (state) => set({ faceState: state }),

  visionFps: 0,
  setVisionFps: (fps) => set({ visionFps: fps }),

  gestureOverlayVisible: true,
  setGestureOverlayVisible: (visible) => set({ gestureOverlayVisible: visible }),

  faceHudVisible: true,
  setFaceHudVisible: (visible) => set({ faceHudVisible: visible }),

  rawHandLandmarks: [],
  setRawHandLandmarks: (landmarks) => set({ rawHandLandmarks: landmarks }),
}));
