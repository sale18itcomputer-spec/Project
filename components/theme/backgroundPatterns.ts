// Canvas-based ambient background animations, ported from odysseus.
// Each runner owns its canvas (DPR-aware sizing + debounced resize) and a
// requestAnimationFrame loop. Motion deltas are scaled by `dt` (frame-units
// at 60fps) so speed stays consistent across refresh rates instead of
// running 2x "frantic" on 120Hz displays, and the loop skips drawing while
// the tab is hidden to avoid a big catch-up jump on refocus. Returns a stop
// function that cancels both the loop and the resize listener.

export type CanvasBgPattern =
    | 'synapse'
    | 'rain'
    | 'constellations'
    | 'perlin-flow'
    | 'petals'
    | 'sparkles'
    | 'embers'
    | 'antigravity'
    | 'tech';

export type BgEffectOptions = {
    /** Resolved CSS color usable directly as a canvas fillStyle/strokeStyle. */
    color: string;
    /** 0..1 multiplier for particle density/opacity. */
    intensity: number;
    /** 0.2..3 multiplier for particle/line size. */
    size: number;
};

type StopFn = () => void;
type PatternRunner = (canvas: HTMLCanvasElement, opts: BgEffectOptions) => StopFn;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const FRAME_MS = 1000 / 60;
const MAX_DT = 4;

// Cap redraws at 120fps — native rate on anything up to a 120Hz display
// (the accumulator below is a no-op there), but still bounded on 144Hz/240Hz
// panels so the ambient canvas doesn't redraw faster than it's useful to.
const TARGET_FRAME_MS = 1000 / 120;

// Drives a draw loop with a normalized `dt` (~1 at 60Hz, ~0.5 at 120Hz, scaled
// to keep motion speed correct regardless of display refresh rate), capped at
// ~120fps. Pauses while the document is hidden so background tabs don't burn
// cycles and don't produce a multi-second "jump" when the tab regains focus.
function rafLoop(step: (dt: number) => void): StopFn {
    let raf = 0;
    let last = 0;
    let acc = 0;
    const tick = (now: number) => {
        if (last === 0) last = now;
        const elapsed = now - last;
        last = now;
        if (!document.hidden) {
            acc += elapsed;
            if (acc >= TARGET_FRAME_MS) {
                const dt = Math.min(acc / FRAME_MS, MAX_DT);
                acc = 0;
                step(dt);
            }
        } else {
            acc = 0;
        }
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
}

function setupCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return null;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    const applyResize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Resize fires continuously while the window is being dragged — defer
    // the actual buffer reallocation to the next frame so it only happens
    // once per repaint instead of dozens of times.
    let resizeRaf = 0;
    const resize = () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(applyResize);
    };

    applyResize();
    window.addEventListener('resize', resize);

    return {
        ctx,
        size: () => ({ width, height }),
        cleanup: () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(resizeRaf);
        },
    };
}

// ── Rain: falling streaks, intensity scales count/speed, size scales length ──
const runRain: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const { width: w0, height: h0 } = getSize();
    const count = Math.floor(40 + intensity * 120);
    const drops = Array.from({ length: count }, () => ({
        x: rand(0, w0),
        y: rand(0, h0),
        len: rand(10, 24) * size,
        speed: rand(4, 10) * (0.5 + intensity),
        opacity: rand(0.2, 0.6),
    }));

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (const d of drops) {
            ctx.globalAlpha = d.opacity * intensity;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.len);
            ctx.stroke();
            d.y += d.speed * dt;
            if (d.y > height) {
                d.y = -d.len;
                d.x = rand(0, width);
            }
        }
        ctx.globalAlpha = 1;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Synapse: pulses expanding outward from random nodes on the CSS grid ──
