/**
 * Процедурные текстуры (генерируются на canvas, без внешних файлов)
 * и библиотека материалов отделки.
 */
import * as THREE from 'three';

const SIZE = 512;
let maxAnisotropy = 4;

export function setMaxAnisotropy(value) {
    maxAnisotropy = value;
}

// ---------- Шум ----------

function hash(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
}

const smooth = t => t * t * (3 - 2 * t);
const mod = (a, n) => ((a % n) + n) % n;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(1, Math.max(0, v));

/** Бесшовный value noise: x, y в [0..1), px/py — число ячеек решётки по осям. */
function noise(x, y, px, py, seed) {
    const fx = x * px, fy = y * py;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const a = hash(mod(x0, px), mod(y0, py), seed);
    const b = hash(mod(x0 + 1, px), mod(y0, py), seed);
    const c = hash(mod(x0, px), mod(y0 + 1, py), seed);
    const d = hash(mod(x0 + 1, px), mod(y0 + 1, py), seed);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function fbm(x, y, px, py, octaves, seed) {
    let sum = 0, amp = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * noise(x, y, px << i, py << i, seed + i * 17);
        norm += amp;
        amp *= 0.5;
    }
    return sum / norm;
}

// ---------- Генерация карт ----------

/**
 * fn(u, v) → { c: [r, g, b] (0..255), h: 0..1 }
 * Возвращает цветовую карту и карту рельефа.
 */
function generate(fn, size = SIZE) {
    const color = document.createElement('canvas');
    const bump = document.createElement('canvas');
    color.width = color.height = bump.width = bump.height = size;
    const cctx = color.getContext('2d');
    const bctx = bump.getContext('2d');
    const cimg = cctx.createImageData(size, size);
    const bimg = bctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const { c, h } = fn(x / size, y / size);
            const i = (y * size + x) * 4;
            cimg.data[i] = c[0];
            cimg.data[i + 1] = c[1];
            cimg.data[i + 2] = c[2];
            cimg.data[i + 3] = 255;
            const hv = Math.round(clamp01(h) * 255);
            bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = hv;
            bimg.data[i + 3] = 255;
        }
    }
    cctx.putImageData(cimg, 0, 0);
    bctx.putImageData(bimg, 0, 0);
    return { color, bump };
}

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

function woodPattern(light, dark, rings, contrast, seed) {
    const L = hex(light), Dk = hex(dark);
    return (u, v) => {
        const warp = fbm(u, v, 2, 6, 4, seed) * 2.2;
        const ring = 0.5 + 0.5 * Math.sin(2 * Math.PI * (v * rings + warp));
        const late = Math.pow(ring, 3);
        const fibre = noise(u, v, 6, 220, seed + 5) * 0.6 + noise(u, v, 24, 512, seed + 9) * 0.4;
        const t = clamp01(late * contrast + (fibre - 0.5) * 0.35 + (fbm(u, v, 4, 4, 3, seed + 3) - 0.5) * 0.3);
        return { c: mix(L, Dk, t), h: 0.5 - late * 0.25 + (fibre - 0.5) * 0.4 };
    };
}

