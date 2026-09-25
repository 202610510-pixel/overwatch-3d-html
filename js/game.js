/* STRIKE POINT — iPad-first touch FPS. Three.js scene + PUBG/Valorant-style HUD & controls. */
(() => {
'use strict';

/* ============================================================
   CONFIG
   ============================================================ */
const ARENA_HALF = 36;
const GRAVITY = -22;
const JUMP_SPEED = 7.2;
const PLAYER_RADIUS = 0.45;
const PLAYER_EYE = 1.65;
const PLAYER_CROUCH_EYE = 1.05;

const WEAPONS = [
  { id:'shotgun', name:'M870', icon:'P', type:'shotgun', damage:11, headMul:1.6, fireRate:750, magSize:6, reserveMax:24,
    reloadTime:2200, spread:0.022, adsSpread:0.014, moveSpreadMul:1.3, auto:false, adsZoom:1.15,
    pellets:8, pelletSpread:0.11, adsPelletSpread:0.065,
    sight:'shotgun', kick:0.11, dmg2:{name:'M870',stats:['DMG 펠릿x8','RATE 낮음','근접 강력']} },
  { id:'rifle', name:'AR-15', icon:'R', type:'rifle', damage:27, headMul:2.0, fireRate:105, magSize:30, reserveMax:120,
    reloadTime:1900, spread:0.040, adsSpread:0.010, moveSpreadMul:1.8, auto:true, adsZoom:1.6,
    sight:'holo', kick:0.03, dmg2:{name:'AR-15',stats:['DMG 27','RATE 높음','ACC 중간']} },
  { id:'sniper', name:'AWM', icon:'S', type:'sniper', damage:98, headMul:2.2, fireRate:1150, magSize:5, reserveMax:20,
    reloadTime:2500, spread:0.008, adsSpread:0.0009, moveSpreadMul:3.0, auto:false, adsZoom:6,
    sight:'scope', zoomLabel:'8×', kick:0.09, dmg2:{name:'AWM',stats:['DMG 98','RATE 낮음','ACC 매우높음']} },
];

// axis-aligned cover boxes {x,z,w,d,h}. h<=CLIMB_MAX_H are climbable (player can stand on top).
// Perimeter walls included.
const CLIMB_MAX_H = 1.8;
const OBSTACLES = [
  {x:0,z:0,w:6,d:6,h:2.2},
  {x:14,z:10,w:4,d:4,h:1.4}, {x:-14,z:-10,w:4,d:4,h:1.4},
  {x:-14,z:10,w:4,d:4,h:1.4}, {x:14,z:-10,w:4,d:4,h:1.4},
  {x:22,z:0,w:3,d:10,h:2.6}, {x:-22,z:0,w:3,d:10,h:2.6},
  {x:0,z:22,w:10,d:3,h:2.6}, {x:0,z:-22,w:10,d:3,h:2.6},
  {x:8,z:-24,w:3,d:3,h:1.2}, {x:-8,z:24,w:3,d:3,h:1.2},
  {x:26,z:20,w:3,d:3,h:1.6}, {x:-26,z:-20,w:3,d:3,h:1.6},
  {x:26,z:-20,w:3,d:3,h:1.6}, {x:-26,z:20,w:3,d:3,h:1.6},
  // climbable cover filling the open cross-gaps near spawn
  {x:0,z:14,w:3,d:3,h:1.3}, {x:0,z:-14,w:3,d:3,h:1.3},
  {x:14,z:0,w:3,d:3,h:1.3}, {x:-14,z:0,w:3,d:3,h:1.3},
  // raised platforms — climbable sniper perches at the far corners
  {x:32,z:32,w:5,d:5,h:1.7}, {x:-32,z:-32,w:5,d:5,h:1.7},
  {x:32,z:-32,w:5,d:5,h:1.7}, {x:-32,z:32,w:5,d:5,h:1.7},
  // decorative/climbable barrels for visual variety
  {x:10,z:3,w:0.9,d:0.9,h:1.0,shape:'cylinder'}, {x:-10,z:-3,w:0.9,d:0.9,h:1.0,shape:'cylinder'},
  {x:3,z:-10,w:0.9,d:0.9,h:1.0,shape:'cylinder'}, {x:-3,z:10,w:0.9,d:0.9,h:1.0,shape:'cylinder'},
  {x:18,z:-5,w:0.9,d:0.9,h:1.0,shape:'cylinder'}, {x:-18,z:5,w:0.9,d:0.9,h:1.0,shape:'cylinder'},
  {x:5,z:18,w:0.9,d:0.9,h:1.0,shape:'cylinder'}, {x:-5,z:-18,w:0.9,d:0.9,h:1.0,shape:'cylinder'},
  // perimeter
  {x:0,z:ARENA_HALF+1,w:ARENA_HALF*2+4,d:2,h:6},
  {x:0,z:-ARENA_HALF-1,w:ARENA_HALF*2+4,d:2,h:6},
  {x:ARENA_HALF+1,z:0,w:2,d:ARENA_HALF*2+4,h:6},
  {x:-ARENA_HALF-1,z:0,w:2,d:ARENA_HALF*2+4,h:6},
];

const BOT_NAMES = ['VIPER','RAZE','GHOST','PHANTOM','WOLF','FALCON','REAPER','COBRA','TITAN','NOVA'];

const WEAPON_SHAPES = {
  shotgun: '<rect x="4" y="10" width="46" height="5"/><rect x="50" y="10" width="10" height="7" rx="1"/><rect x="10" y="15" width="14" height="5" rx="1"/><rect x="30" y="15" width="8" height="10"/><rect x="6" y="6" width="10" height="4"/>',
  rifle: '<rect x="2" y="9" width="12" height="7"/><rect x="12" y="6" width="28" height="9"/><rect x="40" y="9" width="20" height="4"/><rect x="16" y="15" width="7" height="9"/><rect x="27" y="15" width="6" height="12"/>',
  sniper: '<rect x="2" y="10" width="14" height="6"/><rect x="14" y="8" width="24" height="7"/><rect x="16" y="1" width="18" height="5"/><rect x="20" y="6" width="2" height="3"/><rect x="30" y="6" width="2" height="3"/><rect x="38" y="10" width="24" height="3"/><rect x="24" y="15" width="6" height="11"/><rect x="45" y="13" width="2" height="11"/>',
};
function weaponSilhouetteSVG(type, cls){
  const shape = WEAPON_SHAPES[type] || WEAPON_SHAPES.rifle;
  return `<svg viewBox="0 0 64 26" class="${cls||''}">${shape}</svg>`;
}

/* ============================================================
   GLOBAL STATE
   ============================================================ */
const S = {
  mode: 'deathmatch',
  weaponIdx: 1,
  screen: 'menu',
  killTarget: 10,
  matchTime: 300,
  timeLeft: 300,
  zoneRadius: ARENA_HALF*1.35,
  zoneTargetRadius: ARENA_HALF*1.35,
  zombieWave: 1,
  bombState: 'seeking', bombSite: {x:0,z:0}, bombTimer: 0, plantProgress: 0, defuseProgress: 0,
  sens: 90, adsSens: 60, haptic: true,
  crosshairStyle: 'default',
  hudLayout: {}, // key -> {left,bottom,size} in px, screen-relative
};

// registry of every independently-repositionable & resizable control
const HUD_ELEMENTS = [
  { key:'joy', elId:'joystickZone', varX:'--joy-left', varY:'--joy-bottom', varSize:'--joy-size', anchorX:'left',
    defLeft:20, defBottom:30, size:130, sizeMin:90, sizeMax:190, shape:'circle', label:'이동' },
  { key:'jump', elId:'jumpBtn', varX:'--jump-left', varY:'--jump-bottom', varSize:'--jump-size', anchorX:'left',
    defLeft:20, defBottom:292, size:50, sizeMin:36, sizeMax:80, shape:'circle', label:'점프' },
  { key:'crouch', elId:'crouchBtn', varX:'--crouch-left', varY:'--crouch-bottom', varSize:'--crouch-size', anchorX:'left',
    defLeft:20, defBottom:232, size:50, sizeMin:36, sizeMax:80, shape:'circle', label:'앉기' },
  { key:'heal', elId:'healBtn', varX:'--heal-left', varY:'--heal-bottom', varSize:'--heal-size', anchorX:'left',
    defLeft:20, defBottom:172, size:50, sizeMin:36, sizeMax:80, shape:'circle', label:'힐' },
  { key:'fire', elId:'fireBtn', varX:'--fire-right', varY:'--fire-bottom', varSize:'--fire-size', anchorX:'right',
    defLeft:null, defRight:20, defBottom:28, size:82, sizeMin:56, sizeMax:120, shape:'circle', label:'발사' },
  { key:'ads', elId:'adsBtn', varX:'--ads-right', varY:'--ads-bottom', varSize:'--ads-size', anchorX:'right',
    defLeft:null, defRight:114, defBottom:34, size:52, sizeMin:36, sizeMax:76, shape:'circle', label:'조준' },
  { key:'reload', elId:'reloadBtn', varX:'--reload-right', varY:'--reload-bottom', varSize:'--reload-size', anchorX:'right',
    defLeft:null, defRight:178, defBottom:34, size:52, sizeMin:36, sizeMax:76, shape:'circle', label:'장전' },
  { key:'weapons', elId:'weaponSwitcher', varX:'--weapons-right', varY:'--weapons-bottom', varSize:'--weapons-size', anchorX:'right',
    defLeft:null, defRight:20, defBottom:180, size:46, sizeMin:30, sizeMax:64, w:46, h:160, shape:'rect', label:'무기' },
  { key:'flash', elId:'flashBtn', varX:'--flash-right', varY:'--flash-bottom', varSize:'--flash-size', anchorX:'right',
    defLeft:null, defRight:114, defBottom:96, size:46, sizeMin:34, sizeMax:68, shape:'circle', label:'섬광' },
  { key:'smoke', elId:'smokeBtn', varX:'--smoke-right', varY:'--smoke-bottom', varSize:'--smoke-size', anchorX:'right',
    defLeft:null, defRight:178, defBottom:96, size:46, sizeMin:34, sizeMax:68, shape:'circle', label:'연막' },
];

const HUD_PREFS_KEY = 'sp_hudPrefs';
function loadHudPrefs(){
  try{
    const raw = localStorage.getItem(HUD_PREFS_KEY);
    if(!raw) return;
    const p = JSON.parse(raw);
    if(p.crosshairStyle) S.crosshairStyle = p.crosshairStyle;
    if(p.hudLayout && typeof p.hudLayout==='object') S.hudLayout = p.hudLayout;
    if(typeof p.joySize==='number'){
      // migrate legacy joystick-only size field into the unified per-element layout
      const joyDef = HUD_ELEMENTS.find(d=>d.key==='joy');
      if(!S.hudLayout.joy) S.hudLayout.joy = hudDefaultPos(joyDef);
      if(!S.hudLayout.joy.size) S.hudLayout.joy.size = p.joySize;
    }
  }catch(e){}
}
function saveHudPrefs(){
  try{
    localStorage.setItem(HUD_PREFS_KEY, JSON.stringify({
      crosshairStyle: S.crosshairStyle, hudLayout: S.hudLayout,
    }));
  }catch(e){}
}
function applyCrosshairStyle(){
  const ch = document.getElementById('crosshair');
  ch.classList.remove('style-default','style-dot','style-cross');
  ch.classList.add('style-'+S.crosshairStyle);
}
function applyHudLayout(){
  const root = document.documentElement.style;
  HUD_ELEMENTS.forEach(def=>{
    const pos = S.hudLayout[def.key];
    const size = (pos && pos.size) || def.size;
    if(pos){
      const xVal = def.anchorX==='left' ? pos.left : (innerWidth - pos.left - size);
      root.setProperty(def.varX, Math.round(xVal)+'px');
      root.setProperty(def.varY, Math.round(pos.bottom)+'px');
    } else {
      root.removeProperty(def.varX);
      root.removeProperty(def.varY);
    }
    root.setProperty(def.varSize, Math.round(size)+'px');
  });
}
function hudDefaultPos(def){
  const left = def.anchorX==='left' ? def.defLeft : (innerWidth - def.defRight - def.size);
  return { left, bottom: def.defBottom, size: def.size };
}

let scene, camera, renderer, clock;
let envMeshes = [];
let bots = [];
let player = null;
let viewmodel = null;
let raycaster = new THREE.Raycaster();
let running = false;
let audioCtx = null;
let bombSiteMesh = null;

/* ============================================================
   AUDIO (procedural, no assets)
   ============================================================ */
function ac(){ if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } return audioCtx; }
const shotBufferCache = {};
function getShotBuffer(type){
  // synthesizing noise per-shot caused main-thread jank (dropped look input while firing);
  // build each weapon's noise buffer once and reuse the data across shots.
  if(shotBufferCache[type]) return shotBufferCache[type];
  const c = ac();
  const dur = type==='sniper' ? 0.22 : type==='shotgun' ? 0.16 : 0.09;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate*dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<d.length;i++){ d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2); }
  shotBufferCache[type] = buf;
  return buf;
}
function playShot(type){
  try{
    const c = ac(); const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = getShotBuffer(type);
    const filt = c.createBiquadFilter(); filt.type='bandpass';
    filt.frequency.value = type==='sniper'?900:type==='pistol'?1600:type==='shotgun'?750:1200;
    const gain = c.createGain(); gain.gain.value = 0.5;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start(t);
  }catch(e){}
}
function playTone(freq, dur, vol){
  try{
    const c = ac(); const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type='sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+dur);
  }catch(e){}
}
function playHitSound(crit){ playTone(crit?1500:900, 0.09, 0.25); }
function playKillSound(){ playTone(500,0.08,0.3); setTimeout(()=>playTone(750,0.14,0.3),70); }
function playHurtSound(){ playTone(160,0.18,0.3); }
function vibrate(ms){ if(S.haptic && navigator.vibrate) navigator.vibrate(ms); }

