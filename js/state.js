/**
 * Состояние проекта: значения по умолчанию, валидация, миграция и автосохранение.
 */

export const STORAGE_KEY = 'speakerBoxProject.v2';
const LEGACY_STORAGE_KEY = 'speakerBoxProject';

export const BOX_TYPES = ['sealed', 'ported', 'slot', 'bandpass4', 'bandpass6'];
export const LOCATIONS = ['front', 'back', 'side', 'top'];
export const FINISHES = ['mdf', 'plywood', 'oak', 'walnut', 'carpet', 'paint', 'pianoBlack', 'whiteGloss', 'carbon'];
export const CONES = ['paper', 'poly', 'carbon', 'aluminum'];

export function createDefaultState() {
    return {
        version: 2,
        boxType: 'sealed',
        width: 400,
        height: 300,
        depth: 300,
        thickness: 18,
        driver: { diameter: 165, count: 1, location: 'front', cone: 'paper' },
        port: { diameter: 75, length: 150, count: 1, location: 'front', target: 40 },
        port2: { diameter: 75, length: 150 },
        slot: { width: 40, height: 100, length: 200 },
        bandpass: { ratio: 0.45 },
        finish: { body: 'mdf', baffle: 'mdf', grille: false },
        view: { xray: false, dims: true }
    };
}

const num = (v, fallback, min, max) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

/**
 * Привести произвольный объект к корректному состоянию (с ограничениями).
 */
export function sanitizeState(input) {
    const d = createDefaultState();
    const s = input && typeof input === 'object' ? input : {};
    const out = {
        version: 2,
        boxType: pick(s.boxType, BOX_TYPES, d.boxType),
        width: num(s.width, d.width, 3, 3000),
        height: num(s.height, d.height, 3, 3000),
        depth: num(s.depth, d.depth, 3, 3000),
        thickness: num(s.thickness, d.thickness, 1, 60),
        driver: {
            diameter: num(s.driver?.diameter, d.driver.diameter, 1, 3000),
            count: Math.round(num(s.driver?.count, d.driver.count, 1, 8)),
            location: pick(s.driver?.location, LOCATIONS, d.driver.location),
            cone: pick(s.driver?.cone, CONES, d.driver.cone)
        },
        port: {
            diameter: num(s.port?.diameter, d.port.diameter, 10, 400),
            length: num(s.port?.length, d.port.length, 5, 2000),
            count: Math.round(num(s.port?.count, d.port.count, 1, 4)),
            location: pick(s.port?.location, LOCATIONS, d.port.location),
            target: num(s.port?.target, d.port.target, 10, 200)
        },
        port2: {
            diameter: num(s.port2?.diameter, d.port2.diameter, 10, 400),
            length: num(s.port2?.length, d.port2.length, 5, 2000)
        },
        slot: {
            width: num(s.slot?.width, d.slot.width, 5, 1000),
            height: num(s.slot?.height, d.slot.height, 5, 3000),
            length: num(s.slot?.length, d.slot.length, 5, 3000)
        },
        bandpass: { ratio: num(s.bandpass?.ratio, d.bandpass.ratio, 0.15, 0.85) },
        finish: {
            body: pick(s.finish?.body, FINISHES, d.finish.body),
            baffle: pick(s.finish?.baffle, FINISHES, d.finish.baffle),
            grille: bool(s.finish?.grille, d.finish.grille)
        },
        view: {
            xray: bool(s.view?.xray, d.view.xray),
            dims: bool(s.view?.dims, d.view.dims)
        }
    };
    // Толщина стенок не может «съесть» весь корпус
    const minDim = Math.min(out.width, out.height, out.depth);
    out.thickness = Math.min(out.thickness, Math.max((minDim - 1) / 2, 0.5));
    return out;
}

/**
 * Миграция формата v1 (старый экспорт JSON / localStorage).
 */
export function migrateLegacy(data) {
    if (!data || typeof data !== 'object') return createDefaultState();
    if (data.version === 2) return sanitizeState(data);

    const s = createDefaultState();
    const dim = data.dimensions || {};
    Object.assign(s, {
        width: dim.width ?? s.width,
        height: dim.height ?? s.height,
        depth: dim.depth ?? s.depth,
        thickness: dim.thickness ?? s.thickness
    });
    const typeMap = { sealed: 'sealed', ported: 'ported', slotPort: 'slot', bandpass4: 'bandpass4', bandpass6: 'bandpass6', multiDriver: 'sealed' };
    s.boxType = typeMap[data.boxType] || 'sealed';
    if (data.port) {
        s.port.diameter = data.port.diameter ?? s.port.diameter;
        s.port.length = data.port.length ?? s.port.length;
        if (data.port.enabled && s.boxType === 'sealed') s.boxType = 'ported';
    }
    if (data.slotPort) {
        s.slot.width = data.slotPort.width ?? s.slot.width;
        s.slot.height = data.slotPort.height ?? s.slot.height;
        s.slot.length = data.slotPort.length ?? s.slot.length;
        if (data.slotPort.enabled && s.boxType === 'sealed') s.boxType = 'slot';
    }
    if (data.driver) {
        s.driver.diameter = data.driver.diameter ?? s.driver.diameter;
        s.driver.count = data.driver.count ?? s.driver.count;
    }
    return sanitizeState(s);
}

export function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return sanitizeState(JSON.parse(raw));
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) return migrateLegacy(JSON.parse(legacy));
    } catch (e) {
        console.warn('Не удалось загрузить сохранённый проект', e);
    }
    return createDefaultState();
}

let saveTimer = null;
export function saveState(state) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Не удалось сохранить проект', e);
        }
    }, 300);
}

export function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => o[k], obj);
    target[last] = value;
}
