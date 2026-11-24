/**
 * Построение и синхронизация элементов управления.
 */
import { getPath } from './state.js';
import { FINISH_LIBRARY, CONE_LIBRARY, getTexturePreview } from './textures.js';
import { BOX_TYPE_LABELS, round } from './calculator.js';

const CHOICE_OPTIONS = {
    boxType: [
        { value: 'sealed', title: BOX_TYPE_LABELS.sealed, desc: 'Плотный, точный бас, компактный корпус' },
        { value: 'ported', title: BOX_TYPE_LABELS.ported, desc: 'Громче на низких частотах, настройка трубой' },
        { value: 'slot', title: BOX_TYPE_LABELS.slot, desc: 'Порт-щель вдоль стенки, прочная конструкция' },
        { value: 'bandpass4', title: BOX_TYPE_LABELS.bandpass4, desc: 'Закрытая камера + камера с портом' },
        { value: 'bandpass6', title: BOX_TYPE_LABELS.bandpass6, desc: 'Обе камеры с портами, максимальная отдача' }
    ],
    'driver.location': [
        { value: 'front', title: 'Спереди' }, { value: 'back', title: 'Сзади' },
        { value: 'side', title: 'Сбоку' }, { value: 'top', title: 'Сверху' }
    ],
    'port.location': [
        { value: 'front', title: 'Спереди' }, { value: 'back', title: 'Сзади' },
        { value: 'side', title: 'Сбоку' }, { value: 'top', title: 'Сверху' }
    ],
    'driver.cone': Object.entries(CONE_LIBRARY).map(([value, d]) => ({ value, title: d.label, texture: d.tex })),
    'finish.body': Object.entries(FINISH_LIBRARY).map(([value, d]) => ({ value, title: d.label, texture: value })),
    'finish.baffle': Object.entries(FINISH_LIBRARY).map(([value, d]) => ({ value, title: d.label, texture: value }))
};

const DRIVER_PRESETS = [4, 5.25, 6.5, 8, 10, 12, 15, 18];

let uid = 0;

/**
 * @param {object} api — { getState(), set(path, value), action(name) }
 */
export function initUI(api) {
    initTabs();
    document.querySelectorAll('.field').forEach(el => buildField(el, api));
    document.querySelectorAll('[data-choice]').forEach(el => buildChoices(el, api));
    document.querySelectorAll('[data-toggle]').forEach(input => {
        input.addEventListener('change', () => api.set(input.dataset.toggle, input.checked));
    });
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            api.action(btn.dataset.action);
        });
    });

    const presets = document.getElementById('driverPresets');
    DRIVER_PRESETS.forEach(inch => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = `${String(inch).replace('.', ',')}″`;
        chip.title = `${round(inch * 2.54, 1)} см`;
        chip.addEventListener('click', () => api.set('driver.diameter', round(inch * 25.4, 1)));
        presets.appendChild(chip);
    });

    // Превью текстур генерируются после первой отрисовки, чтобы не задерживать запуск
    requestIdleCallbackCompat(() => {
        document.querySelectorAll('.swatch[data-texture]').forEach(sw => {
            sw.style.backgroundImage = `url(${getTexturePreview(sw.dataset.texture)})`;
        });
    });
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tab.dataset.tab));
        });
    });
}

function buildField(el, api) {
    const key = el.dataset.key;
    const scale = Number(el.dataset.scale || 1);
    const id = `f${uid++}`;
    el.innerHTML = `
        <div class="field-head">
            <label for="${id}">${el.dataset.label}</label>
            <div class="field-input">
                <input type="number" id="${id}" step="${el.dataset.step}" min="${el.dataset.nmin ?? el.dataset.min}" max="${el.dataset.nmax ?? el.dataset.max}" inputmode="decimal">
                <span>${el.dataset.unit || ''}</span>
            </div>
        </div>
        <input type="range" min="${el.dataset.min}" max="${el.dataset.max}" step="${el.dataset.step}" aria-label="${el.dataset.label}">`;
    const number = el.querySelector('input[type=number]');
    const range = el.querySelector('input[type=range]');
    el._sync = state => {
        const value = getPath(state, key) / scale;
        const shown = round(value, decimals(el.dataset.step));
        if (document.activeElement !== number) number.value = shown;
        if (document.activeElement !== range) range.value = value;
        const fill = ((Math.min(Math.max(value, range.min), range.max) - range.min) / (range.max - range.min)) * 100;
        range.style.setProperty('--fill', `${fill}%`);
    };
    range.addEventListener('input', () => {
        number.value = range.value;
        api.set(key, Number(range.value) * scale);
    });
    number.addEventListener('input', () => {
        const v = parseFloat(number.value.replace(',', '.'));
        if (Number.isFinite(v)) api.set(key, v * scale);
    });
    number.addEventListener('change', () => el._sync(api.getState()));
    number.addEventListener('blur', () => el._sync(api.getState()));
}

