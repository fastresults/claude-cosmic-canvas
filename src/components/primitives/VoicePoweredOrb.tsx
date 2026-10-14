import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type VoicePoweredOrbProps = {
  className?: string;
  /** External audio level 0..1 (e.g. from useAudioLevel). Omit for gentle idle motion. */
  level?: number;
  /** Hue rotation in degrees applied to the amber/violet/rose palette. */
  hue?: number;
  /** Freeze animation (reduced motion). */
  still?: boolean;
  /** Fires once the WebGL renderer has painted its first frame. */
  onReady?: () => void;
};

const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float iTime;
  uniform vec3 iResolution;
  uniform float hue;
  uniform float hover;
  uniform float rot;
  uniform float hoverIntensity;
  varying vec2 vUv;

  vec3 rgb2yiq(vec3 c) {
    float y = dot(c, vec3(0.299, 0.587, 0.114));
    float i = dot(c, vec3(0.596, -0.274, -0.322));
    float q = dot(c, vec3(0.211, -0.523, 0.312));
    return vec3(y, i, q);
  }

  vec3 yiq2rgb(vec3 c) {
    float r = c.x + 0.956 * c.y + 0.621 * c.z;
    float g = c.x - 0.272 * c.y - 0.647 * c.z;
    float b = c.x - 1.106 * c.y + 1.703 * c.z;
    return vec3(r, g, b);
  }

  vec3 adjustHue(vec3 color, float hueDeg) {
    float hueRad = hueDeg * 3.14159265 / 180.0;
    vec3 yiq = rgb2yiq(color);
    float cosA = cos(hueRad);
    float sinA = sin(hueRad);
    float i = yiq.y * cosA - yiq.z * sinA;
    float q = yiq.y * sinA + yiq.z * cosA;
    yiq.y = i;
    yiq.z = q;
    return yiq2rgb(yiq);
  }

  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yxz + 19.19);
    return -1.0 + 2.0 * fract(vec3(
      p3.x + p3.y,
      p3.x + p3.z,
      p3.y + p3.z
    ) * p3.zyx);
  }

  float snoise3(vec3 p) {
    const float K1 = 0.333333333;
    const float K2 = 0.166666667;
    vec3 i = floor(p + (p.x + p.y + p.z) * K1);
    vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
    vec3 e = step(vec3(0.0), d0 - d0.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = e - e.zxy * (1.0 - e);
    vec3 d1 = d0 - (i1 - K2);
    vec3 d2 = d0 - (i2 - K1);
    vec3 d3 = d0 - 0.5;
    vec4 h = max(0.6 - vec4(
      dot(d0, d0),
      dot(d1, d1),
      dot(d2, d2),
      dot(d3, d3)
    ), 0.0);
    vec4 n = h * h * h * h * vec4(
      dot(d0, hash33(i)),
      dot(d1, hash33(i + i1)),
      dot(d2, hash33(i + i2)),
      dot(d3, hash33(i + 1.0))
    );
    return dot(vec4(31.316), n);
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  // Eve palette: amber, violet, deep warm indigo.
  const vec3 baseColor1 = vec3(0.956863, 0.729412, 0.298039);
  const vec3 baseColor2 = vec3(0.705882, 0.490196, 0.956863);
  const vec3 baseColor3 = vec3(0.298039, 0.160784, 0.501961);
  const float innerRadius = 0.6;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }

  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  vec4 draw(vec2 uv) {
    vec3 color1 = adjustHue(baseColor1, hue);
    vec3 color2 = adjustHue(baseColor2, hue);
    vec3 color3 = adjustHue(baseColor3, hue);

    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;

    float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
    float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 * 1.05, r0, len);
    float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

    float a = iTime * -1.0;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(1.5, 5.0, d);
    v1 *= light1(1.0, 50.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
    float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col = clamp(col * 1.25, 0.0, 1.0);

    return extractAlpha(col);
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;

    float angle = rot;
    float s = sin(angle);
    float c = cos(angle);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

    uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
    uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

    return draw(uv);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 col = mainImage(fragCoord);
    gl_FragColor = vec4(col.rgb * col.a, col.a);
  }
`;

/**
 * WebGL plasma orb (ogl). Browser-only: the renderer is dynamically imported
 * inside a mount effect so the module is safe to import during SSR.
 * No microphone access here — feed an external `level` instead.
 */
export function VoicePoweredOrb({ className, level, hue = 0, still = false, onReady }: VoicePoweredOrbProps) {
  const ctnDom = useRef<HTMLDivElement>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = ctnDom.current;
    if (!container) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { Renderer, Program, Mesh, Triangle, Vec3 } = await import("ogl");
      if (disposed || !ctnDom.current) return;

      const renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      while (container.firstChild) container.removeChild(container.firstChild);
      container.appendChild(gl.canvas);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          iTime: { value: 0 },
          iResolution: {
            value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
          },
          hue: { value: hue },
          hover: { value: 0 },
          rot: { value: 0 },
          hoverIntensity: { value: 0 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width * dpr, height * dpr);
        gl.canvas.style.width = `${width}px`;
        gl.canvas.style.height = `${height}px`;
        program.uniforms.iResolution.value.set(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        );
      };
      window.addEventListener("resize", resize);
      resize();

      // Pause rendering when scrolled out of view.
      let visible = true;
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
      });
      observer.observe(container);

      let rafId = 0;
      let readyFired = false;
      let lastTime = 0;
      let currentRot = 0;
      let smoothed = 0;
      const baseRotationSpeed = 0.3;
      const maxRotationSpeed = 1.2;
      const maxHoverIntensity = 0.8;

      const update = (t: number) => {
        rafId = requestAnimationFrame(update);
        if (!visible) {
          lastTime = t;
          return;
        }
        const dt = (t - lastTime) * 0.001;
        lastTime = t;
        program.uniforms.iTime.value = t * 0.001;
        program.uniforms.hue.value = hue;

        if (still) {
          program.uniforms.hover.value = 0;
          program.uniforms.hoverIntensity.value = 0;
          program.uniforms.rot.value = currentRot;
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          renderer.render({ scene: mesh });
          if (!readyFired) {
            readyFired = true;
            onReadyRef.current?.();
          }
          return;
        }

        // External voice level, or a gentle idle breathing when none is fed.
        const external = levelRef.current;
        const idle = 0.12 + 0.08 * Math.sin(t * 0.0012);
        const target = external == null ? idle : Math.min(external * 1.6, 1);
        smoothed += (target - smoothed) * 0.12;

        const voiceRotationSpeed = baseRotationSpeed + smoothed * maxRotationSpeed * 2.0;
        currentRot += dt * voiceRotationSpeed;

        program.uniforms.hover.value = Math.min(smoothed * 2.0, 1.0);
        program.uniforms.hoverIntensity.value = Math.min(
          smoothed * maxHoverIntensity * 0.8,
          maxHoverIntensity,
        );
        program.uniforms.rot.value = currentRot;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderer.render({ scene: mesh });
        if (!readyFired) {
          readyFired = true;
          onReadyRef.current?.();
        }
      };
      rafId = requestAnimationFrame(update);

      cleanup = () => {
        cancelAnimationFrame(rafId);
        observer.disconnect();
        window.removeEventListener("resize", resize);
        try {
          if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
        } catch {
          /* ignore */
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    })().catch((error) => {
      console.warn("VoicePoweredOrb: WebGL unavailable, keeping fallback", error);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [hue, still]);

  return <div ref={ctnDom} className={cn("relative h-full w-full", className)} aria-hidden />;
}
