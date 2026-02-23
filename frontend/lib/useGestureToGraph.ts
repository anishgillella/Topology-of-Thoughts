"use client";

import { useEffect, useRef } from "react";
import { useVisionStore } from "./visionStore";
import { useGraphStore } from "./store";

interface EMA {
  x: number;
  y: number;
}

// Higher alpha = more responsive (less smoothing)
const ALPHA = 0.35;

function ema(prev: EMA, next: EMA): EMA {
  return {
    x: prev.x + ALPHA * (next.x - prev.x),
    y: prev.y + ALPHA * (next.y - prev.y),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGestureToGraph(fgRef: React.RefObject<any>) {
  const smoothedPos = useRef<EMA>({ x: 0.5, y: 0.5 });
  const lastPinchDistance = useRef<number | null>(null);
  const lastGrabPos = useRef<EMA | null>(null);
  const rafRef = useRef<number>(0);
  const openPalmCooldown = useRef<number>(0);
  const pointCooldown = useRef<number>(0);

  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);

  useEffect(() => {
    if (!cameraEnabled) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      return;
    }

    function tick(timestamp: number) {
      const fg = fgRef.current;
      if (!fg) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const state = useVisionStore.getState();
      const gesture = state.activeGesture;
      if (!gesture || gesture.type === "none") {
        lastPinchDistance.current = null;
        lastGrabPos.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Mirror-flip: video is scaleX(-1), so invert x
      const rawPos = { x: 1 - gesture.position.x, y: gesture.position.y };
      smoothedPos.current = ema(smoothedPos.current, rawPos);

      switch (gesture.type) {
        case "pinch": {
          const pd = gesture.pinchDistance ?? 0.5;
          if (lastPinchDistance.current !== null) {
            const delta = pd - lastPinchDistance.current;
            // Inverted: fingers apart (positive delta) = zoom IN, fingers together (negative delta) = zoom OUT
            const camera = fg.camera();
            if (camera) {
              const currentDist = camera.position.length();
              const zoomFactor = 1 - delta * 5;
              const newDist = currentDist * zoomFactor;
              const clampedDist = Math.max(50, Math.min(2000, newDist));
              const scale = clampedDist / currentDist;
              camera.position.multiplyScalar(scale);
            }
          }
          lastPinchDistance.current = pd;
          break;
        }

        case "grab": {
          const pos = smoothedPos.current;
          if (lastGrabPos.current) {
            const dx = (pos.x - lastGrabPos.current.x) * 500; // Increased sensitivity
            const dy = (pos.y - lastGrabPos.current.y) * 500;

            const camera = fg.camera();
            if (camera) {
              const dist = camera.position.length();
              const theta = Math.atan2(camera.position.x, camera.position.z) + (dx * Math.PI) / 180;
              const phi = Math.acos(Math.max(-1, Math.min(1, camera.position.y / dist))) - (dy * Math.PI) / 180;
              const clampedPhi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

              camera.position.set(
                dist * Math.sin(clampedPhi) * Math.sin(theta),
                dist * Math.cos(clampedPhi),
                dist * Math.sin(clampedPhi) * Math.cos(theta)
              );
              camera.lookAt(0, 0, 0);
            }
          }
          lastGrabPos.current = { ...pos };
          break;
        }

        case "swipe_left":
        case "swipe_right": {
          const camera = fg.camera();
          if (camera) {
            const angle = gesture.type === "swipe_right" ? 0.08 : -0.08;
            const dist = camera.position.length();
            const theta = Math.atan2(camera.position.x, camera.position.z) + angle;
            const phi = Math.acos(Math.max(-1, Math.min(1, camera.position.y / dist)));
            camera.position.set(
              dist * Math.sin(phi) * Math.sin(theta),
              camera.position.y,
              dist * Math.sin(phi) * Math.cos(theta)
            );
            camera.lookAt(0, 0, 0);
          }
          break;
        }

        case "open_palm": {
          // Cooldown to prevent repeated zoomToFit calls
          if (timestamp - openPalmCooldown.current > 1000) {
            fg.zoomToFit(400, 60);
            openPalmCooldown.current = timestamp;
          }
          lastPinchDistance.current = null;
          lastGrabPos.current = null;
          break;
        }

        case "point": {
          // Tap/point to select the nearest node — with cooldown to avoid rapid re-selection
          if (timestamp - pointCooldown.current > 800) {
            pointCooldown.current = timestamp;

            const pos = smoothedPos.current;
            const camera = fg.camera();
            // Read nodes from Zustand store — force-graph writes x/y/z positions back onto node objects
            const storeNodes = useGraphStore.getState().nodes;
            if (camera && storeNodes.length) {
              const screenX = pos.x * window.innerWidth;
              const screenY = pos.y * window.innerHeight;

              let closestNode = null;
              let closestDist = Infinity;

              const THREE = require("three");
              const width = window.innerWidth;
              const height = window.innerHeight;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              for (const node of storeNodes as any[]) {
                if (node.ghost || node.x === undefined) continue;

                const vec = new THREE.Vector3(node.x, node.y, node.z);
                vec.project(camera);

                // Convert NDC to screen pixels
                const nx = (vec.x * 0.5 + 0.5) * width;
                const ny = (-vec.y * 0.5 + 0.5) * height;

                const dist = Math.sqrt((nx - screenX) ** 2 + (ny - screenY) ** 2);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestNode = node;
                }
              }

              // Only select if finger is within 80px of the node's screen position
              if (closestNode && closestDist < 80) {
                useGraphStore.getState().setSelectedNodeId(closestNode.id);
                fg.cameraPosition(
                  { x: closestNode.x + 80, y: closestNode.y + 80, z: closestNode.z + 80 },
                  { x: closestNode.x, y: closestNode.y, z: closestNode.z },
                  1000
                );
              }
            }
          }
          break;
        }

        case "thumbs_up":
        default:
          break;
      }

      // Reset tracking for non-continuous gestures
      if (gesture.type !== "pinch") lastPinchDistance.current = null;
      if (gesture.type !== "grab") lastGrabPos.current = null;

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [cameraEnabled, fgRef]);
}
