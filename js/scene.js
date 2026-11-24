/**
 * 3D-сцена: рендерер, камера, освещение и построение модели корпуса по расчёту.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
    setMaxAnisotropy, getFinishMaterial, getConeMaterial, getBasicMaterial, getGrilleMaterial
} from './textures.js';

const MM = 0.001; // сцена в метрах, модель — в миллиметрах

export class SceneView {
    constructor(container) {
        this.container = container;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x20232a);
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
        this.camera.position.set(0.9, 0.7, 1.1);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.screenSpacePanning = true;
        this.controls.maxPolarAngle = Math.PI * 0.495;

        this.setupLights();
        this.setupGround();

        // Модель хранится в миллиметрах, корневая группа масштабирует в метры
        this.root = new THREE.Group();
        this.root.scale.setScalar(MM);
        this.scene.add(this.root);
        this.model = new THREE.Group();
        this.root.add(this.model);
        this.cabinet = new THREE.Group(); // только панели (для STL)

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);
        this.resize();

        this.renderer.setAnimationLoop(() => {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        });
    }

    setupLights() {
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(1.5, 2.5, 2);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.01;
        const cam = key.shadow.camera;
        cam.left = cam.bottom = -2;
        cam.right = cam.top = 2;
        cam.near = 0.1;
        cam.far = 10;
        this.keyLight = key;
        this.scene.add(key);

        const rim = new THREE.DirectionalLight(0xbfd4ff, 0.8);
        rim.position.set(-2, 1.5, -1.5);
        this.scene.add(rim);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 0.35));
    }

    setupGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20),
            new THREE.ShadowMaterial({ opacity: 0.35 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.grid = new THREE.GridHelper(10, 100, 0x4a4f5c, 0x323640);
        this.grid.material.transparent = true;
        this.grid.material.opacity = 0.6;
        this.grid.position.y = -0.0005;
        this.scene.add(this.grid);
    }

    resize() {
        const w = Math.max(this.container.clientWidth, 1);
        const h = Math.max(this.container.clientHeight, 1);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    /** Навести камеру на модель. */
    fit(design) {
        const { w, h, d } = design.outer;
        const radius = Math.sqrt(w * w + h * h + d * d) * MM / 2;
        const target = new THREE.Vector3(0, h * MM / 2, 0);
        const fov = THREE.MathUtils.degToRad(this.camera.fov);
        const dist = Math.max(radius / Math.sin(fov / 2) * 1.15, 0.05);
        const dir = new THREE.Vector3(0.75, 0.55, 1).normalize();
        this.controls.target.copy(target);
        this.camera.position.copy(target).addScaledVector(dir, dist);
        this.camera.near = Math.max(dist / 200, 0.001);
        this.camera.far = dist * 50 + 10;
        this.camera.updateProjectionMatrix();
        this.controls.minDistance = radius * 0.6;
        this.controls.maxDistance = dist * 8;
        this.controls.update();

        // Подогнать тени и сетку под размер модели
        const s = Math.max(radius * 2, 0.3);
        const cam = this.keyLight.shadow.camera;
        cam.left = cam.bottom = -s;
        cam.right = cam.top = s;
        cam.updateProjectionMatrix();
        this.keyLight.position.set(s * 0.8, s * 1.6, s * 1.1);
        const gridScale = Math.max(1, Math.pow(10, Math.ceil(Math.log10(radius * 4))));
        this.grid.scale.setScalar(gridScale / 10);
    }

    /** Перестроить модель по результату computeDesign(). */
    update(design, state) {
        disposeGroup(this.model);
        this.model.clear();
        this.cabinet = new THREE.Group();

        const { h } = design.outer;
        this.model.position.y = h / 2;
        const xray = state.view.xray;

        const panelsById = {};
        design.panels.forEach(panel => {
            panelsById[panel.id] = panel;
            const finish = panel.finish === 'baffle' ? state.finish.baffle : state.finish.body;
            const mesh = buildPanel(panel, getFinishMaterial(finish, xray && !panel.internal));
            if (!mesh) return;
            mesh.castShadow = !xray;
            mesh.receiveShadow = true;
            this.model.add(mesh);
            this.cabinet.add(mesh.clone());
        });

        design.blocks.forEach(block => {
            const panel = panelsById[block.panelId];
            const frame = faceFrame(panel);
            const geo = new THREE.BoxGeometry(block.w, block.h, block.depth);
            const mesh = new THREE.Mesh(geo, getFinishMaterial(state.finish.body, false));
            mesh.position.set(block.x, block.y, -panel.t - block.depth / 2);
            frame.add(mesh);
            frame.updateMatrixWorld(true);
            this.model.add(frame);
            const clone = mesh.clone();
            clone.applyMatrix4(frame.matrix);
            this.cabinet.add(clone);
        });

        design.drivers.forEach(drv => {
            const panel = panelsById[drv.panelId];
            const frame = faceFrame(panel);
            const driver = buildDriver(drv.d, state.driver.cone, state.finish.grille && !panel.internal);
            driver.position.set(drv.x, drv.y, 0);
            frame.add(driver);
            this.model.add(frame);
        });

        design.ports.forEach(port => {
            const panel = panelsById[port.panelId];
            const frame = faceFrame(panel);
            const tube = buildPort(port.d, panel.t + port.renderInside);
            tube.position.set(port.x, port.y, 0);
            frame.add(tube);
            this.model.add(frame);
        });

        if (state.view.dims) this.model.add(buildDimensions(design));
        this.model.updateMatrixWorld(true);
    }

    screenshot() {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }

    /** Группа с геометрией корпуса (мм) для экспорта STL. */
    getCabinetForExport() {
        const group = this.cabinet.clone();
        group.updateMatrixWorld(true);
        return group;
    }
}

