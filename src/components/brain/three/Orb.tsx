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
  focused?: boolean;
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

const YELLOW_TYPES = new Set(["you", "persona", "voice_sample", "directive"]);

export function Orb({ node, position, dim, focused, onHover, onClick, isYou }: Props) {
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

  const isYellow = YELLOW_TYPES.has(node.nodeType);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = position[1] + Math.sin(t * 0.6 + position[0]) * 0.08;
    }
    if (isYou && core.current) {
      const s = 1 + Math.sin(t * 1.5) * 0.04;
      core.current.scale.setScalar(s);
    }
    if (halo.current) {
      const target = hoverRef.current || focused ? 1.6 : 1;
      const pulse = focused ? 1 + Math.sin(t * 3) * 0.15 : 1;
      const s = baseRadius * 6 * target * pulse;
      halo.current.scale.lerp(new THREE.Vector3(s, s, 1), 0.15);
    }
  });

  const showLabel = isYellow || isHover || focused;

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

      {/* Specular highlight */}
      <mesh position={[-baseRadius * 0.3, baseRadius * 0.3, baseRadius * 0.6]}>
        <sphereGeometry args={[baseRadius * 0.35, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.55} depthWrite={false} />
      </mesh>

      {showLabel && (
        <Billboard follow position={[0, -baseRadius - 0.4, 0]}>
          <Html
            center
            distanceFactor={12}
            zIndexRange={[100, 0]}
            style={{ pointerEvents: "none", zIndex: isHover ? 50 : 2 }}
          >
            <div
              className="rounded-md font-medium tracking-wide text-white whitespace-nowrap backdrop-blur-md transition-all duration-200 ease-out origin-center"
              style={{
                opacity,
                textShadow: "0 1px 3px rgba(0,0,0,0.95)",
                transform: isHover ? "scale(1.3)" : "scale(1)",
                padding: "3px 8px",
                fontSize: isYou ? "12px" : "11px",
                background: "rgba(0,0,0,0.7)",
                border: `1px solid ${color}66`,
                boxShadow: isHover ? `0 4px 20px ${color}55` : `0 2px 8px ${color}22`,
              }}
            >
              {node.label}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}