/* ============================================================
   PROCEDURAL TEXTURES (no external assets)
   ============================================================ */
function hexToRgb(hex){ return [(hex>>16)&255, (hex>>8)&255, hex&255]; }
function clamp255(v){ return Math.max(0, Math.min(255, v)); }

function makeNoiseTexture(baseHex, variance, size, repeatX, repeatY, opts){
  opts = opts || {};
  const [br,bg,bb] = hexToRgb(baseHex);
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext('2d');
  const img = ctx.createImageData(size, size);
  for(let i=0;i<size*size;i++){
    const n = (Math.random()-0.5)*variance;
    const blotch = opts.blotch ? Math.sin(i*0.013)*opts.blotch : 0;
    img.data[i*4]   = clamp255(br+n+blotch);
    img.data[i*4+1] = clamp255(bg+n+blotch);
    img.data[i*4+2] = clamp255(bb+n+blotch);
    img.data[i*4+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if(opts.planks){
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for(let y=0;y<size;y+=size/opts.planks){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke();
    }
  }
  if(opts.panels){
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 3;
    for(let y=0;y<size;y+=size/opts.panels){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke();
    }
    for(let x=0;x<size;x+=size/3){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildSkyDome(){
  const geo = new THREE.SphereGeometry(280, 24, 16);
  const zenith = new THREE.Color(0x2f6fb0);
  const horizon = new THREE.Color(0xbcd6e8);
  const ground = new THREE.Color(0x8a9a86);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const y = pos.getY(i)/280;
    const c = y>=0 ? zenith.clone().lerp(horizon, Math.pow(1-Math.min(1,y*1.6),1.5))
                   : horizon.clone().lerp(ground, Math.min(1,-y*3));
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -1;
  return dome;
}

/* ============================================================
   THREE.JS SETUP
   ============================================================ */
function initThree(){
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xa8c2d4, 0.0125);

  camera = new THREE.PerspectiveCamera(78, innerWidth/innerHeight, 0.05, 500);
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  scene.add(buildSkyDome());

  const hemi = new THREE.HemisphereLight(0xdfefff, 0x556155, 1.05);
  scene.add(hemi);
  const fill = new THREE.AmbientLight(0x8fa2b8, 0.45);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(30, 45, 20);
  sun.castShadow = true;
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.bias = -0.0015;
  sun.shadow.radius = 3;
  scene.add(sun);

  const groundTex = makeNoiseTexture(0x5b6b57, 30, 256, ARENA_HALF/2.2, ARENA_HALF/2.2, { blotch:10 });
  const groundGeo = new THREE.PlaneGeometry(ARENA_HALF*2+6, ARENA_HALF*2+6, 20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness:0.96 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // lane markings for visual scale
  const lineMat = new THREE.MeshBasicMaterial({ color:0x4a584a });
  for(let i=-ARENA_HALF;i<=ARENA_HALF;i+=6){
    const g = new THREE.PlaneGeometry(0.08, ARENA_HALF*2);
    const m = new THREE.Mesh(g, lineMat); m.rotation.x=-Math.PI/2; m.position.set(i,0.01,0);
    scene.add(m);
  }

  const concreteTex = makeNoiseTexture(0x6d7a72, 22, 256, 2, 1, { panels:3 });
  const crateTex = makeNoiseTexture(0x8a7a5c, 24, 256, 1.5, 1.5, { planks:5 });
  const metalTex = makeNoiseTexture(0x7a8088, 18, 256, 1, 1, { panels:2 });
  OBSTACLES.forEach(o=>{
    const isCylinder = o.shape==='cylinder';
    const geo = isCylinder
      ? new THREE.CylinderGeometry(o.w/2, o.w/2, o.h, 14)
      : new THREE.BoxGeometry(o.w, o.h, o.d);
    const tex = isCylinder ? metalTex : (o.h>4 ? concreteTex : crateTex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness:0.85, metalness: isCylinder?0.3:0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(o.x, o.h/2, o.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.obstacle = o;
    scene.add(mesh);
    envMeshes.push(mesh);
  });

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
}
function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* ============================================================
   VIEWMODEL (procedural blocky gun)
   ============================================================ */
function buildViewmodel(){
  const group = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color:0x6b7178, roughness:0.5, metalness:0.25, emissive:0x14161a, emissiveIntensity:0.7 });
  const gripMat = new THREE.MeshStandardMaterial({ color:0x3a3a3a, roughness:0.8, metalness:0.05, emissive:0x0a0a0a, emissiveIntensity:0.7 });

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.028,0.028,0.34), gunMat);
  barrel.position.set(0,0.02,-0.42);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.075,0.2), gunMat);
  receiver.position.set(0,0.005,-0.17);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045,0.05,0.14), gripMat);
  stock.position.set(0,0.01,0.04);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042,0.13,0.045), gripMat);
  grip.position.set(0,-0.09,-0.05);
  grip.rotation.x = 0.28;
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032,0.12,0.042), gripMat);
  mag.position.set(0,-0.1,-0.16);
  mag.rotation.x = -0.18;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.018,0.022,0.05), gripMat);
  sight.position.set(0,0.055,-0.2);

  group.add(barrel, receiver, stock, grip, mag, sight);
  group.position.set(0.2, -0.22, -0.42);
  group.rotation.y = 0.16;
  group.rotation.x = -0.02;
  camera.add(group);
  return { group, baseX:0.2, baseY:-0.22, baseZ:-0.42, kick:0 };
}

