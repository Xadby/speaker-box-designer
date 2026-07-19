/**
 * Управление UI элементами
 */

const sliders = {};
const sliderConfigs = {
    width: { min: 200, max: 1200, step: 10, start: 400 },
    height: { min: 200, max: 800, step: 10, start: 300 },
    depth: { min: 200, max: 1000, step: 10, start: 300 },
    thickness: { min: 10, max: 30, step: 1, start: 18 },
    portDiameter: { min: 50, max: 200, step: 5, start: 75 },
    portLength: { min: 50, max: 300, step: 10, start: 150 },
    slotWidth: { min: 20, max: 100, step: 5, start: 40 },
    slotHeight: { min: 50, max: 200, step: 5, start: 100 },
    slotLength: { min: 50, max: 300, step: 10, start: 100 },
    driverSizeInches: { min: 4, max: 12, step: 0.5, start: 6.5 },
    driverSizeCM: { min: 10, max: 30, step: 0.5, start: 16.5 },
    driverCount: { min: 1, max: 4, step: 1, start: 1 }
};

function initializeUI() {
    console.log('Инициализация UI...');
    
    // Инициализация слайдеров
    Object.keys(sliderConfigs).forEach(key => {
        const config = sliderConfigs[key];
        const element = document.getElementById(`${key}Slider`);
        if (!element) {
            console.warn(`Слайдер ${key} не найден`);
            return;
        }
        
        try {
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
            console.log(`Слайдер ${key} инициализирован`);
        } catch (e) {
            console.error(`Ошибка инициализации ${key}:`, e);
        }
    });
    
    // Вклад��и
    const tabButtons = document.querySelectorAll('.tab-button');
    console.log(`Найдено ${tabButtons.length} кнопок вкладок`);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = e.target.dataset.tab;
            console.log('Нажата вкладка:', tabName);
            switchTab(tabName);
        });
    });
    
    // Радиокнопки типа коробки
    document.querySelectorAll('input[name="boxType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('Тип коробки:', radio.value);
            updateFromUI();
        });
    });
    
    // Радиокнопки расположения портов
    document.querySelectorAll('input[name="portLocation"]').forEach(radio => {
        radio.addEventListener('change', () => updateFromUI());
    });
    
    document.querySelectorAll('input[name="driverLocation"]').forEach(radio => {
        radio.addEventListener('change', () => updateFromUI());
    });
    
    // Чекбоксы портов
    const usePort = document.getElementById('usePort');
    if (usePort) {
        usePort.addEventListener('change', (e) => {
            document.getElementById('portSettings').style.display = e.target.checked ? 'block' : 'none';
            updateFromUI();
        });
    }
    
    const useSlotPort = document.getElementById('useSlotPort');
    if (useSlotPort) {
        useSlotPort.addEventListener('change', (e) => {
            document.getElementById('slotPortSettings').style.display = e.target.checked ? 'block' : 'none';
            updateFromUI();
        });
    }
    
    // Кнопки экспорта
    const exportJSON = document.getElementById('exportJSON');
    if (exportJSON) {
        exportJSON.addEventListener('click', () => {
            ExportManager.exportJSON();
            showNotification('JSON экспортирован');
        });
    }
    
    const exportPDF = document.getElementById('exportPDF');
    if (exportPDF) {
        exportPDF.addEventListener('click', () => {
            ExportManager.exportPDF();
            showNotification('PDF экспортирован');
        });
    }
    
    const exportDXF = document.getElementById('exportDXF');
    if (exportDXF) {
        exportDXF.addEventListener('click', () => {
            ExportManager.exportDXF();
            showNotification('DXF экспортирован');
        });
    }
    
    const exportSTL = document.getElementById('exportSTL');
    if (exportSTL) {
        exportSTL.addEventListener('click', () => {
            ExportManager.exportSTL();
            showNotification('STL экспортирован');
        });
    }
    
    const importJSON = document.getElementById('importJSON');
    if (importJSON) {
        importJSON.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                ExportManager.importJSON(e.target.files[0]);
                showNotification('JSON загружен');
            }
        });
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Сбросить все значения на стандартные?')) {
                window.calculator = new BoxCalculator();
                updateAllUI();
                showNotification('Значения сброшены');
            }
        });
    }
    
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            if (window.threeSetup) {
                const screenshot = threeSetup.getScreenshot();
                const a = document.createElement('a');
                a.href = screenshot;
                a.download = `speaker-box-3d-${new Date().getTime()}.png`;
                a.click();
                showNotification('Скриншот сохранен');
            }
        });
    }
    
    console.log('UI инициализирован успешно');
}

