/**
 * Инициализация Three.js сцены
 */

class ThreeSetup {
    constructor(containerElement) {
        this.container = containerElement;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        this.scene.fog = new THREE.Fog(0xf0f0f0, 5000, 10000);
        
        // Камера
        const width = containerElement.clientWidth;
        const height = containerElement.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        this.camera.position.set(500, 400, 500);
        this.camera.lookAt(0, 0, 0);
        
        // Рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        containerElement.appendChild(this.renderer.domElement);
        
        // Освещение
        this.setupLights();
        
        // Группа для модели
        this.boxGroup = new THREE.Group();
        this.scene.add(this.boxGroup);
        
        // Сетка
        this.gridHelper = BoxGeometry.createGridHelper();
        this.scene.add(this.gridHelper);
        
        // Обработчик изменения размера окна
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Начать отрисовку
        this.animate();
    }

    setupLights() {
        // Основной свет
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainLight.position.set(500, 400, 300);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.left = -1000;
        mainLight.shadow.camera.right = 1000;
        mainLight.shadow.camera.top = 1000;
        mainLight.shadow.camera.bottom = -1000;
        this.scene.add(mainLight);
        
        // Дополнительный свет
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight.position.set(-500, 300, -300);
        this.scene.add(fillLight);
        
        // Рассеянный свет
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
    }

    updateBox(width, height, depth, thickness, boxType, portData, driverData) {
        // Очистить предыдущую группу
        while (this.boxGroup.children.length > 0) {
            this.boxGroup.remove(this.boxGroup.children[0]);
        }
        
        // Создать новый коробка
        const boxMesh = BoxGeometry.createBox(width, height, depth, thickness);
        this.boxGroup.add(boxMesh);
        
        // Добавить порты если нужно
        if (portData.enabled) {
            const port = BoxGeometry.createPort(
                portData.diameter,
                portData.length,
                portData.position
            );
            this.boxGroup.add(port);
        }
        
        if (portData.slotEnabled) {
            const slotPort = BoxGeometry.createSlotPort(
                portData.slotWidth,
                portData.slotHeight,
                portData.slotLength,
                portData.slotPosition
            );
            this.boxGroup.add(slotPort);
        }
        
        // Добавить динамики
        for (let i = 0; i < driverData.count; i++) {
            const offset = (driverData.count > 1) ? (i - (driverData.count - 1) / 2) * 100 : 0;
            const driver = BoxGeometry.createDriver(driverData.diameter, driverData.position);
            driver.position.y = offset;
            this.boxGroup.add(driver);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Получить отрендеренный кадр как DataURL
     */
    getScreenshot() {
        return this.renderer.domElement.toDataURL('image/png');
    }
}

// Глобальный экземпляр
let threeSetup;