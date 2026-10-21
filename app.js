import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { ColladaLoader }  from 'three/addons/loaders/ColladaLoader.js';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ═══════════════════════════════════════════════════════════════
   КОНСТАНТЫ
   ═══════════════════════════════════════════════════════════════ */
const MODEL_FILE_DEFAULT = 'model.dae';
let MODEL_FILE = null;
const UNIT_SCALE = 1.0;
const HUMAN_FILE = 'human.glb';

const TEXTURE_LIST = [
  { file: 'con_pine.bmp', name: 'Сосна' },
  { file: 'con_bok.bmp',  name: 'Бук' },
  { file: 'con_ash.bmp',  name: 'Ясень' },
  { file: 'con_oak.bmp',  name: 'Дуб' }
];

const FINISH_CATEGORIES = [
  { key: 'treads',          label: 'Ступени' },
  { key: 'risers',          label: 'Подступенки' },
  { key: 'stringers',       label: 'Тетивы' },
  { key: 'kosour',          label: 'Косоуры' },
  { key: 'welcome_steps',   label: 'Приглас. ступени' },
  { key: 'welcome_risers',  label: 'Приглас. подступенки' },
  { key: 'handrail',        label: 'Поручень' },
   { key: 'bottomrail',      label: 'Подбалясенник' },
  { key: 'baluster',        label: 'Балясины' },
  { key: 'posts',           label: 'Столбы' },
  { key: 'covering',        label: 'Панель перекрытия' }
];

/* ═══════════════════════════════════════════════════════════════
   DOM-ССЫЛКИ
   ═══════════════════════════════════════════════════════════════ */
const canvas      = document.getElementById('canvas');
const loadingEl   = document.getElementById('loading');
const loadingTxt  = document.getElementById('loadingText');
const toastEl     = document.getElementById('toast');
const infoEl      = document.getElementById('info');
const panelEl     = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
const fileInput   = document.getElementById('fileInput');
const progress    = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const rulerHint   = document.getElementById('rulerHint');
const humanHint   = document.getElementById('humanHint');
const heightSlider= document.getElementById('heightSlider');
const heightValue = document.getElementById('heightValue');
const rotationSlider = document.getElementById('rotationSlider');
const rotationValue  = document.getElementById('rotationValue');
const finishRows  = document.getElementById('finishRows');

const floatRuler         = document.getElementById('floatRuler');
const floatHuman         = document.getElementById('floatHuman');
const floatHeightSlider  = document.getElementById('floatHeightSlider');
const floatHeightValue   = document.getElementById('floatHeightValue');
const floatRotationSlider= document.getElementById('floatRotationSlider');
const floatRotationValue = document.getElementById('floatRotationValue');

const priceOverlay   = document.getElementById('priceModalOverlay');
const priceBody      = document.getElementById('priceModalBody');
const priceSubtitle  = document.getElementById('priceModalSubtitle');
const priceBtn       = document.getElementById('btnPrice');

const paramsOverlay  = document.getElementById('paramsModalOverlay');
const paramsBody     = document.getElementById('paramsModalBody');
const paramsSubtitle = document.getElementById('paramsModalSubtitle');

const orderOverlay   = document.getElementById('orderModalOverlay');
const orderBody      = document.getElementById('orderModalBody');
const orderSubtitle  = document.getElementById('orderModalSubtitle');

const ui = {
  file:   document.getElementById('iFile'),
  meshes: document.getElementById('iMeshes'),
  verts:  document.getElementById('iVerts'),
  tris:   document.getElementById('iTris'),
  size:   document.getElementById('iSize'),
  anims:  document.getElementById('iAnims'),
  animRow:document.getElementById('animRow'),
};

function isMobile() { return window.matchMedia('(max-width:640px)').matches; }

/* ═══════════════════════════════════════════════════════════════
   РЕНДЕРЕР / СЦЕНА / СВЕТ
   ═══════════════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

scene.background = new THREE.Color('#0f1116');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(4, 3, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.9;
controls.panSpeed = 0.8;
controls.zoomSpeed = 1.0;
controls.screenSpacePanning = true;
controls.autoRotateSpeed = 1.6;

controls.addEventListener('start', () => {
  if (isMobile() && panelEl.classList.contains('open')) {
    panelEl.classList.remove('open');
    panelToggle.classList.remove('active');
  }
});

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2f3a, 1.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 9, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.DirectionalLight(0xa8c4ff, 0.9);
fillLight.position.set(-7, 4, -6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(0, -6, -4);
scene.add(rimLight);

/* ---------- Сетка ---------- */
let gridHelper = null;
let gridVisible = false;

function buildGrid(radius, yPos) {
  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
  }
  const size = Math.max(radius * 6, 1);
  gridHelper = new THREE.GridHelper(size, 20, 0x4a5568, 0x272c37);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.55;
  gridHelper.material.depthWrite = false;
  gridHelper.position.y = yPos;
  gridHelper.visible = gridVisible;
  scene.add(gridHelper);
}

/* ═══════════════════════════════════════════════════════════════
   СОСТОЯНИЕ
   ═══════════════════════════════════════════════════════════════ */
let currentModel = null;
let currentMixer = null;
let objectUrls   = [];
const fileMap    = new Map();

const elementGroups = {
  // Лестница 1→2
  s1_treads: [], s1_risers: [], s1_stringers: [], s1_kosour: [],
  s1_welcome_steps: [], s1_welcome_risers: [],
  s1_handrail: [], s1_baluster: [], s1_posts: [], s1_covering: [],
  // Лестница 2→3
  s2_treads: [], s2_risers: [], s2_stringers: [], s2_kosour: [],
  s2_welcome_steps: [], s2_welcome_risers: [],
  s2_handrail: [], s2_baluster: [], s2_posts: [], s2_covering: [],
  // Ограждение 2 этажа
  r2_posts: [], r2_handrail: [], r2_bottomrail: [], r2_baluster: [],
  // Ограждение 3 этажа
  r3_posts: [], r3_handrail: [], r3_bottomrail: [], r3_baluster: [],
  // Прочее
  wall: [], opening: [], floor: [],
};

const elementVisible = {
  s1_treads: true, s1_risers: true, s1_stringers: true, s1_kosour: true,
  s1_welcome_steps: true, s1_welcome_risers: true,
  s1_handrail: true, s1_baluster: true, s1_posts: true, s1_covering: true,

  s2_treads: true, s2_risers: true, s2_stringers: true, s2_kosour: true,
  s2_welcome_steps: true, s2_welcome_risers: true,
  s2_handrail: true, s2_baluster: true, s2_posts: true, s2_covering: true,

  r2_posts: true, r2_handrail: true, r2_bottomrail: true, r2_baluster: true,

  r3_posts: true, r3_handrail: true, r3_bottomrail: true, r3_baluster: true,

  wall: true, opening: true, floor: true,
};

let glassWalls = true;
const WALL_OPACITY    = 0.15;
const WINDOW_OPACITY  = 0.55;

const textureCache = new Map();
const texLoader = new THREE.TextureLoader();

function getTexture(file) {
  if (textureCache.has(file)) return textureCache.get(file);
  const tex = texLoader.load(file);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(file, tex);
  return tex;
}

const originalMaterialState = new Map();

const currentFinish = {
  treads: null, risers: null, stringers: null, kosour: null,
  welcome_steps: null, welcome_risers: null,
  handrail: null, baluster: null, posts: null, covering: null,
};
// Список из 12 цветов (пока заглушки, потом настроим оттенки)
const COLOR_PALETTE = [
  { key: 'clear',   name: 'Лак б/ц',        hex: '#ffffff' },
  { key: 'light',   name: 'Светлый дуб',    hex: '#e6d5b8' },
  { key: 'dark',    name: 'Тёмный орех',    hex: '#5c3a21' },
  { key: 'redwood', name: 'Красное дерево', hex: '#8b1a1a' },
  { key: 'mocha',   name: 'Мокко',          hex: '#6f4e37' },
  { key: 'wenge',   name: 'Венге',          hex: '#3b2b2b' },
  { key: 'honey',   name: 'Медовый',        hex: '#d4a373' },
  { key: 'ash',     name: 'Ясень',          hex: '#f5deb3' },
  { key: 'black',   name: 'Черный',         hex: '#1a1a1a' },
  { key: 'gray',    name: 'Серый',          hex: '#808080' },
  { key: 'white',   name: 'Белый',          hex: '#ffffff' }
];

let paintEnabled = true; // Глобальный флаг покраски

const currentColor = {
  treads: null, risers: null, stringers: null, kosour: null,
  welcome_steps: null, welcome_risers: null,
  handrail: null, baluster: null, posts: null, covering: null,
};
/* ---------- Данные ---------- */
let bomData = null;       // обратная совместимость (первый XML)
  let priceData = null;
let bomGroups = [];       // массив всех XML с этажами

/* ---------- Точки для привязки линейки ---------- */
const allVertices = [];

/* ═══════════════════════════════════════════════════════════════
   КЛАССИФИКАЦИЯ МАТЕРИАЛОВ (для 3D-визуализации)
   ═══════════════════════════════════════════════════════════════ */
function classifyMaterial(str) {
  if (!str) return null;
  const n = str.toUpperCase();

  // 1. Свободный столб ограждения этажа (N_P1)
  let m = n.match(/^([123])_P\d/i);
  if (m) return 'r' + m[1] + '_posts';

  // 2. Поручень ограждения этажа (N_HRFR...)
  m = n.match(/^([123])_HRFR/i);
  if (m) return 'r' + m[1] + '_handrail';

  // 3. Подбалясенник ограждения этажа (N_BRFR...)
  m = n.match(/^([123])_BRFR/i);
  if (m) return 'r' + m[1] + '_bottomrail';

  // 4. Балясины ограждения этажа (N_Ba1FR11...)
  m = n.match(/^([123])_BA\d*FR/i);
  if (m) return 'r' + m[1] + '_baluster';

  // 5. Столбы лестницы (SP1-2L, StPR, EnPR)
  m = n.match(/^([12])_(SP|STPR|ENPR)/i);
  if (m) return 's' + m[1] + '_posts';

  // 6. Тетива лестницы (St1L, St2R)
  m = n.match(/^([12])_ST/i);
  if (m) return 's' + m[1] + '_stringers';

  // 7. Ступени
  m = n.match(/^([12])_TR/i);
  if (m) return 's' + m[1] + '_treads';

  // 8. Подступенки
  m = n.match(/^([12])_RI/i);
  if (m) return 's' + m[1] + '_risers';

  // 9. Поручень лестницы (HRR)
  m = n.match(/^([12])_HRR/i);
  if (m) return 's' + m[1] + '_handrail';

  // 10. Балясины лестницы (Ba1R1R)
  m = n.match(/^([12])_BA/i);
  if (m) return 's' + m[1] + '_baluster';

  // 11. Обшивка проёма
  m = n.match(/^([12])_FC/i);
  if (m) return 's' + m[1] + '_covering';

  // 12. Наконечники столбов (Post cap)
  m = n.match(/^([12])_POST CAP/i);
  if (m) return 's' + m[1] + '_post_caps';

  // Старый фоллбэк по материалу
  if (n.includes('TREAD'))         return 's1_treads';
  if (n.includes('RISER'))         return 's1_risers';
  if (n.includes('STRING'))        return 's1_stringers';
  if (n.includes('HANDRAIL'))      return 's1_handrail';
  if (n.includes('BOTTOMRAIL'))    return 'r2_bottomrail';
  if (n.includes('BALUSTER'))      return 's1_baluster';
  if (n.includes('POST'))          return 's1_posts';
  if (n.includes('BEGIN_WALL'))    return 'wall';
  if (n.includes('BEGIN_OPENING')) return 's1_covering';
  if (n.includes('PARKETT'))       return 'floor';
  if (n.includes('ASH'))           return 'floor';
  if (n.includes('OBJECT3D'))      return 'floor';
  return null;
}