const runSynapse: PatternRunner = (canvas, { color, intensity }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;
    const GRID = 24;

    type Pulse = { x: number; y: number; r: number; alpha: number };
    const pulses: Pulse[] = [];

    const spawn = () => {
        const { width, height } = getSize();
        const cols = Math.max(1, Math.round(width / GRID));
        const rows = Math.max(1, Math.round(height / GRID));
        pulses.push({
            x: Math.round(rand(0, cols)) * GRID,
            y: Math.round(rand(0, rows)) * GRID,
            r: 0,
            alpha: 0.8,
        });
    };

    const spawnEvery = Math.max(8, Math.round(40 / Math.max(intensity, 0.1)));
    let spawnAcc = 0;

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        ctx.clearRect(0, 0, width, height);

        spawnAcc += dt;
        while (spawnAcc >= spawnEvery) {
            if (pulses.length < 24) spawn();
            spawnAcc -= spawnEvery;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        for (let i = pulses.length - 1; i >= 0; i--) {
            const p = pulses[i];
            ctx.globalAlpha = p.alpha * intensity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.stroke();
            p.r += 0.6 * dt;
            p.alpha -= 0.012 * dt;
            if (p.alpha <= 0) pulses.splice(i, 1);
        }
        ctx.globalAlpha = 1;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Constellations: drifting/twinkling stars connected by proximity lines ──
const runConstellations: PatternRunner = (canvas, { color, intensity }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const COUNT = 50;
    const MAX_DIST = 130;
    const MAX_DIST_SQ = MAX_DIST * MAX_DIST;
    const { width: w0, height: h0 } = getSize();
    const stars = Array.from({ length: COUNT }, () => ({
        x: rand(0, w0),
        y: rand(0, h0),
        vx: rand(-0.15, 0.15),
        vy: rand(-0.15, 0.15),
        r: rand(1, 2.5),
        phase: rand(0, Math.PI * 2),
    }));

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        ctx.clearRect(0, 0, width, height);

        for (const s of stars) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.x < 0) s.x = width; else if (s.x > width) s.x = 0;
            if (s.y < 0) s.y = height; else if (s.y > height) s.y = 0;
            s.phase += 0.02 * dt;
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const a = stars[i];
                const b = stars[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < MAX_DIST_SQ) {
                    const dist = Math.sqrt(distSq);
                    ctx.globalAlpha = (1 - dist / MAX_DIST) * 0.25 * intensity;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        ctx.fillStyle = color;
        for (const s of stars) {
            ctx.globalAlpha = (0.4 + 0.6 * ((Math.sin(s.phase) + 1) / 2)) * intensity;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Perlin-flow: particles drifting along a sine-based 2D noise field ──
function noise2D(x: number, y: number, t: number) {
    return (
        Math.sin(x * 0.012 + t) +
        Math.sin(y * 0.012 - t * 0.8) +
        Math.sin((x + y) * 0.006 + t * 0.5)
    ) / 3;
}

const runPerlinFlow: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const COUNT = 200;
    const { width: w0, height: h0 } = getSize();
    const particles = Array.from({ length: COUNT }, () => ({
        x: rand(0, w0),
        y: rand(0, h0),
    }));

    let t = 0;
    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();

        // Fade the previous frame instead of clearing, leaving soft trails.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 0.04 * dt)})`;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5 * intensity;

        for (const p of particles) {
            const angle = noise2D(p.x, p.y, t) * Math.PI * 2;
            p.x += Math.cos(angle) * 1.2 * dt;
            p.y += Math.sin(angle) * 1.2 * dt;

            if (p.x < 0) p.x = width; else if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height; else if (p.y > height) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        t += 0.004 * dt;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Petals: falling, rotating, wobbling double-ellipse petals ──
const runPetals: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const COUNT = 30;
    const { width: w0, height: h0 } = getSize();
    const petals = Array.from({ length: COUNT }, () => ({
        x: rand(0, w0),
        y: rand(-h0, h0),
        r: rand(4, 9) * size,
        rotation: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.02, 0.02),
        fallSpeed: rand(0.3, 1) * (0.5 + intensity),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.01, 0.03),
        wobbleAmount: rand(0.3, 1),
    }));

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;

        for (const p of petals) {
            p.y += p.fallSpeed * dt;
            p.wobble += p.wobbleSpeed * dt;
            p.x += Math.sin(p.wobble) * p.wobbleAmount * dt;
            p.rotation += p.rotSpeed * dt;

            if (p.y > height + p.r) {
                p.y = -p.r;
                p.x = rand(0, width);
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = 0.5 * intensity;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r * 0.5, p.r, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Sparkles: phase-twinkling 4-point stars ──
const runSparkles: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const COUNT = 35;
    const { width: w0, height: h0 } = getSize();
    const sparkles = Array.from({ length: COUNT }, () => ({
        x: rand(0, w0),
        y: rand(0, h0),
        r: rand(2, 5) * size,
        phase: rand(0, Math.PI * 2),
        speed: rand(0.02, 0.06),
    }));

    const drawStar = (x: number, y: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.25, y - r * 0.25);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + r * 0.25, y + r * 0.25);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.25, y + r * 0.25);
        ctx.lineTo(x - r, y);
        ctx.lineTo(x - r * 0.25, y - r * 0.25);
        ctx.closePath();
        ctx.fill();
    };

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        for (const s of sparkles) {
            ctx.globalAlpha = ((Math.sin(s.phase) + 1) / 2) * intensity;
            drawStar(s.x, s.y, s.r);
            s.phase += s.speed * dt;
        }
        ctx.globalAlpha = 1;
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Embers: rising glowing particles with additive blending + fade trail ──
const runEmbers: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    // The gradient is created once per ember (in local 0,0-centered space) and
    // reused every frame via translate — avoids allocating a new gradient
    // object for every particle on every frame.
    const makeEmber = (width: number, height: number) => {
        const r = rand(1, 3) * size;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        return {
            x: rand(0, width),
            y: height + rand(0, height * 0.3),
            vx: rand(-0.3, 0.3),
            vy: rand(-1.5, -0.5),
            r,
            gradient,
            life: 0,
            maxLife: rand(120, 260),
        };
    };

    const { width: w0, height: h0 } = getSize();
    const count = Math.max(10, Math.round(60 * intensity));
    const embers = Array.from({ length: count }, () => makeEmber(w0, h0));

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 0.08 * dt)})`;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < embers.length; i++) {
            const e = embers[i];
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.life += dt;

            const lifeRatio = 1 - e.life / e.maxLife;
            if (lifeRatio <= 0 || e.y < -e.r) {
                embers[i] = makeEmber(width, height);
                continue;
            }

            ctx.globalAlpha = lifeRatio * intensity;
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.fillStyle = e.gradient;
            ctx.beginPath();
            ctx.arc(0, 0, e.r * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
        stopLoop();
        cleanup();
    };
};

// ── Antigravity: glowing orbs that float upward and react to mouse ──
// Hover → repel; click-hold → attract. Particles wrap from top to bottom.
const runAntigravity: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    let mouseX = -9999;
    let mouseY = -9999;
    let isDown = false;

    const onMove  = (e: MouseEvent) => { mouseX = e.clientX; mouseY = e.clientY; };
    const onDown  = () => { isDown = true; };
    const onUp    = () => { isDown = false; };
    const onLeave = () => { mouseX = -9999; mouseY = -9999; isDown = false; };

    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mousedown',  onDown);
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('mouseleave', onLeave);

    const { width: w0, height: h0 } = getSize();
    const COUNT = Math.floor(60 + intensity * 80);
    const particles = Array.from({ length: COUNT }, () => {
        const r = rand(3, 8) * size;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.5);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        return {
            x: rand(0, w0),
            y: rand(0, h0),
            vx: rand(-0.4, 0.4),
            vy: rand(-1.2, -0.3),
            r,
            gradient,
            lift: rand(0.03, 0.07),   // individual upward acceleration
            opacity: rand(0.4, 0.9),
        };
    });

    const REPEL_R  = 140;
    const REPEL_F  = 10;
    const ATTRACT_F = 6;
    const DAMPING  = 0.97;
    const MAX_SPD  = 18;

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 0.07 * dt)})`;
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'lighter';

        for (const p of particles) {
            // Antigravity drift
            p.vy -= p.lift * dt;

            // Mouse influence
            if (mouseX > -999) {
                const dx = p.x - mouseX;
                const dy = p.y - mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < REPEL_R && dist > 0.5) {
                    const factor = (1 - dist / REPEL_R) * dt;
                    if (isDown) {
                        p.vx -= (dx / dist) * ATTRACT_F * factor;
                        p.vy -= (dy / dist) * ATTRACT_F * factor;
                    } else {
                        p.vx += (dx / dist) * REPEL_F * factor;
                        p.vy += (dy / dist) * REPEL_F * factor;
                    }
                }
            }

            // Damping + speed cap
            p.vx *= Math.pow(DAMPING, dt);
            p.vy *= Math.pow(DAMPING, dt);
            const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (spd > MAX_SPD) { p.vx = p.vx / spd * MAX_SPD; p.vy = p.vy / spd * MAX_SPD; }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Wrap: off-top → respawn at bottom; left/right wrap
            if (p.y + p.r < 0) {
                p.y = height + p.r;
                p.x = rand(0, width);
                p.vx = rand(-0.4, 0.4);
                p.vy = rand(-1.2, -0.3);
            } else if (p.y - p.r > height) {
                p.y = -p.r;
            }
            if (p.x + p.r < 0) p.x = width + p.r;
            else if (p.x - p.r > width) p.x = -p.r;

            ctx.globalAlpha = p.opacity * intensity;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.fillStyle = p.gradient;
            ctx.beginPath();
            ctx.arc(0, 0, p.r * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
        stopLoop();
        cleanup();
        window.removeEventListener('mousemove',  onMove);
        window.removeEventListener('mousedown',  onDown);
        window.removeEventListener('mouseup',    onUp);
        window.removeEventListener('mouseleave', onLeave);
    };
};

