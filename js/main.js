/**
 * Главный файл приложения
 */

window.addEventListener('DOMContentLoaded', () => {
    // Инициализация Three.js
    const canvasContainer = document.getElementById('canvas-3d');
    threeSetup = new ThreeSetup(canvasContainer);
    
    // Инициализация управления камерой
    cameraControls = new CameraControls(threeSetup.camera, threeSetup.renderer);
    
    // Инициализация UI
    initializeUI();
    
    // Начальное обновление
    updateDisplayValues();
    updateThreeView();
    
    // Загрузить сохраненный проект из localStorage если он есть
    const savedProject = localStorage.getItem('speakerBoxProject');
    if (savedProject) {
        try {
            const data = JSON.parse(savedProject);
            calculator.setParameters(data);
            updateAllUI();
        } catch (e) {
            console.log('Не удалось загрузить сохраненный проект');
        }
    }
    
    // Сохранять проект в localStorage при каждом изменении
    let saveTimeout;
    const originalUpdateFromUI = updateFromUI;
    window.updateFromUI = function() {
        originalUpdateFromUI();
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('speakerBoxProject', JSON.stringify(calculator.getParameters()));
        }, 500);
    };
});

// Добавить стили по умолчанию
const defaultStyles = `
    .noUi-pips {
        display: none;
    }
    
    input:focus {
        outline: none;
    }
    
    button:focus {
        outline: none;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = defaultStyles;
document.head.appendChild(styleSheet);
