import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EDGE_COLOR } from "./palette";
import type { EdgeKind } from "@/lib/brain/edges";

type Props = {
  from: [number, number, number];
  to: [number, number, number];
  kind: EdgeKind;
  dim?: boolean;
};

export function Filament({ from, to, kind, dim }: Props) {
  const color = EDGE_COLOR[kind] ?? "#ffffff";
  const shimmerRef = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);

  const points = useMemo(() => [start, end], [start, end]);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame((state) => {
    if (!shimmerRef.current) return;
    const t = (state.clock.elapsedTime * 0.35) % 1;
    shimmerRef.current.position.lerpVectors(start, end, t);
  });

  return (
    <group>
      <primitive
        object={
          new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({
              color,
              transparent: true,
              opacity: dim ? 0.06 : 0.28,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          )
        }
      />
      {/* Traveling shimmer */}
      <mesh ref={shimmerRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={dim ? 0.15 : 0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