// ---------- Построение геометрии ----------

/** Группа с системой координат панели: начало — центр внешней поверхности, ось Z — наружу. */
function faceFrame(panel) {
    const group = new THREE.Group();
    const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...panel.u), new THREE.Vector3(...panel.v), new THREE.Vector3(...panel.n)
    );
    const pos = new THREE.Vector3(...panel.center).addScaledVector(new THREE.Vector3(...panel.n), panel.t / 2);
    m.setPosition(pos);
    group.applyMatrix4(m);
    return group;
}

function buildPanel(panel, material) {
    if (panel.w <= 0 || panel.h <= 0 || panel.t <= 0) return null;
    const hw = panel.w / 2, hh = panel.h / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();
    panel.holes.forEach(hole => {
        const path = new THREE.Path();
        if (hole.type === 'circle') {
            path.absarc(hole.x, hole.y, hole.r, 0, Math.PI * 2, true);
        } else {
            const x0 = hole.x - hole.w / 2, y0 = hole.y - hole.h / 2;
            path.moveTo(x0, y0);
            path.lineTo(x0, y0 + hole.h);
            path.lineTo(x0 + hole.w, y0 + hole.h);
            path.lineTo(x0 + hole.w, y0);
            path.closePath();
        }
        shape.holes.push(path);
    });
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: panel.t, bevelEnabled: false, curveSegments: 48
    });
    // z: 0 — внутренняя поверхность, t — внешняя
    const mesh = new THREE.Mesh(geo, material);
    const frame = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...panel.u), new THREE.Vector3(...panel.v), new THREE.Vector3(...panel.n)
    );
    const origin = new THREE.Vector3(...panel.center).addScaledVector(new THREE.Vector3(...panel.n), -panel.t / 2);
    frame.setPosition(origin);
    mesh.applyMatrix4(frame);
    mesh.name = panel.id;
    return mesh;
}

/** Динамик, смотрящий вдоль +Z; плоскость фланца — z = 0. */
function buildDriver(diameter, cone, grille) {
    const R = diameter / 2;
    const group = new THREE.Group();
    const lathe = (points, material, segments = 64) => {
        const geo = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), segments);
        geo.rotateX(Math.PI / 2);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    };

    // Фланец (корзина)
    const flangeH = Math.max(R * 0.04, 1.5);
    group.add(lathe([
        [R * 0.84, 0], [R, 0], [R, flangeH * 0.7], [R * 0.97, flangeH], [R * 0.84, flangeH]
    ], getBasicMaterial('frame')));

    // Подвес (резиновый тороид)
    const surround = [];
    const sIn = R * 0.7, sOut = R * 0.84, sMid = (sIn + sOut) / 2, sR = (sOut - sIn) / 2;
    for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (1 - i / 16);
        surround.push([sMid + Math.cos(a) * sR, flangeH + Math.sin(a) * sR * 0.9]);
    }
    group.add(lathe(surround, getBasicMaterial('rubber')));

    // Диффузор
    const coneDepth = R * 0.32;
    const conePts = [];
    for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        const r = lerp(sIn, R * 0.26, k);
        const z = flangeH - coneDepth * Math.pow(k, 0.8);
        conePts.push([r, z]);
    }
    group.add(lathe(conePts.reverse(), getConeMaterial(cone)));

    // Пылезащитный колпачок
    const capR = R * 0.27;
    const capBase = flangeH - coneDepth;
    const capPts = [];
    for (let i = 0; i <= 10; i++) {
        const a = (Math.PI / 2) * (i / 10);
        capPts.push([Math.cos(a) * capR + 0.01, capBase + Math.sin(a) * capR * 0.45]);
    }
    group.add(lathe(capPts.reverse(), getConeMaterial(cone)));

    // Магнитная система (видна в режиме «рентген»)
    const magnetR = R * 0.45;
    const magnetH = R * 0.3;
    const magnet = new THREE.Mesh(new THREE.CylinderGeometry(magnetR, magnetR, magnetH, 48), getBasicMaterial('magnet'));
    magnet.rotation.x = Math.PI / 2;
    magnet.position.z = capBase - R * 0.1 - magnetH / 2;
    group.add(magnet);

    // Винты крепления
    const screwCount = R > 60 ? 8 : 4;
    const screwR = Math.max(R * 0.025, 1.2);
    const screwGeo = new THREE.CylinderGeometry(screwR, screwR, flangeH * 0.6, 12);
    screwGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < screwCount; i++) {
        const a = (i / screwCount) * Math.PI * 2 + Math.PI / screwCount;
        const screw = new THREE.Mesh(screwGeo, getBasicMaterial('chrome'));
        screw.position.set(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, flangeH * 1.2);
        group.add(screw);
    }

    if (grille) {
        const grilleMat = getGrilleMaterial();
        const pitch = Math.max(R / 40, 2.5);
        grilleMat.alphaMap.repeat.set((R * 2) / (pitch * 4), (R * 2) / (pitch * 4));
        const domeH = R * 0.08;
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const k = i / 16;
            pts.push([R * 0.93 * (1 - k) + 0.01, flangeH + R * 0.12 + domeH * Math.sin((Math.PI / 2) * k)]);
        }
        const grilleGeo = new THREE.LatheGeometry(pts.reverse().map(([r, z]) => new THREE.Vector2(r, z)), 64);
        grilleGeo.rotateX(Math.PI / 2);
        // Плоская проекция UV, чтобы перфорация была равномерной
        const pos = grilleGeo.attributes.position;
        const uv = grilleGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            uv.setXY(i, pos.getX(i) / (2 * R) + 0.5, pos.getY(i) / (2 * R) + 0.5);
        }
        group.add(new THREE.Mesh(grilleGeo, grilleMat));
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(R * 0.95, Math.max(R * 0.035, 1.5), 12, 64),
            getBasicMaterial('frame')
        );
        ring.position.z = flangeH + R * 0.1;
        group.add(ring);
    }
    return group;
}

