/**
 * Расчёт конструкции корпуса: панели, вырезы, раскладка динамиков и портов,
 * объёмы камер, частоты настройки и предупреждения.
 * Модуль не зависит от DOM и Three.js. Все размеры — в миллиметрах.
 */

export const SOUND_SPEED = 343000;      // мм/с
export const END_CORRECTION = 1.463;    // концевая поправка порта (один конец с фланцем, второй свободный), × радиус
export const PORT_WALL = 4;             // толщина стенки трубы порта, мм
export const CUTOUT_RATIO = 0.9;        // диаметр монтажного отверстия относительно посадочного диаметра динамика
const GAP = 6;                          // минимальный зазор между вырезами, мм

export const BOX_TYPE_LABELS = {
    sealed: 'Закрытый ящик',
    ported: 'Фазоинвертор (круглый порт)',
    slot: 'Фазоинвертор (щелевой порт)',
    bandpass4: 'Бандпасс 4-го порядка',
    bandpass6: 'Бандпасс 6-го порядка'
};

const LOCATION_TO_PANEL = { front: 'front', back: 'back', side: 'right', top: 'top' };

const DENSITY = { plywood: 0.62, default: 0.75 }; // г/см³

/** Резонансная частота резонатора Гельмгольца, Гц. V — мм³, area — мм², length — мм, radius — мм. */
export function helmholtzFrequency(volume, area, length, radius) {
    if (volume <= 0 || area <= 0) return 0;
    const leff = Math.max(length, 0) + END_CORRECTION * radius;
    return (SOUND_SPEED / (2 * Math.PI)) * Math.sqrt(area / (volume * leff));
}

/** Физическая длина порта для заданной частоты, мм. */
export function requiredPortLength(freq, volume, area, radius) {
    if (freq <= 0 || volume <= 0 || area <= 0) return 0;
    return (SOUND_SPEED ** 2 * area) / (4 * Math.PI ** 2 * freq ** 2 * volume) - END_CORRECTION * radius;
}

/** Примерный объём, вытесняемый динамиком (магнит + корзина), мм³. */
export function driverDisplacement(diameter) {
    const dm = diameter / 100;
    return 0.12 * dm ** 3 * 1e6;
}

function makeShellPanels(W, H, D, t) {
    const Wi = W - 2 * t, Hi = H - 2 * t, Di = D - 2 * t;
    const p = (id, name, w, h, center, u, v, n, uw, uh, inside) => ({
        id, name, w, h, t, center, u, v, n,
        usable: { w: uw, h: uh }, inside, holes: [], internal: false, finish: 'body'
    });
    return [
        p('front', 'Передняя панель', W, H, [0, 0, D / 2 - t / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], Wi, Hi, Di),
        p('back', 'Задняя панель', W, H, [0, 0, -(D / 2 - t / 2)], [-1, 0, 0], [0, 1, 0], [0, 0, -1], Wi, Hi, Di),
        p('right', 'Боковая стенка (правая)', Di, H, [W / 2 - t / 2, 0, 0], [0, 0, -1], [0, 1, 0], [1, 0, 0], Di, Hi, Wi),
        p('left', 'Боковая стенка (левая)', Di, H, [-(W / 2 - t / 2), 0, 0], [0, 0, 1], [0, 1, 0], [-1, 0, 0], Di, Hi, Wi),
        p('top', 'Верхняя крышка', Wi, Di, [0, H / 2 - t / 2, 0], [1, 0, 0], [0, 0, -1], [0, 1, 0], Wi, Di, Hi),
        p('bottom', 'Дно', Wi, Di, [0, -(H / 2 - t / 2), 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], Wi, Di, Hi)
    ];
}

/** Равномерная сетка из n кругов диаметра d в прямоугольнике rect {x0, y0, w, h}. */
export function gridLayout(rect, n, d) {
    if (n <= 0 || rect.w <= 0 || rect.h <= 0) return { points: [], fits: n <= 0 };
    let best = null;
    for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const cell = Math.min(rect.w / c, rect.h / r);
        if (!best || cell > best.cell + 1e-9) best = { c, r, cell };
    }
    const { c, r } = best;
    const cw = rect.w / c, ch = rect.h / r;
    const points = [];
    for (let row = 0; row < r; row++) {
        const inRow = Math.min(c, n - row * c);
        const offset = ((c - inRow) * cw) / 2;
        for (let col = 0; col < inRow; col++) {
            points.push({
                x: rect.x0 + offset + cw * (col + 0.5),
                y: rect.y0 + rect.h - ch * (row + 0.5)
            });
        }
    }
    return { points, fits: d + GAP <= Math.min(cw, ch) };
}

