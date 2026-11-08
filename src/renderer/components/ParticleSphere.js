/**
 * ParticleSphere.js
 * ─────────────────────────────────────────────────────────────
 * Core 3D visual element for A.R.C.U.S.
 * Ultra-dense quantum particle sphere (18,000+ points)
 * with dynamic volumetric glowing corona and ultra-smooth
 * harmonic speech wave resonance.
 *
 * Props:
 *   state      — 'idle' | 'listening' | 'speaking'
 *   audioLevel — 0–1 float representing current speech/mic amplitude
 *   className  — optional CSS class for the container div
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

// ─── Particle Shaders ──────────────────────────────────────────

const PARTICLE_VERTEX_SHADER = /* glsl */ `
uniform float uTime;
uniform float uState;       // 0 = idle, 1 = listening, 2 = speaking
uniform float uAudioLevel;
uniform float uTransition;  // smooth transition factor (0-1)

attribute float aRandom;
attribute float aLayer;     // 0 = core, 1 = surface, 2 = halo
attribute vec3 aOriginalPosition;

varying float vAlpha;
varying float vDistance;
varying float vLayer;

void main() {
    vLayer = aLayer;
    vec3 pos = aOriginalPosition;
    float t = uTime;

    // ---------- Idle: smooth organic breathing + rotation ----------
    vec3 idlePos = pos;
    {
        float breathe = sin(t * 0.8 + pos.y * 1.5) * 0.05 * (1.0 + aRandom * 0.2);
        idlePos *= 1.0 + breathe;
        idlePos.x += sin(t * 0.4 + pos.z * 3.0) * 0.03;
        idlePos.y += cos(t * 0.5 + pos.x * 3.0) * 0.03;
    }

    // ---------- Listening: vibrant energetic scatter ----------
    vec3 listenPos = pos;
    {
        float scatter = uAudioLevel * 2.2 + 0.4;
        vec3 norm = normalize(pos);
        listenPos += norm * sin(t * 4.0 + aRandom * 6.28) * scatter * (0.3 + aRandom * 0.7);
        listenPos.x += sin(t * 3.0 + aRandom * 12.0) * scatter * 0.35;
        listenPos.y += cos(t * 2.5 + aRandom * 10.0) * scatter * 0.35;
        listenPos.z += sin(t * 2.8 + aRandom * 15.0) * scatter * 0.35;
    }

    // ---------- Speaking: Ultra-smooth harmonic wave resonance (NO jitter) ----------
    vec3 speakPos = pos;
    {
        float pulse = uAudioLevel;
        // Continuous, liquid standing waves across spherical coordinates
        float wave1 = sin(t * 3.2 + pos.y * 2.2) * 0.08 * (1.0 + pulse * 1.4);
        float wave2 = cos(t * 2.6 + pos.x * 2.2 + pos.z * 1.2) * 0.06 * (1.0 + pulse * 1.4);
        float ripple = sin(length(pos) * 4.8 - t * 4.2) * 0.05 * (0.4 + pulse * 0.8);
        
        // Fluid, breathing radial volume expansion
        speakPos *= 1.0 + wave1 + wave2 + ripple;
    }

    // Blend smoothly between states
    vec3 finalPos;
    if (uTransition < 1.0) {
        finalPos = mix(idlePos, listenPos, clamp(uTransition, 0.0, 1.0));
    } else {
        finalPos = mix(listenPos, speakPos, clamp(uTransition - 1.0, 0.0, 1.0));
    }

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    vDistance = length(mvPosition.xyz);
    vAlpha = smoothstep(10.0, 3.0, vDistance);

    // Particle size based on layer & distance
    float baseSize = (aLayer < 0.5) ? 3.0 : (aLayer < 1.5 ? 4.5 : 2.5);
    gl_PointSize = max(1.8, (baseSize * 4.5) / vDistance);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uAudioLevel;

varying float vAlpha;
varying float vDistance;
varying float vLayer;

void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    // Glowing core with soft edge
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 1.4);

    // Inner core points are slightly brighter
    float brightness = (vLayer < 0.5) ? 1.3 : 1.0;
    brightness += uAudioLevel * 0.4;

    gl_FragColor = vec4(uColor * brightness, glow * vAlpha * 0.9);
}
`;

// ─── Dynamic Glow Background Shaders ───────────────────────────

const GLOW_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uAudioLevel;

varying vec2 vUv;

