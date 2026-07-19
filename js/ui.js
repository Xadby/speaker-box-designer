/**
 * Управление UI элементами
 */

const sliders = {};
const sliderConfigs = {
    width: { min: 200, max: 1200, step: 10 },
    height: { min: 200, max: 800, step: 10 },
    depth: { min: 200, max: 1000, step: 10 },
    thickness: { min: 10, max: 30, step: 1 },
    portDiameter: { min: 50, max: 200, step: 5 },
    portLength: { min: 50, max: 300, step: 10 },
    slotWidth: { min: 20, max: 100, step: 5 },
    slotHeight: { min: 50, max: 200, step: 5 },
    slotLength: { min: 50, max: 300, step: 10 },
    driverSizeInches: { min: 4, max: 12, step: 0.5 },
    driverSizeCM: { min: 10, max: 30, step: 0.5 },
    driverCount: { min: 1, max: 4, step: 1 }
};

function initializeUI() {
    // Инициализация слайдеров
    Object.keys(sliderConfigs).forEach(key => {
        const config = sliderConfigs[key];
        const element = document.getElementById(`${key}Slider`);
        if (!element) return;
        
        noUiSlider.create(element, {
            start: config.start || config.min,
            connect: 'lower',
            range: {
                min: config.min,
                max: config.max
            },
            step: config.step,
            format: {
                to: val => Math.round(val * 10) / 10,
                from: val => parseFloat(val)
            }
        });
        
        sliders[key] = element;
        
        // Обработчик изменения
        element.noUiSlider.on('update', () => updateFromUI());
    });
    
    // Вкладки
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Радиокнопки типа коробка
    document.querySelectorAll('input[name="boxType"]').forEach(radio => {
        radio.addEventListener('change', () => updateFromUI());
    });
    
    // Радиокнопки расположения
    document.querySelectorAll('input[name="portLocation"]').forEach(radio => {
        radio.addEventListener('change', () => updateFromUI());
    });
    
    document.querySelectorAll('input[name="driverLocation"]').forEach(radio => {
        radio.addEventListener('change', () => updateFromUI());
    });
    
    // Чекбоксы портов
    document.getElementById('usePort').addEventListener('change', (e) => {
        document.getElementById('portSettings').style.display = e.target.checked ? 'block' : 'none';
        updateFromUI();
    });
    
    document.getElementById('useSlotPort').addEventListener('change', (e) => {
        document.getElementById('slotPortSettings').style.display = e.target.checked ? 'block' : 'none';
        updateFromUI();
    });
    
    // Кнопки экспорта
    document.getElementById('exportJSON').addEventListener('click', () => {
        ExportManager.exportJSON();
        showNotification('JSON экспортирован');
    });
    
    document.getElementById('exportPDF').addEventListener('click', () => {
        ExportManager.exportPDF();
        showNotification('PDF экспортирован');
    });
    
    document.getElementById('exportDXF').addEventListener('click', () => {
        ExportManager.exportDXF();
        showNotification('DXF экспортирован');
    });
    
    document.getElementById('exportSTL').addEventListener('click', () => {
        ExportManager.exportSTL();
        showNotification('STL экспортирован');
    });
    
    document.getElementById('importJSON').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            ExportManager.importJSON(e.target.files[0]);
            showNotification('JSON загружен');
        }
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
        if (confirm('Сбросить все значения на стандартные?')) {
            calculator = new BoxCalculator();
            updateAllUI();
            showNotification('Значения сброшены');
        }
    });
    
    document.getElementById('screenshotBtn').addEventListener('click', () => {
        const screenshot = threeSetup.getScreenshot();
        const a = document.createElement('a');
        a.href = screenshot;
        a.download = `speaker-box-3d-${new Date().getTime()}.png`;
        a.click();
        showNotification('Скриншот сохранен');
    });
}

function switchTab(tabName) {
    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Деактивировать все кнопки
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Активировать выбранную вкладку
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }
}