/** Порт-труба вдоль −Z от внешней поверхности, с раструбом снаружи. */
function buildPort(diameter, length) {
    const r = diameter / 2;
    const group = new THREE.Group();
    const L = Math.max(length, 1);
    const tubeGeo = new THREE.CylinderGeometry(r + 3, r + 3, L, 48, 1, true);
    tubeGeo.rotateX(Math.PI / 2);
    const outer = new THREE.Mesh(tubeGeo, getBasicMaterial('portTube'));
    outer.position.z = -L / 2;
    group.add(outer);
    const innerGeo = new THREE.CylinderGeometry(r, r, L, 48, 1, true);
    innerGeo.rotateX(Math.PI / 2);
    const inner = new THREE.Mesh(innerGeo, getBasicMaterial('portInner'));
    inner.position.z = -L / 2;
    group.add(inner);

    const flare = new THREE.Mesh(new THREE.TorusGeometry(r + 3, Math.max(r * 0.12, 2.5), 16, 64), getBasicMaterial('portTube'));
    flare.position.z = 0.5;
    flare.castShadow = true;
    group.add(flare);
    return group;
}

function buildDimensions(design) {
    const { w, h, d } = design.outer;
    const group = new THREE.Group();
    const off = Math.max(Math.min(w, h, d) * 0.12, 15);
    const material = new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false, transparent: true });
    const tick = off * 0.4;

    const addDim = (a, b, tickDir, labelPos, text) => {
        const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), T = new THREE.Vector3(...tickDir).multiplyScalar(tick);
        const pts = [A, B, A.clone().add(T), A.clone().sub(T), B.clone().add(T), B.clone().sub(T)];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.LineSegments(geo, material);
        line.renderOrder = 10;
        group.add(line);
        const sprite = makeLabel(text, Math.max(Math.min(w, h, d) * 0.09, 12));
        sprite.position.set(...labelPos);
        group.add(sprite);
    };

    const y0 = -h / 2;
    addDim([-w / 2, y0, d / 2 + off], [w / 2, y0, d / 2 + off], [0, 0, 1], [0, y0, d / 2 + off * 2], `${fmt(w)} мм`);
    addDim([-w / 2 - off, -h / 2, d / 2], [-w / 2 - off, h / 2, d / 2], [1, 0, 0], [-w / 2 - off * 2.2, 0, d / 2], `${fmt(h)} мм`);
    addDim([w / 2 + off, y0, d / 2], [w / 2 + off, y0, -d / 2], [1, 0, 0], [w / 2 + off * 2.2, y0, 0], `${fmt(d)} мм`);
    return group;
}

function makeLabel(text, height) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontPx = 64;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    const padding = 18;
    canvas.width = Math.ceil(ctx.measureText(text).width + padding * 2);
    canvas.height = fontPx + padding * 2;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(20, 22, 28, 0.85)';
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 22);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padding, canvas.height / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sprite.scale.set(height * canvas.width / canvas.height, height, 1);
    sprite.renderOrder = 11;
    return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/** Освободить геометрию (материалы кешируются и переиспользуются, кроме меток). */
function disposeGroup(group) {
    group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.isSprite || obj.isLineSegments) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    });
}

const lerp = (a, b, t) => a + (b - a) * t;
const fmt = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