/* ============================================================
   BOT
   ============================================================ */
function makeBot(id, opts){
  opts = opts || {};
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: opts.bodyColor||0xb03a3a, roughness:0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 8), bodyMat);
  body.position.y = 0.95; body.castShadow = true;
  const headMat = new THREE.MeshStandardMaterial({ color: opts.headColor||0xe0b088, roughness:0.6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), headMat);
  head.position.y = 1.68; head.castShadow = true;
  group.add(body, head);
  scene.add(group);

  const bot = {
    id, name: (opts.melee?'ZOMBIE':BOT_NAMES[id % BOT_NAMES.length]) + '_' + (id+1),
    group, body, head,
    hp: 100, maxHp: 100, alive: true,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    yaw: 0,
    state: 'patrol',
    shootCd: 0,
    respawnCd: 0,
    blindedUntil: 0,
    melee: !!opts.melee,
  };
  body.userData.bot = bot; head.userData.bot = bot; body.userData.part='body'; head.userData.part='head';
  return bot;
}

function randomSpawn(minDistFrom, avoid, clearance){
  clearance = clearance===undefined ? 0.6 : clearance;
  for(let tries=0; tries<30; tries++){
    const x = (Math.random()*2-1) * (ARENA_HALF-9);
    const z = (Math.random()*2-1) * (ARENA_HALF-9);
    if(avoid && Math.hypot(x-avoid.x, z-avoid.z) < minDistFrom) continue;
    if(!collidesObstacle(x,z,clearance)) return {x,z};
  }
  return {x:0,z:0};
}

function collidesObstacle(x,z,r){
  for(const o of OBSTACLES){
    const hw=o.w/2+r, hd=o.d/2+r;
    if(x>o.x-hw && x<o.x+hw && z>o.z-hd && z<o.z+hd) return true;
  }
  return false;
}
function resolveCollision(pos, r, footY){
  footY = footY || 0;
  for(const o of OBSTACLES){
    // climbable obstacles stop blocking horizontal movement once the entity is
    // already standing at/above their top, so the player can walk over them
    if(o.h<=CLIMB_MAX_H && footY>=o.h-0.12) continue;
    const hw=o.w/2+r, hd=o.d/2+r;
    if(pos.x>o.x-hw && pos.x<o.x+hw && pos.z>o.z-hd && pos.z<o.z+hd){
      const dxL = pos.x-(o.x-hw), dxR=(o.x+hw)-pos.x;
      const dzT = pos.z-(o.z-hd), dzB=(o.z+hd)-pos.z;
      const m = Math.min(dxL,dxR,dzT,dzB);
      if(m===dxL) pos.x = o.x-hw; else if(m===dxR) pos.x=o.x+hw;
      else if(m===dzT) pos.z = o.z-hd; else pos.z=o.z+hd;
    }
  }
  const d = Math.hypot(pos.x,pos.z);
  if(d>ARENA_HALF-1) { const s=(ARENA_HALF-1)/d; pos.x*=s; pos.z*=s; }
}
function groundHeightAt(x,z){
  let best = 0;
  for(const o of OBSTACLES){
    if(o.h>CLIMB_MAX_H) continue;
    const hw=o.w/2, hd=o.d/2;
    if(x>o.x-hw && x<o.x+hw && z>o.z-hd && z<o.z+hd && o.h>best) best=o.h;
  }
  return best;
}

function hasLineOfSight(a, b){
  const dir = new THREE.Vector3().subVectors(b,a);
  const dist = dir.length(); dir.normalize();
  raycaster.set(a, dir); raycaster.far = dist;
  const hits = raycaster.intersectObjects(envMeshes, false);
  if(hits.length>0) return false;
  return !segmentBlockedBySmoke(a,b);
}

/* ============================================================
   PLAYER
   ============================================================ */
function initPlayer(){
  player = {
    pos: new THREE.Vector3(0, 0, 12),
    vel: new THREE.Vector3(),
    yaw: Math.PI, pitch: 0, recoilOffset: 0, recoilKickH: 0,
    hp: 100, maxHp: 100, shield: 50, maxShield: 50,
    grounded: true, crouch: false, ads: false,
    kills:0, deaths:0, shotsFired:0, shotsHit:0, headshots:0,
    alive: true,
    weapons: [0,1,2],
    curWeaponSlot: 1,
    ammo: WEAPONS.map(w=>({ mag:w.magSize, reserve:w.reserveMax })),
    fireCd: 0, reloading:false, reloadT:0, invuln: 0,
    heals: 2, healing: false, healT: 0,
    grenades: { flash:2, smoke:2 }, throwCd: 0,
    planting: false,
  };
}
const HEAL_MAX = 5;
const HEAL_AMOUNT = 40;
const HEAL_TIME = 1200;
const HEAL_PICKUP_COUNT = 7;
let healPickups = [];

function tryUseHeal(){
  if(!player.alive || player.healing) return;
  if(player.heals<=0) return;
  if(player.hp>=player.maxHp) return;
  player.heals--;
  player.healing = true;
  player.healT = HEAL_TIME;
  updateHealUI();
  playTone(700, 0.1, 0.2);
}

function updateHealUI(){
  const btn = document.getElementById('healBtn');
  const count = document.getElementById('healCount');
  count.textContent = player.heals;
  const usable = player.heals>0 && player.hp<player.maxHp && !player.healing;
  btn.classList.toggle('empty', !usable);
}

function spawnHealPickups(){
  healPickups.forEach(p=>scene.remove(p.mesh));
  healPickups = [];
  for(let i=0;i<HEAL_PICKUP_COUNT;i++){
    const sp = randomSpawn(0, null, 1.5);
    const mat = new THREE.MeshStandardMaterial({ color:0x39d66b, emissive:0x1a6b34, emissiveIntensity:0.9, roughness:0.4 });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.14,0.42,0.14), mat));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.42,0.14,0.14), mat));
    group.position.set(sp.x, 0.55, sp.z);
    scene.add(group);
    healPickups.push({ mesh:group, x:sp.x, z:sp.z, collected:false });
  }
}

function updateHealPickups(dt){
  healPickups.forEach(p=>{
    if(p.collected) return;
    p.mesh.rotation.y += dt*1.6;
    p.mesh.position.y = 0.55 + Math.sin(performance.now()*0.003 + p.x)*0.08;
    if(!player.alive) return;
    const dist = Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
    if(dist<1.3){
      p.collected = true;
      scene.remove(p.mesh);
      player.heals = Math.min(HEAL_MAX, player.heals+1);
      updateHealUI();
      showPickupToast('회복 아이템 획득 +1');
      playTone(900, 0.08, 0.22);
    }
  });
}

const AMMO_PICKUP_COUNT = 6;
const AMMO_REFILL_FRACTION = 0.5;
let ammoPickups = [];

function spawnAmmoPickups(){
  ammoPickups.forEach(p=>scene.remove(p.mesh));
  ammoPickups = [];
  for(let i=0;i<AMMO_PICKUP_COUNT;i++){
    const sp = randomSpawn(0, null, 1.5);
    const mat = new THREE.MeshStandardMaterial({ color:0xd6a72e, emissive:0x6b4e0f, emissiveIntensity:0.9, roughness:0.5 });
    const group = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.24,0.24), mat);
    group.add(crate);
    group.position.set(sp.x, 0.45, sp.z);
    scene.add(group);
    ammoPickups.push({ mesh:group, x:sp.x, z:sp.z, collected:false });
  }
}

function updateAmmoPickups(dt){
  ammoPickups.forEach(p=>{
    if(p.collected) return;
    p.mesh.rotation.y += dt*1.6;
    p.mesh.position.y = 0.45 + Math.sin(performance.now()*0.003 + p.x)*0.08;
    if(!player.alive) return;
    const dist = Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
    if(dist<1.3){
      p.collected = true;
      scene.remove(p.mesh);
      WEAPONS.forEach((w, idx)=>{
        const a = player.ammo[idx];
        a.reserve = Math.min(w.reserveMax, a.reserve + Math.round(w.reserveMax*AMMO_REFILL_FRACTION));
      });
      updateAmmoUI();
      showPickupToast('탄약 보급 +');
      playTone(600, 0.08, 0.22);
    }
  });
}

/* ============================================================
   GRENADES — flashbang & smoke
   ============================================================ */
const GRENADE_SPEED = 15;
const FLASH_RADIUS = 14;
const SMOKE_RADIUS = 4.5;
const SMOKE_DURATION = 9000;
let activeGrenades = [];
let smokeVolumes = [];