function switchTab(tabName) {
    console.log('Переключение на вкладку:', tabName);
    
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
        console.log('Вкладка активирована:', tabName);
    }
    
    // Активировать кнопку
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) {
        btn.classList.add('active');
        console.log('Кнопка активирована:', tabName);
    }
}

function updateFromUI() {
    if (!window.calculator) {
        console.warn('Calculator не инициализирован');
        return;
    }
    
    // Прочитать значения из слайдеров
    if (sliders.width && sliders.width.noUiSlider) {
        calculator.width = parseFloat(sliders.width.noUiSlider.get());
    }
    if (sliders.height && sliders.height.noUiSlider) {
        calculator.height = parseFloat(sliders.height.noUiSlider.get());
    }
    if (sliders.depth && sliders.depth.noUiSlider) {
        calculator.depth = parseFloat(sliders.depth.noUiSlider.get());
    }
    if (sliders.thickness && sliders.thickness.noUiSlider) {
        calculator.thickness = parseFloat(sliders.thickness.noUiSlider.get());
    }
    if (sliders.portDiameter && sliders.portDiameter.noUiSlider) {
        calculator.portDiameter = parseFloat(sliders.portDiameter.noUiSlider.get());
    }
    if (sliders.portLength && sliders.portLength.noUiSlider) {
        calculator.portLength = parseFloat(sliders.portLength.noUiSlider.get());
    }
    if (sliders.slotWidth && sliders.slotWidth.noUiSlider) {
        calculator.slotWidth = parseFloat(sliders.slotWidth.noUiSlider.get());
    }
    if (sliders.slotHeight && sliders.slotHeight.noUiSlider) {
        calculator.slotHeight = parseFloat(sliders.slotHeight.noUiSlider.get());
    }
    if (sliders.slotLength && sliders.slotLength.noUiSlider) {
        calculator.slotLength = parseFloat(sliders.slotLength.noUiSlider.get());
    }
    if (sliders.driverSizeCM && sliders.driverSizeCM.noUiSlider) {
        calculator.driverDiameter = parseFloat(sliders.driverSizeCM.noUiSlider.get()) * 10; // см -> мм
    }
    if (sliders.driverCount && sliders.driverCount.noUiSlider) {
        calculator.driverCount = parseInt(sliders.driverCount.noUiSlider.get());
    }
    
    // Типы
    const boxTypeRadio = document.querySelector('input[name="boxType"]:checked');
    if (boxTypeRadio) calculator.boxType = boxTypeRadio.value;
    
    const usePortCheckbox = document.getElementById('usePort');
    if (usePortCheckbox) calculator.usePort = usePortCheckbox.checked;
    
    const useSlotPortCheckbox = document.getElementById('useSlotPort');
    if (useSlotPortCheckbox) calculator.useSlotPort = useSlotPortCheckbox.checked;
    
    // Обновить 3D
    updateThreeView();
    updateDisplayValues();
}

function updateAllUI() {
    if (!window.calculator) {
        console.warn('Calculator не инициализирован');
        return;
    }
    
    // Обновить слайдеры
    if (sliders.width && sliders.width.noUiSlider) sliders.width.noUiSlider.set(calculator.width);
    if (sliders.height && sliders.height.noUiSlider) sliders.height.noUiSlider.set(calculator.height);
    if (sliders.depth && sliders.depth.noUiSlider) sliders.depth.noUiSlider.set(calculator.depth);
    if (sliders.thickness && sliders.thickness.noUiSlider) sliders.thickness.noUiSlider.set(calculator.thickness);
    if (sliders.portDiameter && sliders.portDiameter.noUiSlider) sliders.portDiameter.noUiSlider.set(calculator.portDiameter);
    if (sliders.portLength && sliders.portLength.noUiSlider) sliders.portLength.noUiSlider.set(calculator.portLength);
    if (sliders.slotWidth && sliders.slotWidth.noUiSlider) sliders.slotWidth.noUiSlider.set(calculator.slotWidth);
    if (sliders.slotHeight && sliders.slotHeight.noUiSlider) sliders.slotHeight.noUiSlider.set(calculator.slotHeight);
    if (sliders.slotLength && sliders.slotLength.noUiSlider) sliders.slotLength.noUiSlider.set(calculator.slotLength);
    if (sliders.driverSizeCM && sliders.driverSizeCM.noUiSlider) sliders.driverSizeCM.noUiSlider.set(calculator.driverDiameter / 10);
    if (sliders.driverCount && sliders.driverCount.noUiSlider) sliders.driverCount.noUiSlider.set(calculator.driverCount);
    
    // Обновить радиокнопки
    const boxTypeRadio = document.querySelector(`input[name="boxType"][value="${calculator.boxType}"]`);
    if (boxTypeRadio) boxTypeRadio.checked = true;
    
    const usePortCheckbox = document.getElementById('usePort');
    if (usePortCheckbox) usePortCheckbox.checked = calculator.usePort;
    
    const useSlotPortCheckbox = document.getElementById('useSlotPort');
    if (useSlotPortCheckbox) useSlotPortCheckbox.checked = calculator.useSlotPort;
    
    updateDisplayValues();
}