function isWindowTexture(matName) {
  if (!matName) return false;
  return matName.toLowerCase().includes('window');
}

/* ═══════════════════════════════════════════════════════════════
   LoadingManager
   ═══════════════════════════════════════════════════════════════ */
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const decoded = decodeURIComponent(url).split('?')[0].split('#')[0];
  const base = decoded.split('/').pop().toLowerCase();
  if (fileMap.has(base)) return fileMap.get(base);
  if (fileMap.has(decoded.toLowerCase())) return fileMap.get(decoded.toLowerCase());
  return url;
});

/* ═══════════════════════════════════════════════════════════════
   УТИЛИТЫ
   ═══════════════════════════════════════════════════════════════ */
function showProgress(v) {
  if (v <= 0 || v >= 100) { progress.classList.remove('show'); return; }
  progress.classList.add('show');
  progressBar.style.width = v + '%';
}
function setLoading(show, text) {
  if (text) loadingTxt.textContent = text;
  loadingEl.classList.toggle('show', show);
}
let toastTimer = null;
function showToast(msg, ok = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('ok', ok);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4000);
}
const fmtInt = (n) => new Intl.NumberFormat('ru-RU').format(n);
function fmtNum(v) {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}
function formatRub(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
}
function disposeObject(root) {
  const textures = new Set();
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      for (const key in m) { const v = m[key]; if (v && v.isTexture) textures.add(v); }
      m.dispose();
    });
  });
  textures.forEach(t => t.dispose());
}
function findNearestVertex(point, radius) {
  let bestDist = radius;
  let bestVert = null;
  for (let i = 0; i < allVertices.length; i++) {
    const d = point.distanceTo(allVertices[i]);
    if (d < bestDist) { bestDist = d; bestVert = allVertices[i]; }
  }
  return bestVert;
}

/* ═══════════════════════════════════════════════════════════════
   OBB / ПЛОЩАДЬ ПОВЕРХНОСТИ
   ═══════════════════════════════════════════════════════════════ */
function computeOBB(vs) {
  if (!vs || vs.length < 4) return null;
  const c = new THREE.Vector3();
  vs.forEach(v => c.add(v));
  c.divideScalar(vs.length);

  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  vs.forEach(v => {
    const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
    xx += dx * dx; xy += dx * dy; xz += dx * dz;
    yy += dy * dy; yz += dy * dz; zz += dz * dz;
  });
  const M = [xx, xy, xz, yy, yz, zz];

  function mulM(v) {
    return new THREE.Vector3(
      M[0] * v.x + M[1] * v.y + M[2] * v.z,
      M[1] * v.x + M[3] * v.y + M[4] * v.z,
      M[2] * v.x + M[4] * v.y + M[5] * v.z
    );
  }
  let v1 = new THREE.Vector3(1, 0.5, 0.3).normalize();
  for (let i = 0; i < 100; i++) {
    v1 = mulM(v1);
    if (v1.length() < 1e-12) break;
    v1.normalize();
  }
  const lam1 = v1.dot(mulM(v1));
  const M2 = [
    M[0] - lam1 * v1.x * v1.x, M[1] - lam1 * v1.x * v1.y, M[2] - lam1 * v1.x * v1.z,
    M[3] - lam1 * v1.y * v1.y, M[4] - lam1 * v1.y * v1.z,
    M[5] - lam1 * v1.z * v1.z
  ];
  function mulM2(v) {
    return new THREE.Vector3(
      M2[0] * v.x + M2[1] * v.y + M2[2] * v.z,
      M2[1] * v.x + M2[3] * v.y + M2[4] * v.z,
      M2[2] * v.x + M2[4] * v.y + M2[5] * v.z
    );
  }
  let v2 = new THREE.Vector3(0, 1, 0);
  if (Math.abs(v1.dot(v2)) > 0.9) v2.set(1, 0, 0);
  v2.sub(v1.clone().multiplyScalar(v2.dot(v1))).normalize();
  for (let i = 0; i < 100; i++) {
    v2 = mulM2(v2);
    v2.sub(v1.clone().multiplyScalar(v2.dot(v1)));
    if (v2.length() < 1e-12) break;
    v2.normalize();
  }
  const v3 = new THREE.Vector3().crossVectors(v1, v2).normalize();

  let min1 = Infinity, max1 = -Infinity;
  let min2 = Infinity, max2 = -Infinity;
  let min3 = Infinity, max3 = -Infinity;
  vs.forEach(v => {
    const d = v.clone().sub(c);
    const p1 = d.dot(v1), p2 = d.dot(v2), p3 = d.dot(v3);
    if (p1 < min1) min1 = p1; if (p1 > max1) max1 = p1;
    if (p2 < min2) min2 = p2; if (p2 > max2) max2 = p2;
    if (p3 < min3) min3 = p3; if (p3 > max3) max3 = p3;
  });
  const d1 = max1 - min1, d2 = max2 - min2, d3 = max3 - min3;
  const dims = [d1, d2, d3].sort((a, b) => b - a);
  return { area: dims[0] * dims[1], length: dims[0], volume: d1 * d2 * d3 };
}

function meshSurfaceArea(obj) {
  const geo = obj.geometry;
  if (!geo) return 0;
  const pos = geo.attributes.position;
  if (!pos) return 0;
  let total = 0;
  const idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      total += new THREE.Vector3().subVectors(b, a)
              .cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      total += new THREE.Vector3().subVectors(b, a)
              .cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
    }
  }
  return total;
}

const meshAnalysisCache = new WeakMap();
function getMeshAnalysis(obj) {
  if (meshAnalysisCache.has(obj)) return meshAnalysisCache.get(obj);
  const geo = obj.geometry;
  if (!geo || !geo.attributes.position) return null;
  const pos = geo.attributes.position;
  obj.updateMatrixWorld(true);
  const vs = [];
  for (let i = 0; i < pos.count; i++) {
    vs.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
  }
  const obb = computeOBB(vs);
  if (!obb) { meshAnalysisCache.set(obj, null); return null; }
  const res = { obbArea: obb.area, obbLength: obb.length, obbVolume: obb.volume, surface: meshSurfaceArea(obj) };
  meshAnalysisCache.set(obj, res);
  return res;
}

/* ═══════════════════════════════════════════════════════════════
   ПАРСЕР XML (BOM + параметры)
   ═══════════════════════════════════════════════════════════════ */
function getAttr(node, name) {
  if (!node) return '';
  const attrs = node.querySelectorAll('attribute');
  for (let i = 0; i < attrs.length; i++) {
    if (attrs[i].getAttribute('name') === name) {
      return attrs[i].getAttribute('value') || '';
    }
  }
  return '';
}

function parseBOM(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const result = { items: [], params: {} };

  const q = (sel) => xml.querySelector(sel);
  const txt = (sel) => { const n = q(sel); return n ? n.textContent.trim() : null; };
  const num = (sel) => { const v = txt(sel); return v != null ? parseFloat(v) : null; };

  result.params = {
    ceiling:       num('ceiling'),
    floorheight:   num('floorheight'),
    floorthick:    num('floorthickness'),
    headroom:      num('headroom'),
    rise:          num('rise'),
    going:         num('going'),
    recalcGoing:   txt('recalculatedgoing'),
    numRisers:     num('numberofrisers'),
    widths:        num('widths'),
    pitch:         txt('pitch'),
    railingHeight: txt('railing > height'),
    handrailDim:   txt('handrail > dim'),
    balusterDim:   txt('baluster > dim'),
    newelName:     txt('newel > name'),
        floorName:     txt('floor > name'),
  };

  const details = xml.querySelectorAll('detail');
  details.forEach((d) => {
    const nameAttr = d.getAttribute('name') || '';
    const typeNode = d.querySelector('type');
    const typeId = typeNode ? typeNode.getAttribute('id') : '';
    if (!typeId || typeId === 'Bolt') return;

    const dim = d.querySelector('dim');
    if (!dim) return;

    const T = parseFloat(dim.querySelector('thickness')?.textContent) || 0;
    const W = parseFloat(dim.querySelector('width')?.textContent) || 0;
    const L = parseFloat(dim.querySelector('length')?.textContent) || 0;
    if (!L) return;

    const matNode = d.querySelector('material');
    const mat = matNode ? (matNode.textContent || '').trim() : '';

    const subtype    = getAttr(d, 'subtype');
    const stringtype = getAttr(d, 'stringtype');

    result.items.push({ name: nameAttr, type: typeId, T, W, L, mat, subtype, stringtype });
  });

  return result;
}

async function loadBOM() {
  bomGroups = [];

  // 1. Ищем все .xml через GitHub API
  let xmlFiles = [];
  try {
    const parts = location.pathname.split('/').filter(x => x);
    const owner = location.hostname.split('.')[0];
    const repo = parts[0];
    if (owner && repo) {
      const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/');
      if (r.ok) {
        const files = await r.json();
        xmlFiles = files
          .filter(f => f.name && f.name.toLowerCase().endsWith('.xml'))
          .map(f => f.name);
      }
    }
  } catch (e) {
    console.warn('GitHub API не сработал:', e.message);
  }

  // 2. Fallback: если API не сработал, попробовать стандартный путь
  if (!xmlFiles.length && MODEL_FILE) {
    const fallback = MODEL_FILE.replace(/\.(dae|xml)$/i, '.xml');
    try {
      const r = await fetch(fallback, { method: 'HEAD' });
      if (r.ok) xmlFiles = [fallback];
    } catch (e) { /* ignore */ }
  }

  if (!xmlFiles.length) {
    console.log('XML не найдены');
    return;
  }

  console.log('%c→ Найдено XML: ' + xmlFiles.length, 'color:#5b8cff;font-weight:bold');

  // 3. Парсим каждый
  for (const name of xmlFiles) {
    try {
      const r = await fetch(name, { cache: 'no-store' });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      const decoder = new TextDecoder('windows-1252');
      const text = decoder.decode(buf);
      const parsed = parseBOM(text);

      // Определяем этаж из params.floorName
      let floor = 1;
      if (parsed.params && parsed.params.floorName) {
        const m = parsed.params.floorName.match(/(\d+)/);
        if (m) floor = parseInt(m[1], 10);
      }

      bomGroups.push({
        file: name,
        floor: floor,
        params: parsed.params,
        items: parsed.items
      });

      console.log('%c✔ ' + name + ' (этаж ' + floor + ', ' + parsed.items.length + ' деталей)',
                  'color:#31d0aa;font-weight:bold');
    } catch (err) {
      console.warn('Ошибка чтения ' + name + ':', err.message);
    }
  }

  // 4. Сортируем по этажу
  bomGroups.sort((a, b) => a.floor - b.floor);

  // 5. Обратная совместимость: bomData = первый XML
  if (bomGroups.length) {
    bomData = { items: bomGroups[0].items, params: bomGroups[0].params };
  }
}

