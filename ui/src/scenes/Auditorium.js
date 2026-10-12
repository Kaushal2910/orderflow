import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Premium luxury cinema: leather recliners, tiered seating, cinematic lighting.
// Preserved contract: seat IDs `R#C#`, seatMap statuses FREE/HELD/SOLD,
// `selected` Set, onToggle(id), refresh(nextMap).
// Extra handle: setView, viewFromSeat, toggleCinematic, recommendBest, seatInfo.
export function createAuditorium(canvas, { rows, cols, seatMap, selected, onToggle, price = 299, movieTitle = "Now Showing", moviePoster = "🎬", onFocus = () => {} }) {
  // ---------- renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050308);
  scene.fog = new THREE.Fog(0x050308, 30, 70);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
  camera.position.set(0, 11, 9.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.8, -1.5);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = 1.62;
  controls.minDistance = 0.8;
  controls.maxDistance = 26;
  controls.screenSpacePanning = true; // pan moves across the screen plane
  controls.zoomToCursor = true;       // wheel zooms toward the hovered seat
  controls.rotateSpeed = 0.65;
  controls.listenToKeyEvents(window); // arrow keys pan the view
  controls.keyPanSpeed = 14;
  // Open-top hall (no ceiling): the camera can rise above the walls for a
  // full-bowl overview, but stays near the room so seats stay readable.
  const CAM_BOX = { x: [-16, 16], y: [0.4, 20], z: [-9, 16] };
  const TGT_BOX = { x: [-12, 12], y: [0, 8], z: [-7.5, 13] };
  const clampCam = () => {
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, ...CAM_BOX.x);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, ...CAM_BOX.y);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, ...CAM_BOX.z);
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, ...TGT_BOX.x);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, ...TGT_BOX.y);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, ...TGT_BOX.z);
  };

  // ---------- seat layout (IDs + mapping preserved) ----------
  const colX = (c) => (c - (cols - 1) / 2) * 1.0 + (c > 4 ? 0.55 : 0) + (c > 9 ? 0.55 : 0);
  const rowY = (r) => 0.25 + r * 0.55;                 // tiered stadium elevation
  const rowZ = (r, c) => -1.2 + r * 1.65 + Math.abs(c - (cols - 1) / 2) * 0.06; // gentle arc
  const N = rows * cols;
  const seats = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    seats.push({
      id: `R${r + 1}C${c + 1}`, r, c,
      x: colX(c), y: rowY(r), z: rowZ(r, c),
      yaw: -colX(c) * 0.035,                       // face the screen
      vip: r === rows - 1, premium: r >= rows - 3 && r < rows - 1,
    });
  }
  const byId = Object.fromEntries(seats.map((s) => [s.id, s]));
  const statusOf = (id) => (selected.has(id) ? "SEL" : byId[id]?.st || "FREE");

  const categoryOf = (s) => (s.vip ? "VIP Recliner" : s.premium ? "Premium" : "Standard");
  function seatInfo(id) {
    const s = byId[id];
    if (!s) return null;
    return { id, row: s.r + 1, col: s.c + 1, category: categoryOf(s), price, status: statusOf(id) };
  }

  // ---------- procedural textures ----------
  // The screen shows the CURRENT movie: poster art + title, cinema-style.
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1024; screenCanvas.height = 512;
  function drawScreen(title, poster) {
    const g = screenCanvas.getContext("2d");
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#070b26"); sky.addColorStop(0.5, "#3d2560");
    sky.addColorStop(0.75, "#a34a68"); sky.addColorStop(1, "#1c1030");
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
    // projector beams
    g.save(); g.globalAlpha = 0.16; g.fillStyle = "#fff2d8";
    g.beginPath(); g.moveTo(512, 512); g.lineTo(300, 0); g.lineTo(420, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(512, 512); g.lineTo(604, 0); g.lineTo(724, 0); g.closePath(); g.fill();
    g.restore();
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`;
      g.fillRect(Math.random() * 1024, Math.random() * 300, 1.4, 1.4);
    }
    // feature presentation art
    g.textAlign = "center";
    g.font = "190px serif";
    g.fillText(poster || "🎬", 512, 300);
    g.font = "700 64px Inter, system-ui, sans-serif";
    g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 18;
    g.fillStyle = "#fdf6e8";
    const t = (title || "Now Showing").slice(0, 26);
    g.fillText(t, 512, 400);
    g.shadowBlur = 0;
    g.font = "500 30px Inter, system-ui, sans-serif";
    g.fillStyle = "#f5d789";
    g.fillText("★  NOW SHOWING  ★", 512, 448);
    // letterbox bars
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1024, 26); g.fillRect(0, 486, 1024, 26);
  }
  drawScreen(movieTitle, moviePoster);
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  function setMovie({ title, poster }) {
    drawScreen(title, poster);
    screenTex.needsUpdate = true;
  }
  function carpetTexture() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    g.fillStyle = "#16111d"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.16)";
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 12);
    return t;
  }

  // ---------- materials (shared) ----------
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x7d4c2c, roughness: 0.58, metalness: 0.04, clearcoat: 0.3, clearcoatRoughness: 0.65 });
  const leatherDark = new THREE.MeshPhysicalMaterial({ color: 0x54321d, roughness: 0.64, metalness: 0.03, clearcoat: 0.22, clearcoatRoughness: 0.7 });
  const cushionAccent = new THREE.MeshPhysicalMaterial({ color: 0x8d5c33, roughness: 0.56, metalness: 0.04, clearcoat: 0.32, clearcoatRoughness: 0.6 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x2e1d12, roughness: 0.45, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x191410, roughness: 0.35, metalness: 0.7 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: 0x8a6a24, emissive: 0xe8b34b, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.8 });
  const ledMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x00e68a, transparent: true, opacity: 0.3, depthWrite: false });
  const stripGlow = new THREE.MeshBasicMaterial({ color: 0xffc37a, toneMapped: false });
  const sconceGlow = new THREE.MeshBasicMaterial({ color: 0xffbe78, toneMapped: false });

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const C = {
    free: new THREE.Color(0x2fd27f), freeVip: new THREE.Color(0xe8b34b),
    held: new THREE.Color(0xe8a13c), sold: new THREE.Color(0xb03a3a),
    sel: new THREE.Color(0x00ff9d), hov: new THREE.Color(0xffffff),
  };

  // ---------- architecture ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 30),
    new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 1); floor.receiveShadow = true; scene.add(floor);

  // tier platforms (one per row, carpet top + wood fascia glow line)
  const platMat = new THREE.MeshStandardMaterial({ color: 0x1b1424, roughness: 0.95 });
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.6 });
  for (let r = 0; r < rows; r++) {
    const y = rowY(r);
    const p = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.5, 1.85), platMat);
    p.position.set(0.55, y - 0.28, rowZ(r, 7)); p.receiveShadow = true; scene.add(p);
    const f = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.05, 0.04), new THREE.MeshBasicMaterial({ color: 0xd89a4e, toneMapped: false }));
    f.position.set(0.55, y - 0.06, rowZ(r, 7) - 0.94); scene.add(f);
  }

  // side walls + acoustic panels + sconces
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x171019, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 26), wallMat);
    wall.position.set(sx * 9.6, 3.75, 1); scene.add(wall);
  }
  const panelGeo = new THREE.BoxGeometry(0.16, 4.4, 1.15);
  const panelMatA = new THREE.MeshStandardMaterial({ color: 0x241a2e, roughness: 0.85 });
  const panelMatB = new THREE.MeshStandardMaterial({ color: 0x2e2138, roughness: 0.85 });
  const NZ = 13;
  const panelsA = new THREE.InstancedMesh(panelGeo, panelMatA, NZ * 2);
  const panelsB = new THREE.InstancedMesh(panelGeo, panelMatB, NZ * 2);
  const sconces = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.7, 0.14), sconceGlow, 8);
  let pa = 0, pb = 0, sc = 0;
  for (const sx of [-1, 1]) for (let i = 0; i < NZ; i++) {
    dummy.position.set(sx * 9.32, 2.9, -8.5 + i * 1.62);
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    if ((i + (sx > 0 ? 1 : 0)) % 2 === 0) panelsA.setMatrixAt(pa++, dummy.matrix);
    else panelsB.setMatrixAt(pb++, dummy.matrix);
    if (i % 3 === 1 && sc < 8) {
      dummy.position.set(sx * 9.28, 3.6, -8.5 + i * 1.62); dummy.updateMatrix();
      sconces.setMatrixAt(sc++, dummy.matrix);
    }
  }
  panelsA.count = pa; panelsB.count = pb; sconces.count = sc;
  scene.add(panelsA, panelsB, sconces);

  // Open-top hall: no ceiling plane, so high overview angles always see
  // the full seating bowl. Lighting rig floats above like a lighting bar.
  const barGlow = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 0.5), stripGlow);
  barGlow.position.set(0, 7.0, 3.5); scene.add(barGlow);

  // back wall + exit signs
  const back = new THREE.Mesh(new THREE.BoxGeometry(20, 7.5, 0.4), wallMat);
  back.position.set(0, 3.75, 12.6); scene.add(back);
  for (const sx of [-6, 7.1]) {
    const exit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.1), new THREE.MeshBasicMaterial({ color: 0x1fd06a, toneMapped: false }));
    exit.position.set(sx, 3.1, 12.35); scene.add(exit);
  }

  // ---------- curved screen + stage ----------
  const screenGeo = new THREE.CylinderGeometry(14, 14, 3.7, 40, 1, true, -0.4, 0.8);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 1.35, roughness: 0.9,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 2.9, -21); scene.add(screen);
  const frame = new THREE.Mesh(
    new THREE.CylinderGeometry(14.25, 14.25, 4.05, 40, 1, true, -0.43, 0.86),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 })
  );
  frame.position.copy(screen.position); scene.add(frame);
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.07, 0.07), stripGlow);
  marquee.position.set(0, 5.05, -7.05); scene.add(marquee);
  const stage = new THREE.Mesh(new THREE.BoxGeometry(15, 0.32, 3.4), new THREE.MeshStandardMaterial({ color: 0x201812, roughness: 0.7 }));
  stage.position.set(0, 0.16, -6.2); stage.receiveShadow = true; scene.add(stage);

  // ---------- stairs + LED step lights (aisles) ----------
  const aisleX = [-2.22, 3.32];
  const stepGeo = new THREE.BoxGeometry(1.0, 0.16, 0.55);
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x241c2e, roughness: 0.9 });
  const steps = new THREE.InstancedMesh(stepGeo, stepMat, rows * 2);
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.035, 0.05), stripGlow, rows * 2);
  let si = 0;
  for (let r = 0; r < rows; r++) for (const ax of aisleX) {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(ax, rowY(r) - 0.1, rowZ(r, 7) - 0.9); dummy.updateMatrix();
    steps.setMatrixAt(si, dummy.matrix);
    dummy.position.set(ax, rowY(r) + 0.0, rowZ(r, 7) - 1.16); dummy.updateMatrix();
    leds.setMatrixAt(si, dummy.matrix);
    si++;
  }
  scene.add(steps, leds);

  // ---------- lamp side-tables at aisle edges (instanced) ----------
  const tables = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.6, 0.52), wood, rows * 4);
  const shades = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.19, 0.26, 14),
    new THREE.MeshStandardMaterial({ color: 0xf5e2b8, emissive: 0xffc37a, emissiveIntensity: 1.6 }), rows * 4);
  let ti = 0;
  for (let r = 0; r < rows; r++) for (const ax of aisleX) for (const side of [-0.95, 0.95]) {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.position.set(ax + side, rowY(r) + 0.3, rowZ(r, 7) + 0.35); dummy.updateMatrix();
    tables.setMatrixAt(ti, dummy.matrix);
    dummy.position.set(ax + side, rowY(r) + 0.75, rowZ(r, 7) + 0.35); dummy.updateMatrix();
    shades.setMatrixAt(ti, dummy.matrix);
    ti++;
  }
  tables.castShadow = true;
  scene.add(tables, shades);

  // ---------- recliner seats (instanced parts, shared geo/mat) ----------
  function im(geo, mat, shadow = true) {
    const m = new THREE.InstancedMesh(geo, mat, N);
    m.castShadow = shadow; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  }
  const mBase = im(new THREE.BoxGeometry(0.62, 0.22, 0.62), leather);
  const mBack = im(new THREE.BoxGeometry(0.62, 0.82, 0.2), leather);
  const mHead = im(new THREE.BoxGeometry(0.44, 0.24, 0.18), leatherDark);
  const mPillow = im(new THREE.BoxGeometry(0.36, 0.2, 0.12), cushionAccent);
  const mArmL = im(new THREE.BoxGeometry(0.14, 0.36, 0.72), wood);
  const mArmR = im(new THREE.BoxGeometry(0.14, 0.36, 0.72), wood);
  const mFoot = im(new THREE.BoxGeometry(0.55, 0.1, 0.36), leatherDark);
  const mCup = im(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 16), metal, false);
  const mLed = im(new THREE.BoxGeometry(0.13, 0.05, 0.03), ledMat, false);
  const mTrim = im(new THREE.BoxGeometry(0.46, 0.045, 0.025), goldTrim, false);
  const mOut = im(new THREE.BoxGeometry(1.04, 1.75, 1.2), outlineMat, false);
  const mHit = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 1.75, 1.25),
    new THREE.MeshBasicMaterial({ visible: false }), N);
  scene.add(mHit);

  const LEAN = 0.18;
  function setPart(mesh, idx, x, y, z, yaw, rx = 0, s = 1) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, yaw, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
  }
  function composeSeat(i, lift = 0, s = 1) {
    const st = seats[i];
    const y = st.y + lift;
    setPart(mBase, i, st.x, y + 0.44, st.z, st.yaw, 0, s);
    setPart(mBack, i, st.x, y + 0.9, st.z + 0.37, st.yaw, LEAN, s);
    setPart(mHead, i, st.x, y + 1.38, st.z + 0.45, st.yaw, LEAN, s);
    setPart(mPillow, i, st.x, y + 0.82, st.z + 0.24, st.yaw, LEAN, s);
    setPart(mArmL, i, st.x - 0.39, y + 0.44, st.z, st.yaw, 0, s);
    setPart(mArmR, i, st.x + 0.39, y + 0.44, st.z, st.yaw, 0, s);
    setPart(mFoot, i, st.x, y + 0.24, st.z - 0.5, st.yaw, -0.12, s);
    setPart(mCup, i, st.x + 0.39, y + 0.63, st.z - 0.1, 0, 0, s);
    setPart(mLed, i, st.x, y + 0.4, st.z - 0.33, st.yaw, 0, s);
    // VIP gold crown trim; others zero-scaled away
    if (st.vip) setPart(mTrim, i, st.x, y + 1.5, st.z + 0.34, st.yaw, LEAN, s);
    else setPart(mTrim, i, 0, -10, 0, 0, 0, 0.001);
    // selection shell
    if (selected.has(st.id)) setPart(mOut, i, st.x, y + 0.85, st.z, st.yaw, 0, s);
    else setPart(mOut, i, 0, -10, 0, 0, 0, 0.001);
    setPart(mHit, i, st.x, y + 0.85, st.z, st.yaw);
  }
  function paintLeds(flashT = -1) {
    for (let i = 0; i < N; i++) {
      const st = seats[i];
      const s = statusOf(st.id);
      let col;
      if (flashT >= 0 && flash.has(st.id) && s === "FREE") {
        const p = 0.55 + 0.45 * Math.sin(flashT * 7 + i);
        col = tmpColor.setRGB(0.9 * p + 0.3, 0.72 * p + 0.2, 0.28 * p).clone();
      } else if (s === "SEL") col = C.sel;
      else if (s === "SOLD") col = C.sold;
      else if (s === "HELD") col = C.held;
      else if (hovered === st.id) col = C.hov;
      else col = st.vip ? C.freeVip : C.free;
      mLed.setColorAt(i, col);
    }
    mLed.instanceColor.needsUpdate = true;
  }
  function layoutAll() {
    for (let i = 0; i < N; i++) {
      const st = seats[i];
      composeSeat(i, selected.has(st.id) ? 0.07 : 0, 1);
    }
    for (const m of [mBase, mBack, mHead, mPillow, mArmL, mArmR, mFoot, mCup, mLed, mTrim, mOut, mHit])
      m.instanceMatrix.needsUpdate = true;
    paintLeds();
  }

  // ---------- lighting rig (even wash, no dark corners) ----------
  const hemi = new THREE.HemisphereLight(0x9a8874, 0x0b0806, 0.65); scene.add(hemi);
  const amb = new THREE.AmbientLight(0x6b563e, 0.55); scene.add(amb);
  const screenWash = new THREE.SpotLight(0xcfd8ff, 220, 40, 0.85, 0.7, 1.6);
  screenWash.position.set(0, 3.0, -6.4);
  screenWash.target.position.set(0, 0.8, 6);
  scene.add(screenWash, screenWash.target);
  const ceilingSpot = new THREE.SpotLight(0xffe2b8, 420, 42, 0.9, 0.6, 1.7);
  ceilingSpot.position.set(0, 7.0, 3.5);
  ceilingSpot.target.position.set(0, 0, -1);
  ceilingSpot.castShadow = true;
  ceilingSpot.shadow.mapSize.set(1024, 1024);
  ceilingSpot.shadow.bias = -0.0004;
  scene.add(ceilingSpot, ceilingSpot.target);
  // warm rear fill so the back rows never sit in darkness
  const rearFill = new THREE.PointLight(0xffd9a8, 40, 34, 1.8);
  rearFill.position.set(0, 5.5, 11.5); scene.add(rearFill);
  const sconceL = new THREE.PointLight(0xffbe78, 34, 20, 1.9); sconceL.position.set(-8.4, 3.6, 0); scene.add(sconceL);
  const sconceR = new THREE.PointLight(0xffbe78, 34, 20, 1.9); sconceR.position.set(8.4, 3.6, 0); scene.add(sconceR);

  let cinematic = false;
  function applyMode() {
    if (cinematic) {
      hemi.intensity = 0.3; amb.intensity = 0.22;
      ceilingSpot.intensity = 220; screenWash.intensity = 260;
      rearFill.intensity = 18;
      sconceL.intensity = sconceR.intensity = 18;
      renderer.toneMappingExposure = 1.05;
    } else {
      hemi.intensity = 0.65; amb.intensity = 0.55;
      ceilingSpot.intensity = 420; screenWash.intensity = 220;
      rearFill.intensity = 40;
      sconceL.intensity = sconceR.intensity = 34;
      renderer.toneMappingExposure = 1.3;
    }
  }
  applyMode();

  // ---------- interaction ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let hovered = null;
  const flash = new Set();
  let flashUntil = 0;
  const pops = new Map(); // idx -> startMs
  const tip = document.createElement("div");
  tip.style.cssText = "position:fixed;pointer-events:none;background:rgba(20,14,28,.94);border:1px solid #e8b34b;color:#f2ecdf;padding:8px 12px;border-radius:10px;font-size:12px;display:none;z-index:60;max-width:230px;box-shadow:0 8px 30px rgba(0,0,0,.5);";
  document.body.appendChild(tip);

  function syncSeatMap() {
    for (const s of seatMap) { const t = byId[s.id]; if (t) t.st = s.status; }
  }
  syncSeatMap();
  layoutAll();

  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(mHit)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return seats[hit.instanceId];
  }

  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons !== 0) { tip.style.display = "none"; canvas.style.cursor = "grabbing"; return; } // dragging, not hovering
    const s = pick(e);
    const nh = s ? s.id : null;
    if (nh !== hovered) { hovered = nh; paintLeds(); }
    canvas.style.cursor = s ? "pointer" : "grab";
    if (s) {
      const info = seatInfo(s.id);
      tip.style.display = "block";
      tip.style.left = Math.min(e.clientX + 14, innerWidth - 240) + "px";
      tip.style.top = e.clientY + 14 + "px";
      tip.innerHTML = `<b style="color:#f5d789">${info.id} · ${info.category}</b><br>` +
        `Row ${info.row} · Seat ${info.col} · ₹${info.price}<br>` +
        `<span style="color:${info.status === "FREE" ? "#3ddc84" : info.status === "SEL" ? "#00ff9d" : "#ff5d5d"}">${info.status === "SEL" ? "Selected ✓" : info.status}</span>` +
        (info.status === "FREE" ? `<br><span style="opacity:.7">Click to select</span>` : "");
    } else tip.style.display = "none";
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; tip.style.display = "none"; paintLeds(); });
  // Only a true tap selects — a drag that ends over a seat must NOT book it.
  let downX = 0, downY = 0;
  let lastTap = { id: null, t: 0 };
  canvas.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener("click", (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // was orbit/pan, ignore
    const s = pick(e);
    if (!s) return;
    const st = byId[s.id].st || "FREE";
    if (st === "SOLD" || st === "HELD") return;
    // second tap of a double-click: skip the toast, selection ends unchanged
    const now = performance.now();
    const isDouble = lastTap.id === s.id && now - lastTap.t < 350;
    lastTap = { id: s.id, t: now };
    pops.set(seats.indexOf(s), now);
    onToggle(s.id, isDouble);
    layoutAll();
  });
  // Double-click ANY seat (even far corners) to fly the camera pivot to it.
  // Afterwards orbit + zoom work around that seat. Single-click still selects.
  canvas.addEventListener("dblclick", (e) => {
    const s = pick(e);
    if (!s) return;
    e.preventDefault();
    focusSeat(s.id);
    onFocus(s.id);
  });
  function focusSeat(id) {
    const s = byId[id];
    if (!s) return false;
    focusPoint(s.x, s.z, s.y + 0.8);
    return true;
  }
  // Fly the orbit pivot to any hall coordinate (minimap clicks land here).
  function focusPoint(x, z, y = 1.0) {
    const off = camera.position.clone().sub(controls.target);
    if (off.length() > 10) off.setLength(10);
    if (off.length() < 3) off.setLength(4);
    const nt = new THREE.Vector3(
      THREE.MathUtils.clamp(x, -12, 12), y,
      THREE.MathUtils.clamp(z, -7.5, 13));
    const nc = nt.clone().add(off);
    flyTo(nc.toArray(), nt.toArray(), 900);
  }
  // D-pad movement: shift the whole view, or dolly toward/away the pivot.
  function panBy(dx, dz) {
    anim = null;
    camera.position.x += dx; camera.position.z += dz;
    controls.target.x += dx; controls.target.z += dz;
    clampCam();
  }
  function dolly(f) {
    anim = null;
    const off = camera.position.clone().sub(controls.target).multiplyScalar(f);
    off.setLength(THREE.MathUtils.clamp(off.length(), 1.2, 24));
    camera.position.copy(controls.target).add(off);
    clampCam();
  }
  // Live data for the 2D minimap.
  function getSeatDots() {
    return seats.map((s) => ({ id: s.id, x: s.x, z: s.z, vip: s.vip, st: statusOf(s.id) }));
  }
  function getView() {
    return { cx: camera.position.x, cz: camera.position.z, tx: controls.target.x, tz: controls.target.z };
  }

  // ---------- camera presets + smooth fly (all inside the hall) ----------
  // Default opens high + centered: screen at the back of the frame,
  // full seating bowl fanned out in front — never stuck behind the back row.
  const VIEWS = {
    default: { p: [0, 11, 9.5], t: [0, 0.8, -1.5] },
    top: { p: [0.5, 15, 3.0], t: [0.5, 0, 0.6] },
    front: { p: [0, 3.0, 8.6], t: [0, 2.6, -7] },
    side: { p: [8.6, 4.2, 2.5], t: [0, 1.4, 0] },
  };
  let anim = null;
  function flyTo(p, t, dur = 1150) {
    anim = {
      t0: performance.now(), dur,
      p0: camera.position.clone(), p1: new THREE.Vector3(...p),
      g0: controls.target.clone(), g1: new THREE.Vector3(...t),
    };
  }
  controls.addEventListener("start", () => { anim = null; });
  function setView(name) {
    const v = VIEWS[name];
    if (!v) return;
    flyTo(v.p, v.t);
  }
  function viewFromSeat(id) {
    const s = byId[id];
    if (!s) return false;
    flyTo([s.x, s.y + 1.25, s.z + 0.15], [0, 2.9, -7], 1300);
    return true;
  }

  // ---------- best seats ----------
  function recommendBest(n = 2) {
    const scored = seats
      .filter((s) => (s.st || "FREE") === "FREE")
      .map((s) => ({ s, score: Math.abs(s.r - 3.6) * 2 + Math.abs(s.c - 7) * 1.15 + (s.vip ? 1.5 : 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, n)
      .map((x) => x.s.id);
    flash.clear(); scored.forEach((id) => flash.add(id));
    flashUntil = performance.now() + 4000;
    return scored;
  }

  function toggleCinematic() {
    cinematic = !cinematic;
    applyMode();
    return cinematic;
  }

  // ---------- resize + loop ----------
  function resize() {
    const w = canvas.clientWidth || 640, h = 460;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  addEventListener("resize", resize);

  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let raf, dead = false;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  (function loop() {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (anim && !reduceMotion) {
      const k = Math.min(1, (now - anim.t0) / anim.dur), e = easeInOut(k);
      camera.position.lerpVectors(anim.p0, anim.p1, e);
      controls.target.lerpVectors(anim.g0, anim.g1, e);
      if (k >= 1) anim = null;
    } else if (anim && reduceMotion) {
      camera.position.copy(anim.p1); controls.target.copy(anim.g1); anim = null;
    }
    // click-pop animation
    if (pops.size) {
      for (const [idx, start] of [...pops]) {
        const k = (now - start) / 260;
        if (k >= 1) {
          pops.delete(idx);
          composeSeat(idx, selected.has(seats[idx].id) ? 0.07 : 0, 1);
        } else {
          const sc = 1 + 0.1 * Math.sin(Math.PI * k);
          composeSeat(idx, selected.has(seats[idx].id) ? 0.07 : 0, sc);
        }
      }
      for (const m of [mBase, mBack, mHead, mPillow, mArmL, mArmR, mFoot, mCup, mLed, mTrim, mOut, mHit])
        m.instanceMatrix.needsUpdate = true;
    }
    // best-seat flash pulse
    if (flash.size && now < flashUntil) paintLeds(now / 1000);
    else if (flash.size) { flash.clear(); paintLeds(); }
    // subtle projector flicker on the screen
    if (!reduceMotion) screenMat.emissiveIntensity = 1.35 + Math.sin(now * 0.008) * 0.045;
    controls.update();
    clampCam();
    renderer.render(scene, camera);
  })();

  return {
    refresh(nextMap) {
      seatMap.splice(0, seatMap.length, ...nextMap);
      syncSeatMap(); layoutAll();
    },
    setView, viewFromSeat, toggleCinematic, recommendBest, seatInfo, setMovie, focusSeat,
    focusPoint, panBy, dolly, getSeatDots, getView,
    isCinematic: () => cinematic,
    dispose() {
      dead = true; cancelAnimationFrame(raf); tip.remove();
      controls.dispose();
      removeEventListener("resize", resize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !Object.values({ leather, leatherDark, cushionAccent, wood, metal }).includes(o.material)) {
          Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
