import {
  Component, ElementRef, Input, NgZone, OnDestroy, PLATFORM_ID, ViewChild, afterNextRender, inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as THREE_NS from 'three';

/**
 * Decorative WebGL backdrop: a spiral "nebula" of particles, a wireframe film reel and
 * a handful of drifting film frames. three.js is imported lazily so it never lands in
 * the initial bundle, and the loop pauses while the canvas is offscreen.
 */
@Component({
  selector: 'app-cinema-scene',
  standalone: true,
  template: `<canvas #canvas class="scene-canvas" aria-hidden="true"></canvas>`,
  styles: [`
    :host { position: absolute; inset: 0; display: block; overflow: hidden; pointer-events: none; }
    .scene-canvas { width: 100%; height: 100%; display: block; opacity: 0; transition: opacity 1.4s ease; }
    .scene-canvas.ready { opacity: 1; }
  `],
})
export class CinemaScene implements OnDestroy {
  /** 'hero' leaves room for copy on the left; 'login' centres the reel behind the card. */
  @Input() variant: 'hero' | 'login' = 'hero';
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private cleanup: (() => void) | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.zone.runOutsideAngular(() => this.init());
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cleanup?.();
  }

  private async init(): Promise<void> {
    const THREE = await import('three');
    if (this.destroyed) return;

    const canvas = this.canvasRef.nativeElement;
    const host = canvas.parentElement as HTMLElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE_NS.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the CSS gradients behind the canvas carry the look on their own.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07060b, 0.035);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    camera.position.set(0, 2.2, 16);

    const isLogin = this.variant === 'login';
    const world = new THREE.Group();
    world.position.x = isLogin ? 0 : 4.2;
    world.rotation.x = 0.42;
    scene.add(world);

    const sprite = this.makeSprite(THREE);
    const disposables: { dispose(): void }[] = [sprite];

    // ---- Nebula: three-armed spiral of additive particles ----
    const count = window.innerWidth < 700 ? 3500 : 7000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const inner = new THREE.Color('#ffd27a');
    const mid = new THREE.Color('#ff5f6d');
    const outer = new THREE.Color('#7a5cff');
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const radius = Math.pow(Math.random(), 0.75) * 11;
      const arm = ((i % 3) / 3) * Math.PI * 2;
      const angle = arm + radius * 0.48;
      const spread = 0.35 + radius * 0.09;
      positions[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * spread * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.9;
      positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread * 2;
      const t = radius / 11;
      tmp.copy(inner).lerp(mid, Math.min(t * 1.8, 1));
      if (t > 0.5) tmp.lerp(outer, (t - 0.5) * 2);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    const nebulaGeo = new THREE.BufferGeometry();
    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nebulaGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const nebulaMat = new THREE.PointsMaterial({
      size: 0.13, map: sprite, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    });
    const nebula = new THREE.Points(nebulaGeo, nebulaMat);
    world.add(nebula);
    disposables.push(nebulaGeo, nebulaMat);

    // ---- Distant dust that sits outside the spiral ----
    const dustCount = 900;
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dust.set([(Math.random() - 0.5) * 70, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 50 - 10], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.09, map: sprite, color: 0xbfb6ff, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);
    disposables.push(dustGeo, dustMat);

    // ---- Film reel at the core ----
    const reel = new THREE.Group();
    const reelMat = new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.55 });
    const ringGeo = new THREE.EdgesGeometry(new THREE.TorusGeometry(2.1, 0.12, 6, 64));
    const hubGeo = new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 24));
    reel.add(new THREE.LineSegments(ringGeo, reelMat));
    const hub = new THREE.LineSegments(hubGeo, reelMat);
    hub.rotation.x = Math.PI / 2;
    reel.add(hub);
    const holeGeo = new THREE.EdgesGeometry(new THREE.CircleGeometry(0.42, 24));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const hole = new THREE.LineSegments(holeGeo, reelMat);
      hole.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0);
      reel.add(hole);
    }
    reel.rotation.x = -Math.PI / 2 + 0.25;
    world.add(reel);
    disposables.push(reelMat, ringGeo, hubGeo, holeGeo);

    // ---- Drifting film frames ----
    const frameGeo = this.makeFilmFrame(THREE);
    const frames: { mesh: THREE_NS.LineSegments; speed: number; radius: number; phase: number; lift: number }[] = [];
    const frameColors = [0xff7a8a, 0xffd27a, 0x9d86ff, 0x6fe3ff];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.LineBasicMaterial({ color: frameColors[i % frameColors.length], transparent: true, opacity: 0.4 });
      const mesh = new THREE.LineSegments(frameGeo, mat);
      const s = 0.5 + Math.random() * 0.7;
      mesh.scale.set(s, s, s);
      frames.push({ mesh, speed: 0.05 + Math.random() * 0.08, radius: 5 + Math.random() * 6, phase: Math.random() * Math.PI * 2, lift: (Math.random() - 0.5) * 4 });
      world.add(mesh);
      disposables.push(mat);
    }
    disposables.push(frameGeo);

    // ---- Sizing, pointer parallax, visibility ----
    const resize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Pull the camera back on narrow screens so the spiral still fits.
      camera.position.z = w < 700 ? 22 : 16;
      world.position.x = isLogin || w < 900 ? 0 : 4.2;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) loop();
    });
    io.observe(host);

    const clock = new THREE.Clock();
    let frame = 0;
    const render = (t: number) => {
      nebula.rotation.y = t * 0.04;
      reel.rotation.z = -t * 0.35;
      dustPoints.rotation.y = t * 0.006;
      for (const f of frames) {
        const a = f.phase + t * f.speed;
        f.mesh.position.set(Math.cos(a) * f.radius, f.lift + Math.sin(t * 0.4 + f.phase) * 0.6, Math.sin(a) * f.radius);
        f.mesh.rotation.set(t * 0.2 + f.phase, t * 0.3, 0);
      }
      camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.03;
      camera.position.y += (2.2 - pointer.y * 1.2 - camera.position.y) * 0.03;
      camera.lookAt(world.position.x * 0.6, 0, 0);
      renderer.render(scene, camera);
    };
    const loop = () => {
      if (!visible || this.destroyed) { frame = 0; return; }
      render(clock.getElapsedTime());
      frame = requestAnimationFrame(loop);
    };

    if (reduceMotion) render(8);
    else loop();
    canvas.classList.add('ready');

    this.cleanup = () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }

  /** Soft round particle so points read as glow rather than squares. */
  private makeSprite(THREE: typeof THREE_NS): THREE_NS.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Outline of a 35mm frame: border, picture window and sprocket holes on both sides. */
  private makeFilmFrame(THREE: typeof THREE_NS): THREE_NS.BufferGeometry {
    const pts: number[] = [];
    const rect = (x0: number, y0: number, x1: number, y1: number) => {
      pts.push(x0, y0, 0, x1, y0, 0, x1, y0, 0, x1, y1, 0, x1, y1, 0, x0, y1, 0, x0, y1, 0, x0, y0, 0);
    };
    rect(-1, -0.75, 1, 0.75);
    rect(-0.68, -0.55, 0.68, 0.55);
    for (let i = 0; i < 4; i++) {
      const y = -0.6 + i * 0.36;
      rect(-0.92, y, -0.8, y + 0.16);
      rect(0.8, y, 0.92, y + 0.16);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }
}