/* ═══════════════════════════════════════════════════════════════
   АВТОПОИСК DAE В РЕПОЗИТОРИИ
   ═══════════════════════════════════════════════════════════════ */
async function findModelFile() {
  try {
    const r = await fetch(MODEL_FILE_DEFAULT, { method: 'HEAD' });
    if (r.ok) {
      console.log('%c✔ Найден ' + MODEL_FILE_DEFAULT, 'color:#31d0aa;font-weight:bold');
      return MODEL_FILE_DEFAULT;
    }
  } catch (e) { /* ignore */ }

  try {
    const parts = location.pathname.split('/').filter(x => x);
    const owner = location.hostname.split('.')[0];
    const repo = parts[0];
    if (!owner || !repo) throw new Error('owner/repo не определены');

    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/');
    if (!r.ok) throw new Error('GitHub API: HTTP ' + r.status);

    const files = await r.json();
    const dae = files.find(f => f.name && f.name.toLowerCase().endsWith('.dae'));
    if (dae) {
      console.log('%c✔ Найден в репозитории: ' + dae.name, 'color:#31d0aa;font-weight:bold');
      return dae.name;
    }
  } catch (e) {
    console.warn('Автопоиск через API не сработал:', e.message);
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   ЗАГРУЗКА МОДЕЛИ
   ═══════════════════════════════════════════════════════════════ */
function loadCollada(url, fileName) {
  setLoading(true, 'Загрузка «' + fileName + '»…');
  showProgress(5);

  for (const k in elementGroups) elementGroups[k] = [];
  allVertices.length = 0;
  originalMaterialState.clear();
  while (openingDimsGroup.children.length) {
    const c = openingDimsGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
  openingDimsVisible = false;
  const btnDims = document.getElementById('btnShowOpeningDims');
  if (btnDims) btnDims.classList.remove('active');
  const loader = new ColladaLoader(manager);
  loader.load(url,
    (collada) => {
      setLoading(false);
      showProgress(0);
      const model = collada.scene;
      if (!model) { showToast('Файл не содержит сцены'); return; }

      if (currentModel) {
        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
      }
      if (currentMixer) { currentMixer.stopAllAction(); currentMixer = null; }

      let meshCount = 0, vertCount = 0, triCount = 0;
      const seenGeom = new Set();

      model.traverse((obj) => {
        if (!obj.isMesh && !obj.isSkinnedMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;

        if (obj.geometry && !seenGeom.has(obj.geometry)) {
          seenGeom.add(obj.geometry);
          const g = obj.geometry;
          const pos = g.attributes.position;
          if (pos) vertCount += pos.count;
          triCount += g.index ? g.index.count / 3 : (pos ? pos.count / 3 : 0);
        }
        meshCount++;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!m) return;
          ['map','emissiveMap','specularMap','normalMap','aoMap','alphaMap'].forEach((k) => {
            if (m[k] && m[k].isTexture) {
              if (k === 'map' || k === 'emissiveMap') m[k].colorSpace = THREE.SRGBColorSpace;
              m[k].anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
          });
          m.needsUpdate = true;
        });

               const matName = mats[0] && mats[0].name ? mats[0].name : '';
        const objName = obj.name || (obj.parent && obj.parent.name) || '';
        const group = classifyMaterial(objName) || classifyMaterial(matName);
                if (group) {
          if (!elementGroups[group]) elementGroups[group] = [];
          elementGroups[group].push(obj);
          if (group === 'wall' && isWindowTexture(matName)) obj.userData.isWindow = true;
        }

        mats.forEach((m) => {
          if (!m) return;
          originalMaterialState.set(obj.uuid, {
            map: m.map || null,
            color: m.color ? m.color.getHex() : 0xffffff
          });
        });
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) { showToast('Модель не содержит геометрии'); return; }

      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);

      const v = new THREE.Vector3();
      const seenPos = new Set();
      model.traverse((obj) => {
        if (!obj.isMesh && !obj.isSkinnedMesh) return;
        const g = obj.geometry;
        if (!g || !g.attributes || !g.attributes.position) return;
        const pos = g.attributes.position;
        obj.updateMatrixWorld();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
          const key = v.x.toFixed(3) + '|' + v.y.toFixed(3) + '|' + v.z.toFixed(3);
          if (!seenPos.has(key)) { seenPos.add(key); allVertices.push(v.clone()); }
        }
      });

      const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
      const r = Math.max(sphere.radius, 0.0001);

      const sc = keyLight.shadow.camera;
      sc.left = -r * 1.6; sc.right = r * 1.6;
      sc.top = r * 1.6; sc.bottom = -r * 1.6;
      sc.near = r * 0.05; sc.far = r * 30;
      sc.updateProjectionMatrix();
      keyLight.position.copy(new THREE.Vector3(1, 1.7, 1).normalize().multiplyScalar(r * 6));
      keyLight.target.position.set(0, 0, 0);
      keyLight.target.updateMatrixWorld();

      buildGrid(r, -size.y / 2);

      const clips = collada.animations || [];
      if (clips.length) {
        currentMixer = new THREE.AnimationMixer(model);
        clips.forEach((clip) => {
          const a = currentMixer.clipAction(clip);
          a.setLoop(THREE.LoopRepeat, Infinity);
          a.play();
        });
      }

      currentModel = model;
      scene.add(currentModel);

      applyElementVisibility();
      applyGlassWalls();
      setHumanHeight(humanHeight);
      buildFinishPanel();
buildColorPanel();
      const modelName = fileName.replace(/\.(dae|xml)$/i, '');
      if (modelName) {
        document.title = '3D Viewer — ' + modelName;
        priceSubtitle.textContent = modelName;
        paramsSubtitle.textContent = modelName;
        orderSubtitle.textContent = modelName;
      }

      ui.file.textContent   = fileName;
      ui.meshes.textContent = fmtInt(meshCount);
      ui.verts.textContent  = fmtInt(Math.round(vertCount));
      ui.tris.textContent   = fmtInt(Math.round(triCount));
      ui.size.textContent   = fmtNum(size.x) + ' × ' + fmtNum(size.y) + ' × ' + fmtNum(size.z);

      if (clips.length) {
        ui.animRow.style.display = 'flex';
        ui.anims.textContent = fmtInt(clips.length);
      } else {
        ui.animRow.style.display = 'none';
      }

      infoEl.classList.add('show');
      panelEl.classList.remove('hidden');
      fitCamera();

      // показываем кнопки расчёта и бланка
      priceBtn.style.display = 'inline-flex';
      document.getElementById('btnOrder').style.display = 'inline-flex';
    },
    (evt) => {
      if (evt && evt.total) {
        const p = Math.round((evt.loaded / evt.total) * 100);
        showProgress(p);
        setLoading(true, 'Загрузка… ' + p + '%');
      }
    },
    (err) => {
      setLoading(false);
      showProgress(0);
      console.error(err);
      showToast('Ошибка загрузки. Проверьте, что это корректный .dae');
    }
  );
}

/* ═══════════════════════════════════════════════════════════════
   РЕСАЙЗ И ЦИКЛ РЕНДЕРА
   ═══════════════════════════════════════════════════════════════ */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (currentMixer) currentMixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

resize();
animate();

/*  ═══════════════════════════════════════════════════════════════
   ФИТ КАМЕРЫ
   ═══════════════════════════════════════════════════════════════ */
function fitCamera() {
  if (!currentModel) return;
  const box = new THREE.Box3().setFromObject(currentModel);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.0001);
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const zoomFactor = isMobile() ? 0.78 : 1.18;
  const dist = (radius / Math.sin(fovRad / 2)) * zoomFactor;
  const dir = new THREE.Vector3(1, 0.62, 1).normalize();
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.near = Math.max(radius / 500, 0.001);
  camera.far = radius * 800;
  camera.updateProjectionMatrix();
  controls.target.copy(sphere.center);
  controls.minDistance = radius * 0.05;
  controls.maxDistance = radius * 60;
  controls.update();
}

/* ═══════════════════════════════════════════════════════════════
   ЛИНЕЙКА
   ═══════════════════════════════════════════════════════════════ */
let rulerMode = false;
let rulerPoints = [];
const rulerGroup = new THREE.Group();
scene.add(rulerGroup);

const rulerLineMat = new THREE.LineBasicMaterial({ color: 0xff7043 });
const rulerDotMat  = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
const rulerDotGeo  = new THREE.SphereGeometry(0.03, 12, 12);

const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

const snapDotGeo = new THREE.SphereGeometry(0.05, 16, 16);
const snapDotMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
const snapDot = new THREE.Mesh(snapDotGeo, snapDotMat);
snapDot.visible = false;
snapDot.renderOrder = 1000;
scene.add(snapDot);

const SNAP_RADIUS = 0.05;

function setRulerMode(on) {
  rulerMode = on;
  document.getElementById('btnRuler').classList.toggle('ruler-on', on);
  canvas.classList.toggle('ruler-mode', on);
  rulerHint.classList.toggle('show', on);
  floatRuler.classList.toggle('show', on);
  if (on && humanMode) setHumanMode(false);
  if (!on) {
    if (rulerPoints.length === 1) rulerPoints = [];
    snapDot.visible = false;
  }
}

function clearRuler() {
  rulerPoints = [];
  while (rulerGroup.children.length) {
    const c = rulerGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (c.material.map) c.material.map.dispose();
      c.material.dispose();
    }
  }
}

function makeLabelSprite(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const dpr = 2, W = 240, H = 70;
  c.width = W * dpr; c.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = 'rgba(20, 22, 30, 0.92)';
  ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 2;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r); ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H); ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r); ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9f43';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.7, 0.2, 1);
  return sprite;
}

function addMeasurePoint(point) {
  const dot = new THREE.Mesh(rulerDotGeo, rulerDotMat);
  dot.position.copy(point);
  dot.renderOrder = 999;
  rulerGroup.add(dot);
}

function addMeasureLine(p1, p2) {
  const geo = new THREE.BufferGeometry().setFromPoints([p1.clone(), p2.clone()]);
  const line = new THREE.Line(geo, rulerLineMat);
  line.renderOrder = 998;
  rulerGroup.add(line);
}

function formatDistance(distance) {
  return (distance * UNIT_SCALE * 1000).toFixed(0) + ' мм';
}

function handleRulerTap(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!currentModel) return;
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) return;
  let point = hits[0].point.clone();
  const nearVert = findNearestVertex(point, SNAP_RADIUS);
  if (nearVert) point = nearVert.clone();
  rulerPoints.push(point);
  addMeasurePoint(point);
  if (rulerPoints.length === 2) {
    const p1 = rulerPoints[0], p2 = rulerPoints[1];
    addMeasureLine(p1, p2);
    const dist = p1.distanceTo(p2);
    const sprite = makeLabelSprite(formatDistance(dist));
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    sprite.position.copy(mid);
    rulerGroup.add(sprite);
    rulerPoints = [];
  }
}