function throwGrenade(type){
  if(!player.alive || player.throwCd>0) return;
  if(player.grenades[type]<=0) return;
  player.grenades[type]--;
  player.throwCd = 600;
  updateNadeUI();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);

  const geo = new THREE.SphereGeometry(0.08, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: type==='flash'?0xd8d8c0:0x555555, roughness:0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);
  mesh.castShadow = true;
  scene.add(mesh);

  const vel = dir.clone().multiplyScalar(GRENADE_SPEED);
  vel.y += 2.5;
  activeGrenades.push({ mesh, vel, type, fuse:1.6 });
  playTone(500, 0.06, 0.15);
}

function updateGrenades(dt){
  for(let i=activeGrenades.length-1;i>=0;i--){
    const g = activeGrenades[i];
    g.vel.y += GRAVITY*dt;
    g.mesh.position.addScaledVector(g.vel, dt);
    g.fuse -= dt;
    const hitGround = g.mesh.position.y<=0.15;
    if(hitGround) g.mesh.position.y = 0.15;
    const hitObstacle = g.mesh.position.y<2.5 && collidesObstacle(g.mesh.position.x, g.mesh.position.z, 0.2);
    if(hitGround || hitObstacle || g.fuse<=0){
      detonateGrenade(g);
      scene.remove(g.mesh);
      activeGrenades.splice(i,1);
    }
  }
}

function detonateGrenade(g){
  if(g.type==='flash') detonateFlash(g.mesh.position.clone());
  else detonateSmoke(g.mesh.position.clone());
}

function detonateFlash(pos){
  playTone(1800, 0.15, 0.35);
  if(player.alive){
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const dist = camPos.distanceTo(pos);
    if(dist<FLASH_RADIUS && hasLineOfSight(camPos, pos)){
      flashBlindPlayer(Math.max(0.25, 1 - dist/FLASH_RADIUS));
    }
  }
  bots.forEach(b=>{
    if(!b.alive) return;
    const botHead = new THREE.Vector3(b.pos.x, 1.6, b.pos.z);
    const dist = botHead.distanceTo(pos);
    if(dist<FLASH_RADIUS && hasLineOfSight(botHead, pos)){
      b.blindedUntil = performance.now() + 2200 + (1-dist/FLASH_RADIUS)*1500;
    }
  });
}
function flashBlindPlayer(strength){
  const el = document.getElementById('flashWhite');
  el.style.transition = 'none';
  el.style.opacity = String(Math.min(1, strength+0.25));
  void el.offsetWidth;
  el.style.transition = 'opacity 2.4s ease-out';
  el.style.opacity = '0';
  vibrate(60);
}

function detonateSmoke(pos){
  playTone(300, 0.2, 0.3);
  const mat = new THREE.MeshBasicMaterial({ color:0xaaaaaa, transparent:true, opacity:0.55, depthWrite:false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SMOKE_RADIUS, 12, 10), mat);
  mesh.position.copy(pos);
  mesh.position.y = Math.max(mesh.position.y, SMOKE_RADIUS*0.5);
  mesh.scale.setScalar(0.1);
  scene.add(mesh);
  const now = performance.now();
  smokeVolumes.push({ x:mesh.position.x, y:mesh.position.y, z:mesh.position.z, r:SMOKE_RADIUS, mesh, bornAt:now, expireAt:now+SMOKE_DURATION });
}

function updateSmokeVolumes(){
  const now = performance.now();
  for(let i=smokeVolumes.length-1;i>=0;i--){
    const s = smokeVolumes[i];
    const growT = Math.min(1, (now-s.bornAt)/500);
    const remain = s.expireAt-now;
    const fadeT = remain<1500 ? Math.max(0, remain/1500) : 1;
    s.mesh.scale.setScalar(0.15+0.85*growT);
    s.mesh.material.opacity = 0.55*fadeT;
    if(remain<=0){
      scene.remove(s.mesh);
      smokeVolumes.splice(i,1);
    }
  }
}
function segmentBlockedBySmoke(a,b){
  if(smokeVolumes.length===0) return false;
  const dir = new THREE.Vector3().subVectors(b,a);
  const len = dir.length();
  if(len<1e-6) return false;
  dir.normalize();
  for(const s of smokeVolumes){
    const toCenter = new THREE.Vector3(s.x-a.x, s.y-a.y, s.z-a.z);
    const t = THREE.MathUtils.clamp(toCenter.dot(dir), 0, len);
    const closest = new THREE.Vector3(a.x+dir.x*t, a.y+dir.y*t, a.z+dir.z*t);
    if(closest.distanceTo(new THREE.Vector3(s.x,s.y,s.z)) < s.r) return true;
  }
  return false;
}
function clearGrenadeState(){
  activeGrenades.forEach(g=>scene.remove(g.mesh));
  activeGrenades = [];
  smokeVolumes.forEach(s=>scene.remove(s.mesh));
  smokeVolumes = [];
}
function updateNadeUI(){
  document.getElementById('flashCount').textContent = player.grenades.flash;
  document.getElementById('smokeCount').textContent = player.grenades.smoke;
  document.getElementById('flashBtn').classList.toggle('empty', player.grenades.flash<=0);
  document.getElementById('smokeBtn').classList.toggle('empty', player.grenades.smoke<=0);
}

function showPickupToast(text){
  const el = document.getElementById('pickupToast');
  el.textContent = text;
  el.classList.remove('hidden'); void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showPickupToast._t);
  showPickupToast._t = setTimeout(()=>{ el.classList.remove('show'); }, 1400);
}
function curWeapon(){ return WEAPONS[player.weapons[player.curWeaponSlot]]; }
function curAmmo(){ return player.ammo[player.weapons[player.curWeaponSlot]]; }

function respawnPlayer(){
  const avoid = S.mode==='bomb' ? S.bombSite : null;
  const minDist = S.mode==='bomb' ? 16 : 10;
  const sp = randomSpawn(minDist, avoid, 3.5);
  player.pos.set(sp.x, 0, sp.z);
  player.vel.set(0,0,0);
  player.hp = player.maxHp; player.shield = player.maxShield;
  player.alive = true; player.reloading=false;
  player.invuln = 2.5;
  player.ads = false;
  document.getElementById('adsBtn').classList.remove('active');
  updateAdsSight(curWeapon());
  updateHealthUI();
}

/* ============================================================
   INPUT — dual virtual sticks (Pointer Events)
   ============================================================ */
const input = {
  moveX:0, moveY:0, moveId:null,
  lookId:null, lookLastX:0, lookLastY:0,
  fireHeld:false,
};

function safeCapture(el, pointerId){
  try{ el.setPointerCapture(pointerId); }catch(e){}
}

function setupInput(){
  const joyZone = document.getElementById('joystickZone');
  const joyStick = document.getElementById('joystickStick');
  const lookZone = document.getElementById('lookZone');

  joyZone.addEventListener('pointerdown', e=>{
    input.moveId = e.pointerId; safeCapture(joyZone, e.pointerId);
    updateStick(e);
  });
  joyZone.addEventListener('pointermove', e=>{ if(e.pointerId===input.moveId) updateStick(e); });
  const endJoy = e=>{ if(e.pointerId===input.moveId){ input.moveId=null; input.moveX=0; input.moveY=0; joyStick.style.transform='translate(-50%,-50%)'; } };
  joyZone.addEventListener('pointerup', endJoy);
  joyZone.addEventListener('pointercancel', endJoy);

  function updateStick(e){
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left+rect.width/2, cy = rect.top+rect.height/2;
    let dx = e.clientX-cx, dy = e.clientY-cy;
    const max = rect.width/2;
    const d = Math.hypot(dx,dy);
    if(d>max){ dx = dx/d*max; dy = dy/d*max; }
    joyStick.style.transform = `translate(-50%,-50%) translate(${dx}px,${dy}px)`;
    input.moveX = dx/max; input.moveY = dy/max;
  }

  lookZone.addEventListener('pointerdown', e=>{
    if(e.pointerId===input.moveId) return;
    input.lookId = e.pointerId; input.lookLastX=e.clientX; input.lookLastY=e.clientY;
    safeCapture(lookZone, e.pointerId);
  });
  lookZone.addEventListener('pointermove', e=>{
    if(e.pointerId!==input.lookId) return;
    const dx = e.clientX-input.lookLastX, dy = e.clientY-input.lookLastY;
    input.lookLastX=e.clientX; input.lookLastY=e.clientY;
    const sensBase = (player.ads ? S.adsSens : S.sens) / 15000;
    player.yaw -= dx*sensBase;
    player.pitch -= dy*sensBase;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  });
  const endLook = e=>{ if(e.pointerId===input.lookId) input.lookId=null; };
  lookZone.addEventListener('pointerup', endLook);
  lookZone.addEventListener('pointercancel', endLook);

  // fire
  const fireBtn = document.getElementById('fireBtn');
  fireBtn.addEventListener('pointerdown', e=>{ fireBtn.classList.add('active'); input.fireHeld=true; safeCapture(fireBtn, e.pointerId); tryFire(true); });
  const stopFire = ()=>{ fireBtn.classList.remove('active'); input.fireHeld=false; };
  fireBtn.addEventListener('pointerup', stopFire);
  fireBtn.addEventListener('pointercancel', stopFire);

  // ads
  const adsBtn = document.getElementById('adsBtn');
  adsBtn.addEventListener('pointerdown', e=>{
    player.ads = !player.ads;
    adsBtn.classList.toggle('active', player.ads);
    safeCapture(adsBtn, e.pointerId);
  });

  // jump
  document.getElementById('jumpBtn').addEventListener('pointerdown', ()=>{ if(player.grounded && !player.crouch){ player.vel.y = JUMP_SPEED; player.grounded=false; } });
  // crouch toggle
  const crouchBtn = document.getElementById('crouchBtn');
  crouchBtn.addEventListener('pointerdown', ()=>{ player.crouch = !player.crouch; crouchBtn.classList.toggle('active', player.crouch); });
  // reload
  document.getElementById('reloadBtn').addEventListener('pointerdown', doReload);
  document.getElementById('healBtn').addEventListener('pointerdown', tryUseHeal);
  document.getElementById('flashBtn').addEventListener('pointerdown', ()=>throwGrenade('flash'));
  document.getElementById('smokeBtn').addEventListener('pointerdown', ()=>throwGrenade('smoke'));

  // bomb-mode plant hold button
  const plantBtn = document.getElementById('plantBtn');
  plantBtn.addEventListener('pointerdown', e=>{ player.planting = true; safeCapture(plantBtn, e.pointerId); });
  const stopPlant = ()=>{ player.planting = false; };
  plantBtn.addEventListener('pointerup', stopPlant);
  plantBtn.addEventListener('pointercancel', stopPlant);

  // weapon switcher built dynamically
  buildWeaponSwitcher();

  // pause — opens settings without stopping the match (bots/timer keep ticking)
  document.getElementById('pauseBtn').addEventListener('pointerdown', openSettingsPanel);
}

