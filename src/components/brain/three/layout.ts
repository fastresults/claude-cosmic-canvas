import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
} from "d3-force-3d";
import type { GraphNode, GraphEdge } from "./useBrainGraph";

export type Positioned = { id: string; x: number; y: number; z: number };

export function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Positioned[] {
  const simNodes = nodes.map((n) => ({
    id: n.id,
    // Pin "You" at origin.
    fx: n.id === "you" ? 0 : undefined,
    fy: n.id === "you" ? 0 : undefined,
    fz: n.id === "you" ? 0 : undefined,
  }));
  const simEdges = edges.map((e) => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(simNodes, 3)
    .force("charge", forceManyBody().strength(-30))
    .force(
      "link",
      forceLink(simEdges)
        .id((d: { id: string }) => d.id)
        .distance(6)
        .strength(0.5),
    )
    .force("center", forceCenter(0, 0, 0))
    .force("collide", forceCollide(1.2))
    .stop();

  // Run enough ticks to settle.
  for (let i = 0; i < 200; i++) sim.tick();

  return simNodes.map((n: { id: string; x?: number; y?: number; z?: number }) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    z: n.z ?? 0,
  }));
}