function updateDisplayValues() {
    if (!window.calculator) return;
    
    const volume = calculator.calculateVolume();
    const frequency = calculator.calculatePortFrequency();
    
    // Размеры
    const widthValue = document.getElementById('widthValue');
    if (widthValue) widthValue.textContent = calculator.width;
    
    const heightValue = document.getElementById('heightValue');
    if (heightValue) heightValue.textContent = calculator.height;
    
    const depthValue = document.getElementById('depthValue');
    if (depthValue) depthValue.textContent = calculator.depth;
    
    const thicknessValue = document.getElementById('thicknessValue');
    if (thicknessValue) thicknessValue.textContent = calculator.thickness;
    
    // Порты
    const portDiameterValue = document.getElementById('portDiameterValue');
    if (portDiameterValue) portDiameterValue.textContent = calculator.portDiameter;
    
    const portLengthValue = document.getElementById('portLengthValue');
    if (portLengthValue) portLengthValue.textContent = calculator.portLength;
    
    const tuningFreq = document.getElementById('tuningFreq');
    if (tuningFreq) tuningFreq.textContent = frequency;
    
    const slotWidthValue = document.getElementById('slotWidthValue');
    if (slotWidthValue) slotWidthValue.textContent = calculator.slotWidth;
    
    const slotHeightValue = document.getElementById('slotHeightValue');
    if (slotHeightValue) slotHeightValue.textContent = calculator.slotHeight;
    
    const slotLengthValue = document.getElementById('slotLengthValue');
    if (slotLengthValue) slotLengthValue.textContent = calculator.slotLength;
    
    // Динамик
    const inchesValue = calculator.driverDiameter / 25.4;
    const driverSizeInchesValue = document.getElementById('driverSizeInchesValue');
    if (driverSizeInchesValue) driverSizeInchesValue.textContent = (Math.round(inchesValue * 10) / 10).toFixed(1);
    
    const driverSizeCMValue = document.getElementById('driverSizeCMValue');
    if (driverSizeCMValue) driverSizeCMValue.textContent = (calculator.driverDiameter / 10).toFixed(1);
    
    const driverCountValue = document.getElementById('driverCountValue');
    if (driverCountValue) driverCountValue.textContent = calculator.driverCount;
    
    // Объем
    const volumeLiters = document.getElementById('volumeLiters');
    if (volumeLiters) volumeLiters.textContent = volume.liters;
    
    const volumeCm3 = document.getElementById('volumeCm3');
    if (volumeCm3) volumeCm3.textContent = volume.cm3;
    
    const volumeInches = document.getElementById('volumeInches');
    if (volumeInches) volumeInches.textContent = volume.inches;
}

function updateThreeView() {
    if (!window.threeSetup || !window.calculator) return;
    
    const portLocationRadio = document.querySelector('input[name="portLocation"]:checked');
    const driverLocationRadio = document.querySelector('input[name="driverLocation"]:checked');
    
    const portData = {
        enabled: calculator.usePort,
        diameter: calculator.portDiameter,
        length: calculator.portLength,
        position: portLocationRadio ? portLocationRadio.value : 'front',
        slotEnabled: calculator.useSlotPort,
        slotWidth: calculator.slotWidth,
        slotHeight: calculator.slotHeight,
        slotLength: calculator.slotLength,
        slotPosition: portLocationRadio ? portLocationRadio.value : 'front'
    };
    
    const driverData = {
        diameter: calculator.driverDiameter,
        count: calculator.driverCount,
        position: driverLocationRadio ? driverLocationRadio.value : 'front'
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