void main() {
    vec2 center = vUv - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    // Corona pulsation rays
    float angle = atan(center.y, center.x);
    float rays = sin(angle * 12.0 + uTime * 1.5) * 0.06;
    float rays2 = cos(angle * 8.0 - uTime * 2.0) * 0.04;
    float pulse = sin(uTime * 1.2) * 0.08 + (uAudioLevel * 0.35);

    float effectiveDist = dist + rays + rays2 - pulse;

    // Exponential glowing falloff
    float intensity = exp(-effectiveDist * 4.2);
    intensity = clamp(intensity, 0.0, 1.0);
    intensity = pow(intensity, 1.6);

    // Deep luminous core
    vec3 glowColor = mix(uColor * 0.8, vec3(1.0), intensity * 0.3);

    gl_FragColor = vec4(glowColor, intensity * 0.55);
}
`;

// ─── Constants ─────────────────────────────────────────────────

const PARTICLE_COUNT = 18000; // Ultra-dense!
const SPHERE_RADIUS = 2.3;
const ROTATION_SPEED = 0.07;
const TRANSITION_SPEED = 3.5;

const COLOR_IDLE = new THREE.Color(0x00d4ff); // Neon cyan
const COLOR_LISTEN = new THREE.Color(0x00ff88); // Neon green
const COLOR_SPEAKING = new THREE.Color(0x00e5ff); // Vivid pulsing cyan

function stateToNumber(state) {
  switch (state) {
    case 'listening': return 1;
    case 'speaking': return 2;
    default: return 0;
  }
}

function targetColor(state) {
  switch (state) {
    case 'listening': return COLOR_LISTEN;
    case 'speaking': return COLOR_SPEAKING;
    default: return COLOR_IDLE;
  }
}

export default function ParticleSphere({ state = 'idle', audioLevel = 0, className = '' }) {
  const containerRef = useRef(null);
  const propsRef = useRef({ state, audioLevel });
  propsRef.current = { state, audioLevel };
  const threeRef = useRef(null);

  const initThree = useCallback((container) => {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Renderer with pure black background
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent so CSS black shows through
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.z = 6.2;

    // ── 1. Dynamic Glow Billboard Plane (Behind the Sphere) ───────
    const glowGeo = new THREE.PlaneGeometry(7.5, 7.5);
    const glowUniforms = {
      uTime: { value: 0 },
      uColor: { value: COLOR_IDLE.clone() },
      uAudioLevel: { value: 0 },
    };
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX_SHADER,
      fragmentShader: GLOW_FRAGMENT_SHADER,
      uniforms: glowUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.z = -0.6; // Behind the sphere center
    scene.add(glowMesh);

    // ── 2. Ultra-Dense Multi-Layer Particle Sphere ───────────────
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const originals = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const layers = new Float32Array(PARTICLE_COUNT);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let r = SPHERE_RADIUS;
      let layer = 1.0; // 0=core, 1=surface, 2=halo

      if (i < 4000) {
        // Inner dense core
        layer = 0.0;
        r = SPHERE_RADIUS * (0.4 + 0.5 * Math.random());
      } else if (i < 15500) {
        // Dense surface with Fibonacci distribution
        layer = 1.0;
        const fi = i - 4000;
        const totalSurface = 11500;
        const theta = Math.acos(1 - 2 * (fi + 0.5) / totalSurface);
        const phi = 2 * Math.PI * fi / goldenRatio;
        r = SPHERE_RADIUS * (0.98 + (Math.random() - 0.5) * 0.05);

        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.sin(theta) * Math.sin(phi);
        const z = r * Math.cos(theta);

        const i3 = i * 3;
        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        originals[i3] = x;
        originals[i3 + 1] = y;
        originals[i3 + 2] = z;
        randoms[i] = Math.random();
        layers[i] = layer;
        continue;
      } else {
        // Outer shimmering halo
        layer = 2.0;
        r = SPHERE_RADIUS * (1.05 + 0.25 * Math.random());
      }

      // Spherical distribution for core & halo
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);

      const i3 = i * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      originals[i3] = x;
      originals[i3 + 1] = y;
      originals[i3 + 2] = z;
      randoms[i] = Math.random();
      layers[i] = layer;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aOriginalPosition', new THREE.BufferAttribute(originals, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(layers, 1));

    const particleUniforms = {
      uTime: { value: 0 },
      uState: { value: 0 },
      uAudioLevel: { value: 0 },
      uTransition: { value: 0 },
      uColor: { value: COLOR_IDLE.clone() },
    };

    const particleMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: particleUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, particleMaterial);
    scene.add(points);

    // ── Animation Loop with Smoothing ────────────────────────────
    let currentTransition = 0;
    let currentColor = COLOR_IDLE.clone();
    let currentAudioLevel = 0; // Smooth damped audio level!
    let clock = new THREE.Clock();
    let animId = null;

    function animate() {
      animId = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const { state: curState, audioLevel: targetAudio } = propsRef.current;

      // Gentle rotation
      points.rotation.y += ROTATION_SPEED * delta;
      points.rotation.x = Math.sin(elapsed * 0.2) * 0.08;

      // Smooth state transition lerp
      const targetStateNum = stateToNumber(curState);
      currentTransition += (targetStateNum - currentTransition) * Math.min(1, TRANSITION_SPEED * delta);

      // Smooth color lerp
      const destColor = targetColor(curState);
      currentColor.lerp(destColor, Math.min(1, TRANSITION_SPEED * delta));

      // Damped audio level interpolation (eliminates ANY jitter or harsh jumps)
      currentAudioLevel += (targetAudio - currentAudioLevel) * Math.min(1.0, 10.0 * delta);

      // Update particle uniforms
      particleUniforms.uTime.value = elapsed;
      particleUniforms.uState.value = targetStateNum;
      particleUniforms.uTransition.value = currentTransition;
      particleUniforms.uAudioLevel.value = currentAudioLevel;
      particleUniforms.uColor.value.copy(currentColor);

      // Update background glow uniforms
      glowUniforms.uTime.value = elapsed;
      glowUniforms.uAudioLevel.value = currentAudioLevel;
      glowUniforms.uColor.value.copy(currentColor);

      renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    window.addEventListener('resize', onResize);

    threeRef.current = {
      renderer,
      scene,
      camera,
      geometry,
      particleMaterial,
      glowGeo,
      glowMat,
      animId,
      onResize,
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    initThree(container);

    return () => {
      const t = threeRef.current;
      if (!t) return;
      cancelAnimationFrame(t.animId);
      window.removeEventListener('resize', t.onResize);

      t.geometry.dispose();
      t.particleMaterial.dispose();
      t.glowGeo.dispose();
      t.glowMat.dispose();

      if (t.renderer.domElement && t.renderer.domElement.parentNode) {
        t.renderer.domElement.parentNode.removeChild(t.renderer.domElement);
      }
      t.renderer.dispose();
      threeRef.current = null;
    };
  }, [initThree]);

  return (
    <div
      ref={containerRef}
      className={`particle-sphere-canvas ${className}`}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}