function handleRulerHover(clientX, clientY) {
  if (!rulerMode || !currentModel) { snapDot.visible = false; return; }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) { snapDot.visible = false; return; }
  const point = hits[0].point.clone();
  const nearVert = findNearestVertex(point, SNAP_RADIUS);
  if (nearVert) {
    snapDot.position.copy(nearVert);
    snapDot.visible = true;
    snapDotMat.color.setHex(0xffd166);
    snapDotMat.opacity = 0.85;
  } else {
    snapDot.position.copy(point);
    snapDot.visible = true;
    snapDotMat.color.setHex(0xffffff);
    snapDotMat.opacity = 0.4;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ЧЕЛОВЕЧЕК
   ═══════════════════════════════════════════════════════════════ */
let humanMode = false;
let humanHeight = 185;
let humanRotation = 0;
const humanGroup = new THREE.Group();
humanGroup.visible = false;
scene.add(humanGroup);

let humanTemplate = null;
let humanTemplateHeight = 1.8;

const humanLoader = new GLTFLoader();
humanLoader.load(HUMAN_FILE, (gltf) => {
  humanTemplate = gltf.scene;
  const box = new THREE.Box3().setFromObject(humanTemplate);
  const size = box.getSize(new THREE.Vector3());
  humanTemplateHeight = size.y > 0.001 ? size.y : 1.8;

  humanTemplate.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true; obj.receiveShadow = true;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.color) m.color.setHex(0xff9f43);
          m.emissive = new THREE.Color(0x3d2408);
          m.emissiveIntensity = 0.15;
          m.needsUpdate = true;
        });
      }
    }
  });
  console.log('%c✔ ' + HUMAN_FILE + ' загружен', 'color:#31d0aa;font-weight:bold');
  if (humanGroup.visible) makeHumanFigure(humanHeight);
}, undefined, (err) => { console.warn('human.glb не загружен:', err); });

function setHumanHeight(cm) {
  humanHeight = cm;
  heightValue.textContent = cm + ' см';
  if (floatHeightValue) floatHeightValue.textContent = cm + ' см';
  makeHumanFigure(cm);
}

function makeHumanFigure(heightCm) {
  while (humanGroup.children.length) {
    const c = humanGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
  }
  const targetH = (heightCm / 100) * UNIT_SCALE;
  if (!humanTemplate) {
    const tempMat = new THREE.MeshStandardMaterial({ color: 0xff9f43, roughness: 0.5 });
    const tempGeo = new THREE.CylinderGeometry(targetH * 0.08, targetH * 0.08, targetH, 12);
    const tempMesh = new THREE.Mesh(tempGeo, tempMat);
    tempMesh.position.y = targetH / 2;
    tempMesh.castShadow = true;
    humanGroup.add(tempMesh);
    humanGroup.userData.topY = targetH;
    return;
  }
  const clone = humanTemplate.clone(true);
  const scale = targetH / humanTemplateHeight;
  clone.scale.setScalar(scale);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  clone.position.y = -box.min.y;
  clone.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  humanGroup.add(clone);
  humanGroup.add(makeHeightLabel(heightCm, targetH));
  humanGroup.userData.topY = targetH;
  humanGroup.rotation.y = (humanRotation * Math.PI) / 180;
}

function makeHeightLabel(text, yPos) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const dpr = 2, W = 200, H = 60;
  c.width = W * dpr; c.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = 'rgba(20, 22, 30, 0.92)';
  ctx.strokeStyle = '#31d0aa'; ctx.lineWidth = 2;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r); ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H); ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r); ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4be0bc';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text + ' см', W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, yPos + 0.15, 0);
  sprite.scale.set(0.55, 0.165, 1);
  return sprite;
}

function setHumanMode(on) {
  humanMode = on;
  document.getElementById('btnHuman').classList.toggle('human-on', on);
  canvas.classList.toggle('human-mode', on);
  humanHint.classList.toggle('show', on);
  if (on && rulerMode) setRulerMode(false);
  // Плавающую плашку показываем только если человечек уже стоит
  floatHuman.classList.toggle('show', on && humanGroup.visible);
}

function placeHuman(clientX, clientY) {
  if (!currentModel) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) return;
  humanGroup.position.copy(hits[0].point.clone());
  humanGroup.visible = true;
  floatHuman.classList.add('show');
}

/* ---------- Указатель ---------- */
let pointerDown = false;
let downX = 0, downY = 0;

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  downX = e.clientX;
  downY = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  pointerDown = false;
  const dx = Math.abs(e.clientX - downX);
  const dy = Math.abs(e.clientY - downY);
  if (dx < 6 && dy < 6) {
    if (rulerMode) handleRulerTap(e.clientX, e.clientY);
    else if (humanMode) placeHuman(e.clientX, e.clientY);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (rulerMode) handleRulerHover(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { snapDot.visible = false; });

/* ═══════════════════════════════════════════════════════════════
   ПАНЕЛЬ + АККОРДЕОНЫ
   ═══════════════════════════════════════════════════════════════ */
if (isMobile()) {
  panelEl.classList.remove('hidden');
  panelEl.classList.remove('open');
} else {
  panelEl.classList.remove('hidden');
}

panelToggle.addEventListener('click', () => {
  const isOpen = panelEl.classList.toggle('open');
  panelToggle.classList.toggle('active', isOpen);
});

document.querySelectorAll('.acc-header').forEach((h) => {
  h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
});

/* ---------- Видимость элементов ---------- */
function applyElementVisibility() {
  for (const key in elementGroups) {
        const visible = elementVisible[key] !== false;
    elementGroups[key].forEach((obj) => { obj.visible = visible; });
  }
}

function applyGlassWalls() {
  elementGroups.wall.forEach((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const isWin = obj.userData.isWindow;
    mats.forEach((m) => {
      if (!m) return;
      if (glassWalls) {
        m.transparent = true;
        m.opacity = isWin ? WINDOW_OPACITY : WALL_OPACITY;
        m.depthWrite = false;
      } else {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    });
  });
}

function bindElementButton(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    elementVisible[key] = !elementVisible[key];
    btn.classList.toggle('active', elementVisible[key]);
    applyElementVisibility();
  });
}
const elementButtonMap = [
  // Лестница 1→2
  ['el_s1_treads', 's1_treads'],
  ['el_s1_risers', 's1_risers'],
  ['el_s1_stringers', 's1_stringers'],
  ['el_s1_kosour', 's1_kosour'],
  ['el_s1_welcome_steps', 's1_welcome_steps'],
  ['el_s1_welcome_risers', 's1_welcome_risers'],
  ['el_s1_handrail', 's1_handrail'],
  ['el_s1_baluster', 's1_baluster'],
  ['el_s1_posts', 's1_posts'],
  ['el_s1_covering', 's1_covering'],
  // Лестница 2→3
  ['el_s2_treads', 's2_treads'],
  ['el_s2_risers', 's2_risers'],
  ['el_s2_stringers', 's2_stringers'],
  ['el_s2_kosour', 's2_kosour'],
  ['el_s2_welcome_steps', 's2_welcome_steps'],
  ['el_s2_welcome_risers', 's2_welcome_risers'],
  ['el_s2_handrail', 's2_handrail'],
  ['el_s2_baluster', 's2_baluster'],
  ['el_s2_posts', 's2_posts'],
  ['el_s2_covering', 's2_covering'],
    // Ограждение 2 этажа
  ['el_r2_posts', 'r2_posts'],
  ['el_r2_handrail', 'r2_handrail'],
  ['el_r2_bottomrail', 'r2_bottomrail'],
  ['el_r2_baluster', 'r2_baluster'],
  // Ограждение 3 этажа
  ['el_r3_posts', 'r3_posts'],
  ['el_r3_handrail', 'r3_handrail'],
  ['el_r3_bottomrail', 'r3_bottomrail'],
  ['el_r3_baluster', 'r3_baluster'],
  // Прочее
  ['el_wall', 'wall'],
  ['el_opening', 'opening'],
  ['el_floor', 'floor'],
];

elementButtonMap.forEach(([id, key]) => bindElementButton(id, key));

document.getElementById('btnGlass').addEventListener('click', (e) => {
  glassWalls = !glassWalls;
  e.currentTarget.classList.toggle('active', glassWalls);
  applyGlassWalls();
});

/* ---------- Линейка / человечек ---------- */
document.getElementById('btnRuler').addEventListener('click', () => setRulerMode(!rulerMode));
document.getElementById('btnRulerClear').addEventListener('click', () => {
  clearRuler();
  showToast('Замеры очищены', true);
});
document.getElementById('floatRulerOff').addEventListener('click', () => setRulerMode(false));

document.getElementById('btnHuman').addEventListener('click', () => {
  setHumanMode(!humanMode);
  if (humanMode && !humanGroup.visible && currentModel) {
    showToast('Тапните по ступени, чтобы поставить человечка', true);
  }
});
document.getElementById('btnHumanRemove').addEventListener('click', () => {
  humanGroup.visible = false;
  setHumanMode(false);
  showToast('Человечек убран', true);
});
document.getElementById('floatHumanOff').addEventListener('click', () => {
  humanGroup.visible = false;
  setHumanMode(false);
});

/* ---------- Ползунки человечка (в аккордеоне + в плашке) ---------- */
function syncHumanHeightUI(cm) {
  heightSlider.value = cm;
  floatHeightSlider.value = cm;
  heightValue.textContent = cm + ' см';
  floatHeightValue.textContent = cm + ' см';
}
function syncHumanRotationUI(deg) {
  rotationSlider.value = deg;
  floatRotationSlider.value = deg;
  rotationValue.textContent = deg + '°';
  floatRotationValue.textContent = deg + '°';
  humanGroup.rotation.y = (deg * Math.PI) / 180;
}

heightSlider.addEventListener('input', (e) => {
  const cm = parseInt(e.target.value, 10);
  setHumanHeight(cm);
  syncHumanHeightUI(cm);
});
rotationSlider.addEventListener('input', (e) => {
  humanRotation = parseInt(e.target.value, 10);
  syncHumanRotationUI(humanRotation);
});
floatHeightSlider.addEventListener('input', (e) => {
  const cm = parseInt(e.target.value, 10);
  setHumanHeight(cm);
  syncHumanHeightUI(cm);
});
floatRotationSlider.addEventListener('input', (e) => {
  humanRotation = parseInt(e.target.value, 10);
  syncHumanRotationUI(humanRotation);
});

