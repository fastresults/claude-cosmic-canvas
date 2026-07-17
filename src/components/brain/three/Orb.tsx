import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
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

// Shared registry to cap concurrent peek labels across all orbs.
const MAX_PEEKS = 4;
const activePeeks = new Map<string, number>(); // id -> visibleSince ts

function tryAcquirePeek(id: string, now: number): boolean {
  if (activePeeks.has(id)) return true;
  if (activePeeks.size >= MAX_PEEKS) return false;
  activePeeks.set(id, now);
  return true;
}
function releasePeek(id: string) {
  activePeeks.delete(id);
}

const PEEK_FADE_IN = 250;
const PEEK_HOLD = 3000;
const PEEK_FADE_OUT = 400;
const PEEK_COOLDOWN = 2000;

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

  const isCore = isYou || node.importance >= 4;

  // Peek label state (non-core only)
  const [peekOpacity, setPeekOpacity] = useState(0);
  const peekPhase = useRef<"idle" | "visible" | "cooldown">("idle");
  const peekStart = useRef(0);
  const cooldownUntil = useRef(0);

  const { camera } = useThree();
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const camForward = useMemo(() => new THREE.Vector3(), []);
  const toOrb = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);

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
      const target = hoverRef.current || focused ? 1.6 : 1;
      const pulse = focused ? 1 + Math.sin(t * 3) * 0.15 : 1;
      const s = baseRadius * 6 * target * pulse;
      halo.current.scale.lerp(new THREE.Vector3(s, s, 1), 0.15);
    }

    // Peek label logic — non-core only
    if (!isCore && group.current) {
      const now = performance.now();
      group.current.getWorldPosition(worldPos);
      camera.getWorldDirection(camForward);
      toOrb.subVectors(worldPos, camera.position).normalize();
      const facing = toOrb.dot(camForward); // 1 = dead ahead

      ndc.copy(worldPos).project(camera);
      const centerDist = Math.hypot(ndc.x, ndc.y); // 0 = center of screen
      const inCone = facing > 0.85 && centerDist < 0.4 && ndc.z < 1;

      if (peekPhase.current === "idle") {
        if (inCone && now > cooldownUntil.current && tryAcquirePeek(node.id, now)) {
          peekPhase.current = "visible";
          peekStart.current = now;
        }
      }
      if (peekPhase.current === "visible") {
        const elapsed = now - peekStart.current;
        let op: number;
        if (elapsed < PEEK_FADE_IN) op = elapsed / PEEK_FADE_IN;
        else if (elapsed < PEEK_FADE_IN + PEEK_HOLD) op = 1;
        else if (elapsed < PEEK_FADE_IN + PEEK_HOLD + PEEK_FADE_OUT)
          op = 1 - (elapsed - PEEK_FADE_IN - PEEK_HOLD) / PEEK_FADE_OUT;
        else {
          op = 0;
          peekPhase.current = "cooldown";
          cooldownUntil.current = now + PEEK_COOLDOWN;
          releasePeek(node.id);
        }
        if (Math.abs(op - peekOpacity) > 0.02 || (op === 0 && peekOpacity !== 0)) {
          setPeekOpacity(op);
        }
      }
      if (peekPhase.current === "cooldown" && now > cooldownUntil.current) {
        peekPhase.current = "idle";
      }
    }
  });

  const showCoreLabel = isCore;
  const showPeekLabel = !isCore && (peekOpacity > 0.01 || hoverRef.current || focused);
  const peekVisualOpacity = hoverRef.current || focused ? 1 : peekOpacity;

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

      {/* Core (persistent) label */}
      {showCoreLabel && (
        <Billboard follow position={[0, -baseRadius - 0.45, 0]}>
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
                transform: isHover ? "scale(1.35)" : "scale(1)",
                padding: "3px 9px",
                fontSize: isYou ? "13px" : "12px",
                background: "rgba(0,0,0,0.7)",
                border: `1px solid ${color}66`,
                boxShadow: isHover ? `0 4px 20px ${color}55` : `0 2px 10px ${color}22`,
              }}
            >
              {node.label}
            </div>
          </Html>
        </Billboard>
      )}

      {/* Peek (transient) label for non-core orbs */}
      {showPeekLabel && (
        <Billboard follow position={[0, -baseRadius - 0.3, 0]}>
          <Html
            center
            distanceFactor={12}
            zIndexRange={[100, 0]}
            style={{ pointerEvents: "none", zIndex: isHover ? 50 : 1 }}
          >
            <div
              className="rounded-md text-white whitespace-nowrap origin-center"
              style={{
                opacity: opacity * peekVisualOpacity,
                textShadow: "0 1px 2px rgba(0,0,0,0.95)",
                transform: isHover ? "scale(2.2)" : "scale(1)",
                padding: isHover ? "3px 8px" : "2px 6px",
                fontSize: isHover ? "11px" : "9.5px",
                background: "rgba(0,0,0,0.65)",
                transition: "transform 200ms ease-out, padding 200ms ease-out",
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
