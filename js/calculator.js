/**
 * Калькулятор для расчета объема коробки и параметров
 */

class BoxCalculator {
    constructor() {
        this.boxType = 'sealed';
        this.width = 400;  // мм
        this.height = 300; // мм
        this.depth = 300;  // мм
        this.thickness = 18; // мм
        
        // Параметры порта
        this.portDiameter = 75; // мм
        this.portLength = 150; // мм
        this.usePort = false;
        
        // Параметры щелевого порта
        this.slotWidth = 40; // мм
        this.slotHeight = 100; // мм
        this.slotLength = 100; // мм
        this.useSlotPort = false;
        
        // Параметры динамика
        this.driverDiameter = 165; // мм (6.5 дюймов)
        this.driverCount = 1;
    }

    /**
     * Расчет внутреннего объема коробки
     * @returns {Object} {liters, cm3, inches}
     */
    calculateVolume() {
        // Внутренние размеры = внешние - 2*толщина
        const innerWidth = Math.max(this.width - 2 * this.thickness, 1);
        const innerHeight = Math.max(this.height - 2 * this.thickness, 1);
        const innerDepth = Math.max(this.depth - 2 * this.thickness, 1);
        
        // Объем в см³
        const volumeCm3 = (innerWidth / 10) * (innerHeight / 10) * (innerDepth / 10);
        
        // Вычитаем объем портов, если они используются
        let portVolume = 0;
        
        if (this.usePort) {
            // Объем цилиндра порта
            const portRadiusCm = (this.portDiameter / 2) / 10;
            const portLengthCm = this.portLength / 10;
            portVolume = Math.PI * portRadiusCm * portRadiusCm * portLengthCm;
        }
        
        if (this.useSlotPort) {
            // Объем прямоугольного щелевого порта
            const slotVolumeCm3 = (this.slotWidth / 10) * (this.slotHeight / 10) * (this.slotLength / 10);
            portVolume += slotVolumeCm3;
        }
        
        // Объем динамика (приблизительно как цилиндр)
        let driverVolume = 0;
        const driverRadiusCm = (this.driverDiameter / 2) / 10;
        const driverDepthCm = 5; // примерная глубина динамика
        driverVolume = Math.PI * driverRadiusCm * driverRadiusCm * driverDepthCm * this.driverCount;
        
        const finalVolumeCm3 = Math.max(volumeCm3 - portVolume - driverVolume, 0);
        const volumeLiters = finalVolumeCm3 / 1000;
        const volumeInches = finalVolumeCm3 / 16.387; // 1 дюйм³ = 16.387 см³
        
        return {
            cm3: Math.round(finalVolumeCm3 * 10) / 10,
            liters: Math.round(volumeLiters * 100) / 100,
            inches: Math.round(volumeInches * 10) / 10
        };
    }

    /**
     * Расчет резонансной частоты порта (Helmholtz resonator)
     * @returns {number} Частота в Гц
     */
    calculatePortFrequency() {
        if (!this.usePort) return 0;
        
        const volume = this.calculateVolume().cm3 * 1000; // см³ → мм³
        const portVolume = Math.PI * Math.pow(this.portDiameter / 2, 2) * this.portLength;
        
        // Формула Helmholtz: f = (c / 2π) * sqrt(A / (V * L))
        // где c = 343000 мм/с (скорость звука)
        // A = площадь порта
        // V = объем
        // L = эффективная длина порта
        
        const c = 343000; // скорость звука в мм/с
        const portArea = Math.PI * Math.pow(this.portDiameter / 2, 2);
        const effectiveLength = this.portLength + 1.46 * Math.sqrt(portArea / Math.PI);
        
        const frequency = (c / (2 * Math.PI)) * Math.sqrt(portArea / (volume * effectiveLength));
        
        return Math.round(frequency * 10) / 10;
    }

    /**
     * Получить все параметры как объект
     */
    getParameters() {
        return {
            boxType: this.boxType,
            dimensions: {
                width: this.width,
                height: this.height,
                depth: this.depth,
                thickness: this.thickness
            },
            port: {
                enabled: this.usePort,
                diameter: this.portDiameter,
                length: this.portLength,
                frequency: this.calculatePortFrequency()
            },
            slotPort: {
                enabled: this.useSlotPort,
                width: this.slotWidth,
                height: this.slotHeight,
                length: this.slotLength
            },
            driver: {
                diameter: this.driverDiameter,
                count: this.driverCount
            },
            volume: this.calculateVolume()
        };
    }

    /**
     * Установить параметры из объекта
     */
    setParameters(params) {
        if (params.boxType) this.boxType = params.boxType;
        if (params.dimensions) {
            if (params.dimensions.width) this.width = params.dimensions.width;
            if (params.dimensions.height) this.height = params.dimensions.height;
            if (params.dimensions.depth) this.depth = params.dimensions.depth;
            if (params.dimensions.thickness) this.thickness = params.dimensions.thickness;
        }
        if (params.port) {
            if (params.port.diameter) this.portDiameter = params.port.diameter;
            if (params.port.length) this.portLength = params.port.length;
            if (params.port.enabled !== undefined) this.usePort = params.port.enabled;
        }
        if (params.slotPort) {
            if (params.slotPort.width) this.slotWidth = params.slotPort.width;
            if (params.slotPort.height) this.slotHeight = params.slotPort.height;
            if (params.slotPort.length) this.slotLength = params.slotPort.length;
            if (params.slotPort.enabled !== undefined) this.useSlotPort = params.slotPort.enabled;
        }
        if (params.driver) {
            if (params.driver.diameter) this.driverDiameter = params.driver.diameter;
            if (params.driver.count) this.driverCount = params.driver.count;
        }
    }
}

// Глобальный экземпляр калькулятора
const calculator = new BoxCalculator();