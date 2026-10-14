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
  uniform float uLight; // 0 = dark theme (emissive), 1 = light theme (tinted glass)
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

  // Smooth 3D value noise (quintic interpolation). Continuous everywhere —
  // no simplex cell seams, which caused the jagged straight-line artifacts.
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float snoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    float x00 = mix(n000, n100, u.x);
    float x10 = mix(n010, n110, u.x);
    float x01 = mix(n001, n101, u.x);
    float x11 = mix(n011, n111, u.x);
    float v = mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
    return v * 2.0 - 1.0; // -1..1
  }

  vec4 extractAlpha(vec3 colorIn) {
    float a = max(max(colorIn.r, colorIn.g), colorIn.b);
    return vec4(colorIn.rgb / (a + 1e-5), a);
  }

  // Eve palette: amber, violet, deep warm indigo.
  const vec3 baseColor1 = vec3(0.956863, 0.729412, 0.298039);
  const vec3 baseColor2 = vec3(0.705882, 0.490196, 0.956863);
  const vec3 baseColor3 = vec3(0.298039, 0.160784, 0.501961);
  // Light theme palette: honey amber + deep violet for contrast on cream.
  const vec3 lightColor1 = vec3(0.85, 0.57, 0.12);
  const vec3 lightColor2 = vec3(0.49, 0.29, 0.85);
  const float innerRadius = 0.6;
  const float noiseScale = 0.65;

  float light1(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * attenuation);
  }

  float light2(float intensity, float attenuation, float dist) {
    return intensity / (1.0 + dist * dist * attenuation);
  }

  // Time-looped noise: crossfade two phases so the hash input never grows
  // large (no blocky precision loss) and the loop has no visible seam.
  float loopNoise(vec2 p) {
    const float P = 300.0;
    float z = mod(iTime * 0.5, P);
    float w = z / P;
    return mix(snoise3(vec3(p, z)), snoise3(vec3(p, z - P)), w);
  }

  vec4 draw(vec2 uv, float px) {
    vec3 color1 = adjustHue(baseColor1, hue);
    vec3 color2 = adjustHue(baseColor2, hue);
    vec3 color3 = adjustHue(baseColor3, hue);

    float ang = atan(uv.y, uv.x);
    float len = length(uv);
    float invLen = len > 0.0 ? 1.0 / len : 0.0;
    float aa = px * 2.0;

    float n0 = loopNoise(uv * noiseScale) * 0.5 + 0.5;
    float swell = hover * 0.03;
    float r0 = mix(mix(innerRadius, 1.0, 0.45), mix(innerRadius, 1.0, 0.55), n0) + swell;
    float d0 = distance(uv, (r0 * invLen) * uv);
    float v0 = light1(1.0, 10.0, d0);
    v0 *= smoothstep(r0 + 0.05 + aa, r0 - aa, len);
    float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

    float a = -iTime;
    vec2 pos = vec2(cos(a), sin(a)) * r0;
    float d = distance(uv, pos);
    float v1 = light2(1.5 + hover * 0.8, 5.0, d);
    v1 *= light1(1.0, 50.0, d0);

    float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5) - aa, len);
    float v3 = smoothstep(innerRadius - aa, mix(innerRadius, 1.0, 0.5) + aa, len);

    vec3 col = mix(color1, color2, cl);
    col = mix(color3, col, v0);
    col = (col + v1) * v2 * v3;
    col = clamp(col * 1.15, 0.0, 1.0);
    vec4 darkOut = extractAlpha(col);

    // Light theme: tinted glass on paper. Saturated color with straight
    // alpha — faint glow fades to transparent, never to grey.
    vec3 lc1 = adjustHue(lightColor1, hue);
    vec3 lc2 = adjustHue(lightColor2, hue);
    vec3 ring = mix(lc1, lc2, cl);
    float body = v0 * v2 * v3;
    float spark = clamp(v1 * v2 * v3, 0.0, 1.0);
    float la = clamp(body * 0.95 + spark * 0.55, 0.0, 1.0);
    la = la * la * (3.0 - 2.0 * la); // gentler halo, crisp body
    vec3 lrgb = mix(ring, mix(ring, vec3(1.0, 0.93, 0.8), 0.45), spark);
    vec4 lightOut = vec4(lrgb, la);

    return mix(darkOut, lightOut, uLight);
  }

  vec4 mainImage(vec2 fragCoord) {
    vec2 center = iResolution.xy * 0.5;
    float size = min(iResolution.x, iResolution.y);
    vec2 uv = (fragCoord - center) / size * 2.0;
    float px = 2.0 / size;
    float s = sin(rot);
    float c = cos(rot);
    uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    return draw(uv, px);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution.xy;
    vec4 col = mainImage(fragCoord);
    gl_FragColor = vec4(col.rgb, col.a);
  }
`;

/**
 * WebGL plasma orb (ogl). Browser-only: the renderer is dynamically imported
 * inside a mount effect so the module is safe to import during SSR.
 * No microphone access here — feed an external `level` instead.
 */
/** True when the app's light theme class is on <html>. */
function isLightTheme(): boolean {
  return document.documentElement.classList.contains("light");
}

/** Test hook: window.__orbTimeOffset (seconds) jumps the clock forward. */
function timeOffset(): number {
  return (window as unknown as { __orbTimeOffset?: number }).__orbTimeOffset ?? 0;
}

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
      gl.disable(gl.BLEND);
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
          uLight: { value: isLightTheme() ? 1 : 0 },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
        program.uniforms.iResolution.value.set(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        );
      };
      window.addEventListener("resize", resize);
      resize();

      // Follow theme switches; uLight eases toward the target (~400ms).
      let lightTarget = isLightTheme() ? 1 : 0;
      const themeObserver = new MutationObserver(() => {
        lightTarget = isLightTheme() ? 1 : 0;
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

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
        // Loop period 600π: whole turns for every angular term and 3 noise loops → seamless.
        program.uniforms.iTime.value = (t * 0.001 + timeOffset()) % (600 * Math.PI);
        program.uniforms.hue.value = hue;
        {
          const cur = program.uniforms.uLight.value as number;
          const k = still ? 1 : 1 - Math.exp(-Math.max(dt, 0) * 10);
          program.uniforms.uLight.value = cur + (lightTarget - cur) * k;
        }

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
        currentRot = (currentRot + dt * voiceRotationSpeed) % (Math.PI * 2);

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
        themeObserver.disconnect();
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