function openSettingsPanel(){
  document.getElementById('quitMatchBtn').classList.toggle('hidden', !running);
  document.getElementById('settingsPanel').classList.remove('hidden');
}

function buildWeaponSwitcher(){
  const el = document.getElementById('weaponSwitcher');
  el.innerHTML='';
  player.weapons.forEach((wIdx, slot)=>{
    const w = WEAPONS[wIdx];
    const btn = document.createElement('button');
    btn.className = 'wSlot' + (slot===player.curWeaponSlot?' active':'');
    btn.innerHTML = weaponSilhouetteSVG(w.type, 'wSlotIcon');
    btn.addEventListener('pointerdown', ()=>switchWeapon(slot));
    el.appendChild(btn);
  });
}
function switchWeapon(slot){
  if(player.reloading) return;
  player.curWeaponSlot = slot;
  player.ads=false;
  document.getElementById('adsBtn').classList.remove('active');
  updateAdsSight(curWeapon());
  [...document.getElementById('weaponSwitcher').children].forEach((c,i)=>c.classList.toggle('active', i===slot));
  updateWeaponUI();
}

function doReload(){
  const w = curWeapon(); const a = curAmmo();
  if(player.reloading || a.mag>=w.magSize || a.reserve<=0) return;
  player.reloading = true; player.reloadT = w.reloadTime;
  document.getElementById('reloadBtn').classList.add('active');
}

/* ============================================================
   FIRE / HIT DETECTION
   ============================================================ */
function tryFire(fromDown){
  const w = curWeapon(); const a = curAmmo();
  if(!player.alive || player.reloading) return;
  if(player.fireCd>0) return;
  if(a.mag<=0){ doReload(); return; }
  player.fireCd = w.fireRate;
  a.mag--;
  player.shotsFired++;
  updateAmmoUI();

  const moving = Math.hypot(input.moveX,input.moveY) > 0.15;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const targets = [];
  bots.forEach(b=>{ if(b.alive){ targets.push(b.body, b.head); } });
  const allTargets = [...targets, ...envMeshes];

  const pelletCount = w.pellets || 1;
  let anyHit = false, anyHeadHit = false;
  for(let p=0; p<pelletCount; p++){
    let spread = w.pellets ? (player.ads ? w.adsPelletSpread : w.pelletSpread) : (player.ads ? w.adsSpread : w.spread);
    if(moving) spread *= w.moveSpreadMul;
    if(player.crouch) spread *= 0.6;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.x += (Math.random()*2-1)*spread;
    dir.y += (Math.random()*2-1)*spread;
    dir.z += (Math.random()*2-1)*spread;
    dir.normalize();

    raycaster.set(origin, dir);
    raycaster.far = w.pellets ? 45 : 200;
    const hits = raycaster.intersectObjects(allTargets, false);
    if(hits.length>0){
      const hit = hits[0];
      const bot = hit.object.userData.bot;
      if(bot){
        const isHead = hit.object.userData.part==='head';
        const dmg = w.damage * (isHead ? w.headMul : 1);
        damageBot(bot, dmg, isHead);
        anyHit = true; if(isHead) anyHeadHit = true;
        hitBotsThisShot.add(bot);
      }
    }
  }
  if(anyHit){
    player.shotsHit++;
    if(anyHeadHit) player.headshots++;
    showHitmarker(anyHeadHit);
  }
  playShot(w.type);
  recoilKick(w);
  flashMuzzle();
  vibrate(w.type==='sniper'?30:12);
}

function recoilKick(w){
  player.recoilOffset += w.kick;
  player.recoilKickH += (Math.random()*2-1)*w.kick*0.35;
  if(viewmodel) viewmodel.kick = 1;
}
function flashMuzzle(){
  const ch = document.getElementById('crosshair');
  ch.classList.add('firing');
  setTimeout(()=>ch.classList.remove('firing'), 90);
}
function showHitmarker(crit){
  const hm = document.getElementById('hitmarker');
  hm.classList.remove('show','crit'); void hm.offsetWidth;
  hm.classList.add('show'); if(crit) hm.classList.add('crit');
  clearTimeout(showHitmarker._t);
  showHitmarker._t = setTimeout(()=>hm.classList.remove('show','crit'), 220);
  playHitSound(crit);
}

function damageBot(bot, dmg, isHead){
  if(!bot.alive) return;
  bot.hp -= dmg;
  if(bot.hp<=0){
    bot.alive = false;
    bot.group.visible = false;
    player.kills++;
    pushKillFeed(`YOU ELIMINATED ${bot.name}${isHead?' (헤드샷)':''}`, true);
    showKillBanner(isHead ? 'HEADSHOT KILL' : 'ELIMINATED');
    playKillSound(); vibrate(40);
    updateScoreUI();
    checkWinCondition();
    if(S.mode==='deathmatch'){ bot.respawnCd = 3000; }
    else { checkAliveBots(); }
  }
}

function checkAliveBots(){
  const alive = bots.filter(b=>b.alive).length;
  if(S.mode==='battle' && alive===0){ endMatch('win'); }
}

/* ============================================================
   ZOMBIE SURVIVAL MODE
   ============================================================ */
let zombieWaveTimer = 0;
function spawnZombieWave(){
  bots.forEach(b=>scene.remove(b.group));
  bots = [];
  const count = Math.min(16, 3 + S.zombieWave*2);
  for(let i=0;i<count;i++){
    const bot = makeBot(i, { melee:true, bodyColor:0x4a7a3a, headColor:0x8aa06a });
    const ang = Math.random()*Math.PI*2;
    const dist = ARENA_HALF-3;
    const sp = { x: Math.cos(ang)*dist, z: Math.sin(ang)*dist };
    bot.pos.set(sp.x,0,sp.z);
    bot.group.position.set(sp.x,0,sp.z);
    bots.push(bot);
  }
  pushKillFeed(`웨이브 ${S.zombieWave} 시작 — 좀비 ${count}`, false);
}
function updateZombieWaves(dt){
  if(zombieWaveTimer>0){
    zombieWaveTimer -= dt;
    if(zombieWaveTimer<=0) spawnZombieWave();
    return;
  }
  if(bots.length>0 && bots.every(b=>!b.alive)){
    S.zombieWave++;
    zombieWaveTimer = 2.5;
    pushKillFeed('다음 웨이브 접근 중...', false);
  }
}

/* ============================================================
   BOMB PLANT/DEFUSE MODE
   ============================================================ */
const BOMB_PLANT_RADIUS = 2.2;
const BOMB_DEFUSE_RADIUS = 1.6;
const BOMB_PLANT_TIME = 3000;
const BOMB_TIMER_MS = 42000;
const BOMB_DEFUSE_TIME = 5000;

function buildBombSiteMesh(){
  const group = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({ color:0xff3b3b, emissive:0xaa1010, emissiveIntensity:1.1, roughness:0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 8, 24), ringMat);
  ring.rotation.x = -Math.PI/2;
  ring.position.y = 0.05;
  const beamMat = new THREE.MeshBasicMaterial({ color:0xff5050, transparent:true, opacity:0.22 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,10,8), beamMat);
  beam.position.y = 5;
  group.add(ring, beam);
  return group;
}

function setRingProgress(id, t){
  const el = document.getElementById(id);
  if(el) el.style.strokeDashoffset = String(100*(1-t));
}

