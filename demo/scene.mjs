// Three.js scene for the walkthrough. Visual only: every number it draws is passed in from evidence.
import * as THREE from './vendor/three.module.js';

const C = { client: 0x4cc9ff, worker: 0xffb84d, vault: 0x2ee6b0, hold: 0xffc14d, verifier: 0xc490ff, good: 0x39ff9a, bad: 0xff5d6c, dim: 0x5a6b80 };
const hex = c => '#' + c.toString(16).padStart(6, '0');

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function drawText(sprite, text, color, height) {
  const size = 110, font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = font;
  c.width = Math.ceil(g.measureText(text).width + size); c.height = Math.ceil(size * 1.45);
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 22; g.fillStyle = color; g.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  sprite.material.map?.dispose(); sprite.material.map = t; sprite.material.needsUpdate = true;
  sprite.scale.set(height * c.width / c.height, height, 1);
}
function label(text, color, height = 0.62) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
  s.renderOrder = 10; drawText(s, text, color, height); return s;
}

export function createScene(host, { retentionPercent, finalStatus, goodScores = [], badScores = [] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x05080d, 1);
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x05080d, 20, 42);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x8090c0, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 10, 8); scene.add(sun);
  const glow = glowTexture();
  const halo = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return s; };

  // Floor: concentric rings and a faint grid.
  const grid = new THREE.PolarGridHelper(12, 12, 6, 64, 0x1a2a3c, 0x111c29); grid.position.y = -1.6; scene.add(grid);

  function node(name, color, pos, geometry) {
    const g = new THREE.Group(); g.position.copy(pos); scene.add(g);
    const core = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.25, flatShading: true }));
    const h = halo(color, 4), ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.035, 8, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -1.25;
    const text = label(name, hex(color)); text.position.y = -2.05;
    g.add(core, h, ring, text);
    return { g, core, h, ring, text, lit: 0 };
  }
  const client = node('CLIENT', C.client, new THREE.Vector3(-6.4, 0, 0), new THREE.IcosahedronGeometry(1, 0));
  const worker = node('WORKER', C.worker, new THREE.Vector3(6.4, 0, 0), new THREE.DodecahedronGeometry(1, 0));
  const verifier = node('VERIFIER', C.verifier, new THREE.Vector3(0, 4.7, -0.6), new THREE.OctahedronGeometry(0.85, 0));
  verifier.ring.position.y = -1.05; verifier.text.position.set(0, 1.45, 0);

  // Escrow vault: a solid drum split into the payout body and the warranty-hold slice.
  const vault = { g: new THREE.Group(), lit: 0 }; scene.add(vault.g);
  const R = 1.75, H = 2.3, hold = Math.min(Math.max(Number(retentionPercent) || 0, 0), 100) / 100;
  const holdAngle = Math.max(hold, 0.04) * Math.PI * 2, centre = -Math.PI / 2 + 0.55, a0 = centre - holdAngle / 2, a1 = centre + holdAngle / 2;
  function sector(from, to, color) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, R, from, to, false); s.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 72 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -H / 2, 0);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.28, metalness: 0.45, transparent: true, opacity: 0.4 }));
  }
  const body = sector(a1 + 0.02, a0 + Math.PI * 2 - 0.02, C.vault);
  // Hinge on the outer rim edge so the hold swings open like a door.
  const hinge = new THREE.Vector3(R * Math.cos(a1), 0, -R * Math.sin(a1));
  const holdPivot = new THREE.Group(); holdPivot.position.copy(hinge);
  const holdMesh = sector(a0, a1, C.vault); holdMesh.position.copy(hinge).multiplyScalar(-1); holdPivot.add(holdMesh);
  const lock = new THREE.Group(), mid = new THREE.Vector3(Math.cos(centre), 0, -Math.sin(centre));
  const lockMat = new THREE.MeshStandardMaterial({ color: C.hold, emissive: C.hold, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25, transparent: true });
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.18), lockMat), shackle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 24, Math.PI), lockMat);
  shackle.position.y = 0.22; lock.add(lockBody, shackle);
  lock.position.copy(mid).multiplyScalar(R + 0.14).sub(hinge); lock.lookAt(lock.position.clone().add(mid)); holdPivot.add(lock);
  const rims = [H / 2, -H / 2].map(y => { const m = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: C.vault, transparent: true, opacity: 0.7 })); m.rotation.x = Math.PI / 2; m.position.y = y; return m; });
  const vaultHalo = halo(C.vault, 6.5), vaultText = label('ESCROW VAULT', hex(C.vault)); vaultText.position.y = -2.05;
  const holdText = label(retentionPercent == null ? 'WARRANTY HOLD' : `WARRANTY HOLD ${retentionPercent}%`, hex(C.hold), 0.5);
  holdText.position.copy(mid).multiplyScalar(R + 1.3).setY(1.75);
  const paidText = label(finalStatus ? String(finalStatus).toUpperCase() : '', hex(C.good), 0.95); paidText.position.set(6.4, 2.35, 0);
  vault.g.add(body, holdPivot, ...rims, vaultHalo, vaultText, holdText); scene.add(paidText);

  // Judges orbit the verifier. Scores come from evidence.
  const judges = [0, 1, 2].map(i => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), new THREE.MeshStandardMaterial({ color: C.dim, emissive: C.dim, emissiveIntensity: 0.4 }));
    const t = label('', '#fff', 0.5), beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: C.good, transparent: true, opacity: 0 }));
    scene.add(m, t, beam); return { m, t, beam, phase: i * Math.PI * 2 / 3, shown: '' };
  });

  // Particle flows along arcs between nodes.
  const anchor = { client: client.g.position, worker: worker.g.position, vault: new THREE.Vector3(0, 0.2, 0), verifier: verifier.g.position, hold: mid.clone().multiplyScalar(R).setY(0.2) };
  function flow(from, to, color, lift = 2.2, count = 70, size = 0.42) {
    const a = anchor[from], b = anchor[to], m = a.clone().lerp(b, 0.5); m.y += lift; m.z += 0.8;
    const curve = new THREE.QuadraticBezierCurve3(a, m, b), pos = new Float32Array(count * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glow, color, size, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }));
    scene.add(pts, trail);
    const seeds = Array.from({ length: count }, () => [Math.random(), (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25]);
    return { curve, pts, trail, seeds, v: 0 };
  }
  const flows = {
    terms: flow('client', 'vault', C.client, 1.6, 40, 0.5), bid: flow('worker', 'client', C.worker, 3.4, 50),
    escrow: flow('client', 'vault', C.good, 1.6, 110), deliver: flow('worker', 'vault', 0x9ad7ff, 1.6, 50),
    judge: flow('vault', 'verifier', C.verifier, 0.6, 60), release: flow('vault', 'worker', C.good, 1.6, 110), hold: flow('hold', 'worker', C.hold, 1.9, 90, 0.5)
  };
  const packet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x9ad7ff, emissive: 0x9ad7ff, emissiveIntensity: 0.8, transparent: true, opacity: 0 }));
  const terms = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshBasicMaterial({ color: 0xeaf6ff, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
  scene.add(packet, terms);

  const STATES = {
    post: { lit: ['client', 'vault'], flows: ['terms'], funded: 0.12, cam: [-0.8, 3.4, 15], look: [-0.7, 1, 0] },
    bid: { lit: ['worker', 'client'], flows: ['bid'], funded: 0.12, cam: [1.2, 3.6, 15], look: [0.6, 1.2, 0] },
    escrow: { lit: ['client', 'vault'], flows: ['escrow'], funded: 1, cam: [-0.5, 3.2, 14.5], look: [-0.4, 0.8, 0] },
    deliver: { lit: ['worker', 'vault'], flows: ['deliver'], funded: 1, cam: [0.6, 3.2, 14.5], look: [0.5, 0.8, 0] },
    judge: { lit: ['verifier', 'vault'], flows: ['judge'], funded: 1, judges: 1, cam: [0, 4.8, 14], look: [0, 2.4, 0] },
    release: { lit: ['vault', 'worker'], flows: ['release'], funded: 0.3, holdLit: 1, cam: [0.6, 3.4, 14.2], look: [0.5, 0.8, 0] },
    warranty: { lit: ['vault', 'worker'], flows: ['hold'], funded: 0.18, holdLit: 1, open: 1, paid: 1, cam: [0.8, 3.2, 14], look: [0.7, 0.8, 0] }
  };
  const nodes = { client, worker, verifier, vault };
  let state = STATES.post, stepStart = performance.now();
  const s = { funded: 0.12, holdLit: 0, open: 0, judges: 0, paid: 0 };
  const cam = new THREE.Vector3(...state.cam), look = new THREE.Vector3(...state.look);
  camera.position.copy(cam);

  const holdBase = new THREE.Color(C.vault), holdGold = new THREE.Color(C.hold), tmp = new THREE.Color();
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  let last = performance.now(), frames = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000), t = now / 1000, st = (now - stepStart) / 1000; last = now;
    const k = 1 - Math.exp(-dt * 3.2), ease = (key, target) => { s[key] += (target - s[key]) * k; };
    ease('funded', state.funded); ease('holdLit', state.holdLit || 0); ease('open', state.open || 0); ease('judges', state.judges || 0); ease('paid', state.paid || 0);

    // Wider framing on narrow viewports keeps all four actors in shot.
    const back = Math.max(1, 1.75 / camera.aspect);
    cam.lerp(new THREE.Vector3(state.cam[0] * back, state.cam[1], state.cam[2] * back), k * 0.7); look.lerp(new THREE.Vector3(...state.look), k * 0.7);
    camera.position.set(cam.x + Math.sin(t * 0.21) * 0.5, cam.y + Math.sin(t * 0.17) * 0.2, cam.z); camera.lookAt(look);

    for (const [name, n] of Object.entries(nodes)) {
      n.lit += ((state.lit.includes(name) ? 1 : 0) - n.lit) * k;
      if (n.core) {
        n.core.rotation.y += dt * (0.25 + n.lit * 0.6); n.core.rotation.x = Math.sin(t * 0.5) * 0.15;
        n.core.material.emissiveIntensity = 0.25 + n.lit * 0.55 + Math.sin(t * 3) * 0.06 * n.lit;
        n.g.scale.setScalar(1 + n.lit * 0.12); n.h.material.opacity = 0.18 + n.lit * 0.4; n.ring.material.opacity = 0.3 + n.lit * 0.6;
      }
    }
    verifier.g.position.y = 4.7 + Math.sin(t * 0.9) * 0.18;
    worker.core.material.emissive.set(C.worker).lerp(tmp.set(C.good), s.paid * 0.5);

    // Vault fill, hold colour, door swing and lock release.
    const fill = s.funded;
    body.material.opacity = 0.32 + fill * 0.63; body.material.emissiveIntensity = 0.06 + fill * 0.5 + vault.lit * 0.1;
    holdMesh.material.color.copy(holdBase).lerp(holdGold, s.holdLit); holdMesh.material.emissive.copy(holdMesh.material.color);
    holdMesh.material.opacity = Math.max(0.32 + fill * 0.63, s.holdLit * 0.95); holdMesh.material.emissiveIntensity = 0.1 + Math.max(fill, s.holdLit) * 0.55;
    holdPivot.rotation.y = -s.open * 1.9;
    lock.scale.setScalar(Math.max(0.001, s.holdLit)); shackle.position.y = 0.22 + s.open * 0.22; lockMat.opacity = 1 - s.open * 0.85;
    holdText.material.opacity = s.holdLit; paidText.material.opacity = s.paid; paidText.position.y = 2.35 + Math.sin(t * 1.4) * 0.08;
    vaultHalo.material.opacity = 0.12 + fill * 0.3; rims.forEach(r => { r.material.opacity = 0.35 + fill * 0.5; });
    vault.g.rotation.y = Math.sin(t * 0.25) * 0.12;

    // Judges: good delivery, then the injection attempt, alternating every five seconds.
    const injection = st % 10 > 5, scores = injection ? badScores : goodScores, jc = injection ? C.bad : C.good;
    judges.forEach((j, i) => {
      const a = j.phase + t * 0.6, p = new THREE.Vector3(verifier.g.position.x + Math.cos(a) * 1.9, verifier.g.position.y - 0.2 + Math.sin(a * 2) * 0.15, verifier.g.position.z + Math.sin(a) * 1.9);
      j.m.position.copy(p); j.t.position.copy(p).add(new THREE.Vector3(0, 0.62, 0));
      j.m.material.color.set(C.dim).lerp(tmp.set(jc), s.judges); j.m.material.emissive.copy(j.m.material.color); j.m.material.emissiveIntensity = 0.3 + s.judges * 0.7;
      const text = scores[i] === undefined ? '' : String(scores[i]);
      if (j.shown !== text + jc) { drawText(j.t, text, hex(jc), 0.55); j.shown = text + jc; }
      j.t.material.opacity = s.judges;
      const pos = j.beam.geometry.attributes.position; pos.setXYZ(0, p.x, p.y, p.z); pos.setXYZ(1, 0, H / 2 + 0.1, 0); pos.needsUpdate = true;
      j.beam.material.color.set(jc); j.beam.material.opacity = s.judges * (0.35 + Math.sin(t * 6 + i) * 0.2);
    });

    for (const [name, f] of Object.entries(flows)) {
      f.v += ((state.flows.includes(name) ? 1 : 0) - f.v) * k;
      f.pts.material.opacity = f.v; f.trail.material.opacity = f.v * 0.28; f.pts.visible = f.trail.visible = f.v > 0.01;
      if (!f.pts.visible) continue;
      const arr = f.pts.geometry.attributes.position, speed = name === 'escrow' || name === 'release' || name === 'hold' ? 0.32 : 0.22, q = new THREE.Vector3();
      f.seeds.forEach(([o, dx, dy], i) => { f.curve.getPointAt((o + t * speed) % 1, q); arr.setXYZ(i, q.x + dx, q.y + dy, q.z + dx); });
      arr.needsUpdate = true;
    }
    const along = (f, period, obj) => { const u = (st / period) % 1; f.curve.getPointAt(u, obj.position); obj.material.opacity = f.v * Math.min(1, Math.sin(u * Math.PI) * 3); };
    along(flows.deliver, 2.6, packet); packet.rotation.x += dt * 1.5; packet.rotation.y += dt * 2;
    along(flows.terms, 2.4, terms); terms.rotation.y += dt * 2.2;

    renderer.render(scene, camera);
    if (++frames % 30 === 0) host.dataset.frames = String(frames);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { setStep(key) { if (STATES[key]) { state = STATES[key]; stepStart = performance.now(); host.dataset.step = key; } } };
}
