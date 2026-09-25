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
  { id:'pistol', name:'M1911', icon:'P', type:'pistol', damage:24, headMul:2.3, fireRate:330, magSize:12, reserveMax:48,
    reloadTime:1100, spread:0.020, adsSpread:0.004, moveSpreadMul:1.6, auto:false, adsZoom:1.25,
    kick:0.045, dmg2:{name:'M1911',stats:['DMG 24','RATE 낮음','ACC 높음']} },
  { id:'rifle', name:'AR-15', icon:'R', type:'rifle', damage:27, headMul:2.0, fireRate:105, magSize:30, reserveMax:120,
    reloadTime:1900, spread:0.040, adsSpread:0.010, moveSpreadMul:1.8, auto:true, adsZoom:1.5,
    kick:0.03, dmg2:{name:'AR-15',stats:['DMG 27','RATE 높음','ACC 중간']} },
  { id:'sniper', name:'AWM', icon:'S', type:'sniper', damage:98, headMul:2.2, fireRate:1150, magSize:5, reserveMax:20,
    reloadTime:2500, spread:0.008, adsSpread:0.0009, moveSpreadMul:3.0, auto:false, adsZoom:3.4,
    kick:0.09, dmg2:{name:'AWM',stats:['DMG 98','RATE 낮음','ACC 매우높음']} },
];

// axis-aligned cover boxes {x,z,w,d,h}. Perimeter walls included.
const OBSTACLES = [
  {x:0,z:0,w:6,d:6,h:2.2},
  {x:14,z:10,w:4,d:4,h:1.4}, {x:-14,z:-10,w:4,d:4,h:1.4},
  {x:-14,z:10,w:4,d:4,h:1.4}, {x:14,z:-10,w:4,d:4,h:1.4},
  {x:22,z:0,w:3,d:10,h:2.6}, {x:-22,z:0,w:3,d:10,h:2.6},
  {x:0,z:22,w:10,d:3,h:2.6}, {x:0,z:-22,w:10,d:3,h:2.6},
  {x:8,z:-24,w:3,d:3,h:1.2}, {x:-8,z:24,w:3,d:3,h:1.2},
  {x:26,z:20,w:3,d:3,h:1.6}, {x:-26,z:-20,w:3,d:3,h:1.6},
  {x:26,z:-20,w:3,d:3,h:1.6}, {x:-26,z:20,w:3,d:3,h:1.6},
  // perimeter
  {x:0,z:ARENA_HALF+1,w:ARENA_HALF*2+4,d:2,h:6},
  {x:0,z:-ARENA_HALF-1,w:ARENA_HALF*2+4,d:2,h:6},
  {x:ARENA_HALF+1,z:0,w:2,d:ARENA_HALF*2+4,h:6},
  {x:-ARENA_HALF-1,z:0,w:2,d:ARENA_HALF*2+4,h:6},
];

const BOT_NAMES = ['VIPER','RAZE','GHOST','PHANTOM','WOLF','FALCON','REAPER','COBRA','TITAN','NOVA'];

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
  sens: 90, adsSens: 60, haptic: true, fixedStick: true,
};

let scene, camera, renderer, clock;
let envMeshes = [];
let bots = [];
let player = null;
let viewmodel = null;
let raycaster = new THREE.Raycaster();
let running = false;
let audioCtx = null;

/* ============================================================
   AUDIO (procedural, no assets)
   ============================================================ */