function updateBomb(dt){
  const plantBtn = document.getElementById('plantBtn');
  if(S.bombState==='seeking'){
    const dist = player.alive ? Math.hypot(player.pos.x-S.bombSite.x, player.pos.z-S.bombSite.z) : Infinity;
    const inRange = dist < BOMB_PLANT_RADIUS;
    plantBtn.classList.toggle('hidden', !inRange || !player.alive);
    if(inRange && player.planting){
      S.plantProgress = Math.min(1, S.plantProgress + dt*1000/BOMB_PLANT_TIME);
    } else {
      S.plantProgress = Math.max(0, S.plantProgress - dt*1000/800);
    }
    setRingProgress('plantRingFg', S.plantProgress);
    document.getElementById('matchTimer').textContent = inRange ? '설치 위치' : '사이트로 이동';
    if(S.plantProgress>=1){
      S.bombState = 'planted';
      S.bombTimer = BOMB_TIMER_MS;
      plantBtn.classList.add('hidden');
      pushKillFeed('폭탄 설치 완료! 방어하세요', true);
      playTone(1200, 0.2, 0.3);
    }
  } else if(S.bombState==='planted'){
    S.bombTimer -= dt*1000;
    document.getElementById('matchTimer').textContent = formatTime(S.bombTimer/1000);
    let anyNear = false;
    bots.forEach(b=>{
      if(!b.alive) return;
      if(Math.hypot(b.pos.x-S.bombSite.x, b.pos.z-S.bombSite.z) < BOMB_DEFUSE_RADIUS) anyNear = true;
    });
    S.defuseProgress = anyNear
      ? Math.min(1, S.defuseProgress + dt*1000/BOMB_DEFUSE_TIME)
      : Math.max(0, S.defuseProgress - dt*1000/2000);
    if(S.defuseProgress>=1){
      S.bombState = 'defused';
      if(running) endMatch('lose');
      return;
    }
    if(S.bombTimer<=0){
      S.bombState = 'exploded';
      if(running) endMatch('win');
    }
  }
}

function damagePlayer(dmg){
  if(!player.alive || player.invuln>0) return;
  let remain = dmg;
  if(player.shield>0){
    const use = Math.min(player.shield, remain);
    player.shield -= use; remain -= use;
  }
  player.hp -= remain;
  flashDamage();
  playHurtSound(); vibrate(25);
  if(player.hp<=0){
    player.hp = 0; player.alive = false;
    player.deaths++;
    pushKillFeed(`YOU WERE ELIMINATED`, false);
    updateScoreUI();
    if(S.mode==='deathmatch'){ setTimeout(()=>{ if(running){ respawnPlayer(); } }, 2200); }
    else { endMatch('lose'); }
  }
  updateHealthUI();
  updateHealUI();
}
function flashDamage(){
  const dv = document.getElementById('damageVignette');
  dv.style.opacity=1; setTimeout(()=>dv.style.opacity=0, 220);
}

/* ============================================================
   BOT AI
   ============================================================ */
function updateBots(dt){
  const playerPos3 = new THREE.Vector3(player.pos.x, 1.4, player.pos.z);
  bots.forEach(bot=>{
    if(!bot.alive){
      if(S.mode==='deathmatch'){
        bot.respawnCd -= dt*1000;
        if(bot.respawnCd<=0){
          const sp = randomSpawn(8, player.pos, 2.5);
          bot.pos.set(sp.x,0,sp.z); bot.hp = bot.maxHp; bot.alive=true; bot.group.visible=true;
          bot.state='patrol';
        }
      }
      return;
    }
    if(bot.melee){
      if(player.alive){
        const dx = player.pos.x-bot.pos.x, dz = player.pos.z-bot.pos.z;
        const dist = Math.hypot(dx,dz);
        bot.yaw = Math.atan2(dx,dz);
        if(dist>1.3){
          const spd = 2.4;
          bot.pos.x += Math.sin(bot.yaw)*spd*dt;
          bot.pos.z += Math.cos(bot.yaw)*spd*dt;
        } else {
          bot.shootCd -= dt*1000;
          if(bot.shootCd<=0){
            bot.shootCd = 650;
            damagePlayer(9 + Math.random()*7);
          }
        }
      }
      resolveCollision(bot.pos, 0.5);
      bot.group.position.set(bot.pos.x, 0, bot.pos.z);
      bot.group.rotation.y = bot.yaw;
      return;
    }

    if(S.mode==='bomb' && S.bombState==='planted'){
      const dx = S.bombSite.x-bot.pos.x, dz = S.bombSite.z-bot.pos.z;
      const dist = Math.hypot(dx,dz);
      bot.yaw = Math.atan2(dx,dz);
      if(dist>0.6){
        const spd = 3.0;
        bot.pos.x += Math.sin(bot.yaw)*spd*dt;
        bot.pos.z += Math.cos(bot.yaw)*spd*dt;
      }
      if(player.alive){
        const distToPlayer = bot.pos.distanceTo(player.pos);
        if(distToPlayer<14 && hasLineOfSight(new THREE.Vector3(bot.pos.x,1.6,bot.pos.z), new THREE.Vector3(player.pos.x,1.4,player.pos.z))){
          bot.shootCd -= dt*1000;
          if(bot.shootCd<=0){
            bot.shootCd = 1000 + Math.random()*500;
            if(Math.random()<0.45) damagePlayer(6+Math.random()*6);
            playShot('rifle');
          }
        }
      }
      resolveCollision(bot.pos, 0.5);
      bot.group.position.set(bot.pos.x, 0, bot.pos.z);
      bot.group.rotation.y = bot.yaw;
      return;
    }

    const botHead = new THREE.Vector3(bot.pos.x, 1.6, bot.pos.z);
    const distToPlayer = bot.pos.distanceTo(player.pos);
    const blinded = performance.now() < bot.blindedUntil;
    const canSee = !blinded && player.alive && distToPlayer<32 && hasLineOfSight(botHead, playerPos3);

    if(canSee){ bot.state='combat'; }
    else if(bot.state==='combat'){ bot.state='patrol'; bot.target=null; }

    if(bot.state==='combat' && player.alive){
      const dx = player.pos.x-bot.pos.x, dz = player.pos.z-bot.pos.z;
      bot.yaw = Math.atan2(dx,dz);
      if(distToPlayer>7){
        const spd = 3.2;
        bot.pos.x += Math.sin(bot.yaw)*spd*dt;
        bot.pos.z += Math.cos(bot.yaw)*spd*dt;
      } else if(distToPlayer<4){
        bot.pos.x -= Math.sin(bot.yaw)*2*dt;
        bot.pos.z -= Math.cos(bot.yaw)*2*dt;
      }
      bot.shootCd -= dt*1000;
      if(bot.shootCd<=0){
        bot.shootCd = 900 + Math.random()*600;
        const acc = 0.6 - Math.min(distToPlayer/40, 0.35);
        if(Math.random() < acc){
          const dmg = 6 + Math.random()*7;
          damagePlayer(dmg);
        }
        playShot('rifle');
      }
    } else {
      if(!bot.target || bot.pos.distanceTo(bot.target)<1.5){
        const sp = randomSpawn(0, null);
        bot.target = new THREE.Vector3(sp.x,0,sp.z);
      }
      const dx = bot.target.x-bot.pos.x, dz = bot.target.z-bot.pos.z;
      bot.yaw = Math.atan2(dx,dz);
      const spd = 1.6;
      bot.pos.x += Math.sin(bot.yaw)*spd*dt;
      bot.pos.z += Math.cos(bot.yaw)*spd*dt;
    }

    if(S.mode==='battle'){
      const distCenter = Math.hypot(bot.pos.x,bot.pos.z);
      if(distCenter>S.zoneRadius-2){
        bot.pos.x *= 0.98; bot.pos.z *= 0.98;
      }
    }

    resolveCollision(bot.pos, 0.5);
    bot.group.position.set(bot.pos.x, 0, bot.pos.z);
    bot.group.rotation.y = bot.yaw;
  });
}

/* ============================================================
   PLAYER MOVEMENT
   ============================================================ */
function updatePlayer(dt){
  if(!player.alive){ return; }
  player.invuln = Math.max(0, player.invuln - dt);
  player.fireCd = Math.max(0, player.fireCd - dt*1000);
  player.throwCd = Math.max(0, player.throwCd - dt*1000);
  if(input.fireHeld){
    const w = curWeapon();
    if(w.auto) tryFire(false);
  }

  if(player.reloading){
    player.reloadT -= dt*1000;
    if(player.reloadT<=0){
      const w = curWeapon(); const a = curAmmo();
      const need = w.magSize-a.mag;
      const take = Math.min(need, a.reserve);
      a.mag += take; a.reserve -= take;
      player.reloading=false;
      document.getElementById('reloadBtn').classList.remove('active');
      updateAmmoUI();
    }
  }

  if(player.healing){
    player.healT -= dt*1000;
    if(player.healT<=0){
      player.healing = false;
      player.hp = Math.min(player.maxHp, player.hp+HEAL_AMOUNT);
      updateHealthUI();
      updateHealUI();
      playTone(1100, 0.12, 0.25);
    }
  }

  const adsWeapon = curWeapon();
  const targetFov = player.ads ? 78/adsWeapon.adsZoom : 78;
  camera.fov += (targetFov-camera.fov) * Math.min(1, dt*8);
  camera.updateProjectionMatrix();
  document.getElementById('crosshair').classList.toggle('ads', player.ads);
  updateAdsSight(adsWeapon);

  const speedBase = player.crouch ? 2.0 : (player.ads ? 2.6 : 4.6);
  const mx = Math.abs(input.moveX)>0.08 ? input.moveX : 0;
  const my = Math.abs(input.moveY)>0.08 ? input.moveY : 0;
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw+Math.PI/2), 0, Math.cos(player.yaw+Math.PI/2));
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -my);
  move.addScaledVector(right, mx);
  if(move.lengthSq()>1) move.normalize();

  const footYBefore = player.pos.y;
  player.pos.x += move.x*speedBase*dt;
  player.pos.z += move.z*speedBase*dt;

  resolveCollision(player.pos, PLAYER_RADIUS, footYBefore);

  const standH = groundHeightAt(player.pos.x, player.pos.z);
  player.vel.y += GRAVITY*dt;
  player.pos.y += player.vel.y*dt;
  if(player.pos.y<=standH){ player.pos.y=standH; player.vel.y=0; player.grounded=true; }
  else { player.grounded=false; }

  if(S.mode==='battle'){
    const distCenter = Math.hypot(player.pos.x, player.pos.z);
    const outside = distCenter > S.zoneRadius;
    document.getElementById('zoneWarn').classList.toggle('hidden', !outside);
    if(outside){ zoneDamageAccum += dt; if(zoneDamageAccum>1){ zoneDamageAccum=0; damagePlayer(4); } }
  }

  player.recoilOffset += (0 - player.recoilOffset) * Math.min(1, dt*7);
  player.recoilKickH += (0 - player.recoilKickH) * Math.min(1, dt*7);

  const eye = player.crouch ? PLAYER_CROUCH_EYE : PLAYER_EYE;
  camera.position.set(player.pos.x, player.pos.y+eye, player.pos.z);
  camera.rotation.order='YXZ';
  camera.rotation.y = player.yaw + player.recoilKickH;
  camera.rotation.x = THREE.MathUtils.clamp(player.pitch + player.recoilOffset, -1.5, 1.5);

  if(viewmodel){
    const bob = Math.sin(performance.now()*0.008)*(move.lengthSq()>0.01 && player.grounded ? 0.008:0);
    viewmodel.kick += (0-viewmodel.kick)*Math.min(1,dt*10);
    const adsMix = player.ads ? 1:0;
    viewmodel.group.position.set(
      THREE.MathUtils.lerp(viewmodel.baseX, 0, adsMix),
      viewmodel.baseY + bob - viewmodel.kick*0.05 + (adsMix*0.01),
      viewmodel.baseZ + viewmodel.kick*0.08
    );
  }
}
let zoneDamageAccum = 0;