const GENERATORS = {
    mdf: () => {
        const base = hex(0xa8865c);
        return (u, v) => {
            const n = fbm(u, v, 16, 16, 4, 11);
            const speck = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 3);
            const k = 0.9 + (n - 0.5) * 0.18 + (speck - 0.5) * 0.12;
            return { c: base.map(x => x * k), h: n * 0.6 + speck * 0.4 };
        };
    },
    plywood: () => woodPattern(0xe3cb9c, 0xc49a62, 5, 0.55, 21),
    oak: () => woodPattern(0xb98a52, 0x6f4a26, 9, 0.85, 31),
    walnut: () => woodPattern(0x6b4428, 0x2e1b0f, 7, 0.9, 41),
    carpet: () => (u, v) => {
        const fibre = hash(Math.floor(u * SIZE), Math.floor(v * SIZE), 7);
        const clump = fbm(u, v, 32, 32, 3, 51);
        const g = 30 + fibre * 28 + (clump - 0.5) * 30;
        return { c: [g, g, g * 1.04], h: fibre * 0.6 + clump * 0.4 };
    },
    paint: () => (u, v) => {
        const peel = fbm(u, v, 24, 24, 4, 61);
        const g = 30 + (peel - 0.5) * 8;
        return { c: [g, g, g + 1], h: peel };
    },
    pianoBlack: () => (u, v) => {
        const n = fbm(u, v, 8, 8, 2, 71);
        return { c: [8, 8, 10], h: 0.5 + (n - 0.5) * 0.1 };
    },
    whiteGloss: () => (u, v) => {
        const n = fbm(u, v, 12, 12, 3, 81);
        const g = 238 + (n - 0.5) * 6;
        return { c: [g, g, g - 2], h: 0.5 + (n - 0.5) * 0.2 };
    },
    carbon: () => {
        const cells = 16;
        return (u, v) => {
            const cx = u * cells, cy = v * cells;
            const i = Math.floor(cx), j = Math.floor(cy);
            const fx = cx - i, fy = cy - j;
            const horizontal = mod(i + j, 4) < 2; // саржевое (twill 2×2) плетение
            const across = horizontal ? fy : fx;
            const along = horizontal ? u : v;
            const tow = Math.sin(Math.PI * across);
            const fib = noise(horizontal ? along : across, horizontal ? across : along, 512, 8, 91);
            const sheen = horizontal ? 1 : 0.62;
            const g = 18 + tow * 34 * sheen + fib * 10;
            return { c: [g, g, g * 1.06], h: tow * 0.8 + fib * 0.2 };
        };
    },
    // Диффузоры
    conePaper: () => (u, v) => {
        const f = fbm(u, v, 32, 16, 4, 101);
        const fibre = noise(u, v, 256, 64, 103);
        const g = 52 + (f - 0.5) * 22 + (fibre - 0.5) * 16;
        return { c: [g, g, g], h: f * 0.5 + fibre * 0.5 };
    },
    conePoly: () => (u, v) => {
        const ripple = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 24);
        const g = 16 + ripple * 6;
        return { c: [g, g, g + 2], h: ripple * 0.5 };
    },
    coneAluminum: () => (u, v) => {
        const brushed = noise(u, v, 8, 512, 111);
        const g = 170 + (brushed - 0.5) * 40;
        return { c: [g, g + 2, g + 6], h: brushed };
    }
};

const textureCache = new Map();

function getMaps(key) {
    if (!textureCache.has(key)) {
        const gen = GENERATORS[key];
        const { color, bump } = generate(gen());
        const map = new THREE.CanvasTexture(color);
        map.colorSpace = THREE.SRGBColorSpace;
        const bumpMap = new THREE.CanvasTexture(bump);
        [map, bumpMap].forEach(tex => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.anisotropy = maxAnisotropy;
        });
        textureCache.set(key, { map, bumpMap, canvas: color });
    }
    return textureCache.get(key);
}

/** Превью текстуры для UI (data URL). */
export function getTexturePreview(key) {
    return getMaps(key).canvas.toDataURL('image/jpeg', 0.8);
}

// ---------- Материалы ----------

export const FINISH_LIBRARY = {
    mdf:        { label: 'МДФ (без отделки)',     tile: 300, bump: 0.6, physical: false, roughness: 0.85 },
    plywood:    { label: 'Фанера (берёза)',       tile: 600, bump: 0.8, physical: false, roughness: 0.65 },
    oak:        { label: 'Шпон дуба',             tile: 500, bump: 1.2, physical: true, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 },
    walnut:     { label: 'Шпон ореха',            tile: 500, bump: 1.0, physical: true, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 },
    carpet:     { label: 'Карпет (ковролин)',     tile: 120, bump: 3.0, physical: false, roughness: 1 },
    paint:      { label: 'Чёрная матовая краска', tile: 200, bump: 0.8, physical: false, roughness: 0.7 },
    pianoBlack: { label: 'Чёрный лак (piano)',    tile: 400, bump: 0.1, physical: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04 },
    whiteGloss: { label: 'Белый глянец',          tile: 400, bump: 0.2, physical: true, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 },
    carbon:     { label: 'Карбон',                tile: 60,  bump: 0.6, physical: true, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }
};