function buildChoices(el, api) {
    const key = el.dataset.choice;
    const name = `c${uid++}`;
    (CHOICE_OPTIONS[key] || []).forEach(opt => {
        const label = document.createElement('label');
        label.className = 'choice';
        label.innerHTML = `
            <input type="radio" name="${name}" value="${opt.value}">
            <span class="body">
                ${opt.texture ? `<span class="swatch" data-texture="${opt.texture}"></span>` : ''}
                <span class="title">${opt.title}</span>
                ${opt.desc ? `<span class="desc">${opt.desc}</span>` : ''}
            </span>`;
        label.querySelector('input').addEventListener('change', e => {
            if (e.target.checked) api.set(key, opt.value);
        });
        el.appendChild(label);
    });
    el._sync = state => {
        const value = getPath(state, key);
        el.querySelectorAll('input').forEach(input => { input.checked = input.value === value; });
    };
}

/** Обновить все элементы управления по состоянию. */
export function syncUI(state) {
    document.querySelectorAll('.field, [data-choice]').forEach(el => el._sync && el._sync(state));
    document.querySelectorAll('[data-toggle]').forEach(input => {
        input.checked = !!getPath(state, input.dataset.toggle);
    });
    document.querySelectorAll('[data-show]').forEach(el => {
        el.classList.toggle('is-hidden', !el.dataset.show.split(',').includes(state.boxType));
    });
    document.querySelectorAll('[data-hide]').forEach(el => {
        el.classList.toggle('is-hidden', el.dataset.hide.split(',').includes(state.boxType));
    });
}

const fmt = (v, digits = 1) => round(v, digits).toLocaleString('ru-RU');

/** Панель результатов, предупреждения и таблица раскроя. */
export function renderResults(design) {
    const rows = [];
    rows.push(`<div class="type">${BOX_TYPE_LABELS[design.type]}</div>`);
    rows.push(row('Объём брутто', `${fmt(design.grossLiters, 2)} л`));
    rows.push(row('Объём нетто', `${fmt(design.netLiters, 2)} л`));
    if (design.isBandpass) {
        rows.push('<div class="sep"></div>');
        design.chambers.forEach(ch => {
            rows.push(row(ch.name, `${fmt(ch.liters, 2)} л`));
            if (ch.frequency) rows.push(row('— настройка Fb', `${fmt(ch.frequency)} Гц`));
        });
    } else if (design.chambers[0].frequency) {
        rows.push(row('Частота настройки Fb', `${fmt(design.chambers[0].frequency)} Гц`));
    }
    rows.push('<div class="sep"></div>');
    rows.push(row('Внутр. размеры', `${fmt(design.inner.w, 0)}×${fmt(design.inner.h, 0)}×${fmt(design.inner.d, 0)} мм`));
    rows.push(row('Масса корпуса ≈', `${fmt(design.massKg)} кг`));
    document.getElementById('stats').innerHTML = rows.join('');

    document.getElementById('warnings').innerHTML = design.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');

    const table = document.getElementById('cutTable');
    table.innerHTML = `
        <thead><tr><th>Деталь</th><th class="num">Длина</th><th class="num">Ширина</th><th class="num">S</th><th class="num">Отв.</th></tr></thead>
        <tbody>${design.cutList.map(c => `
            <tr><td>${c.name}</td><td class="num">${fmt(Math.max(c.w, c.h))}</td><td class="num">${fmt(Math.min(c.w, c.h))}</td><td class="num">${fmt(c.t)}</td><td class="num">${c.holes || '—'}</td></tr>`).join('')}
        </tbody>`;
    document.getElementById('cutSummary').textContent =
        `Деталей: ${design.cutList.length}. Площадь материала: ${fmt(design.sheetArea, 2)} м² (без учёта пропила). Размеры в мм.`;
}

function row(label, value) {
    return `<div class="row"><span>${label}</span><span>${value}</span></div>`;
}

function decimals(step) {
    const s = String(step);
    return s.includes('.') ? s.split('.')[1].length : 0;
}

function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
}

function requestIdleCallbackCompat(fn) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1500 });
    else setTimeout(fn, 200);
}
