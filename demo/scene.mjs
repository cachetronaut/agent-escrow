// Three.js vault scene for the walkthrough. Visual only: every number it draws is passed in from evidence.
// Money travels as brass coins; information (terms, bids, work, evidence) travels as paper cards.
import * as THREE from './vendor/three.module.js';

const C = { night: 0x0d1522, floor: 0x101a2b, rule: 0x2b3c57, bullion: 0xe8b960, client: 0x8fb3e8, worker: 0x7fd3bd, verifier: 0xb7a3f2, pass: 0x7fe0a6, block: 0xff8a78, paper: 0xeef1f6 };
const hex = c => '#' + c.toString(16).padStart(6, '0');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.35, 'rgba(255,255,255,.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function drawLabel(sprite, text, { color = hex(C.paper), height = 0.46, mono = false, stamp = false } = {}) {
  const size = 120, c = document.createElement('canvas'), g = c.getContext('2d');
  const setup = () => {
    g.font = mono ? `600 ${size}px "Plex Mono", ui-monospace, monospace` : `850 ${size}px Archivo, "Arial Black", sans-serif`;
    if (!mono && 'fontStretch' in g) g.fontStretch = 'expanded';
    if ('letterSpacing' in g) g.letterSpacing = mono ? '0px' : '10px';
  };
  setup();
  const pad = stamp ? size * 0.5 : size * 0.35;
  c.width = Math.max(8, Math.ceil(g.measureText(text).width + pad * 2)); c.height = Math.ceil(size * (stamp ? 1.75 : 1.5));
  setup(); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stamp) { g.strokeStyle = color; g.lineWidth = 12; g.strokeRect(10, 10, c.width - 20, c.height - 20); }
  else { g.shadowColor = 'rgba(5,9,16,.9)'; g.shadowBlur = 26; }
  g.fillStyle = color; g.fillText(text, c.width / 2, c.height / 2 + size * 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  sprite.material.map?.dispose(); sprite.material.map = t; sprite.material.needsUpdate = true;
  sprite.scale.set(height * c.width / c.height, height, 1);
}
function label(text, opts) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  s.renderOrder = 10; drawLabel(s, text, opts); return s;
}

