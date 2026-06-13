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
    | 'embers';

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

export const CANVAS_PATTERNS: Record<CanvasBgPattern, PatternRunner> = {
    synapse: runSynapse,
    rain: runRain,
    constellations: runConstellations,
    'perlin-flow': runPerlinFlow,
    petals: runPetals,
    sparkles: runSparkles,
    embers: runEmbers,
};
