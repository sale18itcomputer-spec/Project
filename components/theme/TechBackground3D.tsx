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

            // ── Renderer ──────────────────────────────────────────────────
            const W = window.innerWidth;
            const H = window.innerHeight;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(dpr);
            renderer.setSize(W, H);
            renderer.setClearColor(0x000000, 0);
            el.appendChild(renderer.domElement);

            // ── Scene / Camera ─────────────────────────────────────────────
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 6000);
            camera.position.set(0, 520, 300);
            camera.lookAt(0, 0, 0);

            // ── Lighting ───────────────────────────────────────────────────
            scene.add(new THREE.AmbientLight(0xffffff, 0.5));
            const sun = new THREE.DirectionalLight(0xffffff, 0.9);
            sun.position.set(300, 600, 300);
            scene.add(sun);
            const fill = new THREE.DirectionalLight(0xffffff, 0.3);
            fill.position.set(-200, 200, -200);
            scene.add(fill);

            // ── Resolve theme color ────────────────────────────────────────
            // THREE.Color accepts CSS strings including hsl() directly
            const themeColor = new THREE.Color(color);
            const themeHex = themeColor.getHex();

            // ── Board group (everything tilts together) ────────────────────
            const group = new THREE.Group();
            scene.add(group);

            // PCB board
            const BW = 820; const BH = 520;
            const boardGeo = new THREE.BoxGeometry(BW, 5, BH);
            const boardColor = new THREE.Color(0x0b1a0b).lerp(themeColor, 0.08);
            const boardMat = new THREE.MeshStandardMaterial({
                color: boardColor, roughness: 0.85, metalness: 0.1,
                transparent: true, opacity: Math.min(1, 0.9 * intensity),
            });
            group.add(new THREE.Mesh(boardGeo, boardMat));

            // Grid lines on board surface
            const gridPts: THREE.Vector3[] = [];
            const GRID = 55;
            for (let x = -BW / 2; x <= BW / 2; x += GRID) {
                gridPts.push(new THREE.Vector3(x, 3, -BH / 2), new THREE.Vector3(x, 3, BH / 2));
            }
            for (let z = -BH / 2; z <= BH / 2; z += GRID) {
                gridPts.push(new THREE.Vector3(-BW / 2, 3, z), new THREE.Vector3(BW / 2, 3, z));
            }
            const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
            group.add(new THREE.LineSegments(gridGeo,
                new THREE.LineBasicMaterial({ color: themeColor, transparent: true, opacity: 0.07 * intensity })));

            // ── Chips ──────────────────────────────────────────────────────
            const LABELS = ['CPU', 'GPU', 'RAM', 'SSD', 'NVMe', 'PCIe', 'DDR5', 'USB', 'SATA', 'PSU', 'BIOS', 'VRM', 'FAN', 'NET'];
            const CELL = 88;
            const cols = Math.floor(BW / CELL);
            const rows = Math.floor(BH / CELL);
            const rand = (a: number, b: number) => a + Math.random() * (b - a);

            interface ChipNode { wx: number; wz: number; label: string; chipMesh: THREE.Mesh; pulse: number; }
            const nodes: ChipNode[] = [];
            const used = new Set<string>();
            const shuffled = [...LABELS].sort(() => Math.random() - 0.5);
            const count = Math.min(shuffled.length, Math.round(cols * rows * 0.52));

            const r8 = (themeColor.r * 255) | 0;
            const g8 = (themeColor.g * 255) | 0;
            const b8 = (themeColor.b * 255) | 0;

            const makeLabel = (text: string) => {
                const lc = document.createElement('canvas');
                lc.width = 128; lc.height = 64;
                const lx = lc.getContext('2d')!;
                lx.clearRect(0, 0, 128, 64);
                lx.fillStyle = `rgba(${r8},${g8},${b8},0.92)`;
                lx.font = 'bold 26px monospace';
                lx.textAlign = 'center';
                lx.textBaseline = 'middle';
                lx.fillText(text, 64, 32);
                return new THREE.CanvasTexture(lc);
            };

            for (let i = 0; i < count; i++) {
                let c = 0, r = 0, key = '', tries = 0;
                do {
                    c = Math.floor(rand(0, cols)); r = Math.floor(rand(0, rows));
                    key = `${c},${r}`; tries++;
                } while (used.has(key) && tries < 200);
                used.add(key);

                const wx = (c + 0.5) * CELL - BW / 2 + rand(-CELL * 0.1, CELL * 0.1);
                const wz = (r + 0.5) * CELL - BH / 2 + rand(-CELL * 0.1, CELL * 0.1);

                // Chip body
                const chipGeo = new THREE.BoxGeometry(26, 5, 26);
                const chipMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x111811).lerp(themeColor, 0.12),
                    roughness: 0.4, metalness: 0.6,
                    emissive: themeColor.clone(), emissiveIntensity: 0,
                });
                const chipMesh = new THREE.Mesh(chipGeo, chipMat);
                chipMesh.position.set(wx, 5, wz);
                group.add(chipMesh);

                // Chip border glow ring
                const ringGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(28, 5.5, 28));
                const ringMat = new THREE.LineBasicMaterial({ color: themeColor, transparent: true, opacity: 0.35 * intensity });
                const ring = new THREE.LineSegments(ringGeo, ringMat);
                ring.position.set(wx, 5, wz);
                group.add(ring);

                // Pin stubs (simple lines on edges)
                const pinMat = new THREE.LineBasicMaterial({ color: themeColor, transparent: true, opacity: 0.4 * intensity });
                const PIN = 8; const CHIP = 13; const GAP = 6;
                for (const [ox, oz] of [[-CHIP, 0], [CHIP, 0], [0, -CHIP], [0, CHIP]]) {
                    const isX = oz === 0;
                    for (const off of [-GAP, 0, GAP]) {
                        const pinPts = [
                            new THREE.Vector3(wx + ox + (isX ? 0 : off), 5, wz + oz + (isX ? off : 0)),
                            new THREE.Vector3(wx + ox + (isX ? Math.sign(ox) * PIN : off), 5, wz + oz + (isX ? off : Math.sign(oz) * PIN)),
                        ];
                        const pGeo = new THREE.BufferGeometry().setFromPoints(pinPts);
                        group.add(new THREE.Line(pGeo, pinMat));
                    }
                }

                // Label sprite
                const labelTex = makeLabel(shuffled[i]);
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: labelTex, transparent: true, opacity: 0.88 * intensity,
                }));
                sprite.position.set(wx, 20, wz);
                sprite.scale.set(36, 18, 1);
                group.add(sprite);

                nodes.push({ wx, wz, label: shuffled[i], chipMesh, pulse: 0 });
            }

            // ── Traces ─────────────────────────────────────────────────────
            interface Trace3D {
                ax: number; az: number; bx: number; bz: number;
                destNode: ChipNode | null;
                sig: number; active: boolean; sigSpeed: number;
                sigMesh: THREE.Mesh; sigLight: THREE.PointLight;
                traceLine: THREE.Line;
            }
            const traces3D: Trace3D[] = [];
            const traceExists = (ax: number, az: number, bx: number, bz: number) =>
                traces3D.some(t =>
                    (Math.abs(t.ax - ax) < 2 && Math.abs(t.az - az) < 2 && Math.abs(t.bx - bx) < 2 && Math.abs(t.bz - bz) < 2) ||
                    (Math.abs(t.ax - bx) < 2 && Math.abs(t.az - bz) < 2 && Math.abs(t.bx - ax) < 2 && Math.abs(t.bz - az) < 2));

            for (const a of nodes) {
                const sorted = nodes.filter(n => n !== a)
                    .sort((x, y) => Math.hypot(x.wx - a.wx, x.wz - a.wz) - Math.hypot(y.wx - a.wx, y.wz - a.wz));
                for (const b of sorted.slice(0, 3)) {
                    if (traceExists(a.wx, a.wz, b.wx, b.wz)) continue;
                    // Manhattan: a → elbow (b.x, a.z) → b
                    const tracePts = [
                        new THREE.Vector3(a.wx, 3.5, a.wz),
                        new THREE.Vector3(b.wx, 3.5, a.wz),
                        new THREE.Vector3(b.wx, 3.5, b.wz),
                    ];
                    const traceGeo = new THREE.BufferGeometry().setFromPoints(tracePts);
                    const traceLine = new THREE.Line(traceGeo,
                        new THREE.LineBasicMaterial({ color: themeColor, transparent: true, opacity: 0.2 * intensity }));
                    group.add(traceLine);

                    // Via dot at elbow
                    const viaGeo = new THREE.SphereGeometry(2.5, 8, 8);
                    const viaMesh = new THREE.Mesh(viaGeo, new THREE.MeshBasicMaterial({
                        color: themeColor, transparent: true, opacity: 0.3 * intensity,
                    }));
                    viaMesh.position.set(b.wx, 3.5, a.wz);
                    group.add(viaMesh);

                    // Signal sphere
                    const sigGeo = new THREE.SphereGeometry(4, 10, 10);
                    const sigMat = new THREE.MeshBasicMaterial({ color: themeColor, transparent: true, opacity: 0 });
                    const sigMesh = new THREE.Mesh(sigGeo, sigMat);
                    sigMesh.position.set(a.wx, 5.5, a.wz);
                    group.add(sigMesh);

                    // Point light that travels with the signal
                    const sigLight = new THREE.PointLight(themeHex, 0, 120);
                    sigMesh.add(sigLight);

                    traces3D.push({
                        ax: a.wx, az: a.wz, bx: b.wx, bz: b.wz,
                        destNode: b,
                        sig: -1, active: false,
                        sigSpeed: rand(0.004, 0.009),
                        sigMesh, sigLight, traceLine,
                    });
                }
            }

            // ── Mouse tilt ─────────────────────────────────────────────────
            let targetRX = 0, targetRY = 0;
            let currentRX = 0, currentRY = 0;
            const onMouseMove = (e: MouseEvent) => {
                targetRX = ((e.clientY / window.innerHeight) - 0.5) * 0.45;
                targetRY = ((e.clientX / window.innerWidth)  - 0.5) * 0.55;
            };
            window.addEventListener('mousemove', onMouseMove);

            // ── Resize ─────────────────────────────────────────────────────
            const onResize = () => {
                const nW = window.innerWidth; const nH = window.innerHeight;
                camera.aspect = nW / nH;
                camera.updateProjectionMatrix();
                renderer.setSize(nW, nH);
            };
            window.addEventListener('resize', onResize);

            // ── Signal helpers ─────────────────────────────────────────────
            const activateSig = (t: Trace3D) => {
                if (t.active) return;
                t.active = true; t.sig = 0;
                (t.sigMesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * intensity;
                t.sigLight.intensity = 1.8 * intensity;
                (t.traceLine.material as THREE.LineBasicMaterial).opacity = 0.55 * intensity;
            };
            const deactivateSig = (t: Trace3D) => {
                t.active = false; t.sig = -1;
                (t.sigMesh.material as THREE.MeshBasicMaterial).opacity = 0;
                t.sigLight.intensity = 0;
                (t.traceLine.material as THREE.LineBasicMaterial).opacity = 0.2 * intensity;
            };

            // ── Animation ──────────────────────────────────────────────────
            let last = 0; let spawnAcc = 0;

            const tick = (now: number) => {
                if (disposed) return;
                animId = requestAnimationFrame(tick);
                const dt = Math.min((now - last) / 16.67, 4);
                last = now;

                // Smooth tilt
                currentRX += (targetRX - currentRX) * 0.045;
                currentRY += (targetRY - currentRY) * 0.045;
                group.rotation.x = -currentRX;
                group.rotation.y =  currentRY;

                // Gentle float
                group.position.y = Math.sin(now * 0.0004) * 10;

                // Auto-spawn
                spawnAcc += dt;
                if (spawnAcc > 35) {
                    spawnAcc = 0;
                    const idle = traces3D.filter(t => !t.active);
                    if (idle.length) activateSig(idle[Math.floor(Math.random() * idle.length)]);
                }

                // Update signals
                for (const t of traces3D) {
                    if (!t.active) continue;
                    t.sig += t.sigSpeed * dt;
                    if (t.sig >= 1) {
                        deactivateSig(t);
                        if (t.destNode) t.destNode.pulse = Math.min(1, (t.destNode.pulse || 0) + 0.8);
                        // Chain reaction
                        if (Math.random() < 0.55) {
                            const next = traces3D.filter(tr => !tr.active && tr !== t && (
                                (Math.abs(tr.ax - t.bx) < 3 && Math.abs(tr.az - t.bz) < 3) ||
                                (Math.abs(tr.bx - t.bx) < 3 && Math.abs(tr.bz - t.bz) < 3)));
                            if (next.length) activateSig(next[Math.floor(Math.random() * next.length)]);
                        }
                        continue;
                    }

                    // Signal position along Manhattan path
                    const seg1 = Math.abs(t.bx - t.ax);
                    const seg2 = Math.abs(t.bz - t.az);
                    const total = seg1 + seg2;
                    if (total < 0.001) continue;
                    const traveled = t.sig * total;
                    let px: number, pz: number;
                    if (traveled <= seg1) {
                        px = t.ax + (t.bx - t.ax) * (traveled / Math.max(seg1, 0.001)); pz = t.az;
                    } else {
                        px = t.bx; pz = t.az + (t.bz - t.az) * ((traveled - seg1) / Math.max(seg2, 0.001));
                    }
                    t.sigMesh.position.set(px, 6, pz);
                }

                // Node pulse glow
                for (const n of nodes) {
                    if (n.pulse > 0) {
                        n.pulse = Math.max(0, n.pulse - 0.022 * dt);
                        (n.chipMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = n.pulse * 0.65 * intensity;
                    }
                }

                renderer.render(scene, camera);
            };
            animId = requestAnimationFrame(tick);

            // Cleanup ref
            (el as any).__cleanup3d = () => {
                disposed = true;
                cancelAnimationFrame(animId);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('resize', onResize);
                scene.traverse((obj) => {
                    if ((obj as any).geometry) (obj as any).geometry.dispose();
                    const mat = (obj as any).material;
                    if (mat) { Array.isArray(mat) ? mat.forEach((m: any) => m.dispose()) : mat.dispose(); }
                });
                renderer.dispose();
                if (renderer.domElement.parentNode) renderer.domElement.remove();
            };
        };

        run();

        return () => {
            disposed = true;
            cancelAnimationFrame(animId);
            if ((el as any).__cleanup3d) { (el as any).__cleanup3d(); delete (el as any).__cleanup3d; }
            else { el.innerHTML = ''; }
        };
    }, [color, intensity]);

    return (
        <div
            ref={mountRef}
            aria-hidden
            style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }}
        />
    );
}