/* ============================================================
   HUD UPDATES
   ============================================================ */
function updateHealthUI(){
  document.getElementById('shieldFill').style.width = (player.shield/player.maxShield*100)+'%';
  document.getElementById('healthFill').style.width = (Math.max(0,player.hp)/player.maxHp*100)+'%';
  document.getElementById('healthNum').textContent = Math.ceil(Math.max(0,player.hp));
  document.getElementById('lowHpVignette').style.opacity = player.hp<30 ? 0.7 : 0;
}
function updateAmmoUI(){
  const a = curAmmo();
  document.getElementById('ammoInMag').textContent = a.mag;
  document.getElementById('ammoReserve').textContent = a.reserve;
}
function updateAdsSight(w){
  const reticle = document.getElementById('adsReticle');
  const scope = document.getElementById('scopeOverlay');
  const showDot = player.ads && (w.sight==='reflex' || w.sight==='holo' || w.sight==='shotgun');
  const showScope = player.ads && w.sight==='scope';
  reticle.classList.toggle('show', showDot);
  reticle.classList.toggle('holo', w.sight==='holo');
  reticle.classList.toggle('reflex', w.sight==='reflex');
  reticle.classList.toggle('shotgun', w.sight==='shotgun');
  scope.classList.toggle('show', showScope);
  if(showScope) document.getElementById('scopeZoom').textContent = w.zoomLabel || '';
}
function updateWeaponUI(){
  const w = curWeapon();
  document.getElementById('weaponNameTag').textContent = w.name;
  document.getElementById('weaponIconBig').innerHTML = weaponSilhouetteSVG(w.type);
  updateAmmoUI();
}
function updateScoreUI(){
  document.getElementById('scoreYou').textContent = player.kills;
  document.getElementById('scoreEnemy').textContent = player.deaths;
}
function pushKillFeed(text, self){
  const feed = document.getElementById('killFeed');
  const item = document.createElement('div');
  item.className = 'killFeedItem'+(self?' self':'');
  item.textContent = text;
  feed.appendChild(item);
  setTimeout(()=>item.remove(), 3500);
  while(feed.children.length>4) feed.removeChild(feed.firstChild);
}
function showKillBanner(text){
  const kb = document.getElementById('killBanner');
  kb.textContent = text;
  kb.classList.remove('hidden'); void kb.offsetWidth;
  kb.style.animation='none'; void kb.offsetWidth; kb.style.animation='';
  setTimeout(()=>kb.classList.add('hidden'), 900);
}
function formatTime(s){
  s = Math.max(0,Math.ceil(s));
  const m = Math.floor(s/60), sec = s%60;
  return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
}

/* minimap: top-down radar, rotates with player yaw */
function drawMinimap(){
  const cvs = document.getElementById('minimap');
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2,H/2,W/2,0,Math.PI*2); ctx.clip();
  ctx.fillStyle = '#101b22'; ctx.fillRect(0,0,W,H);

  const scale = (W/2-8) / (ARENA_HALF+4);
  ctx.translate(W/2, H/2);
  ctx.rotate(-player.yaw);

  ctx.fillStyle = 'rgba(140,160,150,0.35)';
  OBSTACLES.forEach(o=>{
    if(o.h>4) return;
    ctx.fillRect((o.x-player.pos.x)*scale-1, (o.z-player.pos.z)*scale-1, Math.max(2,o.w*scale*0.5), Math.max(2,o.d*scale*0.5));
  });

  if(S.mode==='battle'){
    ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
    ctx.arc(-player.pos.x*scale, -player.pos.z*scale, S.zoneRadius*scale, 0, Math.PI*2); ctx.stroke();
  }

  bots.forEach(b=>{
    if(!b.alive) return;
    const dx=(b.pos.x-player.pos.x)*scale, dz=(b.pos.z-player.pos.z)*scale;
    ctx.fillStyle = '#ff4655';
    ctx.beginPath(); ctx.arc(dx,dz,3,0,Math.PI*2); ctx.fill();
  });

  ctx.restore();
  ctx.fillStyle = '#00e5c7';
  ctx.beginPath();
  ctx.moveTo(W/2, H/2-6); ctx.lineTo(W/2-5,H/2+5); ctx.lineTo(W/2+5,H/2+5); ctx.closePath(); ctx.fill();
}

/* ============================================================
   MATCH FLOW
   ============================================================ */
function checkWinCondition(){
  if(S.mode==='deathmatch'){
    if(player.kills>=S.killTarget) endMatch('win');
    else if(player.deaths>=S.killTarget) endMatch('lose');
  }
}

function startMatch(mode){
  S.mode = mode;
  document.getElementById('mainMenu').classList.add('hidden');
  document.getElementById('resultScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');

  bots.forEach(b=>scene.remove(b.group));
  bots = [];

  if(mode==='bomb'){
    S.bombSite = randomSpawn(0, null, 3);
    S.bombState = 'seeking';
    S.plantProgress = 0;
    S.defuseProgress = 0;
    if(bombSiteMesh) scene.remove(bombSiteMesh);
    bombSiteMesh = buildBombSiteMesh();
    bombSiteMesh.position.set(S.bombSite.x, 0, S.bombSite.z);
    scene.add(bombSiteMesh);
  } else if(bombSiteMesh){
    scene.remove(bombSiteMesh); bombSiteMesh = null;
  }

  if(mode!=='zombie'){
    const botCount = mode==='battle' ? 9 : 5;
    for(let i=0;i<botCount;i++){
      const bot = makeBot(i);
      const sp = randomSpawn(14, null, 2.5);
      bot.pos.set(sp.x,0,sp.z);
      bot.group.position.set(sp.x,0,sp.z);
      bots.push(bot);
    }
  }

  initPlayer();
  const others = [0,1,2].filter(i=>i!==S.weaponIdx);
  player.weapons = [others[0], S.weaponIdx, others[1]];
  player.curWeaponSlot = 1;
  respawnPlayer();
  buildWeaponSwitcher();
  updateWeaponUI();
  updateScoreUI();
  updateHealthUI();
  updateHealUI();
  updateNadeUI();
  clearGrenadeState();
  spawnHealPickups();
  spawnAmmoPickups();

  if(mode==='zombie'){
    S.zombieWave = 1;
    zombieWaveTimer = 0;
    spawnZombieWave();
  }

  if(!viewmodel) viewmodel = buildViewmodel();

  S.matchTime = mode==='battle' ? 240 : 300;
  S.timeLeft = S.matchTime;
  S.zoneRadius = ARENA_HALF*1.35;
  S.zoneTargetRadius = 8;
  zoneDamageAccum = 0;
  document.getElementById('zoneWarn').classList.add('hidden');
  document.getElementById('killFeed').innerHTML='';
  document.getElementById('plantBtn').classList.add('hidden');

  running = true;
  clock.getDelta();
  requestAnimationFrame(loop);
}

function endMatch(result){
  running = false;
  if(!result) result = player.kills>=player.deaths ? 'win' : 'lose';
  document.getElementById('plantBtn').classList.add('hidden');
  document.getElementById('gameScreen').classList.add('hidden');
  const rs = document.getElementById('resultScreen');
  rs.classList.remove('hidden');
  const title = document.getElementById('resultTitle');
  title.textContent = result==='win' ? 'VICTORY' : 'DEFEAT';
  title.classList.toggle('defeat', result!=='win');
  document.getElementById('statKills').textContent = player.kills;
  document.getElementById('statDeaths').textContent = player.deaths;
  const acc = player.shotsFired>0 ? Math.round(player.shotsHit/player.shotsFired*100) : 0;
  document.getElementById('statAcc').textContent = acc+'%';
  document.getElementById('statHs').textContent = player.headshots;
}

