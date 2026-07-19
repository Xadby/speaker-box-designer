/**
 * Создание геометрии 3D модели коробки
 */

class BoxGeometry {
    /**
     * Создать группу объектов для коробки
     */
    static createBox(width, height, depth, thickness) {
        const group = new THREE.Group();
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.7,
            metalness: 0.1
        });
        
        // Внешняя геометрия
        const outerGeom = new THREE.BoxGeometry(width, height, depth);
        const outerMesh = new THREE.Mesh(outerGeom, material);
        
        // Внутренняя геометрия (для создания полого коробка)
        const innerWidth = Math.max(width - 2 * thickness, 0.1);
        const innerHeight = Math.max(height - 2 * thickness, 0.1);
        const innerDepth = Math.max(depth - 2 * thickness, 0.1);
        
        const innerGeom = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth);
        const innerMesh = new THREE.Mesh(innerGeom, material);
        
        group.add(outerMesh);
        group.add(innerMesh);
        
        // Установить позицию для булевой операции
        return group;
    }

    /**
     * Создать цилиндрический порт
     */
    static createPort(diameter, length, position = 'front') {
        const radius = diameter / 2;
        const geometry = new THREE.CylinderGeometry(radius, radius, length, 32);
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.5,
            metalness: 0.3
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.z = Math.PI / 2; // Повернуть на 90 градусов
        
        // Позиционирование в зависимости от placement
        switch (position) {
            case 'front':
                mesh.position.z = length / 2;
                break;
            case 'back':
                mesh.position.z = -length / 2;
                break;
            case 'side':
                mesh.position.x = length / 2;
                break;
        }
        
        return mesh;
    }

    /**
     * Создать щелевой порт
     */
    static createSlotPort(width, height, length, position = 'front') {
        const geometry = new THREE.BoxGeometry(width, height, length);
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.5,
            metalness: 0.3
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Позиционирование
        switch (position) {
            case 'front':
                mesh.position.z = length / 2;
                break;
            case 'back':
                mesh.position.z = -length / 2;
                break;
            case 'side':
                mesh.position.x = length / 2;
                break;
        }
        
        return mesh;
    }

    /**
     * Создать динамик
     */
    static createDriver(diameter, position = 'front') {
        const group = new THREE.Group();
        
        const radius = diameter / 2;
        
        // Конус динамика
        const coneGeometry = new THREE.ConeGeometry(radius * 0.8, radius * 0.6, 32);
        const coneMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.8,
            metalness: 0
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.z = radius * 0.3;
        
        // Краска/обод динамика
        const rimGeometry = new THREE.TorusGeometry(radius, radius * 0.15, 32, 32);
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.6,
            metalness: 0.4
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        
        group.add(cone);
        group.add(rim);
        
        // Позиционирование
        switch (position) {
            case 'front':
                group.position.z = radius * 0.3;
                break;
            case 'back':
                group.position.z = -radius * 0.3;
                group.rotation.y = Math.PI;
                break;
            case 'side':
                group.position.x = radius * 0.3;
                group.rotation.y = Math.PI / 2;
                break;
        }
        
        return group;
    }

    /**
     * Создать сетку для фона
     */
    static createGridHelper() {
        const size = 2000;
        const divisions = 20;
        const gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0xcccccc);
        return gridHelper;
    }
}