export function createScene(host, { retentionPercent, finalStatus, goodScores = [], badScores = [], amounts = {}, onJudgePhase } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(C.night); scene.fog = new THREE.Fog(C.night, 21, 38);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

  // Studio reflections for the metals: a few soft panels rendered into an environment map.
  const pmrem = new THREE.PMREMGenerator(renderer), studio = new THREE.Scene();
  studio.background = new THREE.Color(0x0a1019);
  for (const [color, power, pos, size] of [[0xfff0d8, 5, [0, 9, 7], [12, 4]], [0x7f9cff, 2.2, [-9, 3, -5], [7, 7]], [0xe8b960, 1.4, [9, 2, 5], [5, 5]], [0xffffff, 1.2, [0, -6, 0], [20, 20]]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); studio.add(m);
  }
  scene.environment = pmrem.fromScene(studio, 0.04).texture;

  scene.add(new THREE.HemisphereLight(0xa9bddf, C.night, 0.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-4, 9, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6f8fff, 1.6); rim.position.set(5, 5, -9); scene.add(rim);
  const glow = glowTexture();
  const halo = (color, size, opacity = 0.25) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.setScalar(size); return s; };

  // Floor: a dark vault-room disc with engraved rings and the settlement line between the parties.
  const FLOOR = -1.2;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(90, 96), new THREE.MeshStandardMaterial({ color: C.floor, roughness: 0.82, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; scene.add(floor);
  for (const r of [3.1, 4.4, 7.4, 10.5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.02, 160), new THREE.MeshBasicMaterial({ color: C.rule, transparent: true, opacity: 0.7, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = FLOOR + 0.004; scene.add(ring);
  }
  const track = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.006, 0.05), new THREE.MeshBasicMaterial({ color: C.rule, toneMapped: false })); track.position.set(0, FLOOR + 0.006, 0); scene.add(track);

  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x3a4659, metalness: 0.85, roughness: 0.42, clearcoat: 0.3 });
  function pedestal(color, x) {
    const g = new THREE.Group(); g.position.set(x, FLOOR, 0); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 0.36, 6), darkSteel); base.position.y = 0.18; base.rotation.y = Math.PI / 6;
    const inlay = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.03, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }));
    inlay.rotation.x = Math.PI / 2; inlay.position.y = 0.37;
    const light = new THREE.PointLight(color, 0, 7, 1.6); light.position.y = 1.9;
    g.add(base, inlay, light); return { g, inlay, light };
  }
  const glassy = color => new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, emissive: color, emissiveIntensity: 0.12 });

  // Client: a sheet of terms.
  const client = { ...pedestal(C.client, -5.6), emblem: new THREE.Group(), lit: 0 };
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.32, 0.09), glassy(C.client)); client.emblem.add(tablet);
  [0.36, 0.17, -0.02, -0.21].forEach((y, i) => { const l = new THREE.Mesh(new THREE.BoxGeometry(i === 3 ? 0.38 : 0.68, 0.055, 0.02), new THREE.MeshBasicMaterial({ color: C.paper, toneMapped: false })); l.position.set(i === 3 ? -0.15 : 0, y, 0.055); client.emblem.add(l); });
  client.mat = tablet.material;

  // Worker: a gear at work.
  const worker = { ...pedestal(C.worker, 5.6), emblem: new THREE.Group(), lit: 0 };
  const gearMat = glassy(C.worker); gearMat.metalness = 0.85; gearMat.roughness = 0.3;
  const gear = new THREE.Group(); gear.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.15, 14, 48), gearMat), new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.26, 24).rotateX(Math.PI / 2), gearMat));
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.24), gearMat); t.position.set(Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0); t.rotation.z = a; gear.add(t); }
  worker.emblem.add(gear); worker.mat = gearMat;
  for (const a of [client, worker]) { a.emblem.position.set(a.g.position.x, 0.55, 0); a.halo = halo(a === client ? C.client : C.worker, 3.4, 0.12); a.halo.position.copy(a.emblem.position); scene.add(a.emblem, a.halo); }

  // Verifier: a ring above the vault; the three judges ride on it.
  const verifier = { g: new THREE.Group(), lit: 0 }; verifier.g.position.set(0, 3.95, -0.2); scene.add(verifier.g);
  const vMat = new THREE.MeshPhysicalMaterial({ color: C.verifier, metalness: 0.6, roughness: 0.25, clearcoat: 1, emissive: C.verifier, emissiveIntensity: 0.25 });
  const vRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.05, 12, 120), vMat); vRing.rotation.x = Math.PI / 2;
  const vLens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), vMat);
  verifier.halo = halo(C.verifier, 4.2, 0.1); verifier.g.add(vRing, vLens, verifier.halo); verifier.mat = vMat;

  // Escrow vault: a steel drum split into the payout body and a brass warranty-hold slice that swings open.
  const vault = { g: new THREE.Group(), lit: 0 }; scene.add(vault.g);
  const R = 1.95, H = 2.05, TOP = FLOOR + H;
  const hold = Math.min(Math.max(Number(retentionPercent) || 0, 0), 100) / 100;
  const holdAngle = Math.max(hold, 0.04) * Math.PI * 2, centre = -Math.PI / 3, a0 = centre - holdAngle / 2, a1 = centre + holdAngle / 2;
  const bodyFrom = a1 + 0.015, bodyTo = a0 + Math.PI * 2 - 0.015;
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x8794a9, metalness: 0.92, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  function sector(from, to, material) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, R, from, to, false); s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: H - 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 96 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, FLOOR + 0.05, 0); return new THREE.Mesh(geo, material);
  }
  const ringArc = (inner, outer, from, to, color) => { const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1, from, to - from).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); m.position.y = TOP + 0.012; return m; };
  const body = sector(bodyFrom, bodyTo, steel);
  const bodyGlow = ringArc(0.5, R - 0.32, bodyFrom, bodyTo, C.bullion);
  const hinge = new THREE.Vector3(R * Math.cos(a1), 0, -R * Math.sin(a1));
  const holdPivot = new THREE.Group(); holdPivot.position.copy(hinge);
  const holdMat = steel.clone(), holdMesh = sector(a0, a1, holdMat);
  const holdInner = new THREE.Group(); holdInner.position.copy(hinge).multiplyScalar(-1);
  const holdGlow = ringArc(0.5, R - 0.32, a0 + 0.03, a1 - 0.03, C.bullion);
  holdInner.add(holdMesh, holdGlow); holdPivot.add(holdInner);
  const holdDir = new THREE.Vector3(Math.cos(centre), 0, -Math.sin(centre));
  const brass = new THREE.MeshPhysicalMaterial({ color: C.bullion, metalness: 1, roughness: 0.26, emissive: C.bullion, emissiveIntensity: 0.12, transparent: true });
  const lock = new THREE.Group(), lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.16), brass), shackle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 24, Math.PI), brass);
  shackle.position.y = 0.21; lock.add(lockBody, shackle);
  lock.position.copy(holdDir).multiplyScalar(R + 0.12).setY(FLOOR + H * 0.55); lock.lookAt(lock.position.clone().add(holdDir)); holdInner.add(lock);
  const bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), steel, 30), m4 = new THREE.Matrix4();
  for (let i = 0; i < 30; i++) { const a = bodyFrom + (bodyTo - bodyFrom) * (i + 0.5) / 30; m4.makeTranslation(Math.cos(a) * (R - 0.16), TOP + 0.03, -Math.sin(a) * (R - 0.16)); bolts.setMatrixAt(i, m4); }
  // Fill dial: 60 ticks around the base; the lit share is the real escrowed share (all, then the hold, then none).
  const TICKS = 60, dial = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.04, 0.36), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), TICKS);
  const dummy = new THREE.Object3D(), unlit = new THREE.Color(C.rule), lit = new THREE.Color(C.bullion);
  for (let i = 0; i < TICKS; i++) { const a = -i / TICKS * Math.PI * 2; dummy.position.set(Math.sin(a) * (R + 0.62), FLOOR + 0.03, Math.cos(a) * (R + 0.62)); dummy.rotation.set(0, a, 0); dummy.updateMatrix(); dial.setMatrixAt(i, dummy.matrix); dial.setColorAt(i, unlit); }
  const vaultLight = new THREE.PointLight(C.bullion, 0, 10, 1.4); vaultLight.position.set(0, TOP + 1.2, 1.4);
  vault.g.add(body, bodyGlow, holdPivot, bolts, dial, vaultLight);

  // Floor plaques name the parties; the verifier's name floats above its ring.
  const plaque = (text, color, x) => { const s = label(text, { color: hex(color), height: 0.5 }); s.position.set(x, FLOOR + 0.12, 3.35); scene.add(s); return s; };
  plaque('CLIENT', C.client, -5.6); plaque('WORKER', C.worker, 5.6); plaque('ESCROW VAULT', C.bullion, 0);
  const vName = label('VERIFIER', { color: hex(C.verifier), height: 0.46 }); vName.position.set(0, 1.05, 0); verifier.g.add(vName);
  const amountText = label('', { color: hex(C.bullion), height: 0.44, mono: true }); amountText.position.set(0, TOP + 1.3, 0.4); scene.add(amountText);
  const holdText = label(retentionPercent == null ? 'WARRANTY HOLD' : `WARRANTY HOLD ${retentionPercent}%`, { color: hex(C.bullion), height: 0.36 });
  holdText.position.copy(holdDir).multiplyScalar(R + 0.6).setY(FLOOR + H + 1.0); scene.add(holdText);
  const paid = label(finalStatus ? String(finalStatus).toUpperCase() : '', { color: hex(C.pass), height: 0.72, stamp: true }); paid.position.set(5.6, 2.15, 0.2); scene.add(paid);

  // Judges: three orbs on the verifier ring. Scores come from evidence.
  const judges = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 28, 18), new THREE.MeshStandardMaterial({ color: C.verifier, emissive: C.verifier, emissiveIntensity: 0.3, roughness: 0.3 }));
    const t = label('', { height: 0.5 }), beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ transparent: true, opacity: 0, toneMapped: false }));
    scene.add(m, t, beam); return { m, t, beam, phase: i * Math.PI * 2 / 3, shown: '' };
  });

  // Streams along arcs between the parties.
  const at = { client: client.emblem.position, worker: worker.emblem.position, vault: new THREE.Vector3(0, TOP + 0.2, 0), verifier: verifier.g.position, hold: holdDir.clone().multiplyScalar(R + 0.1).setY(FLOOR + H * 0.6) };
  const coinGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 32), cardGeo = new THREE.PlaneGeometry(0.4, 0.52);
  function stream(from, to, kind, tint, lift = 2.0, count = kind === 'coin' ? 16 : 7, speed = kind === 'coin' ? 0.3 : 0.22) {
    const a = at[from], b = at[to], mid = a.clone().lerp(b, 0.5); mid.y += lift; mid.z += 1.0;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const mat = kind === 'coin' ? brass.clone() : new THREE.MeshStandardMaterial({ color: new THREE.Color(C.paper).lerp(new THREE.Color(tint), 0.35), emissive: tint, emissiveIntensity: 0.35, roughness: 0.55, side: THREE.DoubleSide, transparent: true });
    const mesh = new THREE.InstancedMesh(kind === 'coin' ? coinGeo : cardGeo, mat, count); mesh.frustumCulled = false;
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineDashedMaterial({ color: kind === 'coin' ? C.bullion : tint, dashSize: 0.16, gapSize: 0.14, transparent: true, opacity: 0, toneMapped: false }));
    path.computeLineDistances(); scene.add(mesh, path);
    return { curve, mesh, path, kind, count, speed, v: 0 };
  }
  const streams = {
    terms: stream('client', 'vault', 'card', C.client, 1.8), bid: stream('worker', 'client', 'card', C.worker, 3.3),
    escrow: stream('client', 'vault', 'coin', C.bullion, 1.8), deliver: stream('worker', 'vault', 'card', C.worker, 1.8),
    evidence: stream('vault', 'verifier', 'card', C.verifier, 0.3, 5, 0.18), release: stream('vault', 'worker', 'coin', C.bullion, 1.8),
    hold: stream('hold', 'worker', 'coin', C.bullion, 1.9, 12)
  };

  const S = {
    post: { lit: ['client'], streams: ['terms'], fill: 0, yaw: -0.05 },
    bid: { lit: ['worker', 'client'], streams: ['bid'], fill: 0, yaw: 0.03 },
    escrow: { lit: ['client', 'vault'], streams: ['escrow'], fill: 1, amount: 'escrow', yaw: -0.03 },
    deliver: { lit: ['worker', 'vault'], streams: ['deliver'], fill: 1, amount: 'escrow', yaw: 0.04 },
    judge: { lit: ['verifier'], streams: ['evidence'], fill: 1, judges: 1, yaw: 0 },
    release: { lit: ['vault', 'worker'], streams: ['release'], fill: hold, holdLit: 1, amount: 'hold', yaw: 0.04 },
    warranty: { lit: ['worker', 'vault'], streams: ['hold'], fill: 0, holdLit: 1, open: 1, paid: 1, yaw: 0.06 }
  };
  const actors = { client, worker, verifier, vault };
  let state = S.post, stepStart = performance.now(), litTicks = -1, shownAmount = null, lastPhase = null;
  const s = { fill: 0, holdLit: 0, open: 0, judges: 0, paid: 0, amount: 0, yaw: 0 };
  const insets = { top: 0, right: 0, bottom: 0 };
  const look = new THREE.Vector3(0, 1.75, 0), WORLD_W = 15.4, WORLD_H = 7.4;
  let dist = 20;

  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    const rw = Math.max(200, w - insets.right), rh = Math.max(160, h - insets.top - insets.bottom), shift = insets.top - insets.bottom;
    const FW = w + insets.right, FH = h + Math.abs(shift), tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.aspect = FW / FH; camera.setViewOffset(FW, FH, insets.right, shift < 0 ? -shift : 0, w, h); camera.updateProjectionMatrix();
    dist = Math.max(WORLD_W * FH / (2 * tanF * rw), WORLD_H * FH / (2 * tanF * rh));
  }
  new ResizeObserver(resize).observe(host); resize();

  let last = performance.now(), frames = 0;
  const tmp = new THREE.Color(), steelColor = new THREE.Color(0x8794a9), gold = new THREE.Color(C.bullion), v3 = new THREE.Vector3();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000, st = (now - stepStart) / 1000; last = now;
    const k = 1 - Math.exp(-dt * 3), ease = (key, target) => { s[key] += (target - s[key]) * k; };
    ease('fill', state.fill); ease('holdLit', state.holdLit || 0); ease('open', state.open || 0); ease('judges', state.judges || 0); ease('paid', state.paid || 0); ease('yaw', state.yaw || 0);
    ease('amount', state.amount && amounts[state.amount] ? 1 : 0);

    const yaw = s.yaw + (still ? 0 : Math.sin(t * 0.13) * 0.035);
    camera.position.set(look.x + Math.sin(yaw) * dist, look.y + dist * 0.25, look.z + Math.cos(yaw) * dist); camera.lookAt(look);

    for (const [name, a] of Object.entries(actors)) {
      a.lit += ((state.lit.includes(name) ? 1 : 0) - a.lit) * k;
      if (a.mat) a.mat.emissiveIntensity = 0.12 + a.lit * 0.55;
      if (a.inlay) { a.inlay.material.opacity = 0.35 + a.lit * 0.65; a.light.intensity = a.lit * 9; }
      if (a.halo) a.halo.material.opacity = 0.06 + a.lit * 0.22;
      if (a.emblem) a.emblem.position.y = 0.55 + Math.sin(t * 1.1 + a.g.position.x) * 0.06 + a.lit * 0.12;
    }
    client.emblem.rotation.y = Math.sin(t * 0.6) * 0.35;
    gear.rotation.z -= dt * (0.35 + worker.lit * 1.4);
    verifier.g.position.y = 3.95 + Math.sin(t * 0.8) * 0.08; vLens.rotation.y += dt * 0.6;
    worker.mat.emissive.set(C.worker).lerp(tmp.set(C.pass), s.paid * 0.6);

    // Vault: fill glow, dial ticks, hold slice colour, door swing and lock release.
    bodyGlow.material.opacity = Math.min(s.fill, 1) * 0.55 * (1 - s.holdLit * 0.85);
    holdGlow.material.opacity = Math.max(s.fill, s.holdLit * (1 - s.open)) * 0.6;
    holdMat.color.copy(steelColor).lerp(gold, s.holdLit); holdMat.emissive.copy(gold); holdMat.emissiveIntensity = s.holdLit * 0.18;
    holdPivot.rotation.y = -s.open * 1.75;
    lock.scale.setScalar(Math.max(0.001, s.holdLit)); shackle.position.y = 0.21 + s.open * 0.24;
    lockBody.material.opacity = 1 - s.open * 0.7;
    vaultLight.intensity = (s.fill * 0.7 + s.holdLit * 0.4) * 22 + vault.lit * 6;
    const ticks = Math.round(s.fill * TICKS);
    if (ticks !== litTicks) { for (let i = 0; i < TICKS; i++) dial.setColorAt(i, i < ticks ? lit : unlit); dial.instanceColor.needsUpdate = true; litTicks = ticks; }
    holdText.material.opacity = s.holdLit; paid.material.opacity = s.paid; paid.position.y = 2.15 + Math.sin(t * 1.3) * 0.05;
    if (state.amount && state.amount !== shownAmount && amounts[state.amount]) { drawLabel(amountText, `${amounts[state.amount]} ${state.amount === 'hold' ? 'held' : 'locked'}`, { color: hex(C.bullion), height: 0.44, mono: true }); shownAmount = state.amount; }
    amountText.material.opacity = s.amount;

    // Judges: the good delivery, then the injection attempt, alternating every five seconds.
    const injection = state === S.judge && st % 10 > 5, scores = injection ? badScores : goodScores, jc = injection ? C.block : C.pass;
    if (state === S.judge && injection !== lastPhase) { lastPhase = injection; onJudgePhase?.(injection); }
    judges.forEach((j, i) => {
      const a = j.phase + t * 0.45, p = v3.set(Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35).add(verifier.g.position);
      j.m.position.copy(p); j.t.position.copy(p).add(new THREE.Vector3(0, 0.55, 0));
      j.m.material.color.set(C.verifier).lerp(tmp.set(jc), s.judges); j.m.material.emissive.copy(j.m.material.color); j.m.material.emissiveIntensity = 0.3 + s.judges * 0.9;
      const text = scores[i] === undefined ? '' : String(scores[i]);
      if (j.shown !== text + jc) { drawLabel(j.t, text, { color: hex(jc), height: 0.52 }); j.shown = text + jc; }
      j.t.material.opacity = s.judges;
      const pos = j.beam.geometry.attributes.position; pos.setXYZ(0, p.x, p.y, p.z); pos.setXYZ(1, 0, TOP + 0.15, 0); pos.needsUpdate = true;
      j.beam.material.color.set(jc); j.beam.material.opacity = s.judges * (0.45 + Math.sin(t * 5 + i) * 0.2);
    });

    for (const [name, f] of Object.entries(streams)) {
      f.v += ((state.streams.includes(name) ? 1 : 0) - f.v) * k;
      f.mesh.visible = f.path.visible = f.v > 0.01; f.path.material.opacity = f.v * 0.5;
      if (!f.mesh.visible) continue;
      for (let i = 0; i < f.count; i++) {
        const u = (i / f.count + t * f.speed) % 1, env = Math.min(1, Math.sin(u * Math.PI) * 2.2);
        f.curve.getPointAt(u, dummy.position);
        if (f.kind === 'coin') dummy.rotation.set(t * 3.2 + i, t * 1.1 + i * 0.7, 0.3);
        else dummy.rotation.set(Math.sin(t * 2 + i) * 0.25, Math.sin(t * 1.4 + i) * 0.5, Math.sin(t * 1.7 + i) * 0.15);
        dummy.scale.setScalar(Math.max(0.001, f.v * env)); dummy.updateMatrix(); f.mesh.setMatrixAt(i, dummy.matrix);
      }
      f.mesh.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
    if (++frames % 30 === 0) host.dataset.frames = String(frames);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    setStep(key) { if (!S[key]) return; state = S[key]; stepStart = performance.now(); lastPhase = null; host.dataset.step = key; },
    setInsets(next) { Object.assign(insets, next); resize(); }
  };
}