/* ============================================================
   MAIN LOOP
   ============================================================ */
function loop(){
  if(!running) return;
  const dt = Math.min(clock.getDelta(), 0.05);

  if(S.mode==='zombie'){
    document.getElementById('matchTimer').textContent = '웨이브 '+S.zombieWave;
  } else if(S.mode!=='bomb'){
    S.timeLeft -= dt;
    document.getElementById('matchTimer').textContent = formatTime(S.timeLeft);
    if(S.mode==='battle'){
      const prog = 1 - Math.max(0,S.timeLeft)/S.matchTime;
      S.zoneRadius = THREE.MathUtils.lerp(ARENA_HALF*1.35, S.zoneTargetRadius, Math.min(1,prog*1.15));
    }
    if(S.timeLeft<=0){ checkWinCondition(); if(running) endMatch(S.mode==='deathmatch' ? (player.kills>=player.deaths?'win':'lose') : (bots.some(b=>b.alive)?'lose':'win')); return; }
  }

  updatePlayer(dt);
  updateBots(dt);
  updateHealPickups(dt);
  updateAmmoPickups(dt);
  updateGrenades(dt);
  updateSmokeVolumes();
  if(S.mode==='zombie') updateZombieWaves(dt);
  if(S.mode==='bomb') updateBomb(dt);
  drawMinimap();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ============================================================
   MENU WIRING
   ============================================================ */
function buildMenuWeaponCarousel(){
  const el = document.getElementById('weaponCarousel');
  el.innerHTML='';
  WEAPONS.forEach((w, idx)=>{
    const card = document.createElement('button');
    card.className = 'weaponCard'+(idx===S.weaponIdx?' active':'');
    card.innerHTML = `<span class="wIcon">${weaponSilhouetteSVG(w.type)}</span><span class="wName">${w.name}</span>
      <span class="wStats">${w.dmg2.stats.map(s=>`<span>${s}</span>`).join('')}</span>`;
    card.addEventListener('pointerdown', ()=>{
      S.weaponIdx = idx;
      [...el.children].forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
    });
    el.appendChild(card);
  });
}

function setupMenu(){
  buildMenuWeaponCarousel();

  document.querySelectorAll('.modeCard').forEach(btn=>{
    btn.addEventListener('pointerdown', ()=>{
      document.querySelectorAll('.modeCard').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      S.mode = btn.dataset.mode;
    });
  });

  document.getElementById('playBtn').addEventListener('pointerdown', ()=>{
    ac(); // unlock audio on user gesture
    startMatch(S.mode);
  });
  document.getElementById('playAgainBtn').addEventListener('pointerdown', ()=>{
    document.getElementById('resultScreen').classList.add('hidden');
    startMatch(S.mode);
  });
  document.getElementById('backToMenuBtn').addEventListener('pointerdown', ()=>{
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
  });

  document.getElementById('settingsBtn').addEventListener('pointerdown', openSettingsPanel);
  document.getElementById('closeSettingsBtn').addEventListener('pointerdown', ()=>document.getElementById('settingsPanel').classList.add('hidden'));
  document.getElementById('quitMatchBtn').addEventListener('pointerdown', ()=>{
    document.getElementById('settingsPanel').classList.add('hidden');
    endMatch(null);
  });
  document.getElementById('howToBtn').addEventListener('pointerdown', ()=>document.getElementById('howToPanel').classList.remove('hidden'));
  document.getElementById('closeHowToBtn').addEventListener('pointerdown', ()=>document.getElementById('howToPanel').classList.add('hidden'));

  document.getElementById('sensSlider').addEventListener('input', e=> S.sens = +e.target.value);
  document.getElementById('adsSensSlider').addEventListener('input', e=> S.adsSens = +e.target.value);
  document.getElementById('hapticToggle').addEventListener('change', e=> S.haptic = e.target.checked);

  document.querySelectorAll('#crosshairStyleGroup .segBtn').forEach(btn=>{
    btn.addEventListener('pointerdown', ()=>{
      document.querySelectorAll('#crosshairStyleGroup .segBtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      S.crosshairStyle = btn.dataset.ch;
      applyCrosshairStyle();
      saveHudPrefs();
    });
  });

  setupHudEditor();
}

function setupHudEditor(){
  const container = document.getElementById('hudEditHandles');
  const sizeSlider = document.getElementById('hudSizeSlider');
  const sizeLabel = document.getElementById('hudSizeLabel');
  let dragKey = null, dragId = null, lastX = 0, lastY = 0;
  let selectedKey = 'joy';

  const handles = {};
  HUD_ELEMENTS.forEach(def=>{
    const h = document.createElement('div');
    h.className = 'hudHandle' + (def.shape==='rect' ? ' rect' : '');
    h.textContent = def.label;
    container.appendChild(h);
    handles[def.key] = h;

    h.addEventListener('pointerdown', e=>{
      dragKey = def.key; dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      h.classList.add('dragging');
      selectHandle(def.key);
      safeCapture(h, e.pointerId);
    });
    h.addEventListener('pointermove', e=>{
      if(e.pointerId!==dragId || dragKey!==def.key) return;
      const dx = e.clientX-lastX, dy = e.clientY-lastY;
      lastX = e.clientX; lastY = e.clientY;
      const cur = S.hudLayout[def.key] || hudDefaultPos(def);
      const size = cur.size || def.size;
      const w = def.w || size, hgt = def.h || size;
      S.hudLayout[def.key] = {
        left: Math.max(2, Math.min(innerWidth-w-2, cur.left+dx)),
        bottom: Math.max(2, Math.min(innerHeight-hgt-2, cur.bottom-dy)),
        size: cur.size,
      };
      layoutHandle(def, handles[def.key]);
      applyHudLayout();
    });
    const endDrag = e=>{ if(e.pointerId===dragId && dragKey===def.key){ dragId=null; dragKey=null; h.classList.remove('dragging'); } };
    h.addEventListener('pointerup', endDrag);
    h.addEventListener('pointercancel', endDrag);
  });

  function layoutHandle(def, h){
    const pos = S.hudLayout[def.key] || hudDefaultPos(def);
    const size = pos.size || def.size;
    h.style.left = pos.left+'px';
    h.style.bottom = pos.bottom+'px';
    h.style.width = (def.w || size)+'px';
    h.style.height = (def.h || size)+'px';
  }
  function layoutAllHandles(){
    HUD_ELEMENTS.forEach(def=>layoutHandle(def, handles[def.key]));
  }

  function selectHandle(key){
    selectedKey = key;
    const def = HUD_ELEMENTS.find(d=>d.key===key);
    Object.keys(handles).forEach(k=>handles[k].classList.toggle('selected', k===key));
    const cur = S.hudLayout[key] || hudDefaultPos(def);
    const size = cur.size || def.size;
    sizeSlider.min = def.sizeMin;
    sizeSlider.max = def.sizeMax;
    sizeSlider.value = size;
    sizeLabel.textContent = def.label + ' 크기';
  }

  sizeSlider.addEventListener('input', e=>{
    const def = HUD_ELEMENTS.find(d=>d.key===selectedKey);
    const cur = S.hudLayout[selectedKey] || hudDefaultPos(def);
    S.hudLayout[selectedKey] = { left: cur.left, bottom: cur.bottom, size: +e.target.value };
    layoutAllHandles();
    applyHudLayout();
  });

  document.getElementById('openJoyEditBtn').addEventListener('pointerdown', ()=>{
    document.getElementById('settingsPanel').classList.add('hidden');
    layoutAllHandles();
    selectHandle(selectedKey);
    document.getElementById('joyEditPanel').classList.remove('hidden');
  });
  document.getElementById('joyResetBtn').addEventListener('pointerdown', ()=>{
    S.hudLayout = {};
    layoutAllHandles();
    applyHudLayout();
    selectHandle(selectedKey);
  });
  document.getElementById('joyDoneBtn').addEventListener('pointerdown', ()=>{
    saveHudPrefs();
    document.getElementById('joyEditPanel').classList.add('hidden');
    document.getElementById('settingsPanel').classList.remove('hidden');
  });
}

/* ============================================================
   BOOT
   ============================================================ */
function boot(){
  const fill = document.getElementById('loaderFill');
  const tip = document.getElementById('loaderTip');
  let p = 0;
  const steps = ['맵 로딩 중...', '무기 데이터 로딩 중...', '봇 배치 중...', '준비 완료'];
  const iv = setInterval(()=>{
    p += 18 + Math.random()*20;
    if(p>100) p=100;
    fill.style.width = p+'%';
    tip.textContent = steps[Math.min(steps.length-1, Math.floor(p/26))];
    if(p>=100){
      clearInterval(iv);
      setTimeout(()=>{
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
      }, 200);
    }
  }, 90);
}

window.addEventListener('DOMContentLoaded', ()=>{
  loadHudPrefs();
  initThree();
  initPlayer();
  setupInput();
  setupMenu();
  applyCrosshairStyle();
  applyHudLayout();
  document.querySelectorAll('#crosshairStyleGroup .segBtn').forEach(b=>{
    b.classList.toggle('active', b.dataset.ch===S.crosshairStyle);
  });
  boot();
});

})();