/* ---------- Камера / прочее ---------- */
document.getElementById('btnFit').addEventListener('click', fitCamera);
document.getElementById('btnRotate').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle('active', controls.autoRotate);
});
document.getElementById('btnShot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'view-' + Date.now() + '.png';
  a.click();
  showToast('Снимок сохранён', true);
});
document.getElementById('btnShare').addEventListener('click', async () => {
  const url = location.origin + location.pathname + location.search;
  const title = document.title || '3D Viewer';
  if (navigator.share) {
    try { await navigator.share({ title, text: 'Посмотрите 3D-модель', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована в буфер обмена', true);
  } catch { prompt('Скопируйте ссылку вручную:', url); }
});
document.getElementById('bgColor').addEventListener('input', (e) => {
  scene.background.set(e.target.value);
});

/* ---------- Сброс ---------- */
document.getElementById('btnReset').addEventListener('click', () => {
     paintEnabled = true;
  document.getElementById('btnGlobalPaint').classList.add('active');
   buildColorPanel();
     for (const k in currentColor) { currentColor[k] = null; applyColor(k); }
    document.querySelectorAll('[id^="el_s1_"], [id^="el_s2_"], [id^="el_r2_"], [id^="el_r3_"], #el_wall, #el_opening, #el_floor').forEach((b) => b.classList.add('active'));
  
  glassWalls = true;
  document.getElementById('btnGlass').classList.add('active');
  controls.autoRotate = false;
  document.getElementById('btnRotate').classList.remove('active');
  applyElementVisibility();
  applyGlassWalls();
  if (rulerMode) setRulerMode(false);
  if (humanMode) setHumanMode(false);
  humanGroup.visible = false;
  humanRotation = 0;
  syncHumanRotationUI(0);
  for (const k in currentFinish) { currentFinish[k] = null; applyFinish(k); }
  buildFinishPanel();
  const bg = '#0f1116';
  document.getElementById('bgColor').value = bg;
  scene.background.set(bg);
  if (currentModel) fitCamera();
});

/* ---------- Сохранить позицию в URL ---------- */
document.getElementById('btnSavePos').addEventListener('click', () => {
  const p = camera.position;
  const t = controls.target;
  const params = new URLSearchParams(location.search);
  params.set('cam', p.x.toFixed(3) + ',' + p.y.toFixed(3) + ',' + p.z.toFixed(3));
  params.set('target', t.x.toFixed(3) + ',' + t.y.toFixed(3) + ',' + t.z.toFixed(3));
  const newUrl = location.origin + location.pathname + '?' + params.toString();
  history.replaceState(null, '', newUrl);
  navigator.clipboard.writeText(newUrl).then(() => {
    showToast('Ссылка с позицией скопирована', true);
  }).catch(() => prompt('Скопируйте ссылку вручную:', newUrl));
});

/* ---------- Восстановить камеру из URL ---------- */
function applyCameraFromURL() {
  const params = new URLSearchParams(location.search);
  const camStr = params.get('cam');
  const tgtStr = params.get('target');
  if (!camStr) return false;
  try {
    const c = camStr.split(',').map(parseFloat);
    const t = tgtStr ? tgtStr.split(',').map(parseFloat) : [0, 0, 0];
    if (c.length === 3 && c.every(isFinite)) {
      camera.position.set(c[0], c[1], c[2]);
      controls.target.set(t[0] || 0, t[1] || 0, t[2] || 0);
      camera.updateProjectionMatrix();
      controls.update();
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

/* ---------- Горячие клавиши ---------- */
window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  switch (e.key.toLowerCase()) {
    case 'f': document.getElementById('btnFit').click(); break;
    case 'r': document.getElementById('btnRotate').click(); break;
    case 'm': document.getElementById('btnRuler').click(); break;
    case 'h': document.getElementById('btnHuman').click(); break;
  }
});/* ═══════════════════════════════════════════════════════════════
   ОТДЕЛКА (панель текстур)
   ═══════════════════════════════════════════════════════════════ */
function buildFinishPanel() {
  finishRows.innerHTML = '';

  FINISH_CATEGORIES.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'finish-row';
    row.dataset.key = cat.key;

    const header = document.createElement('div');
    header.className = 'finish-header';
    header.innerHTML =
      '<span class="label">' + cat.label + '</span>' +
      '<span class="value">' +
        '<span class="finish-current">Как в проекте</span>' +
        '<span class="arrow">▼</span>' +
      '</span>';

    const options = document.createElement('div');
    options.className = 'finish-options';

    const optOriginal = document.createElement('button');
    optOriginal.className = 'finish-option selected';
    optOriginal.dataset.file = '';
    optOriginal.dataset.name = 'Как в проекте';
    optOriginal.innerHTML = '<span class="swatch" style="background:#1a1d25;"></span>Как в проекте';
    options.appendChild(optOriginal);

    TEXTURE_LIST.forEach((t) => {
      const opt = document.createElement('button');
      opt.className = 'finish-option';
      opt.dataset.file = t.file;
      opt.dataset.name = t.name;
      opt.innerHTML =
        '<span class="swatch" style="background-image:url(' + t.file + ');"></span>' + t.name;
      options.appendChild(opt);
    });

    row.appendChild(header);
    row.appendChild(options);

    header.addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      finishRows.querySelectorAll('.finish-row.open').forEach((r) => {
        if (r !== row) r.classList.remove('open');
      });
      row.classList.toggle('open', !isOpen);
    });

    options.addEventListener('click', (e) => {
      const btn = e.target.closest('.finish-option');
      if (!btn) return;
      const file = btn.dataset.file;
      const name = btn.dataset.name;
      currentFinish[cat.key] = file ? { file, name } : null;
      options.querySelectorAll('.finish-option').forEach((o) => o.classList.remove('selected'));
      btn.classList.add('selected');
      row.querySelector('.finish-current').textContent = file ? name : 'Как в проекте';
      row.classList.remove('open');
      applyFinish(cat.key);
    });

    finishRows.appendChild(row);
  });
}
function buildColorPanel() {
  const colorRows = document.getElementById('colorRows');
  if (!colorRows) return;
  colorRows.innerHTML = '';

  FINISH_CATEGORIES.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'finish-row'; // используем те же классы для аккордеона внутри
    row.dataset.key = cat.key;

    const header = document.createElement('div');
    header.className = 'finish-header';
    header.innerHTML =
      '<span class="label">' + cat.label + '</span>' +
      '<span class="value">' +
        '<span class="finish-current">Без тонировки</span>' +
        '<span class="arrow">▼</span>' +
      '</span>';

    const options = document.createElement('div');
    options.className = 'color-options';

    // Кнопка "Сброс"
    const optOrig = document.createElement('div');
    optOrig.className = 'color-swatch original';
    optOrig.innerHTML = '✕';
    optOrig.title = 'Без тонировки';
    optOrig.addEventListener('click', () => {
      currentColor[cat.key] = null;
      row.querySelector('.finish-current').textContent = 'Без тонировки';
      options.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
      optOrig.classList.add('selected');
      row.classList.remove('open');
      applyColor(cat.key);
    });
    options.appendChild(optOrig);

    // Цвета
    COLOR_PALETTE.forEach((color) => {
      if (color.name === 'Натуральный') return; // пропускаем белый, есть кнопка сброса
      
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color.hex;
      swatch.title = color.name;
      
      swatch.addEventListener('click', () => {
       currentColor[cat.key] = color.key;
        row.querySelector('.finish-current').textContent = color.name;
        options.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
        swatch.classList.add('selected');
        row.classList.remove('open');
        applyColor(cat.key);
      });
      options.appendChild(swatch);
    });

    row.appendChild(header);
    row.appendChild(options);

    header.addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      colorRows.querySelectorAll('.finish-row.open').forEach((r) => {
        if (r !== row) r.classList.remove('open');
      });
      row.classList.toggle('open', !isOpen);
    });

    colorRows.appendChild(row);
  });
}
document.getElementById('btnGlobalPaint').addEventListener('click', (e) => {
  paintEnabled = !paintEnabled;
  e.currentTarget.classList.toggle('active', paintEnabled);
  
  // Если выключаем покраску, визуально сбрасываем все цвета
  if (!paintEnabled) {
    for (const k in currentColor) { currentColor[k] = null; applyColor(k); }
  }
  
  buildColorPanel(); // Перерисовываем панель (чтобы скрыть/показать цвета)
  showToast(paintEnabled ? 'Покраска включена' : 'Покраска отключена', true);
});
function applyColor(categoryKey) {
  const colorKey = currentColor[categoryKey];
  const colorObj = COLOR_PALETTE.find(c => c.key === colorKey);
  const colorHex = colorObj ? colorObj.hex : null;

  for (const groupKey in elementGroups) {
    if (!groupKey.endsWith('_' + categoryKey)) continue;
    
    elementGroups[groupKey].forEach((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const orig = originalMaterialState.get(obj.uuid);

      mats.forEach((m) => {
        if (!m) return;
        
        if (!paintEnabled || !colorKey) {
          if (orig) {
            m.map = orig.map;
            if (m.color) m.color.setHex(orig.color);
          }
          if (m.isMeshStandardMaterial) m.roughness = 0.8;
          if (m.isMeshPhongMaterial) m.shininess = 10;
        } else {
          if (colorKey === 'clear') {
            if (orig && orig.map) m.map = orig.map;
            if (m.color) m.color.setHex(0xffffff);
            
                       if (m.isMeshStandardMaterial) {
              m.roughness = 0.1;       // Гладкая поверхность
              m.metalness = 0.2;       // Легкий отблеск
              m.envMapIntensity = 1.5; // Усиливаем отражение окружения
              m.roughnessMap = null;   // Отключаем старые карты
            }
            if (m.isMeshPhongMaterial) {
              m.shininess = 300;
              m.specular = new THREE.Color(0xffffff);
              m.specularMap = null;
            }
          } else {
            if (colorKey === 'white' || colorKey === 'redwood' || colorKey === 'black') {
              m.map = null; 
            } else {
              if (orig && orig.map) m.map = orig.map; 
            }
            if (m.color) m.color.set(colorHex);
            if (m.isMeshStandardMaterial) m.roughness = 0.5;
            if (m.isMeshPhongMaterial) m.shininess = 30;
          }
        }
        m.needsUpdate = true;
      });
    });
  }
}
function applyFinish(categoryKey) {
  const choice = currentFinish[categoryKey];

  for (const groupKey in elementGroups) {
    // Ищем группы, которые заканчиваются на _treads, _risers и т.д.
    if (!groupKey.endsWith('_' + categoryKey)) continue;
    
    const meshes = elementGroups[groupKey];
    meshes.forEach((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const orig = originalMaterialState.get(obj.uuid);

      mats.forEach((m) => {
        if (!m) return;
        if (!choice) {
          // Если выбрано "Как в проекте" — возвращаем исходную текстуру и цвет
          if (orig) {
            m.map = orig.map;
            if (m.color) m.color.setHex(orig.color);
          }
        } else {
          // Если выбрана текстура — накладываем её и сбрасываем цвет (тонировку)
          m.map = getTexture(choice.file);
          if (m.color) m.color.setHex(0xffffff); 
        }
        m.needsUpdate = true;
      });
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   КЛАССИФИКАЦИЯ BOM-ЭЛЕМЕНТОВ
   ═══════════════════════════════════════════════════════════════ */
function classifyBOMItems(items, floor) {
  const result = { stair: {}, railing: {} };
  if (!items || !items.length) return result;

  // Детали этой лестницы
  const stairItems = items.filter(d => d.name && d.name.startsWith(floor + '_'));

  // Welcome steps — ступени с subtype='bullnose'
  const welcomeSteps = stairItems.filter(d => d.type === 'Step' && d.subtype === 'bullnose');

  // Welcome risers существуют ТОЛЬКО если есть welcome steps
  let welcomeRiserNames = [];
  if (welcomeSteps.length > 0) {
    const risers = stairItems
      .filter(d => d.type === 'Riser')
      .sort((a, b) => {
        const na = parseInt((a.name || '').replace(/\D+/g, ''), 10) || 0;
        const nb = parseInt((b.name || '').replace(/\D+/g, ''), 10) || 0;
        return na - nb;
      });
    welcomeRiserNames = risers.slice(0, welcomeSteps.length).map(r => r.name);
  }

  items.forEach(d => {
    if (!d.name) return;
    const m = d.name.match(/^(\d+)_/);
    if (!m) return;
    const prefix = parseInt(m[1], 10);

    let target = null;
    if (prefix === floor)          target = result.stair;
    else if (prefix === floor + 1) target = result.railing;
    else return;

    let catKey = null;
    if (d.type === 'Step') {
      catKey = (d.subtype === 'bullnose') ? 'welcome_steps' : 'treads';
    } else if (d.type === 'Riser') {
      catKey = welcomeRiserNames.includes(d.name) ? 'welcome_risers' : 'risers';
    } else if (d.type === 'String') {
      catKey = (d.stringtype === 'cut') ? 'kosour' : 'stringers';
    } else if (d.type === 'Newel')      catKey = 'posts';
    else if (d.type === 'NewelCap')     catKey = 'post_caps';
    else if (d.type === 'Handrail')     catKey = 'handrail';
    else if (d.type === 'Baluster')     catKey = 'baluster';
    else if (d.type === 'Covering')     catKey = 'covering';
    else if (d.type === 'Bottomrail')   catKey = 'bottomrail';

    if (!catKey) return;
    if (!target[catKey]) target[catKey] = [];
    target[catKey].push(d);
  });

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   КАЛЬКУЛЯТОР
   ═══════════════════════════════════════════════════════════════ */
function getMaterialForKey(key) {
  const chosen = currentFinish[key];
  if (!chosen || !chosen.file) return 'pine';
  const mats = priceData && priceData.materials ? priceData.materials : {};
  for (const matKey in mats) {
    const t = mats[matKey].textures || [];
    if (t.indexOf(chosen.file) !== -1) return matKey;
  }
  return 'pine';
}

function getMaterialInfo(matKey) {
  const mats = priceData && priceData.materials ? priceData.materials : {};
  return mats[matKey] || mats.pine || { name: 'Сосна' };
}/* Площадь покраски для категории — берём из 3D-модели (DAE) */
function getDAEPaintArea(catKey) {
  if (!bomData) return 0;
  const grouped = classifyBOMItems();
  const items = grouped[catKey] || [];
  let total = 0;
  items.forEach(d => { total += 2 * (d.W * d.L) / 1e6; });
  return total;
}


/* Площадь покраски для одной детали — полная поверхность коробки.
   Красим ВСЕ грани, кроме примыкающих (упрощённо — все 6). */
function paintAreaForBox(T, W, L) {
  // в мм → м²
  return (2 * (W * L + W * T + L * T)) / 1e6;
}
/* Боковая поверхность (для length-категорий, у которых торцы малы) */
function paintAreaLateral(T, W, L) {
  return (2 * (W + T) * L) / 1e6;
}
/* Цилиндр (для балясин) */
function paintAreaCyl(W, L) {
  return (Math.PI * W * L) / 1e6;
}

function buildGroupResult(prefix, title, classified, paintPrice, countMontage) {
  const out = {
    prefix: prefix,
    title: title,
    categories: [],
    materialTotal: 0,
    paintTotal: 0,
    montageCost: 0
  };
  if (!priceData || !priceData.categories) return out;

  for (const catKey in priceData.categories) {
    const cat = priceData.categories[catKey];
    const items = classified[catKey];
    if (!items || !items.length) continue;

    // Скрытые категории не участвуют в расчёте
    const visKey = prefix + '_' + catKey;
    if (elementVisible[visKey] === false) continue;

    const matKey = getMaterialForKey(catKey);
    const matInfo = getMaterialInfo(matKey);
    const unitPrice = (cat.prices && cat.prices[matKey]) || 0;
    const coef = (cat.method === 'm2' && cat.coef) ? cat.coef : 1;

    let qty = 0;
    if (cat.method === 'm2') {
      items.forEach(d => { qty += (d.W * d.L) / 1e6; });
      qty *= coef;
    } else if (cat.method === 'length') {
      const extra = (cat.extra_mm || 0) / 1000;
      items.forEach(d => { qty += d.L / 1000 + extra; });
    } else if (cat.method === 'count') {
      qty = items.length;
    }

    const paintArea = getDXFPaintArea(catKey, items);

    // --- РАСЧЕТ ПОКРАСКИ ---
    let paintCost = 0;
    let paintName = 'Цвет не выбран';

    if (paintEnabled) {
      const selKey = currentColor[catKey] || 'clear';
      const paintData = priceData && priceData.paints ? priceData.paints[selKey] : null;
      const unitPaintPrice = paintData ? paintData.price_m2 : 1800;
      
      paintCost = paintArea * unitPaintPrice;
      paintName = paintData ? paintData.name : 'Лак б/ц';
    } else {
      paintName = 'Без покраски';
    }

    // --- СОХРАНЯЕМ В КАТЕГОРИЮ ---
    out.categories.push({
      key: catKey,
      name: cat.name,
      materialName: matInfo.name,
      count: items.length,
      qty: qty,
      method: cat.method,
      paintArea: paintArea,
      materialCost: qty * unitPrice,
      paintCost: paintCost,
      paintName: paintName
    });

    out.materialTotal += qty * unitPrice;
    out.paintTotal += paintCost;
  }

  // Монтаж — только для лестниц
  if (countMontage) {
    const treadMatKey = getMaterialForKey('treads');
    const baseMontage = (treadMatKey === 'pine') ? 25000 : 30000;
    let coef = 1.0;
    if (classified.risers && classified.risers.length > 0) coef += 0.10;
    const coveringCount = (classified.covering || []).length;
    out.montageCost = baseMontage * coef + 1200 * coveringCount;
  }

  return out;
}

function calculatePrice(km) {
  const result = {
    groups: [],
    materialTotal: 0,
    paintTotal: 0,
    deliveryCost: 0,
    deliveryKm: km || 0,
    montageCost: 0,
    total: 0
  };
  if (!bomGroups || !bomGroups.length || !priceData || !priceData.categories) return result;

  const paintPrice = (priceData.paint && priceData.paint.price_m2) || 0;

  for (const group of bomGroups) {
    const classified = classifyBOMItems(group.items, group.floor);

    // Лестница N → N+1
    const stairResult = buildGroupResult(
      's' + group.floor,
      'Лестница ' + group.floor + '→' + (group.floor + 1),
      classified.stair,
      paintPrice,
      true
    );
    if (stairResult.categories.length) result.groups.push(stairResult);

    // Ограждение этажа N+1
    const railingResult = buildGroupResult(
      'r' + (group.floor + 1),
      'Ограждение ' + (group.floor + 1) + ' этажа',
      classified.railing,
      paintPrice,
      false
    );
    if (railingResult.categories.length) result.groups.push(railingResult);

    result.materialTotal += stairResult.materialTotal + railingResult.materialTotal;
    result.paintTotal += stairResult.paintTotal + railingResult.paintTotal;
    result.montageCost += stairResult.montageCost;
  }

  /* Доставка: 60 ₽/км + 800 подача, минимум 4500 */
  const base = 60 * (km || 0) + 800;
  result.deliveryCost = Math.max(4500, base);

  result.total = result.materialTotal + result.paintTotal + result.deliveryCost + result.montageCost;
  return result;
}

 
  
/* ═══════════════════════════════════════════════════════════════
   МОДАЛКА СМЕТЫ (БЕЗ формул)
   ═══════════════════════════════════════════════════════════════ */
let currentKm = 0;

function buildPriceModal() {
  if (!priceData) {
    priceBody.innerHTML = '<div class="price-empty">Файл price.json не найден</div>';
    return;
  }
function buildDynamicPanelButtons() {
  const container1 = document.getElementById('container_s1_covering');
  const container2 = document.getElementById('container_s2_covering');
  if (container1) container1.innerHTML = '';
  if (container2) container2.innerHTML = '';

  if (!bomGroups || !bomGroups.length) return;

  bomGroups.forEach(group => {
    const floor = group.floor;
    const container = document.getElementById('container_s' + floor + '_covering');
    if (!container) return;

    // Находим все панели для этой лестницы
    const panels = group.items.filter(d => d.type === 'Covering');
    
    panels.forEach(d => {
      const panelName = d.name.split('_')[1]; // FC1, FC2
      const key = 's' + floor + '_' + panelName.toLowerCase(); // s1_fc1
      
      if (!elementGroups[key]) elementGroups[key] = [];
      if (elementVisible[key] === undefined) elementVisible[key] = true;

      const btn = document.createElement('button');
      btn.className = 'btn active';
      btn.id = 'el_' + key;
      btn.innerHTML = '<span class="ico">📏</span> Панель ' + panelName.replace('FC', '');
      
      btn.addEventListener('click', () => {
        elementVisible[key] = !elementVisible[key];
        btn.classList.toggle('active', elementVisible[key]);
        applyElementVisibility();
      });

      container.appendChild(btn);
    });
  });
}
   
  if (!bomGroups || !bomGroups.length) {
    priceBody.innerHTML = '<div class="price-empty">XML-файлы из Staircon не найдены.<br>Загрузите их в репозиторий.</div>';
    return;
  }

  // Автозагрузка DXF при первом открытии
  if (Object.keys(dxfCache).length < 46) {
    priceBody.innerHTML = '<div class="price-empty">' +
      '<div class="spinner" style="margin-bottom:14px;"></div>' +
      '<div id="dxfProgress">Загрузка DXF… <b>0 / 46</b></div>' +
      '</div>';
    const prog = document.getElementById('dxfProgress');
    loadAllDXF((done, total) => {
      if (prog) prog.innerHTML = 'Загрузка DXF… <b>' + done + ' / ' + total + '</b>';
    }).then(() => { buildPriceModal(); });
    return;
  }

  const result = calculatePrice(currentKm);
  priceBody.innerHTML = '';

  // Поле км
  const kmRow = document.createElement('div');
  kmRow.className = 'input-row';
  kmRow.innerHTML =
    '<label>📍 Расстояние доставки:</label>' +
    '<input type="number" id="deliveryKmInput" min="0" step="1" value="' + currentKm + '">' +
    '<span class="unit">км</span>';
  priceBody.appendChild(kmRow);
  kmRow.querySelector('input').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    currentKm = isFinite(v) && v >= 0 ? v : 0;
    buildPriceModal();
  });

  // Группы с категориями
  result.groups.forEach((g) => {
    const groupBlock = document.createElement('div');
    groupBlock.className = 'price-group';

    const groupTotal = g.materialTotal + g.paintTotal;
    const title = document.createElement('div');
    title.className = 'price-group-title';
    title.innerHTML = '<span>' + g.title + '</span>' +
                      '<span class="sum">' + formatRub(groupTotal) + '</span>';
    groupBlock.appendChild(title);

    const body = document.createElement('div');
    body.className = 'price-group-body';

       g.categories.forEach((cat) => {
      const block = document.createElement('div');
      block.className = 'price-cat';
      
      // Форматируем количество
      let qtyText = '';
      if (cat.method === 'm2') qtyText = cat.qty.toFixed(3) + ' м²';
      else if (cat.method === 'length') qtyText = cat.qty.toFixed(2) + ' м';
      else if (cat.method === 'count') qtyText = cat.qty + ' шт';

      block.innerHTML =
        '<div class="price-cat-name">' +
          '<span>' + cat.name + '</span>' +
          '<span class="material">' + cat.materialName + '</span>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:4px;">' +
          '<span>Изготовление (' + qtyText + ')</span>' +
          '<span>' + formatRub(cat.materialCost) + '</span>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted);">' +
          '<span>Покраска: ' + cat.paintName + ' (' + cat.paintArea.toFixed(2) + ' м²)</span>' +
          '<span>' + formatRub(cat.paintCost) + '</span>' +
        '</div>' +
        '<div class="price-cat-result" style="margin-top:8px; border-top:1px solid var(--border); padding-top:4px;">' +
          formatRub(cat.materialCost + cat.paintCost) +
        '</div>';
      body.appendChild(block);
    });

    groupBlock.appendChild(body);
    priceBody.appendChild(groupBlock);
  });

  // Итоги
  const totals = document.createElement('div');
  totals.className = 'price-totals';
    totals.innerHTML =
    '<div class="price-totals-row"><span>Изготовление</span><span>' + formatRub(result.materialTotal) + '</span></div>' +
    '<div class="price-totals-row"><span>Покраска</span><span>' + formatRub(result.paintTotal) + '</span></div>' +
    '<div class="price-totals-row"><span>Доставка (' + result.deliveryKm + ' км)</span><span>' + formatRub(result.deliveryCost) + '</span></div>' +
    '<div class="price-totals-row"><span>Монтаж</span><span>' + formatRub(result.montageCost) + '</span></div>' +
    '<div class="price-totals-row total"><span>ИТОГО</span><span>' + formatRub(result.total) + '</span></div>';
  priceBody.appendChild(totals);
}

/* ═══════════════════════════════════════════════════════════════
   МОДАЛКА ПАРАМЕТРОВ ЛЕСТНИЦЫ
   ═══════════════════════════════════════════════════════════════ */
function buildParamsModal() {
  if (!bomData || !bomData.params) {
    paramsBody.innerHTML = '<div class="price-empty">Параметры недоступны. Загрузите XML.</div>';
    return;
  }
  const p = bomData.params;
  paramsBody.innerHTML = '';

  function row(label, value, section = false) {
    if (value === null || value === undefined || value === '' || value === 0) return;
    const el = document.createElement('div');
    el.className = 'param-row' + (section ? ' section' : '');
    el.innerHTML = section
      ? '<span>' + label + '</span>'
      : '<span class="label">' + label + '</span><span class="value">' + value + '</span>';
    paramsBody.appendChild(el);
  }

  function mm(v) { return v != null ? Math.round(v) + ' мм' : null; }

  row('Этаж и перекрытие', null, true);
  row('Высота этажа (пол-пол)', mm(p.floorheight));
  row('Высота потолка 1 этажа', mm(p.ceiling));
  row('Толщина перекрытия', mm(p.floorthick));
  row('Просвет под перекрытием', mm(p.headroom));

  row('Ступени', null, true);
  row('Высота ступени', mm(p.rise));
  row('Глубина ступени', p.going ? p.going.toFixed(1) + ' мм' : null);
  if (p.recalcGoing) row('Глубина (забежные)', p.recalcGoing + ' мм');
  row('Количество подъёмов', p.numRisers);
  row('Ширина марша', mm(p.widths));
  row('Угол наклона', p.pitch);

  row('Ограждение и элементы', null, true);
  row('Высота ограждения', p.railingHeight);
  row('Сечение поручня', p.handrailDim);
  row('Диаметр балясины', p.balusterDim);
  row('Сечение столба', p.newelName);
}

/* ═══════════════════════════════════════════════════════════════
   БЛАНК ЗАКАЗА
   ═══════════════════════════════════════════════════════════════ */
const ORDER_PDF_FILE = 'Olyga Toksovo.pdf';

function buildOrderModal() {
  if (!bomData || !priceData) {
    orderBody.innerHTML = '<div class="price-empty">Нет данных. Загрузите XML и price.json.</div>';
    return;
  }

  const result = calculatePrice(currentKm);
  orderBody.innerHTML = '';

  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU');
  const modelName = (MODEL_FILE || '').replace(/\.(dae|xml)$/i, '');

  /* --- Шапка --- */
  const header = document.createElement('div');
  header.className = 'order-section';
  header.innerHTML =
    '<div style="text-align:center;padding:6px 0 12px;">' +
      '<div style="font-size:20px;font-weight:800;color:var(--text);">Бланк заказа</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' +
        (modelName || 'Лестница') + ' · ' + dateStr +
      '</div>' +
    '</div>';
  orderBody.appendChild(header);

  /* --- Вид сверху (PDF) --- */
  const pdfSec = document.createElement('div');
  pdfSec.className = 'order-section';
  pdfSec.innerHTML =
    '<div class="order-section-title">Вид сверху (чертёж)</div>' +
    '<div class="order-image-frame">' +
      '<iframe src="' + encodeURI(ORDER_PDF_FILE) + '#toolbar=0&navpanes=0&scrollbar=0"></iframe>' +
    '</div>';
  orderBody.appendChild(pdfSec);

  /* --- 3D-вид --- */
  let shotSrc = '';
  try {
    renderer.render(scene, camera);
    shotSrc = canvas.toDataURL('image/png');
  } catch (e) { console.warn('Не удалось сделать снимок:', e); }

  if (shotSrc) {
    const shotSec = document.createElement('div');
    shotSec.className = 'order-section';
    shotSec.innerHTML =
      '<div class="order-section-title">3D-вид</div>' +
      '<div class="order-image-frame"><img id="orderShotImg" src="' + shotSrc + '"></div>';
    orderBody.appendChild(shotSec);
  }

  /* --- Параметры --- */
  if (bomData.params) {
    const p = bomData.params;
    const rows = [];
    const push = (label, val) => { if (val) rows.push('<div class="param-row"><span class="label">' + label + '</span><span class="value">' + val + '</span></div>'); };

    if (p.floorheight)  push('Высота этажа',     Math.round(p.floorheight) + ' мм');
    if (p.rise)         push('Высота ступени',   Math.round(p.rise) + ' мм');
    if (p.going)        push('Глубина ступени',  p.going.toFixed(1) + ' мм');
    if (p.widths)       push('Ширина марша',     Math.round(p.widths) + ' мм');
    if (p.numRisers)    push('Количество подъёмов', p.numRisers);
    if (p.pitch)        push('Угол наклона',     p.pitch);
    if (p.railingHeight) push('Высота ограждения', p.railingHeight);

    if (rows.length) {
      const paramsSec = document.createElement('div');
      paramsSec.className = 'order-section';
      paramsSec.innerHTML =
        '<div class="order-section-title">Параметры лестницы</div>' + rows.join('');
      orderBody.appendChild(paramsSec);
    }
  }

  /* --- Состав заказа --- */
  const grouped = classifyBOMItems();

  const tableRows = [];
  let idx = 0;
  for (const catKey in priceData.categories) {
    const cat = priceData.categories[catKey];
    const items = grouped[catKey];
    if (!items || !items.length) continue;

    const found = result.categories.find(c => c.key === catKey);
    if (!found) continue;

    idx++;
    tableRows.push(
      '<tr>' +
        '<td class="num">' + idx + '</td>' +
        '<td>' + cat.name + '</td>' +
        '<td class="mat">' + found.materialName + '</td>' +
        '<td class="qty">' + found.count + ' шт</td>' +
        '<td class="sum">' + formatRub(found.materialCost) + '</td>' +
      '</tr>'
    );
  }

  const tableSec = document.createElement('div');
  tableSec.className = 'order-section';
  tableSec.innerHTML =
    '<div class="order-section-title">Состав заказа</div>' +
    '<table class="order-table">' +
      '<thead><tr>' +
        '<th>№</th><th>Наименование</th><th>Материал</th><th>Кол-во</th><th>Сумма</th>' +
      '</tr></thead>' +
      '<tbody>' + tableRows.join('') + '</tbody>' +
    '</table>';
  orderBody.appendChild(tableSec);

  /* --- Итоги --- */
  const totalsSec = document.createElement('div');
  totalsSec.className = 'order-section';
  totalsSec.innerHTML =
    '<div class="order-section-title">Итоги</div>' +
    '<div class="order-totals">' +
        '<div class="order-totals-row"><span>Материал</span><span>' + formatRub(result.materialTotal) + '</span></div>' +
      '<div class="order-totals-row"><span>Покраска</span><span>' + formatRub(result.paintTotal) + '</span></div>' +
      '<div class="order-totals-row"><span>Доставка (' + result.deliveryKm + ' км)</span><span>' + formatRub(result.deliveryCost) + '</span></div>' +
      '<div class="order-totals-row"><span>Монтаж</span><span>' + formatRub(result.montageCost) + '</span></div>' +
      '<div class="order-totals-row total"><span>ИТОГО</span><span>' + formatRub(result.total) + '</span></div>' +
    '</div>';
  orderBody.appendChild(totalsSec);

  /* --- Срок изготовления --- */
  const leadSec = document.createElement('div');
  leadSec.className = 'order-section';
  leadSec.innerHTML =
    '<div class="order-lead-row">' +
      '🕐 Срок изготовления:' +
      '<input type="number" id="orderLead" min="1" step="1" value="30">' +
      '<span class="unit">рабочих дней</span>' +
    '</div>';
  orderBody.appendChild(leadSec);
}

/* ---------- Скачать PDF ---------- */
document.getElementById('orderDownload').addEventListener('click', () => {
  // 1. Открываем оригинальный PDF-чертёж в новой вкладке — браузер позволит сохранить
  const a = document.createElement('a');
  a.href = encodeURI(ORDER_PDF_FILE);
  a.download = ORDER_PDF_FILE;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('PDF открыт. Сохраните через Ctrl+S', true);
});

/* ---------- Поделиться ---------- */
document.getElementById('orderShare').addEventListener('click', async () => {
  const url = location.origin + location.pathname + location.search;
  const title = 'Бланк заказа · ' + (document.title || '3D Viewer');
  if (navigator.share) {
    try { await navigator.share({ title, text: 'Бланк заказа лестницы', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована в буфер обмена', true);
  } catch { prompt('Скопируйте ссылку вручную:', url); }
});

/* ═══════════════════════════════════════════════════════════════
   МОДАЛЬНЫЕ ОКНА
   ═══════════════════════════════════════════════════════════════ */
function makeModal(overlayId, closeBtnId, closeIconId, onOpen) {
  const overlay = document.getElementById(overlayId);
  const openFn  = () => { if (onOpen) onOpen(); overlay.classList.add('show'); };
  const closeFn = () => overlay.classList.remove('show');

  if (closeBtnId)  document.getElementById(closeBtnId).addEventListener('click', closeFn);
  if (closeIconId) document.getElementById(closeIconId).addEventListener('click', closeFn);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
  return { openFn, closeFn, overlay };
}

const priceModal  = makeModal('priceModalOverlay',  'priceModalCloseBtn',  'priceModalClose',  buildPriceModal);
const paramsModal = makeModal('paramsModalOverlay', 'paramsModalCloseBtn', 'paramsModalClose', buildParamsModal);
const orderModal  = makeModal('orderModalOverlay',  'orderModalCloseBtn',  'orderModalClose',  buildOrderModal);

priceBtn.addEventListener('click', priceModal.openFn);
document.getElementById('btnParams').addEventListener('click', paramsModal.openFn);
document.getElementById('btnOrder').addEventListener('click', orderModal.openFn);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (priceModal.overlay.classList.contains('show'))  priceModal.closeFn();
    if (paramsModal.overlay.classList.contains('show')) paramsModal.closeFn();
    if (orderModal.overlay.classList.contains('show'))  orderModal.closeFn();
  }
});

/* ═══════════════════════════════════════════════════════════════
   DXF ПАРСЕР + ЗАГРУЗЧИК
   ═══════════════════════════════════════════════════════════════ */

/* Кэш: { "1_Tr3": {area, perimeter}, ... } в мм² и мм */
const dxfCache = {};

/* ---- Парсер DXF ---- */
function parseDXF(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim());
  const pairs = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i], 10);
    if (!isNaN(code)) pairs.push([code, lines[i + 1]]);
  }

  const polylines = [];
  let inEntities = false;
  let current = null;
  let i = 0;

  while (i < pairs.length) {
    const [code, value] = pairs[i];

    if (code === 0 && value === 'SECTION') {
      if (pairs[i+1] && pairs[i+1][0] === 2 && pairs[i+1][1] === 'ENTITIES') inEntities = true;
    }
    if (code === 0 && value === 'ENDSEC') inEntities = false;

    if (!inEntities) { i++; continue; }

    if (code === 0 && value === 'POLYLINE') {
      current = { layer: '', vertices: [] };
      i++;
      while (i < pairs.length && pairs[i][0] !== 0) {
        if (pairs[i][0] === 8) current.layer = pairs[i][1];
        i++;
      }
      continue;
    }

    if (code === 0 && value === 'VERTEX' && current) {
      const v = { x: 0, y: 0, bulge: 0 };
      i++;
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [c, val] = pairs[i];
        if (c === 10) v.x = parseFloat(val);
        if (c === 20) v.y = parseFloat(val);
        if (c === 42) v.bulge = parseFloat(val);
        i++;
      }
      current.vertices.push(v);
      continue;
    }

    if (code === 0 && value === 'SEQEND' && current) {
      if (current.vertices.length > 2) polylines.push(current);
      current = null;
      i++;
      continue;
    }

    i++;
  }

  return { polylines };
}

