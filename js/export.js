/**
 * Экспорт и импорт: JSON, PNG, STL, DXF и PDF (чертёж + раскрой).
 */
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { migrateLegacy } from './state.js';
import { BOX_TYPE_LABELS, round } from './calculator.js';
import { FINISH_LIBRARY, CONE_LIBRARY } from './textures.js';

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

function download(data, filename, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(state) {
    download(JSON.stringify(state, null, 2), `speaker-box-${stamp()}.json`, 'application/json');
}

export function importJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(migrateLegacy(JSON.parse(reader.result)));
            } catch (e) {
                reject(new Error('Файл не является корректным проектом JSON'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

export function exportPNG(view) {
    const url = view.screenshot();
    const a = document.createElement('a');
    a.href = url;
    a.download = `speaker-box-${stamp()}.png`;
    a.click();
}

export function exportSTL(view) {
    const exporter = new STLExporter();
    const data = exporter.parse(view.getCabinetForExport(), { binary: true });
    download(new Blob([data], { type: 'model/stl' }), `speaker-box-${stamp()}.stl`);
}

// ---------- DXF (R12, мм) ----------

const DXF_NAMES = {
    front: 'FRONT', back: 'BACK', right: 'SIDE RIGHT', left: 'SIDE LEFT',
    top: 'TOP', bottom: 'BOTTOM', partition: 'PARTITION'
};

/** Раскладка деталей в ряды для чертежей. Возвращает [{part, x, y}] — левый нижний угол. */
function layoutParts(parts, maxRowWidth, gap) {
    const placed = [];
    let x = 0, y = 0, rowH = 0;
    parts.forEach(part => {
        if (x > 0 && x + part.w > maxRowWidth) {
            x = 0;
            y -= rowH + gap;
            rowH = 0;
        }
        placed.push({ part, x, y: y - part.h });
        x += part.w + gap;
        rowH = Math.max(rowH, part.h);
    });
    return placed;
}

export function drawingParts(design) {
    const parts = design.panels.map(p => ({ id: p.id, name: p.name, label: DXF_NAMES[p.id] || p.id.toUpperCase(), w: p.w, h: p.h, holes: p.holes }));
    design.blocks.forEach((b, i) => parts.push({ id: `block${i}`, name: b.name, label: `SLOT WALL ${i + 1}`, w: b.cut[0], h: b.cut[1], holes: [] }));
    return parts.filter(p => p.w > 0 && p.h > 0);
}

export function exportDXF(design) {
    const out = [];
    const push = (...pairs) => out.push(...pairs.map(String));
    const f = v => round(v, 3);
    const line = (x1, y1, x2, y2, layer) => push(0, 'LINE', 8, layer, 10, f(x1), 20, f(y1), 30, 0, 11, f(x2), 21, f(y2), 31, 0);
    const rect = (x, y, w, h, layer) => {
        line(x, y, x + w, y, layer);
        line(x + w, y, x + w, y + h, layer);
        line(x + w, y + h, x, y + h, layer);
        line(x, y + h, x, y, layer);
    };

    push(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
    push(0, 'SECTION', 2, 'ENTITIES');
    const t = design.t;
    const totalW = drawingParts(design).reduce((a, p) => a + p.w, 0);
    layoutParts(drawingParts(design), Math.max(totalW / 2, 1200), 40).forEach(({ part, x, y }) => {
        rect(x, y, part.w, part.h, 'OUTLINE');
        const cx = x + part.w / 2, cy = y + part.h / 2;
        part.holes.forEach(h => {
            if (h.type === 'circle') push(0, 'CIRCLE', 8, 'HOLES', 10, f(cx + h.x), 20, f(cy + h.y), 30, 0, 40, f(h.r));
            else rect(cx + h.x - h.w / 2, cy + h.y - h.h / 2, h.w, h.h, 'HOLES');
        });
        const th = Math.max(Math.min(part.w, part.h) * 0.06, 6);
        push(0, 'TEXT', 8, 'LABELS', 10, f(x), 20, f(y - th * 1.6), 30, 0, 40, f(th),
            1, `${part.label} ${round(part.w, 1)}x${round(part.h, 1)} t=${round(t, 1)}`);
    });
    push(0, 'ENDSEC', 0, 'EOF');
    download(out.join('\n') + '\n', `speaker-box-panels-${stamp()}.dxf`, 'application/dxf');
}

// ---------- PDF (страницы рисуются на canvas, поэтому кириллица отображается корректно) ----------

const PAGE_W = 2480, PAGE_H = 3508; // A4 @ 300 dpi
const PX = PAGE_W / 210;            // пикселей на мм листа

function newPage() {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'alphabetic';
    return { canvas, ctx };
}

const font = (ctx, size, weight = 400) => { ctx.font = `${weight} ${size * PX / 3}px system-ui, 'Segoe UI', Roboto, sans-serif`; };
const fmt = (v, d = 1) => round(v, d).toLocaleString('ru-RU');

function header(ctx, title, page) {
    font(ctx, 18, 700);
    ctx.fillStyle = '#111';
    ctx.fillText(title, 15 * PX, 22 * PX);
    font(ctx, 9);
    ctx.fillStyle = '#666';
    ctx.fillText(`Speaker Box Designer · ${new Date().toLocaleDateString('ru-RU')} · стр. ${page}`, 15 * PX, 29 * PX);
    ctx.strokeStyle = '#ffb547';
    ctx.lineWidth = 0.8 * PX;
    ctx.beginPath();
    ctx.moveTo(15 * PX, 33 * PX);
    ctx.lineTo(195 * PX, 33 * PX);
    ctx.stroke();
}

function table(ctx, x, y, cols, rows) {
    const rowH = 7 * PX;
    font(ctx, 9, 700);
    ctx.fillStyle = '#444';
    let cx = x;
    cols.forEach(c => {
        ctx.textAlign = c.align || 'left';
        ctx.fillText(c.title, c.align === 'right' ? cx + c.w * PX : cx, y);
        cx += c.w * PX;
    });
    y += rowH * 0.6;
    font(ctx, 9.5);
    ctx.fillStyle = '#111';
    rows.forEach((r, i) => {
        if (i % 2 === 0) {
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(x - 2 * PX, y, cols.reduce((a, c) => a + c.w, 0) * PX + 4 * PX, rowH);
            ctx.fillStyle = '#111';
        }
        cx = x;
        r.forEach((cell, j) => {
            const c = cols[j];
            ctx.textAlign = c.align || 'left';
            ctx.fillText(String(cell), c.align === 'right' ? cx + c.w * PX : cx, y + rowH * 0.7);
            cx += c.w * PX;
        });
        y += rowH;
    });
    ctx.textAlign = 'left';
    return y;
}

function drawPart(ctx, part, x, y, scale, t) {
    // x, y — левый верхний угол в пикселях листа
    const w = part.w * scale, h = part.h * scale;
    ctx.fillStyle = '#faf6ef';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.35 * PX;
    ctx.strokeRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = '#fff';
    part.holes.forEach(hole => {
        ctx.beginPath();
        if (hole.type === 'circle') ctx.arc(cx + hole.x * scale, cy - hole.y * scale, hole.r * scale, 0, Math.PI * 2);
        else ctx.rect(cx + (hole.x - hole.w / 2) * scale, cy - (hole.y + hole.h / 2) * scale, hole.w * scale, hole.h * scale);
        ctx.fill();
        ctx.stroke();
        if (hole.type === 'circle') {
            font(ctx, 6.5);
            ctx.fillStyle = '#c0392b';
            ctx.textAlign = 'center';
            ctx.fillText(`⌀${fmt(hole.r * 2)}`, cx + hole.x * scale, cy - hole.y * scale + 1 * PX);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#fff';
        }
    });
    font(ctx, 8, 700);
    ctx.fillStyle = '#111';
    ctx.fillText(part.name, x, y - 2.5 * PX);
    font(ctx, 7.5);
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText(`${fmt(part.w)} мм`, cx, y + h + 4 * PX);
    ctx.save();
    ctx.translate(x + w + 3.5 * PX, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${fmt(part.h)} мм`, 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
}

export async function exportPDF(design, state, screenshot) {
    if (!window.jspdf) throw new Error('Библиотека jsPDF не загрузилась');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    // --- Страница 1: сводка ---
    const p1 = newPage();
    let ctx = p1.ctx;
    header(ctx, 'Акустический корпус — чертёж', 1);

    const summary = [
        ['Тип корпуса', BOX_TYPE_LABELS[design.type]],
        ['Внешние размеры (Ш×В×Г)', `${fmt(design.outer.w)} × ${fmt(design.outer.h)} × ${fmt(design.outer.d)} мм`],
        ['Внутренние размеры', `${fmt(design.inner.w)} × ${fmt(design.inner.h)} × ${fmt(design.inner.d)} мм`],
        ['Толщина материала', `${fmt(design.t)} мм`],
        ['Объём брутто / нетто', `${fmt(design.grossLiters, 2)} л / ${fmt(design.netLiters, 2)} л`],
        ['Динамики', `${state.driver.count} × ⌀${fmt(state.driver.diameter)} мм (${fmt(state.driver.diameter / 25.4)}″), вырез ⌀${fmt(state.driver.diameter * 0.9)} мм, диффузор: ${CONE_LIBRARY[state.driver.cone].label.toLowerCase()}`]
    ];
    design.chambers.forEach(ch => {
        let txt = `${fmt(ch.liters, 2)} л`;
        if (ch.ports?.length) txt += `, порт ${ch.ports.length} × ⌀${fmt(ch.ports[0].d)} × ${fmt(ch.ports[0].length)} мм`;
        if (ch.slot) txt += `, щель ${fmt(ch.slot.w)} × ${fmt(ch.slot.h)} × ${fmt(ch.slot.length)} мм`;
        if (ch.frequency) txt += `, Fb ≈ ${fmt(ch.frequency)} Гц`;
        summary.push([design.isBandpass ? ch.name : 'Камера', txt]);
    });
    summary.push(['Отделка', `корпус — ${FINISH_LIBRARY[state.finish.body].label.toLowerCase()}, лицевая панель — ${FINISH_LIBRARY[state.finish.baffle].label.toLowerCase()}`]);
    summary.push(['Масса корпуса (оценка)', `${fmt(design.massKg)} кг`]);

    let y = table(ctx, 15 * PX, 45 * PX, [{ title: 'Параметр', w: 55 }, { title: 'Значение', w: 125 }], summary);

    const img = await loadImage(screenshot);
    const maxW = 180 * PX, maxH = PAGE_H - y - 40 * PX - (design.warnings.length * 7 * PX);
    const k = Math.min(maxW / img.width, maxH / img.height);
    const iw = img.width * k, ih = img.height * k;
    y += 8 * PX;
    ctx.drawImage(img, 15 * PX + (maxW - iw) / 2, y, iw, ih);
    y += ih + 10 * PX;

    if (design.warnings.length) {
        font(ctx, 10, 700);
        ctx.fillStyle = '#c0392b';
        ctx.fillText('Предупреждения:', 15 * PX, y);
        font(ctx, 9);
        design.warnings.forEach(w => {
            y += 6.5 * PX;
            ctx.fillText(`• ${w}`, 15 * PX, y);
        });
    }
    doc.addImage(p1.canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);

    // --- Страница 2: раскрой ---
    doc.addPage();
    const p2 = newPage();
    ctx = p2.ctx;
    header(ctx, 'Раскрой деталей', 2);
    const parts = drawingParts(design);
    y = table(ctx, 15 * PX, 45 * PX, [
        { title: '№', w: 10 }, { title: 'Деталь', w: 80 },
        { title: 'Ширина, мм', w: 30, align: 'right' }, { title: 'Высота, мм', w: 30, align: 'right' },
        { title: 'Вырезов', w: 25, align: 'right' }
    ], parts.map((p, i) => [i + 1, p.name, fmt(p.w), fmt(p.h), p.holes.length || '—']));
    font(ctx, 9);
    ctx.fillStyle = '#555';
    ctx.fillText(`Толщина всех деталей: ${fmt(design.t)} мм. Площадь материала: ${fmt(design.sheetArea, 2)} м². Вырезы показаны со стороны лицевой поверхности.`, 15 * PX, y + 7 * PX);

    // Чертежи деталей в общем масштабе
    const areaTop = y + 22 * PX, areaLeft = 15 * PX;
    const areaW = 180 * PX, areaH = PAGE_H - areaTop - 15 * PX;
    const gapMm = 18;
    const widest = Math.max(...parts.map(p => p.w), 1);
    let scale = (areaW - 12 * PX) / widest; // пикселей листа на мм детали
    const layout = () => layoutParts(parts, (areaW - 12 * PX) / scale, (gapMm * PX) / scale);
    let placed = layout();
    while (-Math.min(...placed.map(p => p.y)) * scale > areaH - 10 * PX && scale > 1e-4) {
        scale *= 0.92;
        placed = layout();
    }
    placed.forEach(({ part, x, y: py }) => {
        drawPart(ctx, part, areaLeft + x * scale, areaTop + (-py - part.h) * scale + 4 * PX, scale, design.t);
    });
    font(ctx, 8);
    ctx.fillStyle = '#777';
    ctx.fillText(`Масштаб чертежей ≈ 1:${fmt(PX / scale, 0)}`, 15 * PX, PAGE_H - 10 * PX);
    doc.addImage(p2.canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);

    doc.save(`speaker-box-${stamp()}.pdf`);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}