function usableRect(panel) {
    return { x0: -panel.usable.w / 2, y0: -panel.usable.h / 2, w: panel.usable.w, h: panel.usable.h };
}

/** Разделить прямоугольник на основную часть и полосу справа (или снизу) под порты. */
function splitRect(rect, strip, forceRight = false) {
    if (forceRight || rect.w >= rect.h) {
        return {
            main: { x0: rect.x0, y0: rect.y0, w: rect.w - strip, h: rect.h },
            side: { x0: rect.x0 + rect.w - strip, y0: rect.y0, w: strip, h: rect.h }
        };
    }
    return {
        main: { x0: rect.x0, y0: rect.y0 + strip, w: rect.w, h: rect.h - strip },
        side: { x0: rect.x0, y0: rect.y0, w: rect.w, h: strip }
    };
}

/**
 * Полный расчёт конструкции.
 * @param {object} s — состояние (см. state.js)
 */
export function computeDesign(s) {
    const { width: W, height: H, depth: D, thickness: t } = s;
    const Wi = W - 2 * t, Hi = H - 2 * t, Di = D - 2 * t;
    const type = s.boxType;
    const isBandpass = type === 'bandpass4' || type === 'bandpass6';
    const hasRoundPort = type === 'ported' || isBandpass;
    const hasSlot = type === 'slot';

    const panels = makeShellPanels(W, H, D, t);
    const byId = Object.fromEntries(panels.map(p => [p.id, p]));
    const warnings = [];
    const drivers = [];
    const ports = [];
    const blocks = []; // внутренние перегородки щелевого порта (в координатах панели)
    let slot = null;

    const n = s.driver.count;
    const dDiam = s.driver.diameter;
    const cutout = dDiam * CUTOUT_RATIO;

    // --- Бандпасс: внутренняя перегородка с динамиками ---
    let frontDepth = 0, rearDepth = 0;
    let partition = null;
    if (isBandpass) {
        const free = Math.max(Di - t, 0);
        frontDepth = free * s.bandpass.ratio;
        rearDepth = free - frontDepth;
        partition = {
            id: 'partition', name: 'Перегородка (динамики)', w: Wi, h: Hi, t,
            center: [0, 0, D / 2 - t - frontDepth - t / 2],
            u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1],
            usable: { w: Wi, h: Hi }, inside: rearDepth, holes: [], internal: true, finish: 'body'
        };
        panels.push(partition);
        byId.partition = partition;
        if (Di - t <= 0) warnings.push('Корпус слишком мелкий для перегородки бандпасса.');
    }

    // --- Где монтируются динамики и порты ---
    const driverPanel = isBandpass ? partition : byId[LOCATION_TO_PANEL[s.driver.location]];
    const portPanel = isBandpass ? byId.front : byId[LOCATION_TO_PANEL[s.port.location]];
    driverPanel.finish = 'baffle';
    if (isBandpass) byId.front.finish = 'baffle';

    let driverRect = usableRect(driverPanel);
    let portRect = usableRect(portPanel);
    const pd = s.port.diameter;
    const portStrip = pd * 1.4;

    if (hasRoundPort && !isBandpass && portPanel === driverPanel) {
        const split = splitRect(driverRect, portStrip);
        driverRect = split.main;
        portRect = split.side;
    }
    if (hasSlot) {
        const sw = Math.min(s.slot.width, portPanel.usable.w);
        if (portPanel === driverPanel) {
            driverRect = splitRect(driverRect, sw + t, true).main;
        }
    }

    // --- Динамики ---
    const dl = gridLayout(driverRect, n, cutout);
    if (!dl.fits) {
        warnings.push(`Динамики (${n} × ⌀${round(dDiam)} мм) не помещаются на панели «${driverPanel.name}».`);
    } else {
        dl.points.forEach(pt => {
            drivers.push({ panelId: driverPanel.id, x: pt.x, y: pt.y, d: dDiam });
            driverPanel.holes.push({ type: 'circle', x: pt.x, y: pt.y, r: cutout / 2 });
        });
    }

    // --- Круглые порты ---
    const portInside = (panel, length) => length - t;
    const addRoundPorts = (panel, rect, count, diameter, length, chamberDepth, label) => {
        const lay = gridLayout(rect, count, diameter * 1.3);
        const lin = portInside(panel, length);
        if (!lay.fits) {
            warnings.push(`${label}: ${count} × ⌀${round(diameter)} мм не помещаются на панели «${panel.name}».`);
            return [];
        }
        if (lin <= 0) warnings.push(`${label}: длина порта меньше толщины стенки (${round(t)} мм).`);
        if (lin > chamberDepth - diameter / 2) {
            warnings.push(`${label}: порт слишком длинный — внутри ${round(lin)} мм при глубине камеры ${round(chamberDepth)} мм (нужен зазор ≥ ${round(diameter / 2)} мм до стенки).`);
        }
        const created = lay.points.map(pt => ({
            panelId: panel.id, x: pt.x, y: pt.y, d: diameter, length, inside: Math.max(lin, 0),
            renderInside: Math.max(Math.min(lin, chamberDepth - 2), 0)
        }));
        created.forEach(p => panel.holes.push({ type: 'circle', x: p.x, y: p.y, r: diameter / 2 + PORT_WALL }));
        ports.push(...created);
        return created;
    };

    let mainPorts = [];
    let rearPorts = [];
    if (hasRoundPort) {
        const chamber = isBandpass ? frontDepth : portPanel.inside;
        mainPorts = addRoundPorts(portPanel, portRect, s.port.count, pd, s.port.length, chamber, isBandpass ? 'Порт передней камеры' : 'Порт');
        if (type === 'bandpass6') {
            rearPorts = addRoundPorts(byId.back, usableRect(byId.back), s.port.count, s.port2.diameter, s.port2.length, rearDepth, 'Порт тыльной камеры');
        }
    }

    // --- Щелевой порт ---
    if (hasSlot) {
        const ur = usableRect(portPanel);
        let sw = s.slot.width;
        let sh = s.slot.height;
        if (sw + t >= ur.w) {
            warnings.push('Щель шире, чем панель: уменьшите ширину щели.');
            sw = Math.max(ur.w - t - 1, 1);
        }
        if (sh > ur.h) sh = ur.h;
        const topWall = sh < ur.h - 0.5;
        const lin = s.slot.length - t;
        if (lin <= 0) warnings.push(`Щелевой порт: длина меньше толщины стенки (${round(t)} мм).`);
        if (lin > portPanel.inside - sw) {
            warnings.push(`Щелевой порт слишком длинный — внутри ${round(lin)} мм при глубине ${round(portPanel.inside)} мм (оставьте зазор ≥ ширины щели).`);
        }
        const renderLin = Math.max(Math.min(lin, portPanel.inside - 1), 0);
        const x1 = ur.x0 + ur.w;
        slot = {
            panelId: portPanel.id,
            x: x1 - sw / 2, y: ur.y0 + sh / 2, w: sw, h: sh,
            length: s.slot.length, inside: Math.max(lin, 0), topWall
        };
        portPanel.holes.push({ type: 'rect', x: slot.x, y: slot.y, w: sw, h: sh });
        if (renderLin > 0) {
            const wallH = sh + (topWall ? t : 0);
            blocks.push({ panelId: portPanel.id, name: 'Стенка щелевого порта', x: x1 - sw - t / 2, y: ur.y0 + wallH / 2, w: t, h: wallH, depth: renderLin, cut: [renderLin, wallH] });
            if (topWall) {
                blocks.push({ panelId: portPanel.id, name: 'Крышка щелевого порта', x: x1 - sw / 2, y: ur.y0 + sh + t / 2, w: sw, h: t, depth: renderLin, cut: [renderLin, sw] });
            }
        }
    }

    // --- Объёмы ---
    const gross = Math.max(Wi, 0) * Math.max(Hi, 0) * Math.max(Di, 0);
    const driverDisp = drivers.length * driverDisplacement(dDiam);
    const portDisp = list => list.reduce((acc, p) => acc + Math.PI * (p.d / 2 + PORT_WALL) ** 2 * p.inside, 0);

    const chambers = [];
    if (isBandpass) {
        const face = Math.max(Wi, 0) * Math.max(Hi, 0);
        const vFront = face * frontDepth - portDisp(mainPorts);
        const vRear = face * rearDepth - driverDisp - portDisp(rearPorts);
        chambers.push({ id: 'front', name: 'Передняя камера (с портом)', volume: vFront, ports: mainPorts });
        chambers.push({ id: 'rear', name: type === 'bandpass6' ? 'Тыльная камера (с портом)' : 'Тыльная камера (закрытая)', volume: vRear, ports: rearPorts });
    } else {
        let v = gross - driverDisp - portDisp(mainPorts);
        if (slot) {
            v -= slot.w * slot.h * slot.inside;
            v -= t * (slot.h + (slot.topWall ? t : 0)) * slot.inside;
            if (slot.topWall) v -= t * slot.w * slot.inside;
        }
        chambers.push({ id: 'main', name: 'Корпус', volume: v, ports: mainPorts, slot });
    }

    chambers.forEach(ch => {
        ch.volume = Math.max(ch.volume, 0);
        ch.liters = ch.volume / 1e6;
        ch.frequency = 0;
        if (ch.slot) {
            const area = ch.slot.w * ch.slot.h;
            ch.frequency = helmholtzFrequency(ch.volume, area, ch.slot.length, Math.sqrt(area / Math.PI));
        } else if (ch.ports && ch.ports.length) {
            const r = ch.ports[0].d / 2;
            ch.frequency = helmholtzFrequency(ch.volume, ch.ports.length * Math.PI * r * r, ch.ports[0].length, r);
        }
        if (ch.volume <= 0) warnings.push(`${ch.name}: полезный объём равен нулю — увеличьте размеры.`);
    });

    const net = chambers.reduce((a, c) => a + c.volume, 0);

    // --- Раскрой и масса ---
    const holeArea = h => (h.type === 'circle' ? Math.PI * h.r * h.r : h.w * h.h);
    const cutList = panels.map(p => ({
        name: p.name, id: p.id, w: p.w, h: p.h, t,
        holes: p.holes.length,
        area: p.w * p.h
    }));
    blocks.forEach((b, i) => cutList.push({ name: b.name, id: `block${i}`, w: b.cut[0], h: b.cut[1], t, holes: 0, area: b.cut[0] * b.cut[1] }));
    const woodVolume = panels.reduce((a, p) => a + (p.w * p.h - p.holes.reduce((s2, h) => s2 + holeArea(h), 0)) * t, 0)
        + blocks.reduce((a, b) => a + b.w * b.h * b.depth, 0);
    const density = DENSITY[s.finish.body] || DENSITY.default;
    const massKg = woodVolume / 1000 * density / 1000;
    const sheetArea = cutList.reduce((a, c) => a + c.area, 0) / 1e6;

    return {
        type, isBandpass, hasRoundPort, hasSlot,
        outer: { w: W, h: H, d: D }, inner: { w: Wi, h: Hi, d: Di }, t,
        panels, drivers, ports, slot, blocks, chambers, warnings, cutList,
        grossLiters: gross / 1e6,
        netLiters: net / 1e6,
        driverDisplacementLiters: driverDisp / 1e6,
        massKg, sheetArea,
        bandpass: isBandpass ? { frontDepth, rearDepth } : null
    };
}

/** Подобрать длину основного порта (или щели) под целевую частоту. */
export function suggestPortLength(s, targetFreq) {
    const design = computeDesign(s);
    const ch = design.chambers[0];
    if (!ch || ch.volume <= 0) return null;
    if (design.hasSlot && design.slot) {
        const area = design.slot.w * design.slot.h;
        return requiredPortLength(targetFreq, ch.volume, area, Math.sqrt(area / Math.PI));
    }
    if (design.hasRoundPort) {
        const r = s.port.diameter / 2;
        // Объём зависит от длины порта — уточняем итерациями
        let length = s.port.length;
        for (let i = 0; i < 8; i++) {
            const d2 = computeDesign({ ...s, port: { ...s.port, length } });
            const v = d2.chambers[0].volume;
            if (v <= 0) return null;
            length = requiredPortLength(targetFreq, v, s.port.count * Math.PI * r * r, r);
            if (length <= 0) return length;
        }
        return length;
    }
    return null;
}

export function round(v, digits = 0) {
    const k = 10 ** digits;
    return Math.round(v * k) / k;
}