/* ---- Площадь и периметр одной полилинии (с дугами) ---- */
function polylineAreaAndPerimeter(vertices) {
  const n = vertices.length;
  if (n < 3) return { area: 0, perimeter: 0 };

  let area = 0;
  let perimeter = 0;

  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const chord = Math.hypot(dx, dy);

    area += 0.5 * (p1.x * p2.y - p2.x * p1.y);

    const b = p1.bulge || 0;
    if (Math.abs(b) < 1e-9) {
      perimeter += chord;
    } else {
      const theta = 4 * Math.atan(b);
      const r = chord / (2 * Math.sin(theta / 2));
      area += 0.5 * r * r * (theta - Math.sin(theta));
      perimeter += Math.abs(r * theta);
    }
  }

  return { area: Math.abs(area), perimeter };
}

/* ---- Загрузить один DXF (с fallback на .dxf / .DXF) ---- */
async function loadOneDXF(name) {
  const urls = [name + '.DXF', name + '.dxf'];
  for (const url of urls) {
    try {
     const r = await fetch(url);
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || text.length < 50) continue;
      const dxf = parseDXF(text);
      const contour = dxf.polylines.find(p => p.layer === 'CONTOUR');
      if (!contour) continue;
      const res = polylineAreaAndPerimeter(contour.vertices);
      return res;
    } catch (e) { /* пробуем следующий url */ }
  }
  return null;
}
/* ═══════════════════════════════════════════════════════════════
   РАЗМЕРЫ ПРОЁМА (ГЕОМЕТРИЧЕСКИЙ АНАЛИЗ)
   ═══════════════════════════════════════════════════════════════ */
