'use client';

import React, { useEffect, useRef } from 'react';
import type * as THREE from 'three';

interface Props { color: string; intensity: number; }

export default function TechBackground3D({ color, intensity }: Props) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;

        let disposed = false;
        let animId = 0;

        const run = async () => {
            const THREE = await import('three');
            if (disposed) return;

            // ── Renderer ────────────────────────────────────────────────
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setClearColor(0x000000, 0);
            el.appendChild(renderer.domElement);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 5000);
            camera.position.set(0, 0, 1000);
            camera.lookAt(0, 0, 0);

            const themeCol = new THREE.Color(color);

            // ── Nodes ─────────────────────────────────────────────────────
            const N = 220;
            const RX = 1100, RY = 650, RZ = 520;
            const pos = new Float32Array(N * 3);
            const vel = new Float32Array(N * 3);
            for (let i = 0; i < N; i++) {
                pos[i * 3]     = (Math.random() - 0.5) * RX * 2;
                pos[i * 3 + 1] = (Math.random() - 0.5) * RY * 2;
                pos[i * 3 + 2] = (Math.random() - 0.5) * RZ * 2;
                vel[i * 3]     = (Math.random() - 0.5) * 0.13;
                vel[i * 3 + 1] = (Math.random() - 0.5) * 0.13;
                vel[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
            }

            const ptGeo = new THREE.BufferGeometry();
            ptGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

            const ptCanvas = document.createElement('canvas');
            ptCanvas.width = ptCanvas.height = 32;
            const ptCtx = ptCanvas.getContext('2d')!;
            const grad = ptCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
            grad.addColorStop(0,   'rgba(255,255,255,1)');
            grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
            grad.addColorStop(1,   'rgba(255,255,255,0)');
            ptCtx.fillStyle = grad;
            ptCtx.fillRect(0, 0, 32, 32);
            const ptTex = new THREE.CanvasTexture(ptCanvas);

            const ptMat = new THREE.PointsMaterial({
                color: themeCol, size: 5.5, map: ptTex,
                transparent: true, opacity: 0.9 * intensity,
                blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
            });
            scene.add(new THREE.Points(ptGeo, ptMat));

            // ── Edges ──────────────────────────────────────────────────────
            const DIST = 195;
            const DIST_SQ = DIST * DIST;
            const MAX_EDGES = 500;
            const ePos = new Float32Array(MAX_EDGES * 6);
            const eCol = new Float32Array(MAX_EDGES * 6);
            const eGeo = new THREE.BufferGeometry();
            eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
            eGeo.setAttribute('color',    new THREE.BufferAttribute(eCol, 3));
            const eMat = new THREE.LineBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0.5 * intensity,
                blending: THREE.AdditiveBlending, depthWrite: false,
            });
            scene.add(new THREE.LineSegments(eGeo, eMat));

            // ── Signals ────────────────────────────────────────────────────
            interface Signal { ai: number; bi: number; t: number; speed: number; mesh: THREE.Mesh; }
            const sigGeo = new THREE.SphereGeometry(3.5, 8, 8);
            const sigBaseCol = new THREE.Color().lerpColors(new THREE.Color(0xffffff), themeCol, 0.25);
            const signals: Signal[] = [];
            let lastSig = -999;

            interface Pair { ai: number; bi: number; }
            const activeEdges: Pair[] = [];

            // ── Logo sprite (white, transparent bg) ───────────────────────
            let logoSprite: THREE.Sprite | null = null;
            let logoTex: THREE.Texture | null = null;

            const loadLogo = () => new Promise<void>(resolve => {
                const img = new Image();
                img.onload = () => {
                    // Down-sample for texture — original is huge
                    const scale = 0.08;
                    const w = Math.round(img.width  * scale);
                    const h = Math.round(img.height * scale);
                    const lc = document.createElement('canvas');
                    lc.width = w; lc.height = h;
                    const lx = lc.getContext('2d')!;
                    lx.drawImage(img, 0, 0, w, h);

                    // Convert: blue-on-white → white-on-transparent
                    const id = lx.getImageData(0, 0, w, h);
                    const d = id.data;
                    for (let i = 0; i < d.length; i += 4) {
                        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
                        const a = Math.min(255, Math.round((255 - avg) * 2.2));
                        d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
                        d[i + 3] = a;
                    }
                    lx.putImageData(id, 0, 0);

                    logoTex = new THREE.CanvasTexture(lc);
                    const spriteMat = new THREE.SpriteMaterial({
                        map: logoTex, transparent: true,
                        opacity: 0.45 * intensity,
                        blending: THREE.NormalBlending, depthWrite: false,
                    });
                    logoSprite = new THREE.Sprite(spriteMat);
                    // Logo is ~5.115:1 aspect — width 600, height ~117
                    logoSprite.scale.set(600, 117, 1);
                    logoSprite.position.set(0, 0, 0);
                    scene.add(logoSprite);
                    resolve();
                };
                img.onerror = () => resolve(); // silently skip if missing
                img.src = '/logo.png';
            });

            await loadLogo();
            if (disposed) return;

            // ── Mouse ──────────────────────────────────────────────────────
            let mx = 0, my = 0;
            const onMove = (e: MouseEvent) => {
                mx = (e.clientX / window.innerWidth  - 0.5) * 2;
                my = (e.clientY / window.innerHeight - 0.5) * 2;
            };
            window.addEventListener('mousemove', onMove);

            // ── Resize ─────────────────────────────────────────────────────
            const onResize = () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener('resize', onResize);

            // ── Animate ────────────────────────────────────────────────────
            const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
            let tRX = 0, tRY = 0, cRX = 0, cRY = 0;
            let lastT = performance.now();

            const tick = () => {
                if (disposed) return;
                animId = requestAnimationFrame(tick);
                const now = performance.now();
                const dt = Math.min(now - lastT, 50) / 16;
                lastT = now;

                // Move nodes
                for (let i = 0; i < N; i++) {
                    pos[i * 3]     += vel[i * 3]     * dt;
                    pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
                    pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
                    if (Math.abs(pos[i * 3])     > RX) vel[i * 3]     *= -1;
                    if (Math.abs(pos[i * 3 + 1]) > RY) vel[i * 3 + 1] *= -1;
                    if (Math.abs(pos[i * 3 + 2]) > RZ) vel[i * 3 + 2] *= -1;
                }
                (ptGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

                // Rebuild edges
                activeEdges.length = 0;
                let ei = 0;
                for (let i = 0; i < N && ei < MAX_EDGES; i++) {
                    const ax = pos[i*3], ay = pos[i*3+1], az = pos[i*3+2];
                    for (let j = i + 1; j < N && ei < MAX_EDGES; j++) {
                        const bx = pos[j*3], by = pos[j*3+1], bz = pos[j*3+2];
                        const dx = ax-bx, dy = ay-by, dz = az-bz;
                        const dsq = dx*dx + dy*dy + dz*dz;
                        if (dsq < DIST_SQ) {
                            const fade = 1 - Math.sqrt(dsq) / DIST;
                            const b6 = ei * 6;
                            ePos[b6]=ax; ePos[b6+1]=ay; ePos[b6+2]=az;
                            ePos[b6+3]=bx; ePos[b6+4]=by; ePos[b6+5]=bz;
                            const r=themeCol.r*fade, g=themeCol.g*fade, b=themeCol.b*fade;
                            eCol[b6]=r; eCol[b6+1]=g; eCol[b6+2]=b;
                            eCol[b6+3]=r; eCol[b6+4]=g; eCol[b6+5]=b;
                            activeEdges.push({ ai: i, bi: j });
                            ei++;
                        }
                    }
                }
                eGeo.setDrawRange(0, ei * 2);
                (eGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
                (eGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;

                // Signals
                if (now - lastSig > 650 && activeEdges.length > 0) {
                    const e = activeEdges[Math.floor(Math.random() * activeEdges.length)];
                    const m = new THREE.Mesh(sigGeo, new THREE.MeshBasicMaterial({
                        color: sigBaseCol, transparent: true, opacity: 1,
                        blending: THREE.AdditiveBlending, depthWrite: false,
                    }));
                    scene.add(m);
                    signals.push({ ai: e.ai, bi: e.bi, t: 0, speed: 0.008 + Math.random() * 0.007, mesh: m });
                    lastSig = now;
                }
                for (let i = signals.length - 1; i >= 0; i--) {
                    const s = signals[i];
                    s.t += s.speed * dt;
                    if (s.t >= 1) {
                        scene.remove(s.mesh);
                        (s.mesh.material as THREE.Material).dispose();
                        signals.splice(i, 1);
                    } else {
                        const ax=pos[s.ai*3], ay=pos[s.ai*3+1], az=pos[s.ai*3+2];
                        const bx=pos[s.bi*3], by=pos[s.bi*3+1], bz=pos[s.bi*3+2];
                        s.mesh.position.set(ax+(bx-ax)*s.t, ay+(by-ay)*s.t, az+(bz-az)*s.t);
                    }
                }

                // Logo gentle pulse
                if (logoSprite) {
                    const pulse = 0.4 + Math.sin(now * 0.0006) * 0.1;
                    (logoSprite.material as THREE.SpriteMaterial).opacity = pulse * intensity;
                }

                // Slow orbit + mouse parallax
                const orb = now * 0.00006;
                tRX = my * 0.2  + Math.sin(orb * 0.7) * 0.1;
                tRY = mx * 0.25 + Math.sin(orb)       * 0.18;
                cRX = lerp(cRX, tRX, 0.025);
                cRY = lerp(cRY, tRY, 0.025);
                camera.position.x = Math.sin(cRY) * 1000;
                camera.position.y = Math.sin(cRX) * 220;
                camera.position.z = Math.cos(cRY) * 1000;
                camera.lookAt(0, 0, 0);

                renderer.render(scene, camera);
            };
            tick();

            (el as any).__cleanup3d = () => {
                disposed = true;
                cancelAnimationFrame(animId);
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('resize', onResize);
                ptGeo.dispose(); ptMat.dispose(); ptTex.dispose();
                eGeo.dispose();  eMat.dispose();
                sigGeo.dispose();
                if (logoTex) logoTex.dispose();
                if (logoSprite) (logoSprite.material as THREE.Material).dispose();
                for (const s of signals) {
                    scene.remove(s.mesh);
                    (s.mesh.material as THREE.Material).dispose();
                }
                renderer.dispose();
                if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
            };
        };

        run();

        return () => {
            disposed = true;
            cancelAnimationFrame(animId);
            const cleanup = (el as any).__cleanup3d;
            if (cleanup) cleanup();
        };
    }, [color, intensity]);

    return <div ref={mountRef} aria-hidden style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />;
}