function updateFromUI() {
    // Прочитать значения из слайдеров
    calculator.width = parseFloat(sliders.width.noUiSlider.get());
    calculator.height = parseFloat(sliders.height.noUiSlider.get());
    calculator.depth = parseFloat(sliders.depth.noUiSlider.get());
    calculator.thickness = parseFloat(sliders.thickness.noUiSlider.get());
    calculator.portDiameter = parseFloat(sliders.portDiameter.noUiSlider.get());
    calculator.portLength = parseFloat(sliders.portLength.noUiSlider.get());
    calculator.slotWidth = parseFloat(sliders.slotWidth.noUiSlider.get());
    calculator.slotHeight = parseFloat(sliders.slotHeight.noUiSlider.get());
    calculator.slotLength = parseFloat(sliders.slotLength.noUiSlider.get());
    calculator.driverDiameter = parseFloat(sliders.driverSizeCM.noUiSlider.get()) * 10; // см -> мм
    calculator.driverCount = parseInt(sliders.driverCount.noUiSlider.get());
    
    // Типы
    calculator.boxType = document.querySelector('input[name="boxType"]:checked').value;
    calculator.usePort = document.getElementById('usePort').checked;
    calculator.useSlotPort = document.getElementById('useSlotPort').checked;
    
    // Обновить 3D
    updateThreeView();
    updateDisplayValues();
}

function updateAllUI() {
    // Обновить слайдеры
    if (sliders.width) sliders.width.noUiSlider.set(calculator.width);
    if (sliders.height) sliders.height.noUiSlider.set(calculator.height);
    if (sliders.depth) sliders.depth.noUiSlider.set(calculator.depth);
    if (sliders.thickness) sliders.thickness.noUiSlider.set(calculator.thickness);
    if (sliders.portDiameter) sliders.portDiameter.noUiSlider.set(calculator.portDiameter);
    if (sliders.portLength) sliders.portLength.noUiSlider.set(calculator.portLength);
    if (sliders.slotWidth) sliders.slotWidth.noUiSlider.set(calculator.slotWidth);
    if (sliders.slotHeight) sliders.slotHeight.noUiSlider.set(calculator.slotHeight);
    if (sliders.slotLength) sliders.slotLength.noUiSlider.set(calculator.slotLength);
    if (sliders.driverSizeCM) sliders.driverSizeCM.noUiSlider.set(calculator.driverDiameter / 10);
    if (sliders.driverCount) sliders.driverCount.noUiSlider.set(calculator.driverCount);
    
    // Обновить радиокнопки
    document.querySelector(`input[name="boxType"][value="${calculator.boxType}"]`).checked = true;
    document.getElementById('usePort').checked = calculator.usePort;
    document.getElementById('useSlotPort').checked = calculator.useSlotPort;
    
    updateDisplayValues();
}

function updateDisplayValues() {
    const volume = calculator.calculateVolume();
    const frequency = calculator.calculatePortFrequency();
    
    // Размеры
    document.getElementById('widthValue').textContent = calculator.width;
    document.getElementById('heightValue').textContent = calculator.height;
    document.getElementById('depthValue').textContent = calculator.depth;
    document.getElementById('thicknessValue').textContent = calculator.thickness;
    
    // Порты
    document.getElementById('portDiameterValue').textContent = calculator.portDiameter;
    document.getElementById('portLengthValue').textContent = calculator.portLength;
    document.getElementById('tuningFreq').textContent = frequency;
    
    document.getElementById('slotWidthValue').textContent = calculator.slotWidth;
    document.getElementById('slotHeightValue').textContent = calculator.slotHeight;
    document.getElementById('slotLengthValue').textContent = calculator.slotLength;
    
    // Динамик
    const inchesValue = calculator.driverDiameter / 25.4;
    document.getElementById('driverSizeInchesValue').textContent = (Math.round(inchesValue * 10) / 10).toFixed(1);
    document.getElementById('driverSizeCMValue').textContent = (calculator.driverDiameter / 10).toFixed(1);
    document.getElementById('driverCountValue').textContent = calculator.driverCount;
    
    // Объем
    document.getElementById('volumeLiters').textContent = volume.liters;
    document.getElementById('volumeCm3').textContent = volume.cm3;
    document.getElementById('volumeInches').textContent = volume.inches;
}

function updateThreeView() {
    const portData = {
        enabled: calculator.usePort,
        diameter: calculator.portDiameter,
        length: calculator.portLength,
        position: document.querySelector('input[name="portLocation"]:checked')?.value || 'front',
        slotEnabled: calculator.useSlotPort,
        slotWidth: calculator.slotWidth,
        slotHeight: calculator.slotHeight,
        slotLength: calculator.slotLength,
        slotPosition: document.querySelector('input[name="portLocation"]:checked')?.value || 'front'
    };
    
    const driverData = {
        diameter: calculator.driverDiameter,
        count: calculator.driverCount,
        position: document.querySelector('input[name="driverLocation"]:checked')?.value || 'front'
    };
    
    threeSetup.updateBox(
        calculator.width,
        calculator.height,
        calculator.depth,
        calculator.thickness,
        calculator.boxType,
        portData,
        driverData
    );
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// CSS для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
