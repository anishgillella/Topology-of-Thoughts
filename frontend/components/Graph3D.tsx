"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useGraphStore } from "@/lib/store";

const ForceGraph3D = dynamic(
  () => import("react-force-graph-3d").then((mod) => mod.default),
  { ssr: false }
);

// Create a text sprite (always faces camera)
function createTextSprite(text: string, color: string, fontSize: number) {
  const THREE = require("three");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const scale = 4;
  const font = `bold ${fontSize * scale * 10}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.font = font;
  const textWidth = ctx.measureText(text).width;

  canvas.width = textWidth + 20 * scale;
  canvas.height = fontSize * scale * 14;

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(
    canvas.width / (scale * 10),
    canvas.height / (scale * 10),
    1
  );
  return sprite;
}

// Create a sphere with a readable label positioned below it
function createLabeledSphere(
  label: string,
  radius: number,
  sphereColor: string,
  isGhost: boolean
) {
  const THREE = require("three");
  const group = new THREE.Group();

  // Sphere
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshLambertMaterial({
    color: sphereColor,
    transparent: true,
    opacity: isGhost ? 0.4 : 0.85,
  });
  const sphere = new THREE.Mesh(geometry, material);
  group.add(sphere);

  // Label below the sphere — always readable, never clipped
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const pxRatio = 4;
  const fontSize = 28 * pxRatio;
  const font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

  ctx.font = font;
  const textWidth = ctx.measureText(label).width;
  const pad = 16 * pxRatio;

  canvas.width = textWidth + pad * 2;
  canvas.height = fontSize * 1.4;

  // Subtle background pill for readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const pillH = canvas.height * 0.85;
  const pillY = (canvas.height - pillH) / 2;
  const pillR = pillH / 2;
  ctx.beginPath();
  ctx.roundRect(pad * 0.3, pillY, canvas.width - pad * 0.6, pillH, pillR);
  ctx.fill();

  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isGhost ? "rgba(103, 232, 249, 0.6)" : "#ffffff";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);

  // Fixed readable size — doesn't shrink with sphere
  const worldWidth = Math.max(label.length * 0.8, 4);
  const worldHeight = worldWidth * (canvas.height / canvas.width);
  sprite.scale.set(worldWidth, worldHeight, 1);
  sprite.position.set(0, -(radius + worldHeight * 0.6), 0);
  group.add(sprite);

  return group;
}

export default function Graph3D() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const ghostNodes = useGraphStore((s) => s.ghostNodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 64,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const resetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 60);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") resetView();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetView]);

  const allNodes = useMemo(() => {
    const real = nodes.map((n) => ({
      ...n,
      ghost: false,
      fromSession: n.fromSession,
    }));
    const ghosts = ghostNodes.map((n) => ({ ...n, ghost: true }));
    return [...real, ...ghosts];
  }, [nodes, ghostNodes]);

  const connectivityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.source, (map.get(edge.source) || 0) + 1);
      map.set(edge.target, (map.get(edge.target) || 0) + 1);
    }
    return map;
  }, [edges]);

  const graphData = useMemo(() => {
    const nodeIds = new Set(allNodes.map((n) => n.id));
    return {
      nodes: allNodes.map((n) => ({
        id: n.id,
        name: n.label,
        description: n.description,
        connectivity: connectivityMap.get(n.id) || 0,
        mentionCount: n.mentionCount ?? 1,
        ghost: n.ghost,
        fromSession: n.fromSession,
      })),
      links: edges
        .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
        .map((e) => ({
          source: e.source,
          target: e.target,
          aiInferred: e.aiInferred || false,
          historical: e.historical || false,
          ghost: e.ghost || false,
          label: e.label,
          weight: e.weight,
        })),
    };
  }, [allNodes, edges, connectivityMap]);

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      if (node.ghost) return;
      setSelectedNodeId(node.id);
      if (fgRef.current) {
        fgRef.current.cameraPosition(
          { x: node.x + 80, y: node.y + 80, z: node.z + 80 },
          { x: node.x, y: node.y, z: node.z },
          1000
        );
      }
    },
    [setSelectedNodeId]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeColor = useCallback((node: any) => {
    if (node.ghost) return "rgba(103, 232, 249, 0.4)";
    if (node.fromSession) return "#14b8a6";
    if (!selectedNodeId) return "#8b5cf6";
    if (node.id === selectedNodeId) return "#a78bfa";
    const isConnected = edges.some(
      (e) =>
        (e.source === selectedNodeId && e.target === node.id) ||
        (e.target === selectedNodeId && e.source === node.id)
    );
    return isConnected ? "#7c3aed" : "#3f3f46";
  }, [selectedNodeId, edges]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeVal = useCallback((node: any) => {
    if (node.ghost) return 0.5;
    const connectivityBoost = (node.connectivity || 0) * 0.5;
    const mentionBoost = Math.log2(node.mentionCount || 1) * 0.5;
    return 1 + connectivityBoost + mentionBoost;
  }, []);

  // Custom node: sphere with label rendered inside
  const nodeThreeObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      const val = node.ghost
        ? 0.5
        : 1 +
          (node.connectivity || 0) * 0.5 +
          Math.log2(node.mentionCount || 1) * 0.5;
      const radius = Math.cbrt(val) * 2.5;

      let color = "#8b5cf6";
      if (node.ghost) color = "rgba(103, 232, 249, 0.4)";
      else if (node.fromSession) color = "#14b8a6";
      else if (selectedNodeId && node.id === selectedNodeId) color = "#a78bfa";
      else if (selectedNodeId) {
        const isConnected = edges.some(
          (e) =>
            (e.source === selectedNodeId && e.target === node.id) ||
            (e.target === selectedNodeId && e.source === node.id)
        );
        color = isConnected ? "#7c3aed" : "#3f3f46";
      }

      return createLabeledSphere(node.name, radius, color, !!node.ghost);
    },
    [selectedNodeId, edges]
  );

  // Edge labels
  const linkThreeObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any) => {
      if (!link.label || link.ghost) return new (require("three").Group)();

      let color = "#9ca3af";
      if (link.historical) color = "#5eead4";
      else if (link.aiInferred) color = "#fcd34d";

      return createTextSprite(link.label, color, 2);
    },
    []
  );

  const linkPositionUpdate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj: any, { start, end }: { start: any; end: any }) => {
      if (!obj || !start || !end) return;
      Object.assign(obj.position, {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        z: (start.z + end.z) / 2,
      });
    },
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkColor = useCallback((link: any) => {
    if (link.ghost) return "rgba(103, 232, 249, 0.2)";
    if (link.historical) return "#14b8a6";
    return link.aiInferred ? "#f59e0b" : "#4b5563";
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkWidth = useCallback((link: any) => {
    if (link.ghost) return 0.5;
    if (link.historical) return 2;
    const base = link.aiInferred ? 1 : 1.5;
    return link.weight ? base * link.weight : base;
  }, []);

  return (
    <div
      className="w-full"
      style={{ height: dimensions.height || "calc(100vh - 64px)" }}
    >
      {dimensions.width > 0 && (
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="#09090b"
          nodeLabel=""
          nodeColor={nodeColor}
          nodeVal={nodeVal}
          nodeOpacity={0.9}
          nodeResolution={32}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          linkColor={linkColor}
          linkOpacity={0.6}
          linkWidth={linkWidth}
          linkThreeObjectExtend={true}
          linkThreeObject={linkThreeObject}
          linkPositionUpdate={linkPositionUpdate}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={0.5}
          linkDirectionalArrowColor={linkColor}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => setSelectedNodeId(null)}
          enableNodeDrag={true}
          enableNavigationControls={true}
        />
      )}
    </div>
  );
}