export const CONE_LIBRARY = {
    paper:    { label: 'Бумага',    tex: 'conePaper', roughness: 0.9, metalness: 0, bump: 1.0 },
    poly:     { label: 'Полипропилен', tex: 'conePoly', roughness: 0.45, metalness: 0, bump: 0.3 },
    carbon:   { label: 'Карбон',    tex: 'carbon', roughness: 0.35, metalness: 0.1, bump: 0.6 },
    aluminum: { label: 'Алюминий',  tex: 'coneAluminum', roughness: 0.3, metalness: 0.9, bump: 0.3 }
};

const materialCache = new Map();

function cached(key, factory) {
    if (!materialCache.has(key)) materialCache.set(key, factory());
    return materialCache.get(key);
}

/** Материал панели корпуса. UV панелей задаются в миллиметрах, поэтому repeat = 1 / размер тайла. */
export function getFinishMaterial(finish, xray = false) {
    return cached(`finish:${finish}:${xray}`, () => {
        const def = FINISH_LIBRARY[finish] || FINISH_LIBRARY.mdf;
        const src = getMaps(finish);
        const map = src.map.clone();
        const bumpMap = src.bumpMap.clone();
        [map, bumpMap].forEach(tex => {
            tex.repeat.set(1 / def.tile, 1 / def.tile);
            tex.needsUpdate = true;
        });
        const params = {
            map, bumpMap, bumpScale: def.bump, roughness: def.roughness, metalness: 0,
            transparent: xray, opacity: xray ? 0.22 : 1, depthWrite: !xray, side: xray ? THREE.DoubleSide : THREE.FrontSide
        };
        if (def.physical) {
            return new THREE.MeshPhysicalMaterial({ ...params, clearcoat: def.clearcoat, clearcoatRoughness: def.clearcoatRoughness });
        }
        return new THREE.MeshStandardMaterial(params);
    });
}

export function getConeMaterial(cone) {
    return cached(`cone:${cone}`, () => {
        const def = CONE_LIBRARY[cone] || CONE_LIBRARY.paper;
        const src = getMaps(def.tex);
        const map = src.map.clone();
        const bumpMap = src.bumpMap.clone();
        [map, bumpMap].forEach(tex => {
            tex.repeat.set(6, 1);
            tex.needsUpdate = true;
        });
        return new THREE.MeshStandardMaterial({
            map, bumpMap, bumpScale: def.bump, roughness: def.roughness, metalness: def.metalness, side: THREE.DoubleSide
        });
    });
}

export function getBasicMaterial(name) {
    return cached(`basic:${name}`, () => {
        switch (name) {
            case 'rubber': return new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95, side: THREE.DoubleSide });
            case 'frame': return new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
            case 'chrome': return new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.15, metalness: 1 });
            case 'magnet': return new THREE.MeshStandardMaterial({ color: 0x333438, roughness: 0.5, metalness: 0.7 });
            case 'portTube': return new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.6, side: THREE.DoubleSide });
            case 'portInner': return new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.BackSide });
            default: return new THREE.MeshStandardMaterial({ color: 0x888888 });
        }
    });
}

/** Перфорированная металлическая сетка гриля (alphaMap). */
export function getGrilleMaterial() {
    return cached('grille', () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#000';
        const pitch = size / 4;
        for (let row = 0; row <= 4; row++) {
            for (let col = 0; col <= 4; col++) {
                const x = col * pitch + (row % 2 ? pitch / 2 : 0);
                const y = row * pitch;
                ctx.beginPath();
                ctx.arc(x, y, pitch * 0.36, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        const alpha = new THREE.CanvasTexture(canvas);
        alpha.wrapS = alpha.wrapT = THREE.RepeatWrapping;
        alpha.anisotropy = maxAnisotropy;
        return new THREE.MeshStandardMaterial({
            color: 0x1c1d20, metalness: 0.7, roughness: 0.4,
            alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide
        });
    });
}

/** Освободить материалы и текстуры (при смене анизотропии и т.п.). */
export function disposeMaterials() {
    materialCache.forEach(m => {
        Object.values(m).forEach(v => v && v.isTexture && v.dispose());
        m.dispose();
    });
    materialCache.clear();
}