// ── Tech: PCB-style chip nodes connected by circuit traces.
//    Drag chips to reposition • click to blast signals • chain reactions •
//    signal trails • expanding rings on arrival • trace glow • node bobbing.
const runTech: PatternRunner = (canvas, { color, intensity, size }) => {
    const setup = setupCanvas(canvas);
    if (!setup) return () => {};
    const { ctx, size: getSize, cleanup } = setup;

    const LABELS = ['CPU', 'GPU', 'RAM', 'SSD', 'NVMe', 'PCIe', 'DDR5', 'USB', 'SATA', 'PSU', 'BIOS', 'VRM', 'FAN', 'NET', 'DMA', 'CLK'];

    interface ChipNode { x: number; y: number; label: string; pulse: number; bobPhase: number; }
    interface Signal { pos: number; speed: number; }
    interface Trace { a: ChipNode; b: ChipNode; elbowX: number; elbowY: number; seg1: number; seg2: number; total: number; sigs: Signal[]; glow: number; }
    interface Ring { x: number; y: number; r: number; alpha: number; }

    let nodes: ChipNode[] = [];
    let traces: Trace[] = [];
    let rings: Ring[] = [];
    let bits: { x: number; y: number; ch: string; alpha: number }[] = [];
    let dragNode: ChipNode | null = null;
    let mouseX = -1; let mouseY = -1;
    let hoveredNode: ChipNode | null = null;

    const BOX = 30 * size;
    const HIT = BOX * 1.1;

    const recalc = (t: Trace) => {
        t.elbowX = t.b.x; t.elbowY = t.a.y;
        t.seg1 = Math.abs(t.b.x - t.a.x);
        t.seg2 = Math.abs(t.b.y - t.a.y);
        t.total = t.seg1 + t.seg2;
    };

    const spawnSig = (t: Trace) => {
        if (t.sigs.length < 3)
            t.sigs.push({ pos: 0, speed: rand(0.004, 0.009) * (0.5 + intensity) });
    };

    const pulseNode = (n: ChipNode) => {
        n.pulse = 1;
        rings.push({ x: n.x, y: n.y, r: BOX * 0.5, alpha: 0.75 });
        traces.filter(t => t.a === n || t.b === n).forEach(t => { if (Math.random() < 0.75) spawnSig(t); });
    };

    const onMove = (e: MouseEvent) => {
        mouseX = e.clientX; mouseY = e.clientY;
        if (dragNode) {
            dragNode.x = mouseX; dragNode.y = mouseY;
            traces.filter(t => t.a === dragNode || t.b === dragNode).forEach(recalc);
        }
        hoveredNode = nodes.reduce<ChipNode | null>((best, n) => {
            const d = Math.hypot(n.x - mouseX, n.y - mouseY);
            return d < HIT && (!best || d < Math.hypot(best.x - mouseX, best.y - mouseY)) ? n : best;
        }, null);
    };
    const onDown = (e: MouseEvent) => {
        const hit = nodes.reduce<{ n: ChipNode; d: number } | null>((best, n) => {
            const d = Math.hypot(n.x - e.clientX, n.y - e.clientY);
            return d < HIT && (!best || d < best.d) ? { n, d } : best;
        }, null);
        if (hit) { dragNode = hit.n; pulseNode(hit.n); }
    };
    const onUp = () => { dragNode = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup',   onUp);

    const buildLayout = (width: number, height: number) => {
        const CELL = Math.max(70, Math.min(110, Math.min(width, height) / 7)) * size;
        const cols = Math.max(3, Math.floor(width / CELL));
        const rows = Math.max(3, Math.floor(height / CELL));

        nodes = []; rings = [];
        const used = new Set<string>();
        const shuffled = [...LABELS].sort(() => Math.random() - 0.5);
        const count = Math.min(shuffled.length, Math.round(cols * rows * 0.6 + 2));

        for (let i = 0; i < count; i++) {
            let c = 0, r = 0, key = '', tries = 0;
            do { c = Math.floor(rand(0, cols)); r = Math.floor(rand(0, rows)); key = `${c},${r}`; tries++; }
            while (used.has(key) && tries < 200);
            used.add(key);
            nodes.push({
                x: (c + 0.5) * CELL + rand(-CELL * 0.12, CELL * 0.12),
                y: (r + 0.5) * CELL + rand(-CELL * 0.12, CELL * 0.12),
                label: shuffled[i], pulse: 0, bobPhase: rand(0, Math.PI * 2),
            });
        }

        traces = [];
        const exists = (a: ChipNode, b: ChipNode) =>
            traces.some(t => (t.a === a && t.b === b) || (t.a === b && t.b === a));
        for (const a of nodes) {
            const sorted = nodes.filter(n => n !== a)
                .sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y));
            for (const b of sorted.slice(0, 3)) {
                if (exists(a, b)) continue;
                const t: Trace = { a, b, elbowX: 0, elbowY: 0, seg1: 0, seg2: 0, total: 0, sigs: [], glow: 0 };
                recalc(t);
                traces.push(t);
            }
        }

        bits = Array.from({ length: Math.floor(30 * intensity) }, () => ({
            x: rand(0, width), y: rand(0, height),
            ch: Math.random() < 0.5 ? '0' : '1', alpha: rand(0.03, 0.12),
        }));
    };

    let built = false;
    let spawnAcc = 0;

    const sigPos = (t: Trace, pos: number): [number, number] => {
        if (t.total === 0) return [t.a.x, t.a.y];
        const traveled = pos * t.total;
        if (traveled <= t.seg1) {
            const f = t.seg1 > 0 ? traveled / t.seg1 : 0;
            return [t.a.x + (t.elbowX - t.a.x) * f, t.a.y];
        }
        const f = t.seg2 > 0 ? (traveled - t.seg1) / t.seg2 : 0;
        return [t.elbowX, t.elbowY + (t.b.y - t.elbowY) * f];
    };

    const stopLoop = rafLoop((dt) => {
        const { width, height } = getSize();
        if (!built) { buildLayout(width, height); built = true; }

        ctx.clearRect(0, 0, width, height);

        // Floating binary chars
        ctx.font = `${10 * size}px monospace`;
        ctx.fillStyle = color;
        for (const b of bits) {
            b.alpha += (Math.random() < 0.5 ? 1 : -1) * 0.003 * dt;
            b.alpha = Math.max(0.02, Math.min(0.12 * intensity, b.alpha));
            ctx.globalAlpha = b.alpha;
            ctx.fillText(b.ch, b.x, b.y);
        }

        // Auto-spawn signals
        spawnAcc += dt;
        const spawnEvery = Math.max(8, 30 / Math.max(intensity, 0.1));
        if (spawnAcc >= spawnEvery) {
            spawnAcc = 0;
            const candidates = traces.filter(t => t.sigs.length < 3);
            if (candidates.length) spawnSig(candidates[Math.floor(Math.random() * candidates.length)]);
        }

        // Traces
        ctx.lineWidth = 1.2 * size;
        for (const t of traces) {
            t.glow = Math.max(0, t.glow - 0.025 * dt);

            // Base trace line
            ctx.globalAlpha = (0.12 + t.glow * 0.3) * intensity;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(t.a.x, t.a.y);
            ctx.lineTo(t.elbowX, t.elbowY);
            ctx.lineTo(t.b.x, t.b.y);
            ctx.stroke();

            // Elbow solder dot
            ctx.globalAlpha = (0.22 + t.glow * 0.35) * intensity;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(t.elbowX, t.elbowY, 2.5 * size, 0, Math.PI * 2);
            ctx.fill();

            // Signals
            for (let si = t.sigs.length - 1; si >= 0; si--) {
                const sig = t.sigs[si];
                const [px, py] = sigPos(t, sig.pos);

                // Trail (5 fading dots behind signal)
                for (let tr = 1; tr <= 5; tr++) {
                    const [tx, ty] = sigPos(t, Math.max(0, sig.pos - tr * 0.028));
                    ctx.globalAlpha = Math.max(0, (0.45 - tr * 0.08)) * intensity;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(tx, ty, (4 - tr * 0.5) * size, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Signal glow orb
                const g = ctx.createRadialGradient(px, py, 0, px, py, 9 * size);
                g.addColorStop(0, color); g.addColorStop(1, 'transparent');
                ctx.globalAlpha = intensity;
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(px, py, 9 * size, 0, Math.PI * 2);
                ctx.fill();

                t.glow = Math.min(1, t.glow + 0.25);
                sig.pos += sig.speed * dt;

                if (sig.pos >= 1) {
                    t.sigs.splice(si, 1);
                    t.b.pulse = Math.min(1, t.b.pulse + 0.7);
                    rings.push({ x: t.b.x, y: t.b.y, r: BOX * 0.5, alpha: 0.65 });
                    // Chain reaction — 55% chance to forward to a connected trace
                    if (Math.random() < 0.55) {
                        const next = traces.filter(tr => (tr.a === t.b || tr.b === t.b) && tr !== t && tr.sigs.length < 3);
                        if (next.length) spawnSig(next[Math.floor(Math.random() * next.length)]);
                    }
                }
            }
        }

        // Expanding arrival rings
        for (let i = rings.length - 1; i >= 0; i--) {
            const rg = rings[i];
            ctx.globalAlpha = rg.alpha * intensity;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * size;
            ctx.beginPath();
            ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
            ctx.stroke();
            rg.r += 2.8 * dt;
            rg.alpha -= 0.022 * dt;
            if (rg.alpha <= 0) rings.splice(i, 1);
        }

        // Chip nodes
        const PIN = 7 * size;
        ctx.font = `bold ${9 * size}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const n of nodes) {
            if (n.pulse > 0) n.pulse = Math.max(0, n.pulse - 0.022 * dt);
            n.bobPhase += 0.014 * dt;
            const bob = Math.sin(n.bobPhase) * 1.8;
            const rx = n.x; const ry = n.y + (dragNode === n ? 0 : bob);
            const glow = n.pulse;
            const hover = hoveredNode === n;
            const isDragging = dragNode === n;

            // Pin stubs (4 sides, 3 per side for realism)
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 * size;
            ctx.globalAlpha = (0.32 + glow * 0.5 + (hover ? 0.15 : 0)) * intensity;
            const pinOffsets = [-0.3, 0, 0.3];
            for (const [ex, ey, startX, startY] of [
                [-BOX / 2, 0, -BOX / 2 - PIN, 0],
                [ BOX / 2, 0,  BOX / 2 + PIN, 0],
                [0, -BOX / 2, 0, -BOX / 2 - PIN],
                [0,  BOX / 2, 0,  BOX / 2 + PIN],
            ] as [number, number, number, number][]) {
                const isHoriz = ey === 0;
                for (const off of pinOffsets) {
                    const ox = isHoriz ? 0 : off * BOX * 0.3;
                    const oy = isHoriz ? off * BOX * 0.3 : 0;
                    ctx.beginPath();
                    ctx.moveTo(rx + ex + ox, ry + ey + oy);
                    ctx.lineTo(rx + startX + ox, ry + startY + oy);
                    ctx.stroke();
                }
            }

            // Box fill
            ctx.globalAlpha = (0.07 + glow * 0.28 + (hover || isDragging ? 0.12 : 0)) * intensity;
            ctx.fillStyle = color;
            ctx.fillRect(rx - BOX / 2, ry - BOX / 2, BOX, BOX);

            // Box border
            ctx.globalAlpha = (0.42 + glow * 0.58 + (hover ? 0.2 : 0)) * intensity;
            ctx.strokeStyle = color;
            ctx.lineWidth = isDragging ? 2 * size : 1.5 * size;
            ctx.strokeRect(rx - BOX / 2, ry - BOX / 2, BOX, BOX);

            // Label
            ctx.globalAlpha = (0.72 + glow * 0.28 + (hover ? 0.18 : 0)) * intensity;
            ctx.fillStyle = color;
            ctx.fillText(n.label, rx, ry);
        }

        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    });

    return () => {
        stopLoop();
        cleanup();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mousedown', onDown);
        window.removeEventListener('mouseup',   onUp);
    };
};

export const CANVAS_PATTERNS: Record<CanvasBgPattern, PatternRunner> = {
    synapse: runSynapse,
    rain: runRain,
    constellations: runConstellations,
    'perlin-flow': runPerlinFlow,
    petals: runPetals,
    sparkles: runSparkles,
    embers: runEmbers,
    antigravity: runAntigravity,
    tech: runTech,
};
