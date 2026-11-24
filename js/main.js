/**
 * Точка входа приложения.
 */
import { loadState, saveState, sanitizeState, createDefaultState, setPath } from './state.js';
import { computeDesign, suggestPortLength, round } from './calculator.js';
import { SceneView } from './scene.js';
import { initUI, syncUI, renderResults, toast } from './ui.js';
import { exportJSON, importJSON, exportPNG, exportSTL, exportDXF, exportPDF } from './export.js';

let state = loadState();
let design = computeDesign(state);
let view = null;
let lastFitSize = 0;
let frameRequested = false;

const sizeOf = d => Math.hypot(d.outer.w, d.outer.h, d.outer.d);

function refresh({ fit = false } = {}) {
    design = computeDesign(state);
    syncUI(state);
    renderResults(design);
    if (view) {
        view.update(design, state);
        const size = sizeOf(design);
        if (fit || !lastFitSize || Math.abs(size - lastFitSize) / lastFitSize > 0.35) {
            view.fit(design);
            lastFitSize = size;
        }
    }
}

function scheduleRefresh() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(() => {
        frameRequested = false;
        refresh();
    });
}

function setState(next, options) {
    state = sanitizeState(next);
    saveState(state);
    refresh(options);
}

const api = {
    getState: () => state,
    set(path, value) {
        const next = structuredClone(state);
        setPath(next, path, value);
        state = sanitizeState(next);
        saveState(state);
        scheduleRefresh();
    },
    async action(name) {
        try {
            switch (name) {
                case 'fit':
                    view && view.fit(design);
                    lastFitSize = sizeOf(design);
                    break;
                case 'export-json':
                    exportJSON(state);
                    toast('Проект сохранён в JSON');
                    break;
                case 'import-json':
                    document.getElementById('importFile').click();
                    break;
                case 'export-png':
                    exportPNG(view);
                    toast('Скриншот сохранён');
                    break;
                case 'export-stl':
                    exportSTL(view);
                    toast('STL экспортирован');
                    break;
                case 'export-dxf':
                    exportDXF(design);
                    toast('DXF экспортирован');
                    break;
                case 'export-pdf':
                    toast('Формирование PDF…');
                    await exportPDF(design, state, view.screenshot());
                    break;
                case 'reset':
                    if (confirm('Сбросить все значения на стандартные?')) {
                        setState(createDefaultState(), { fit: true });
                        toast('Значения сброшены');
                    }
                    break;
            }
        } catch (e) {
            console.error(e);
            toast(e.message || 'Ошибка', 'error');
        }
    }
};

function initPortSuggestion() {
    const btn = document.getElementById('suggestLength');
    const result = document.getElementById('suggestResult');
    btn.addEventListener('click', () => {
        const target = state.port.target;
        const length = suggestPortLength(state, target);
        if (length == null) {
            result.textContent = 'Не удалось рассчитать: проверьте объём корпуса.';
            return;
        }
        if (length < state.thickness) {
            result.textContent = `Для ${target} Гц порт получается короче стенки (${round(length)} мм) — уменьшите площадь порта или объём.`;
            return;
        }
        const key = state.boxType === 'slot' ? 'slot.length' : 'port.length';
        api.set(key, round(length, 1));
        result.textContent = `Длина ${round(length)} мм для Fb = ${target} Гц применена.`;
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initUI(api);
    initPortSuggestion();

    document.getElementById('importFile').addEventListener('change', async e => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            setState(await importJSON(file), { fit: true });
            toast('Проект загружен');
        } catch (err) {
            toast(err.message, 'error');
        }
    });

    try {
        view = new SceneView(document.getElementById('canvas3d'));
    } catch (e) {
        console.error(e);
        document.getElementById('loading').textContent = 'Не удалось инициализировать WebGL: ' + e.message;
        refresh();
        return;
    }
    refresh({ fit: true });
    document.getElementById('loading').classList.add('done');
});
