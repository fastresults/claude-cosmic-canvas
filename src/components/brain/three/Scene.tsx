import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Orb } from "./Orb";
import { Filament } from "./Filament";
import { Starfield } from "./Starfield";
import { useBrainGraph, type GraphNode } from "./useBrainGraph";
import { computeLayout } from "./layout";

type Props = {
  onPeek: (node: GraphNode) => void;
};

export function Scene({ onPeek }: Props) {
  const { nodes, edges } = useBrainGraph();
  const [hovered, setHovered] = useState<string | null>(null);

  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>();
    const laid = computeLayout(nodes, edges);
    for (const p of laid) map.set(p.id, [p.x, p.y, p.z]);
    return map;
  }, [nodes, edges]);

  // Which ids are "related" to the hovered node.
  const related = useMemo(() => {
    if (!hovered) return null;
    const s = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.source === hovered) s.add(e.target);
      if (e.target === hovered) s.add(e.source);
    }
    return s;
  }, [hovered, edges]);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "radial-gradient(circle at 50% 55%, #1a1208 0%, #050303 60%, #000 100%)" }}
    >
      <PerspectiveCamera makeDefault position={[0, 2, 22]} fov={55} />
      <ambientLight intensity={0.4} />

      <Suspense fallback={null}>
        <Starfield />

        {edges.map((e) => {
          const a = positions.get(e.source);
          const b = positions.get(e.target);
          if (!a || !b) return null;
          const dim = related ? !(related.has(e.source) && related.has(e.target)) : false;
          return <Filament key={e.id} from={a} to={b} kind={e.kind} dim={dim} />;
        })}

        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const dim = related ? !related.has(n.id) : false;
          return (
            <Orb
              key={n.id}
              node={n}
              position={p}
              dim={dim}
              isYou={n.id === "you"}
              onHover={setHovered}
              onClick={onPeek}
            />
          );
        })}

        <EffectComposer>
          <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.6} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.85} />
        </EffectComposer>
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={45}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
