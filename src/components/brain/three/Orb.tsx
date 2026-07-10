import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import { NODE_COLOR } from "./palette";
import type { GraphNode } from "./useBrainGraph";

type Props = {
  node: GraphNode;
  position: [number, number, number];
  dim?: boolean;
  onHover?: (id: string | null) => void;
  onClick?: (node: GraphNode) => void;
  isYou?: boolean;
};

// Build a radial-gradient sprite texture once.
function makeHaloTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.35)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedHalo: THREE.Texture | null = null;
function getHalo() {
  if (!sharedHalo) sharedHalo = makeHaloTexture();
  return sharedHalo;
}

export function Orb({ node, position, dim, onHover, onClick, isYou }: Props) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const hoverRef = useRef(false);
  const [isHover, setIsHover] = useState(false);

  const color = NODE_COLOR[node.nodeType];
  const baseRadius = isYou ? 1.4 : 0.35 + node.importance * 0.12;
  const haloTexture = useMemo(() => getHalo(), []);

  const colorObj = useMemo(() => new THREE.Color(color), [color]);
  const opacity = dim ? 0.25 : 1;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // gentle bob
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t * 0.6 + position[0]) * 0.08;
    }
    // pulse the sun
    if (isYou && core.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.04;
      core.current.scale.setScalar(s);
    }
    if (halo.current) {
      const target = hoverRef.current ? 1.4 : 1;
      halo.current.scale.lerp(new THREE.Vector3(baseRadius * 6 * target, baseRadius * 6 * target, 1), 0.15);
    }
  });

  return (
    <group ref={group} position={position}>
      {/* Outer halo bloom */}
      <sprite ref={halo} scale={[baseRadius * 6, baseRadius * 6, 1]}>
        <spriteMaterial
          map={haloTexture}
          color={colorObj}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={opacity * (isYou ? 0.9 : 0.7)}
        />
      </sprite>

      {/* Core sphere */}
      <mesh
        ref={core}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoverRef.current = true;
          setIsHover(true);
          onHover?.(node.id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          hoverRef.current = false;
          setIsHover(false);
          onHover?.(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(node);
        }}
      >
        <sphereGeometry args={[baseRadius, 32, 32]} />
        <meshBasicMaterial color={colorObj} transparent opacity={opacity} />
      </mesh>

      {/* Specular highlight (small offset white sphere) */}
      <mesh position={[-baseRadius * 0.3, baseRadius * 0.3, baseRadius * 0.6]}>
        <sphereGeometry args={[baseRadius * 0.35, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.55} depthWrite={false} />
      </mesh>

      {/* Pill label */}
      <Billboard follow position={[0, -baseRadius - 0.35, 0]}>
        <Html
          center
          distanceFactor={12}
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none", zIndex: isHover ? 50 : 1 }}
        >
          <div
            className="rounded-md border bg-black/80 font-medium tracking-wide text-white whitespace-nowrap backdrop-blur-md transition-all duration-200 ease-out origin-center"
            style={{
              opacity,
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
              transform: isHover ? "scale(2.6)" : "scale(1)",
              padding: isHover ? "4px 10px" : "2px 6px",
              fontSize: isHover ? "12px" : "10px",
              borderColor: isHover ? "rgba(245,182,66,0.6)" : "rgba(255,255,255,0.1)",
              boxShadow: isHover ? "0 4px 20px rgba(245,182,66,0.35)" : "none",
            }}
          >
            {node.label}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