let openingDimsVisible = false;
const openingDimsGroup = new THREE.Group();
scene.add(openingDimsGroup);

function buildOpeningDimensions() {
  // Очищаем старые размеры
  while (openingDimsGroup.children.length) {
    const c = openingDimsGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material && c.material.map) c.material.map.dispose();
    if (c.material) c.material.dispose();
  }

  // Собираем все меши проёма (полы перекрытий, где есть проём)
  const coverMeshes = [...(elementGroups['s1_covering'] || []), ...(elementGroups['s2_covering'] || [])];
  if (!coverMeshes.length) return;

  coverMeshes.forEach(mesh => {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry;
    if (!geom) return;

    // Находим максимальную высоту (верхнюю грань) для этого меша
    const pos = geom.attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y;
      if (y > maxY) maxY = y;
    }

    // Ищем рёбра с помощью EdgesGeometry
    const edges = new THREE.EdgesGeometry(geom, 30); 
    const edgePos = edges.attributes.position;
    
    const drawnEdges = new Set(); // Чтобы не дублировать линии

    for (let i = 0; i < edgePos.count; i += 2) {
      const p1 = new THREE.Vector3().fromBufferAttribute(edgePos, i).applyMatrix4(mesh.matrixWorld);
      const p2 = new THREE.Vector3().fromBufferAttribute(edgePos, i + 1).applyMatrix4(mesh.matrixWorld);

      // Оставляем только рёбра на верхней грани (допуск 10 мм)
      if (Math.abs(p1.y - maxY) < 0.01 && Math.abs(p2.y - maxY) < 0.01) {
        const dist = p1.distanceTo(p2);
        
        // Игнорируем слишком короткие рёбра (например, скругления < 50 мм)
        if (dist > 0.05) {
          // Создаем уникальный ключ для ребра, чтобы не рисовать его дважды
          const key = [p1.x.toFixed(2), p1.z.toFixed(2), p2.x.toFixed(2), p2.z.toFixed(2)].sort().join('|');
          if (!drawnEdges.has(key)) {
            drawnEdges.add(key);

            // Создаем метку (используем функцию из линейки, но с другим цветом)
            const text = Math.round(dist * 1000) + ' мм';
            const sprite = makeLabelSprite(text);
            
            // Красим рамку метки в синий цвет (чтобы отличать от линейки)
            const canvas = sprite.material.map.image;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#5b8cff';
            ctx.stroke();
            
            // Позиционируем метку по центру ребра
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            sprite.position.copy(mid);
            
            openingDimsGroup.add(sprite);
          }
        }
      }
    }
    edges.dispose();
  });
  
  openingDimsGroup.visible = openingDimsVisible;
  console.log(`%c✔ Построено размеров проёма: ${openingDimsGroup.children.length}`, 'color:#31d0aa');
}