function ac(){ if(!audioCtx){ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } return audioCtx; }
function playShot(type){
  try{
    const c = ac(); const t = c.currentTime;
    const dur = type==='sniper' ? 0.22 : 0.09;
    const buf = c.createBuffer(1, c.sampleRate*dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++){ d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 2); }
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type='bandpass';
    filt.frequency.value = type==='sniper'?900:type==='pistol'?1600:1200;
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
  OBSTACLES.forEach(o=>{
    const geo = new THREE.BoxGeometry(o.w, o.h, o.d);
    const mat = new THREE.MeshStandardMaterial({ map: o.h>4 ? concreteTex : crateTex, roughness:0.85 });
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
function makeBot(id){
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb03a3a, roughness:0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 8), bodyMat);
  body.position.y = 0.95; body.castShadow = true;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe0b088, roughness:0.6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), headMat);
  head.position.y = 1.68; head.castShadow = true;
  group.add(body, head);
  scene.add(group);

  const bot = {
    id, name: BOT_NAMES[id % BOT_NAMES.length] + '_' + (id+1),
    group, body, head,
    hp: 100, maxHp: 100, alive: true,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    yaw: 0,
    state: 'patrol',
    shootCd: 0,
    respawnCd: 0,
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
function resolveCollision(pos, r){
  for(const o of OBSTACLES){
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

function hasLineOfSight(a, b){
  const dir = new THREE.Vector3().subVectors(b,a);
  const dist = dir.length(); dir.normalize();
  raycaster.set(a, dir); raycaster.far = dist;
  const hits = raycaster.intersectObjects(envMeshes, false);
  return hits.length===0;
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
  };
}
function curWeapon(){ return WEAPONS[player.weapons[player.curWeaponSlot]]; }
function curAmmo(){ return player.ammo[player.weapons[player.curWeaponSlot]]; }

function respawnPlayer(){
  const sp = randomSpawn(10, null, 3.5);
  player.pos.set(sp.x, 0, sp.z);
  player.vel.set(0,0,0);
  player.hp = player.maxHp; player.shield = player.maxShield;
  player.alive = true; player.reloading=false;
  player.invuln = 2.5;
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
  const endJoy = e=>{ if(e.pointerId===input.moveId){ input.moveId=null; input.moveX=0; input.moveY=0; joyStick.style.transform=''; } };
  joyZone.addEventListener('pointerup', endJoy);
  joyZone.addEventListener('pointercancel', endJoy);

  function updateStick(e){
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left+rect.width/2, cy = rect.top+rect.height/2;
    let dx = e.clientX-cx, dy = e.clientY-cy;
    const max = rect.width/2;
    const d = Math.hypot(dx,dy);
    if(d>max){ dx = dx/d*max; dy = dy/d*max; }
    joyStick.style.transform = `translate(${dx}px,${dy}px)`;
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
  adsBtn.addEventListener('pointerdown', e=>{ adsBtn.classList.add('active'); player.ads=true; safeCapture(adsBtn, e.pointerId); });
  const stopAds = ()=>{ adsBtn.classList.remove('active'); player.ads=false; };
  adsBtn.addEventListener('pointerup', stopAds);
  adsBtn.addEventListener('pointercancel', stopAds);

  // jump
  document.getElementById('jumpBtn').addEventListener('pointerdown', ()=>{ if(player.grounded && !player.crouch){ player.vel.y = JUMP_SPEED; player.grounded=false; } });
  // crouch toggle
  const crouchBtn = document.getElementById('crouchBtn');
  crouchBtn.addEventListener('pointerdown', ()=>{ player.crouch = !player.crouch; crouchBtn.classList.toggle('active', player.crouch); });
  // reload
  document.getElementById('reloadBtn').addEventListener('pointerdown', doReload);

  // weapon switcher built dynamically
  buildWeaponSwitcher();

  // pause
  document.getElementById('pauseBtn').addEventListener('pointerdown', ()=>endMatch(null));
}

function buildWeaponSwitcher(){
  const el = document.getElementById('weaponSwitcher');
  el.innerHTML='';
  player.weapons.forEach((wIdx, slot)=>{
    const w = WEAPONS[wIdx];
    const btn = document.createElement('button');
    btn.className = 'wSlot' + (slot===player.curWeaponSlot?' active':'');
    btn.textContent = w.icon;
    btn.addEventListener('pointerdown', ()=>switchWeapon(slot));
    el.appendChild(btn);
  });
}
function switchWeapon(slot){
  if(player.reloading) return;
  player.curWeaponSlot = slot;
  player.ads=false;
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
  let spread = player.ads ? w.adsSpread : w.spread;
  if(moving) spread *= w.moveSpreadMul;
  if(player.crouch) spread *= 0.6;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += (Math.random()*2-1)*spread;
  dir.y += (Math.random()*2-1)*spread;
  dir.z += (Math.random()*2-1)*spread;
  dir.normalize();

  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  raycaster.set(origin, dir);
  raycaster.far = 200;

  const targets = [];
  bots.forEach(b=>{ if(b.alive){ targets.push(b.body, b.head); } });
  const hits = raycaster.intersectObjects([...targets, ...envMeshes], false);

  if(hits.length>0){
    const hit = hits[0];
    const bot = hit.object.userData.bot;
    if(bot){
      const isHead = hit.object.userData.part==='head';
      const dmg = w.damage * (isHead ? w.headMul : 1);
      damageBot(bot, dmg, isHead);
      player.shotsHit++;
      if(isHead) player.headshots++;
      showHitmarker(isHead);
    }
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
    if(S.mode==='battle'){ endMatch('lose'); }
    else { setTimeout(()=>{ if(running){ respawnPlayer(); } }, 2200); }
  }
  updateHealthUI();
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
    const botHead = new THREE.Vector3(bot.pos.x, 1.6, bot.pos.z);
    const distToPlayer = bot.pos.distanceTo(player.pos);
    const canSee = player.alive && distToPlayer<32 && hasLineOfSight(botHead, playerPos3);

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

  const targetFov = player.ads ? 78/curWeapon().adsZoom : 78;
  camera.fov += (targetFov-camera.fov) * Math.min(1, dt*8);
  camera.updateProjectionMatrix();
  document.getElementById('crosshair').classList.toggle('ads', player.ads);

  const speedBase = player.crouch ? 2.0 : (player.ads ? 2.6 : 4.6);
  const mx = Math.abs(input.moveX)>0.08 ? input.moveX : 0;
  const my = Math.abs(input.moveY)>0.08 ? input.moveY : 0;
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw+Math.PI/2), 0, Math.cos(player.yaw+Math.PI/2));
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -my);
  move.addScaledVector(right, mx);
  if(move.lengthSq()>1) move.normalize();

  player.pos.x += move.x*speedBase*dt;
  player.pos.z += move.z*speedBase*dt;

  player.vel.y += GRAVITY*dt;
  player.pos.y += player.vel.y*dt;
  if(player.pos.y<=0){ player.pos.y=0; player.vel.y=0; player.grounded=true; }

  resolveCollision(player.pos, PLAYER_RADIUS);

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
function updateWeaponUI(){
  const w = curWeapon();
  document.getElementById('weaponNameTag').textContent = w.name;
  document.getElementById('weaponIconBig').textContent = w.icon;
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
  const botCount = mode==='battle' ? 9 : 5;
  for(let i=0;i<botCount;i++){
    const bot = makeBot(i);
    const sp = randomSpawn(14, null, 2.5);
    bot.pos.set(sp.x,0,sp.z);
    bot.group.position.set(sp.x,0,sp.z);
    bots.push(bot);
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

  if(!viewmodel) viewmodel = buildViewmodel();

  S.matchTime = mode==='battle' ? 240 : 300;
  S.timeLeft = S.matchTime;
  S.zoneRadius = ARENA_HALF*1.35;
  S.zoneTargetRadius = 8;
  zoneDamageAccum = 0;
  document.getElementById('zoneWarn').classList.add('hidden');
  document.getElementById('killFeed').innerHTML='';

  running = true;
  clock.getDelta();
  requestAnimationFrame(loop);
}

function endMatch(result){
  running = false;
  if(!result) result = player.kills>=player.deaths ? 'win' : 'lose';
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

  S.timeLeft -= dt;
  document.getElementById('matchTimer').textContent = formatTime(S.timeLeft);
  if(S.mode==='battle'){
    const prog = 1 - Math.max(0,S.timeLeft)/S.matchTime;
    S.zoneRadius = THREE.MathUtils.lerp(ARENA_HALF*1.35, S.zoneTargetRadius, Math.min(1,prog*1.15));
  }
  if(S.timeLeft<=0){ checkWinCondition(); if(running) endMatch(S.mode==='deathmatch' ? (player.kills>=player.deaths?'win':'lose') : (bots.some(b=>b.alive)?'lose':'win')); return; }

  updatePlayer(dt);
  updateBots(dt);
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
    card.innerHTML = `<span class="wIcon">${w.icon}</span><span class="wName">${w.name}</span>
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

  document.getElementById('settingsBtn').addEventListener('pointerdown', ()=>document.getElementById('settingsPanel').classList.remove('hidden'));
  document.getElementById('closeSettingsBtn').addEventListener('pointerdown', ()=>document.getElementById('settingsPanel').classList.add('hidden'));
  document.getElementById('howToBtn').addEventListener('pointerdown', ()=>document.getElementById('howToPanel').classList.remove('hidden'));
  document.getElementById('closeHowToBtn').addEventListener('pointerdown', ()=>document.getElementById('howToPanel').classList.add('hidden'));

  document.getElementById('sensSlider').addEventListener('input', e=> S.sens = +e.target.value);
  document.getElementById('adsSensSlider').addEventListener('input', e=> S.adsSens = +e.target.value);
  document.getElementById('hapticToggle').addEventListener('change', e=> S.haptic = e.target.checked);
  document.getElementById('fixedJoystickToggle').addEventListener('change', e=> S.fixedStick = e.target.checked);
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
  initThree();
  initPlayer();
  setupInput();
  setupMenu();
  boot();
});

})();
