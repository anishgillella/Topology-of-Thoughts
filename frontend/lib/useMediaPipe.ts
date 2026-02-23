"use client";

import { useEffect, useRef } from "react";
import { useVisionStore } from "./visionStore";
import { interpretHands, clearHistory } from "./gestureInterpreter";
import { interpretFace } from "./faceInterpreter";

export function useMediaPipe(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceLandmarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handLandmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsCounterRef = useRef({ frames: 0, lastUpdate: 0 });
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!cameraEnabled) return;

    let cancelled = false;

    async function init() {
      if (initializedRef.current) return;

      try {
        const vision = await import("@mediapipe/tasks-vision");
        const { FaceLandmarker, HandLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (cancelled) return;

        // Try GPU delegate first, fall back to CPU silently
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function createWithFallback(Creator: any, options: any) {
          // Suppress MediaPipe's internal INFO→console.error noise during creation
          const origError = console.error;
          console.error = (...args: unknown[]) => {
            const msg = typeof args[0] === "string" ? args[0] : "";
            // Suppress XNNPACK/TFLite delegate INFO messages
            if (msg.includes("TensorFlow Lite") || msg.includes("XNNPACK") || msg.includes("Created")) return;
            origError.apply(console, args);
          };

          try {
            return await Creator.createFromOptions(filesetResolver, options);
          } catch {
            // GPU failed, retry with CPU
            const cpuOptions = {
              ...options,
              baseOptions: { ...options.baseOptions, delegate: "CPU" },
            };
            return await Creator.createFromOptions(filesetResolver, cpuOptions);
          } finally {
            console.error = origError;
          }
        }

        const [faceLandmarker, handLandmarker] = await Promise.all([
          createWithFallback(FaceLandmarker, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1,
          }),
          createWithFallback(HandLandmarker, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          }),
        ]);

        if (cancelled) {
          faceLandmarker.close();
          handLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        handLandmarkerRef.current = handLandmarker;
        initializedRef.current = true;
      } catch (err) {
        console.warn("MediaPipe initialization failed:", err);
      }
    }

    function detect(timestamp: number) {
      if (cancelled) return;

      // Cap at ~30fps
      if (timestamp - lastTimeRef.current < 33) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const video = videoRef.current;
      if (
        !video ||
        video.readyState < 2 ||
        !handLandmarkerRef.current
      ) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      lastTimeRef.current = timestamp;
      frameCountRef.current++;
      const store = useVisionStore.getState();

      try {
        // Hand detection runs every frame (needed for responsive gestures)
        const handResults = handLandmarkerRef.current.detectForVideo(
          video,
          timestamp
        );

        if (handResults.landmarks && handResults.landmarks.length > 0) {
          const handData = handResults.landmarks.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (lm: any[], i: number) => ({
              landmarks: lm,
              handedness:
                handResults.handednesses?.[i]?.[0]?.categoryName ?? "Right",
            })
          );

          store.setRawHandLandmarks(handData);
          const gestures = interpretHands(handData, timestamp);
          store.setHands(gestures);

          const active =
            gestures.find((g) => g.type !== "none" && g.handedness === "Right") ??
            gestures.find((g) => g.type !== "none") ??
            null;
          store.setActiveGesture(active);
        } else {
          store.setRawHandLandmarks([]);
          store.setHands([]);
          store.setActiveGesture(null);
        }

        // Face detection runs every 3rd frame (~10fps) — expressions don't need 30fps
        if (faceLandmarkerRef.current && frameCountRef.current % 3 === 0) {
          const faceResults = faceLandmarkerRef.current.detectForVideo(
            video,
            timestamp
          );
          if (
            faceResults.faceBlendshapes &&
            faceResults.faceBlendshapes.length > 0
          ) {
            store.setFaceState(
              interpretFace(faceResults.faceBlendshapes[0].categories)
            );
          } else {
            store.setFaceState(null);
          }
        }
      } catch (err) {
        console.warn("Detection error:", err);
      }

      // FPS counter
      fpsCounterRef.current.frames++;
      if (timestamp - fpsCounterRef.current.lastUpdate > 1000) {
        store.setVisionFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastUpdate = timestamp;
      }

      rafRef.current = requestAnimationFrame(detect);
    }

    init().then(() => {
      if (!cancelled) {
        rafRef.current = requestAnimationFrame(detect);
      }
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraEnabled, videoRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
      initializedRef.current = false;
      clearHistory();
    };
  }, []);
}