// Обработчик кнопки
document.getElementById('btnShowOpeningDims').addEventListener('click', (e) => {
  openingDimsVisible = !openingDimsVisible;
  e.currentTarget.classList.toggle('active', openingDimsVisible);
  
  // Если размеры еще не построены, строим их при первом нажатии
  if (openingDimsGroup.children.length === 0) {
    buildOpeningDimensions();
  }
  
  openingDimsGroup.visible = openingDimsVisible;
  showToast(openingDimsVisible ? 'Размеры проёма включены' : 'Размеры проёма скрыты', true);
});
/* ---- Загрузить все DXF для плоских категорий ---- */
let dxfLoadPromise = null;

async function loadAllDXF(progressCb) {
  if (dxfLoadPromise) return dxfLoadPromise;
  dxfLoadPromise = (async () => {
    if (!bomGroups || !bomGroups.length) return;

    /* Собираем ВСЕ имена деталей из ВСЕХ XML-групп */
    const allNames = new Set();
    bomGroups.forEach(group => {
      const classified = classifyBOMItems(group.items, group.floor);

      ['stair', 'railing'].forEach(section => {
        for (const catKey in classified[section]) {
          (classified[section][catKey] || []).forEach(d => {
            if (!d.name) return;
            if (d.name.endsWith('End')) return;
            allNames.add(d.name);
          });
        }
      });
    });

    const toLoad = Array.from(allNames);

    console.log('%c→ Загрузка ' + toLoad.length + ' DXF...',
                'color:#5b8cff;font-weight:bold');

    let done = 0;
    const concurrency = 8;
    let idx = 0;

    async function worker() {
      while (idx < toLoad.length) {
        const name = toLoad[idx++];
        const res = await loadOneDXF(name);
        if (res) dxfCache[name] = res;
        done++;
        if (progressCb) progressCb(done, toLoad.length);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const ok = Object.keys(dxfCache).length;
    console.log('%c✔ DXF загружено: ' + ok + ' / ' + toLoad.length,
                'color:#31d0aa;font-weight:bold');
    return dxfCache;
  })();
  return dxfLoadPromise;
}

/* ---- Площадь покраски из DXF для одной категории ---- */
function getDXFPaintArea(catKey, items) {
  if (!items || !items.length) return 0;

  /* Столбы — из XML: 4 × 80 × L */
  if (catKey === 'posts') {
    let total = 0;
    items.forEach(d => { total += (4 * 80 * d.L) / 1e6; });
    return total;
  }
  /* Балясины — из XML: 4 × 45 × L */
  if (catKey === 'baluster') {
    let total = 0;
    items.forEach(d => { total += (4 * 45 * d.L) / 1e6; });
    return total;
  }

  /* Плоские — из DXF, с fallback на XML */
  let total = 0;
  items.forEach(d => {
    if (d.name && d.name.endsWith('End')) return;
    const dxf = d.name ? dxfCache[d.name] : null;
    if (dxf) {
      const T = d.T / 1000;
      total += (dxf.area / 1e6) * 2 + (dxf.perimeter / 1000) * T;
    } else {
      total += 2 * (d.W * d.L) / 1e6;
    }
  });
  return total;
}

/* ═══════════════════════════════════════════════════════════════
   СТАРТ
   ═══════════════════════════════════════════════════════════════ */
(async () => {
  /* 1. price.json */
  try {
    const r = await fetch('price.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    priceData = await r.json();
    console.log('%c✔ price.json загружен', 'color:#31d0aa;font-weight:bold');
  } catch (err) {
    console.log('price.json не найден:', err.message);
  }

  /* 2. Модель */
  MODEL_FILE = await findModelFile();
  if (!MODEL_FILE) {
    showToast('Файл .dae не найден. Загрузите его в репозиторий.');
    return;
  }

  /* 3. BOM (XML) */
  await loadBOM();

  /* 4. Загрузка модели */
  loadCollada(MODEL_FILE, MODEL_FILE);
})();

console.log('%c◈ 3D Viewer готов', 'color:#5b8cff;font-weight:bold;font-size:14px');
console.log('Линейка — M. Человечек — H.');  
