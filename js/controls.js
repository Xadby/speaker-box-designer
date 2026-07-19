/**
 * Управление камерой и интерактивностью
 */

class CameraControls {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.rotation = { x: 0, y: 0 };
        this.zoom = 1;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Мышь
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onMouseWheel(e));
        
        // Сенсорный ввод для мобильных
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            
            // Правая кнопка мыши - сдвиг
            if (e.buttons === 2) {
                this.camera.position.x -= deltaX * 0.5;
                this.camera.position.y += deltaY * 0.5;
            } else {
                // Левая кнопка мыши - вращение
                this.rotation.y += deltaX * 0.01;
                this.rotation.x += deltaY * 0.01;
                
                // Ограничить вращение по X
                this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
                
                this.updateCameraRotation();
            }
            
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    onMouseWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const direction = e.deltaY > 0 ? 1 : -1;
        this.zoom += direction * zoomSpeed;
        this.zoom = Math.max(0.5, Math.min(3, this.zoom));
        
        const distance = 800 / this.zoom;
        const direction3D = this.camera.position.clone().normalize();
        this.camera.position.copy(direction3D.multiplyScalar(distance));
    }

    updateCameraRotation() {
        const distance = this.camera.position.length();
        this.camera.position.x = distance * Math.sin(this.rotation.y) * Math.cos(this.rotation.x);
        this.camera.position.y = distance * Math.sin(this.rotation.x);
        this.camera.position.z = distance * Math.cos(this.rotation.y) * Math.cos(this.rotation.x);
        this.camera.lookAt(0, 0, 0);
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
            const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
            
            this.rotation.y += deltaX * 0.01;
            this.rotation.x += deltaY * 0.01;
            this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
            
            this.updateCameraRotation();
            this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        
        // Pinch to zoom
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            
            if (!this.previousDistance) {
                this.previousDistance = distance;
            } else {
                const delta = distance - this.previousDistance;
                this.zoom -= delta * 0.01;
                this.zoom = Math.max(0.5, Math.min(3, this.zoom));
                
                const dist = 800 / this.zoom;
                const dir = this.camera.position.clone().normalize();
                this.camera.position.copy(dir.multiplyScalar(dist));
                
                this.previousDistance = distance;
            }
        }
    }

    onTouchEnd(e) {
        this.isDragging = false;
        this.previousDistance = null;
    }
}

let cameraControls;
