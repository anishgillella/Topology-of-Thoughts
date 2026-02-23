"use client";

import { useEffect } from "react";
import { useVisionStore } from "@/lib/visionStore";

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function CameraFeed({ videoRef }: CameraFeedProps) {
  const cameraEnabled = useVisionStore((s) => s.cameraEnabled);
  const setCameraStream = useVisionStore((s) => s.setCameraStream);
  const setCameraEnabled = useVisionStore((s) => s.setCameraEnabled);

  useEffect(() => {
    if (!cameraEnabled) return;

    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 1280, height: 720 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStream(stream);
      } catch (err) {
        console.warn("Camera access denied:", err);
        setCameraEnabled(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraStream(null);
    };
  }, [cameraEnabled, videoRef, setCameraStream, setCameraEnabled]);

  if (!cameraEnabled) return null;

  return (
    <>
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        autoPlay
        playsInline
        muted
        className="camera-feed"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          zIndex: 0,
        }}
      />
      {/* Vignette overlay */}
      <div
        className="camera-vignette"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(9,9,11,0.7) 100%)",
        }}
      />
    </>
  );
}
