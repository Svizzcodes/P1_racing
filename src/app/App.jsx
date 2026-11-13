import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import TouchControlButton from './TouchControlButton';
import {
  analyzeSetup,
  DEFAULT_SETUP_ANALYSIS,
  loadCareerStats,
  loadSettings
} from './setupProfiles';
import './index.css';

const TOTAL_LAPS = 5;
const PLAYER_ID = 'PARTHIV ABHANI';
const TRACK_WIDTH = 20;
const CAMERA_MODES = ['CHASE', 'COCKPIT', 'BROADCAST'];
const DRS_ZONES = [[0, 0.12], [0.25, 0.39]];
const WEATHER_PRESETS = [
  { name: 'CLEAR', rain: 0.0, fog: 0.00085, sun: 1.85, ambient: 0.68, top: '#1976d2', mid: '#42a5f5', bot: '#bbdefb' },
  { name: 'OVERCAST', rain: 0.3, fog: 0.0016, sun: 1.25, ambient: 0.58, top: '#37474f', mid: '#607d8b', bot: '#cfd8dc' },
  { name: 'STORM', rain: 0.75, fog: 0.0025, sun: 0.85, ambient: 0.42, top: '#1c2833', mid: '#34495e', bot: '#5d6d7e' }
];


const TRACK_POINTS = [
  [0, 0, 0], [80, 0, 0], [110, 6, -20], [130, 12, -50], [140, 15, -80], [130, 12, -110], [140, 8, -140],
  [160, 4, -160], [200, 2, -170], [250, 0, -175], [280, -2, -160], [290, -4, -130], [280, -4, -90],
  [260, -2, -60], [240, 0, -40], [200, 2, -30], [160, 4, -20], [120, 2, 20], [80, 0, 40], [40, 0, 50],
  [0, 0, 55], [-40, -2, 50], [-60, -2, 35], [-50, -2, 10], [-25, -1, 0]
];

const QUALITY_PRESETS = {
  high: {
    label: 'P1 RACE SPEC',
    antialias: true,
    maxPixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.0) : 1.5,
    minPixelRatio: 1.0,
    logarithmicDepthBuffer: false,
    shadowMapEnabled: true,
    shadowMapSize: 1024,
    rainCount: 650,
    rainUpdateInterval: 0.03,
    skyResolution: 512,
    skySegments: 32,
    skyUpdateInterval: 0.15,
    minimapInterval: 0.15,
    minimapSize: 180,
    groundSegments: 220,
    trackSamples: 640,
    terrainCheckStep: 5,
    treeCount: 1100,
    barrierStep: 3,
    smokeCount: 90,
    sparkCount: 60,
    grassAnisotropy: 4,
    wheelSegments: 12,
    shadowUpdateInterval: 0.15,
    useDetailedCarModel: true
  }
};

const detectQualityPreset = () => {
  return QUALITY_PRESETS.high;
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const normAngle = (a) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
};

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
};

const inDrsZone = (t) => DRS_ZONES.some(([a, b]) => t >= a && t <= b);

const paintSkyGlow = (ctx, x, y, weather) => {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 260);
  glow.addColorStop(0, `rgba(255,250,220,${0.95 - weather.rain * 0.4})`);
  glow.addColorStop(0.35, `rgba(255,210,120,${0.6 - weather.rain * 0.25})`);
  glow.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 260, y - 260, 520, 520);
};

const paintSky = (ctx, w, h, weather, sunPhase) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, weather.top);
  g.addColorStop(0.5, weather.mid);
  g.addColorStop(1, weather.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sx = w * (0.2 + 0.6 * sunPhase);
  const sy = h * (0.55 - 0.3 * Math.sin(sunPhase * Math.PI));
  paintSkyGlow(ctx, sx - w, sy, weather);
  paintSkyGlow(ctx, sx, sy, weather);
  paintSkyGlow(ctx, sx + w, sy, weather);

  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i += 1) {
    const cloudY = h * (0.18 + i * 0.12) + Math.sin((sunPhase + i * 0.15) * Math.PI * 2) * 6;
    const alpha = Math.max(0.06, 0.12 - weather.rain * 0.05 - i * 0.01);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 16 - i * 1.8;
    ctx.beginPath();
    ctx.moveTo(-20, cloudY);
    ctx.bezierCurveTo(w * 0.18, cloudY - 18, w * 0.42, cloudY + 12, w * 0.65, cloudY - 6);
    ctx.bezierCurveTo(w * 0.82, cloudY - 16, w * 0.94, cloudY + 8, w + 20, cloudY - 4);
    ctx.stroke();
  }
};

let detailedCarTemplatePromise = null;

const loadDetailedCarTemplate = () => {
  if (!detailedCarTemplatePromise) {
    const loader = new GLTFLoader();
    const tryUrls = ['./redbull.glb', 'redbull.glb', '/redbull.glb'];
    const tryLoad = (idx) => {
      if (idx >= tryUrls.length) {
        return Promise.reject(new Error('Failed to load redbull.glb from all paths'));
      }
      return loader.loadAsync(tryUrls[idx]).catch(() => tryLoad(idx + 1));
    };
    detailedCarTemplatePromise = tryLoad(0)
      .then((gltf) => gltf.scene)
      .catch((error) => {
        detailedCarTemplatePromise = null;
        console.warn('Could not load redbull.glb:', error);
        throw error;
      });
  }
  return detailedCarTemplatePromise;
};

const cloneDetailedCar = (template, shadowMapEnabled) => {
  const model = template.clone(true);
  const allowDetailedCarShadows = shadowMapEnabled && false;
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry = obj.geometry.clone();
      obj.material = Array.isArray(obj.material)
        ? obj.material.map((material) => material.clone())
        : obj.material.clone();
      const materialList = Array.isArray(obj.material) ? obj.material : [obj.material];
      materialList.forEach((material) => {
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = Math.min(material.map.anisotropy || 1, 2);
        }
        if (material.normalMap) {
          material.normalMap.anisotropy = Math.min(material.normalMap.anisotropy || 1, 1);
        }
        if (material.roughness !== undefined) {
          material.roughness = Math.max(0.28, Math.min(material.roughness, 0.55));
        }
      });
      obj.castShadow = allowDetailedCarShadows;
      obj.receiveShadow = allowDetailedCarShadows;
      obj.frustumCulled = true;
    }
  });
  return model;
};

// ── Audio Engine ──
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let windGain = null;
let windNoise = null;
let audioEnabled = false;

const initAudio = () => {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Engine oscillator
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 80;
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
    // Wind noise
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    windNoise = audioCtx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;
    windGain = audioCtx.createGain();
    windGain.gain.value = 0;
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windNoise.start();
    audioEnabled = true;
  } catch (e) { audioEnabled = false; }
};

const updateEngineSound = (kmh, rpm, throttle) => {
  if (!audioEnabled || !engineOsc) return;
  const t = performance.now() * 0.001;
  engineOsc.frequency.value = 55 + rpm * 0.006 + Math.sin(t * 30) * (throttle ? 3 : 1);
  engineGain.gain.value = Math.min(0.06, 0.005 + throttle * 0.055);
  if (windGain) windGain.gain.value = Math.min(0.03, kmh * 0.00015);
};

const playCollisionSound = () => {
  if (!audioEnabled || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 120;
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.15);
};

const playGearShiftSound = () => {
  if (!audioEnabled || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 300;
  g.gain.setValueAtTime(0.04, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
};

const stopAudio = () => {
  if (engineGain) engineGain.gain.value = 0;
  if (windGain) windGain.gain.value = 0;
};

export default function F1RacingGame() {
  const containerRef = useRef(null);
  const minimapRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const debugStateRef = useRef({
    coordinateSystem: 'trackProgress is 0..1 around the circuit; lateralOffsetMeters is signed from centerline (+left, -right).',
    phase: 'menu',
    countdown: null,
    player: null,
    race: null,
    leaders: [],
    hudMessage: null
  });

  const [settings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  const setupAnalysisRef = useRef(DEFAULT_SETUP_ANALYSIS);

  const [careerStats, setCareerStats] = useState(loadCareerStats);
  const careerStatsRef = useRef(careerStats);

  const [phase, setPhase] = useState('menu');
  const phaseRef = useRef(phase);

  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLanding(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const [soundOn, setSoundOn] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [sessionId, setSessionId] = useState(0);
  const [result, setResult] = useState(null);
  const [showTouchControls, setShowTouchControls] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissOrientationPrompt, setDismissOrientationPrompt] = useState(false);
  const cameraActionRef = useRef(null);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 800;
        setIsPortrait(portrait);
      }
    };
    checkOrientation();
    const isTouch = typeof window !== 'undefined' && (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 1024
    );
    setShowTouchControls(isTouch);

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const [hud, setHud] = useState({
    speed: 0,
    gear: 1,
    rpm: 4000,
    lap: 1,
    bestLap: null,
    lapTime: 0,
    raceTime: 0,
    position: 1,
    competitors: 7,
    sector: 1,
    sectors: [null, null, null],
    drsReady: false,
    drsOn: false,
    ers: 100,
    ersOn: false,
    damage: 0,
    weather: 'CLEAR',
    camera: 'CHASE',
    leaders: [PLAYER_ID, 'VERSTAPPEN', 'NORRIS', 'HAMILTON'],
    slipstream: false,
    offTrack: false,
    message: '',
    fps: 60,
    flow: 0,
    profile: DEFAULT_SETUP_ANALYSIS.preset.shortLabel
  });

  const prevThrottleRef = useRef(false);
  const keysRef = useRef({ up: false, down: false, left: false, right: false, drift: false, drs: false, ers: false, repair: false });
  const clearInputs = () => {
    Object.keys(keysRef.current).forEach((key) => {
      keysRef.current[key] = false;
    });
  };

  useEffect(() => {
    settingsRef.current = settings;
    setupAnalysisRef.current = analyzeSetup(settings);
    localStorage.setItem('f1-pro-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    careerStatsRef.current = careerStats;
    localStorage.setItem('f1-pro-career', JSON.stringify(careerStats));
  }, [careerStats]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const analysis = analyzeSetup(settings);
    debugStateRef.current = {
      ...debugStateRef.current,
      phase,
      countdown,
      quality: {
        preset: detectQualityPreset().label
      },
      setup: {
        profile: analysis.preset.name,
        matchPct: analysis.matchPct,
        attack: analysis.metrics.attack,
        precision: analysis.metrics.precision,
        tyreCare: analysis.metrics.tyreCare
      },
      career: {
        races: careerStats.races,
        wins: careerStats.wins,
        podiums: careerStats.podiums,
        bestLap: careerStats.bestLap ? Number(careerStats.bestLap.toFixed(3)) : null
      },
      result: result ? {
        position: result.position,
        total: Number(result.total.toFixed(3)),
        best: result.best ? Number(result.best.toFixed(3)) : null,
        weather: result.weather,
        isNewBestLap: Boolean(result.isNewBestLap)
      } : null
    };
  }, [phase, countdown, result, careerStats, settings]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.render_game_to_text = () => JSON.stringify(debugStateRef.current);
    return () => {
      delete window.render_game_to_text;
    };
  }, []);

  const resetHud = () => {
    const nextSetup = setupAnalysisRef.current;
    setHud((prev) => ({
      ...prev,
      speed: 0,
      gear: 1,
      rpm: 4000,
      lap: 1,
      bestLap: null,
      lapTime: 0,
      raceTime: 0,
      position: 1,
      sector: 1,
      sectors: [null, null, null],
      drsReady: false,
      drsOn: false,
      ers: 100,
      ersOn: false,
      damage: 0,
      weather: 'CLEAR',
      camera: CAMERA_MODES[0],
      slipstream: false,
      offTrack: false,
      message: '',
      fps: 60,
      flow: 0,
      profile: nextSetup.preset.shortLabel
    }));
  };

  const startRace = () => {
    clearInputs();
    resetHud();
    setResult(null);
    setCountdown(3);
    setPhase('countdown');
    setSessionId((v) => v + 1);
  };

  const restartRace = () => {
    clearInputs();
    resetHud();
    setResult(null);
    setCountdown(3);
    setPhase('countdown');
    setSessionId((v) => v + 1);
  };

  const backToMenu = () => {
    clearInputs();
    setPhase('menu');
    setResult(null);
    setCountdown(null);
    setSessionId((v) => v + 1);
  };

  useEffect(() => {
    if (!containerRef.current || phaseRef.current === 'menu') return undefined;

    const container = containerRef.current;
    let cancelled = false;
    container.innerHTML = '';
    const quality = detectQualityPreset();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xa6d2f8, 0.00085);

    const camera = new THREE.PerspectiveCamera(76, container.clientWidth / container.clientHeight, 0.5, 2500);
    const renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: quality.logarithmicDepthBuffer
    });
    let targetPixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    let activePixelRatio = targetPixelRatio;
    const applyRendererMetrics = () => {
      renderer.setPixelRatio(activePixelRatio);
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    applyRendererMetrics();
    renderer.shadowMap.enabled = quality.shadowMapEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.62;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x9fc5f0, 0.65);
    const hemi = new THREE.HemisphereLight(0xd4ebff, 0x5a8a50, 1.35);
    const sun = new THREE.DirectionalLight(0xfffaec, 1.85);
    sun.position.set(150, 220, 120);
    sun.castShadow = quality.shadowMapEnabled;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 850;
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    scene.add(ambient, hemi, sun);

    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = quality.skyResolution;
    skyCanvas.height = quality.skyResolution;
    const skyCtx = skyCanvas.getContext('2d');
    paintSky(skyCtx, quality.skyResolution, quality.skyResolution, WEATHER_PRESETS[0], 0.3);
    const skyTexture = new THREE.CanvasTexture(skyCanvas);
    skyTexture.wrapS = THREE.RepeatWrapping;
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1300, quality.skySegments, quality.skySegments),
      new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false })
    );
    scene.add(sky);

    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 256;
    grassCanvas.height = 256;
    const grassCtx = grassCanvas.getContext('2d');
    grassCtx.fillStyle = '#3c8438';
    grassCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i += 1) {
      const x = Math.floor(Math.random() * 256);
      const y = Math.floor(Math.random() * 256);
      const shade = 90 + Math.floor(Math.random() * 85);
      grassCtx.fillStyle = `rgb(${30 + Math.floor(shade * 0.2)}, ${shade}, ${30 + Math.floor(shade * 0.15)})`;
      grassCtx.fillRect(x, y, 2, 2);
    }
    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(40, 40);
    grassTexture.colorSpace = THREE.SRGBColorSpace;
    grassTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.grassAnisotropy);

    const groundGeo = new THREE.PlaneGeometry(3000, 3000, quality.groundSegments, quality.groundSegments);
    groundGeo.rotateX(-Math.PI / 2);

    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ map: grassTexture, color: 0x489e43, roughness: 0.88, metalness: 0.02 })
    );
    ground.receiveShadow = quality.shadowMapEnabled;
    scene.add(ground);

    const curve = new THREE.CatmullRomCurve3(
      TRACK_POINTS.map(([x, y, z]) => new THREE.Vector3(x * 3.6, y * 3.6, z * 3.6)),
      true,
      'catmullrom',
      0.52
    );

    const samples = quality.trackSamples;
    const points = [];
    const tangents = [];
    const normals = [];
    const curvatures = [];
    let trackLength = 0;

    for (let i = 0; i < samples; i += 1) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      points.push(p);
      tangents.push(tan);
      normals.push(n);
      if (i) trackLength += p.distanceTo(points[i - 1]);
    }
    trackLength += points[0].distanceTo(points[samples - 1]);

    // Deform terrain safely using Trench Cap
    const posAttribute = groundGeo.attributes.position;
    for (let i = 0; i < posAttribute.count; i++) {
      const vx = posAttribute.getX(i);
      const vz = posAttribute.getZ(i);

      let closestDist = Infinity;
      let closestY = 0;
      let trenchCap = Infinity;

      for (let j = 0; j < samples; j += quality.terrainCheckStep) {
        const pt = points[j];
        const dx = vx - pt.x;
        const dz = vz - pt.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < closestDist) {
          closestDist = dist;
          closestY = pt.y;
        }

        let cap;
        // Expand the Trench Cap Zone to 28 to completely encompass the Triangle grid diagonals!
        // 10 unit grid means the edge can reach 14.1 diagonal. track is radius 10. 10+14=24.
        if (dist < 28) {
          cap = pt.y - 0.4;
        } else {
          cap = pt.y - 0.4 + (dist - 28) * 1.5;
        }
        if (cap < trenchCap) trenchCap = cap;
      }

      let baseElevation = closestY - 0.4 - (closestDist > 28 ? (closestDist - 28) * 0.15 : 0);
      baseElevation = Math.max(-15, baseElevation);

      const targetY = Math.min(trenchCap, baseElevation);
      posAttribute.setY(i, targetY);
    }
    groundGeo.computeVertexNormals();

    for (let i = 0; i < samples; i += 1) {
      curvatures.push(clamp((1 - tangents[i].dot(tangents[(i + 8) % samples])) * 6, 0, 1));
    }

    const roadVertices = [];
    const roadUV = [];
    const roadIndices = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const n = normals[i];
      const l = p.clone().addScaledVector(n, TRACK_WIDTH * 0.5);
      const r = p.clone().addScaledVector(n, -TRACK_WIDTH * 0.5);
      roadVertices.push(l.x, l.y + 0.03, l.z, r.x, r.y + 0.03, r.z);
      roadUV.push(0, (i / samples) * 32, 1, (i / samples) * 32);
      const base = i * 2;
      const nxt = ((i + 1) % samples) * 2;
      roadIndices.push(base, nxt, base + 1, base + 1, nxt, nxt + 1);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUV, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    // Asphalt Texture
    const asphaltCanvas = document.createElement('canvas');
    asphaltCanvas.width = 512;
    asphaltCanvas.height = 512;
    const ctxA = asphaltCanvas.getContext('2d');
    ctxA.fillStyle = '#22262a';
    ctxA.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      ctxA.fillStyle = Math.random() > 0.5 ? '#1a1d21' : '#2b3036';
      ctxA.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const asphaltTex = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(2, 80);
    asphaltTex.anisotropy = 4;

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: 0x9e9e9e,
      roughness: 0.72,
      metalness: 0.12,
    });
    const runoffVertices = [];
    const runoffUV = [];
    const runoffIndices = [];
    const runoffHalfWidth = TRACK_WIDTH * 0.82;
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const n = normals[i];
      const l = p.clone().addScaledVector(n, runoffHalfWidth);
      const r = p.clone().addScaledVector(n, -runoffHalfWidth);
      runoffVertices.push(l.x, l.y + 0.018, l.z, r.x, r.y + 0.018, r.z);
      runoffUV.push(0, (i / samples) * 24, 1, (i / samples) * 24);
      const base = i * 2;
      const nxt = ((i + 1) % samples) * 2;
      runoffIndices.push(base, nxt, base + 1, base + 1, nxt, nxt + 1);
    }
    const runoffGeo = new THREE.BufferGeometry();
    runoffGeo.setAttribute('position', new THREE.Float32BufferAttribute(runoffVertices, 3));
    runoffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(runoffUV, 2));
    runoffGeo.setIndex(runoffIndices);
    runoffGeo.computeVertexNormals();
    const runoff = new THREE.Mesh(
      runoffGeo,
      new THREE.MeshStandardMaterial({
        map: asphaltTex,
        color: 0x69717b,
        roughness: 0.92,
        metalness: 0.04
      })
    );
    runoff.receiveShadow = quality.shadowMapEnabled;
    scene.add(runoff);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = quality.shadowMapEnabled;
    scene.add(road);

    // Starting Grid Markings
    const startGridGeo = new THREE.BufferGeometry();
    const gridVerts = [];
    const gridIndices = [];
    let gidx = 0;

    // Draw grid slots for first 5 cars (0 to 0.015 of the track)
    for (let k = 0; k < 5; k++) {
      const gT = k * 0.003;
      const rp = curve.getPointAt(gT);
      const rtan = curve.getTangentAt(gT).normalize();
      const rn = new THREE.Vector3(-rtan.z, 0, rtan.x).normalize();

      const side = (k % 2 === 0) ? -1 : 1;
      const offset = TRACK_WIDTH * 0.25 * side;
      const center = rp.clone().addScaledVector(rn, offset);

      // Slot box
      const w = 1.6;
      const h = 4.0;
      const bl = center.clone().addScaledVector(rn, -w).addScaledVector(rtan, -h);
      const br = center.clone().addScaledVector(rn, w).addScaledVector(rtan, -h);
      const tl = center.clone().addScaledVector(rn, -w).addScaledVector(rtan, h);
      const tr = center.clone().addScaledVector(rn, w).addScaledVector(rtan, h);

      gridVerts.push(
        bl.x, bl.y + 0.04, bl.z, br.x, br.y + 0.04, br.z,
        tl.x, tl.y + 0.04, tl.z, tr.x, tr.y + 0.04, tr.z
      );
      gridIndices.push(gidx, gidx + 1, gidx + 2, gidx + 2, gidx + 1, gidx + 3);
      gidx += 4;
    }

    // Start/Finish Line
    const sfP = curve.getPointAt(0);
    const sfTan = curve.getTangentAt(0).normalize();
    const sfN = new THREE.Vector3(-sfTan.z, 0, sfTan.x).normalize();
    const sfL = sfP.clone().addScaledVector(sfN, -TRACK_WIDTH * 0.48);
    const sfR = sfP.clone().addScaledVector(sfN, TRACK_WIDTH * 0.48);
    const sfW = 0.8; // thickness
    const sbl = sfL.clone().addScaledVector(sfTan, -sfW);
    const sbr = sfR.clone().addScaledVector(sfTan, -sfW);
    const stl = sfL.clone().addScaledVector(sfTan, sfW);
    const str = sfR.clone().addScaledVector(sfTan, sfW);
    gridVerts.push(
      sbl.x, sbl.y + 0.05, sbl.z, sbr.x, sbr.y + 0.05, sbr.z,
      stl.x, stl.y + 0.05, stl.z, str.x, str.y + 0.05, str.z
    );
    gridIndices.push(gidx, gidx + 1, gidx + 2, gidx + 2, gidx + 1, gidx + 3);

    startGridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridVerts, 3));
    startGridGeo.setIndex(gridIndices);
    const startGridMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const startGrid = new THREE.Mesh(startGridGeo, startGridMat);
    scene.add(startGrid);

    // Curbs (Rumble Strips) and Braeking Boards
    const curbVerts = [];
    const curbColors = [];
    const curbIndices = [];
    let curIdx = 0;

    const boardGeo = new THREE.PlaneGeometry(1.5, 0.8);

    // Pre-calculate sharp corners to place braking boards 50m, 100m, 150m beforehand
    let isCornering = false;

    for (let i = 0; i < samples; i += 1) {
      const c = curvatures[i];
      const p = points[i];
      const n = normals[i];

      if (c > 0.45) { // Sharp corner generates curbs
        // Inside or outside curb depending on turn direction
        const curveDir = tangents[i].clone().cross(tangents[(i + 1) % samples]);
        const isLeftTurn = curveDir.y > 0;
        const sideOffset = isLeftTurn ? -TRACK_WIDTH * 0.5 : TRACK_WIDTH * 0.5;

        const curbCenter = p.clone().addScaledVector(n, sideOffset);
        const curbWidth = isLeftTurn ? new THREE.Vector3().copy(n).multiplyScalar(0.8) : new THREE.Vector3().copy(n).multiplyScalar(-0.8);

        const cl = curbCenter.clone().sub(curbWidth);
        const cr = curbCenter.clone().add(curbWidth);

        // Slight height above the displaced track
        curbVerts.push(cl.x, cl.y + 0.06, cl.z, cr.x, cr.y + 0.08, cr.z);

        // Alternating color based on segment index (Yellow and Red for Spa style)
        const color = (i % 4 < 2) ? [0.95, 0.95, 0.95] : [0.83, 0.12, 0.12];
        curbColors.push(...color, ...color);

        if (curIdx > 0 && i > 0 && curvatures[i - 1] > 0.45) {
          const b = curIdx;
          curbIndices.push(b - 2, b - 1, b, b, b - 1, b + 1);
        }
        curIdx += 2;

        // If we just started cornering, place brake markers backwards
        if (!isCornering) {
          const boardDistances = [150, 100, 50];
          boardDistances.forEach((dist, bIdx) => {
            const lookbackFrames = Math.floor(dist / (trackLength / samples));
            const placeIdx = (i - lookbackFrames + samples) % samples;
            const pb = points[placeIdx];
            const nb = normals[placeIdx];
            const tb = tangents[placeIdx];

            // Boards on the outside of the approaching straight
            const boardSide = isLeftTurn ? TRACK_WIDTH * 0.7 : -TRACK_WIDTH * 0.7;
            const boardPos = pb.clone().addScaledVector(nb, boardSide);

            const boardCanvas = document.createElement('canvas');
            boardCanvas.width = 128;
            boardCanvas.height = 64;
            const bctx = boardCanvas.getContext('2d');
            bctx.fillStyle = '#0a0d10';
            bctx.fillRect(0, 0, 128, 64);
            bctx.fillStyle = '#ffffff';
            bctx.font = 'bold 36px monospace';
            bctx.textAlign = 'center';
            bctx.textBaseline = 'middle';
            bctx.fillText(dist.toString(), 64, 34);

            const boardTex = new THREE.CanvasTexture(boardCanvas);
            const bMat = new THREE.MeshBasicMaterial({ map: boardTex });
            const board = new THREE.Mesh(boardGeo, bMat);
            board.position.copy(boardPos);
            board.position.y = boardPos.y + 1.0;

            // Orient facing approaching driver
            const angle = Math.atan2(tb.x, tb.z);
            board.rotation.y = angle + Math.PI;
            scene.add(board);
          });
        }
        isCornering = true;
      } else {
        isCornering = false;
      }
    }

    if (curbIndices.length > 0) {
      const curbGeo = new THREE.BufferGeometry();
      curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
      curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
      curbGeo.setIndex(curbIndices);
      curbGeo.computeVertexNormals();
      const curbMesh = new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
      scene.add(curbMesh);
    }

    const linePos = [];
    const lineCol = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const c = curvatures[i];
      linePos.push(p.x, p.y + 0.2, p.z);
      if (c < 0.4) lineCol.push(0.2 + c, 0.95, 0.32);
      else if (c < 0.72) lineCol.push(0.9, 0.85, 0.2);
      else lineCol.push(0.95, 0.35, 0.15);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
    scene.add(new THREE.LineLoop(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.52 })));

    const edgeL = [];
    const edgeR = [];
    const centerDash = [];
    for (let i = 0; i < samples; i += 1) {
      const p = points[i];
      const n = normals[i];
      const left = p.clone().addScaledVector(n, TRACK_WIDTH * 0.45);
      const right = p.clone().addScaledVector(n, -TRACK_WIDTH * 0.45);
      edgeL.push(left.x, left.y + 0.055, left.z);
      edgeR.push(right.x, right.y + 0.055, right.z);

      if (i % 12 < 6) {
        const p0 = points[i];
        const p1 = points[(i + 2) % samples];
        centerDash.push(p0.x, p0.y + 0.06, p0.z, p1.x, p1.y + 0.06, p1.z);
      }
    }

    const edgeLGeo = new THREE.BufferGeometry();
    edgeLGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeL, 3));
    scene.add(new THREE.LineLoop(edgeLGeo, new THREE.LineBasicMaterial({ color: 0xe9edf5, transparent: true, opacity: 0.85 })));

    const edgeRGeo = new THREE.BufferGeometry();
    edgeRGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeR, 3));
    scene.add(new THREE.LineLoop(edgeRGeo, new THREE.LineBasicMaterial({ color: 0xe9edf5, transparent: true, opacity: 0.85 })));

    const centerDashGeo = new THREE.BufferGeometry();
    centerDashGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerDash, 3));
    scene.add(new THREE.LineSegments(centerDashGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));

    // Procedural Pine Forests (Eau Rouge Ardennes vibes)
    const treeCount = quality.treeCount;
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 2.5, 5);
    trunkGeo.translate(0, 1.25, 0); // Put base at 0
    const leavesGeo = new THREE.ConeGeometry(2.5, 7, 7);
    leavesGeo.translate(0, 5.0, 0); // Put base above trunk

    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x183015, roughness: 0.95 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 1.0 });

    const leavesMesh = new THREE.InstancedMesh(leavesGeo, treeMaterial, treeCount);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMaterial, treeCount);
    leavesMesh.castShadow = quality.shadowMapEnabled;
    trunkMesh.castShadow = quality.shadowMapEnabled;
    leavesMesh.receiveShadow = quality.shadowMapEnabled;
    trunkMesh.receiveShadow = quality.shadowMapEnabled;

    const dummy = new THREE.Object3D();
    const tPos = new THREE.Vector3();
    let placed = 0;
    const groundPos = groundGeo.attributes.position;
    const vertexCount = groundPos.count;

    while (placed < treeCount) {
      const vIdx = Math.floor(Math.random() * vertexCount);
      tPos.set(groundPos.getX(vIdx), groundPos.getY(vIdx), groundPos.getZ(vIdx));

      let tooClose = false;
      for (let j = 0; j < samples; j += 12) { // check every 12th point
        if (tPos.distanceToSquared(points[j]) < 1200) { // Keep trees ~34 units away from track edge
          tooClose = true;
          break;
        }
      }

      // Keep trees clustered near the visible area
      if (Math.abs(tPos.x) > 600 || Math.abs(tPos.z) > 600) tooClose = true;

      if (!tooClose) {
        dummy.position.copy(tPos);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.7 + Math.random() * 0.8;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        leavesMesh.setMatrixAt(placed, dummy.matrix);
        trunkMesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }
    scene.add(leavesMesh);
    scene.add(trunkMesh);

    // Procedural Grandstand on Start/Finish straight
    const grandstandGroup = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });

    for (let t = 0; t < 8; t++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 1.5), standMat);
      step.position.set(0, t * 1.0, -t * 1.5);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(58, 0.6, 0.8), seatMat);
      seat.position.set(0, t * 1.0 + 0.6, -t * 1.5 - 0.2);
      grandstandGroup.add(step);
      grandstandGroup.add(seat);
    }

    const roofGeo = new THREE.BoxGeometry(62, 0.4, 16);
    roofGeo.translate(0, 0, -8);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    roof.position.set(0, 12, 2);
    roof.rotation.x = -0.15;
    grandstandGroup.add(roof);

    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 12);
    pillarGeo.translate(0, 6, 0);
    for (let px = -25; px <= 25; px += 25) {
      const p1 = new THREE.Mesh(pillarGeo, standMat);
      p1.position.set(px, 0, -10);
      grandstandGroup.add(p1);
    }

    grandstandGroup.position.copy(points[15]); // Placed near T=15 (start straight)
    const sfNormal2 = normals[15].clone();
    grandstandGroup.position.addScaledVector(sfNormal2, TRACK_WIDTH * 0.5 + 8); // push outside

    // Orient facing the track
    grandstandGroup.rotation.y = Math.atan2(-sfNormal2.x, -sfNormal2.z);
    grandstandGroup.position.y = points[15].y + 0.5;

    scene.add(grandstandGroup);

    // ── Tire Smoke Particle System ──
    const SMOKE_COUNT = quality.smokeCount;
    const smokePositions = new Float32Array(SMOKE_COUNT * 3);
    const smokeSizes = new Float32Array(SMOKE_COUNT);
    const smokeAlphas = new Float32Array(SMOKE_COUNT);
    const smokeLife = new Float32Array(SMOKE_COUNT);
    const smokeVel = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) { smokeLife[i] = -1; smokeSizes[i] = 0; smokeAlphas[i] = 0; }
    const smokeGeo = new THREE.BufferGeometry();
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));
    const smokeMat = new THREE.PointsMaterial({ color: 0xcccccc, size: 1.5, transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true });
    const smokeFx = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeFx);
    let smokeIdx = 0;

    // ── Spark Particle System ──
    const SPARK_COUNT = quality.sparkCount;
    const sparkPositions = new Float32Array(SPARK_COUNT * 3);
    const sparkLife = new Float32Array(SPARK_COUNT);
    const sparkVel = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) sparkLife[i] = -1;
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffcc44, size: 0.4, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
    const sparkFx = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkFx);
    let sparkIdx = 0;

    // ── Track Barriers (Armco style) ──
    const barrierVerts = [];
    const barrierIndices = [];
    let bIdx = 0;
    const BARRIER_HEIGHT = 1.8;
    for (let i = 0; i < samples; i += quality.barrierStep) {
      const p = points[i];
      const n = normals[i];
      const ni = (i + quality.barrierStep) % samples;
      const pn = points[ni];
      const nn = normals[ni];
      // Both sides
      for (const side of [1, -1]) {
        const off = TRACK_WIDTH * 0.62 * side;
        const b0 = p.clone().addScaledVector(n, off);
        const b1 = pn.clone().addScaledVector(nn, off);
        barrierVerts.push(
          b0.x, b0.y + 0.05, b0.z,
          b0.x, b0.y + BARRIER_HEIGHT, b0.z,
          b1.x, b1.y + 0.05, b1.z,
          b1.x, b1.y + BARRIER_HEIGHT, b1.z
        );
        barrierIndices.push(bIdx, bIdx + 1, bIdx + 2, bIdx + 2, bIdx + 1, bIdx + 3);
        bIdx += 4;
      }
    }
    const barrierGeo = new THREE.BufferGeometry();
    barrierGeo.setAttribute('position', new THREE.Float32BufferAttribute(barrierVerts, 3));
    barrierGeo.setIndex(barrierIndices);
    barrierGeo.computeVertexNormals();
    const barrierMesh = new THREE.Mesh(barrierGeo, new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
    scene.add(barrierMesh);

    // ── Screen shake state ──
    let shakeIntensity = 0;
    let shakeDecay = 0;

    // ── F1 Car Builder ──
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.15 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.3 });
    const haloMat = new THREE.MeshStandardMaterial({ color: 0x282828, metalness: 0.8, roughness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x112244, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.6 });

    // Red Bull Racing Livery Materials
    const rbNavy = 0x091836;
    const rbNavyMat = new THREE.MeshStandardMaterial({ color: rbNavy, metalness: 0.32, roughness: 0.38 });
    const rbRedMat = new THREE.MeshStandardMaterial({ color: 0xd90429, metalness: 0.45, roughness: 0.28 });
    const rbYellowMat = new THREE.MeshStandardMaterial({ color: 0xffd100, metalness: 0.35, roughness: 0.32 });
    const goldVisorMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.95, roughness: 0.1 });

    const buildF1Car = (color, shadowEnabled, isPlayer = false) => {
      const car = new THREE.Group();
      const bodyMat = isPlayer
        ? rbNavyMat
        : new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.15 });
      const accentMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.2 });

      // ── Front Chassis ──
      const frontTub = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 1.0), bodyMat);
      frontTub.position.set(0, 0.2, 1.2);
      frontTub.castShadow = shadowEnabled;
      car.add(frontTub);

      if (isPlayer) {
        [-0.205, 0.205].forEach((x) => {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.8), rbRedMat);
          stripe.position.set(x, 0.2, 1.2);
          car.add(stripe);
        });
      }

      // ── Cockpit Section ──
      const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.8), bodyMat);
      cockpit.position.set(0, 0.22, 0.3);
      cockpit.castShadow = shadowEnabled;
      car.add(cockpit);

      // ── Rear Chassis ──
      const rearChassis = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.6), bodyMat);
      rearChassis.position.set(0, 0.2, -0.5);
      rearChassis.castShadow = shadowEnabled;
      car.add(rearChassis);

      // ── Engine Cover ──
      const engineTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 1.0), bodyMat);
      engineTop.position.set(0, 0.3, -1.3);
      engineTop.castShadow = shadowEnabled;
      car.add(engineTop);

      // Engine rear taper
      const engineRear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.4), bodyMat);
      engineRear.position.set(0, 0.28, -2.0);
      car.add(engineRear);

      // Shark fin
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.24, 0.6), isPlayer ? rbRedMat : bodyMat);
      fin.position.set(0, 0.48, -1.2);
      fin.castShadow = shadowEnabled;
      car.add(fin);

      if (isPlayer) {
        const finYellowStripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 0.45), rbYellowMat);
        finYellowStripe.position.set(0, 0.54, -1.2);
        car.add(finYellowStripe);
      }

      // ── Nose (4 tapered steps) ──
      const nose1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.6), bodyMat);
      nose1.position.set(0, 0.22, 1.9);
      nose1.castShadow = shadowEnabled;
      car.add(nose1);

      // Red Bull Yellow Nose Tip Starts on step 2
      const nose2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.5), isPlayer ? rbYellowMat : bodyMat);
      nose2.position.set(0, 0.21, 2.4);
      nose2.castShadow = shadowEnabled;
      car.add(nose2);

      const nose3 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.4), isPlayer ? rbYellowMat : bodyMat);
      nose3.position.set(0, 0.2, 2.8);
      nose3.castShadow = shadowEnabled;
      car.add(nose3);

      const nose4 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.2), isPlayer ? rbYellowMat : bodyMat);
      nose4.position.set(0, 0.2, 3.1);
      nose4.castShadow = shadowEnabled;
      car.add(nose4);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), isPlayer ? rbYellowMat : bodyMat);
      tip.position.set(0, 0.2, 3.22);
      car.add(tip);

      // #1 Decal on nose for Shlok Vij Red Bull #1
      if (isPlayer) {
        const badgeCanvas = document.createElement('canvas');
        badgeCanvas.width = 128;
        badgeCanvas.height = 128;
        const bctx = badgeCanvas.getContext('2d');
        bctx.fillStyle = '#091836';
        bctx.fillRect(0, 0, 128, 128);
        bctx.fillStyle = '#ffd100';
        bctx.font = 'bold 96px Orbitron, sans-serif';
        bctx.textAlign = 'center';
        bctx.textBaseline = 'middle';
        bctx.fillText('1', 64, 64);
        bctx.strokeStyle = '#d90429';
        bctx.lineWidth = 10;
        bctx.strokeRect(6, 6, 116, 116);
        const badgeTex = new THREE.CanvasTexture(badgeCanvas);
        badgeTex.colorSpace = THREE.SRGBColorSpace;
        const badgeMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(0.2, 0.2),
          new THREE.MeshBasicMaterial({ map: badgeTex })
        );
        badgeMesh.rotation.x = -Math.PI / 2;
        badgeMesh.position.set(0, 0.262, 1.88);
        car.add(badgeMesh);
      }

      // ── Sidepods ──
      [-0.35, 0.35].forEach((x, si) => {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.8), bodyMat);
        sp.position.set(x, 0.25, -0.2);
        sp.castShadow = shadowEnabled;
        car.add(sp);

        if (isPlayer) {
          const spRed = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.7), rbRedMat);
          spRed.position.set(x + (si === 0 ? -0.07 : 0.07), 0.26, -0.2);
          car.add(spRed);
        }

        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.04), isPlayer ? rbYellowMat : darkMat);
        intake.position.set(x, 0.32, 0.2);
        car.add(intake);

        const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), darkMat);
        outlet.position.set(x, 0.28, -0.6);
        car.add(outlet);
      });

      // ── Rear Wing ──
      const rwMainGeo = new THREE.BoxGeometry(1.0, 0.02, 0.22);
      const rwMain = new THREE.Mesh(rwMainGeo, isPlayer ? rbNavyMat : wingMat);
      rwMain.position.set(0, 0.78, -2.1);
      rwMain.rotation.x = 0.2;
      rwMain.castShadow = shadowEnabled;
      car.add(rwMain);

      // DRS flap
      const drsGeo = new THREE.BoxGeometry(0.95, 0.015, 0.16);
      const drsMesh = new THREE.Mesh(drsGeo, isPlayer ? rbRedMat : wingMat);
      drsMesh.position.set(0, 0.84, -2.02);
      drsMesh.rotation.x = 0.1;
      drsMesh.castShadow = shadowEnabled;
      car.add(drsMesh);
      car.userData.drsFlap = drsMesh;

      // Rear wing endplates
      [-0.52, 0.52].forEach(x => {
        const ep = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.28), isPlayer ? rbNavyMat : darkMat);
        ep.position.set(x, 0.72, -2.1);
        ep.castShadow = shadowEnabled;
        car.add(ep);
        if (isPlayer) {
          const epTrim = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.28), rbYellowMat);
          epTrim.position.set(x, 0.81, -2.1);
          car.add(epTrim);
        }
      });

      // Rear wing pillars
      [-0.3, 0.3].forEach(x => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.03), darkMat);
        pillar.position.set(x, 0.55, -2.05);
        car.add(pillar);
      });

      // ── Slim Sidepods ──
      [-0.42, 0.42].forEach((x) => {
        const spGeo = new THREE.BoxGeometry(0.12, 0.16, 1.0);
        const sp = new THREE.Mesh(spGeo, bodyMat);
        sp.position.set(x, 0.28, -0.4);
        sp.castShadow = shadowEnabled;
        car.add(sp);

        const intakeGeo = new THREE.BoxGeometry(0.1, 0.12, 0.04);
        const intake = new THREE.Mesh(intakeGeo, darkMat);
        intake.position.set(x, 0.35, 0.1);
        car.add(intake);
      });

      // ── Air Intake / Scope ──
      const scopeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.2);
      const scope = new THREE.Mesh(scopeGeo, darkMat);
      scope.position.set(0, 0.46, -0.7);
      car.add(scope);

      // ── Halo ──
      const haloCurveGeo = new THREE.TorusGeometry(0.22, 0.02, 6, 12, Math.PI);
      const haloCurve = new THREE.Mesh(haloCurveGeo, isPlayer ? rbNavyMat : haloMat);
      haloCurve.position.set(0, 0.46, 0.5);
      haloCurve.rotation.z = Math.PI / 2;
      haloCurve.rotation.y = Math.PI / 2;
      car.add(haloCurve);

      const haloUp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.22, 6), isPlayer ? rbRedMat : haloMat);
      haloUp.position.set(0, 0.42, 0.7);
      car.add(haloUp);

      // ── Cockpit / Visor ──
      const visorGeo = new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const visor = new THREE.Mesh(visorGeo, isPlayer ? goldVisorMat : glassMat);
      visor.position.set(0, 0.38, 0.4);
      visor.scale.set(1, 0.5, 1.1);
      car.add(visor);

      // ── Driver Helmet ──
      const helmetMat = isPlayer
        ? new THREE.MeshStandardMaterial({ color: 0x091836, metalness: 0.6, roughness: 0.3 })
        : new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), helmetMat);
      helmet.position.set(0, 0.44, 0.35);
      helmet.scale.set(0.85, 0.6, 0.9);
      car.add(helmet);

      if (isPlayer) {
        const helmetBand = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.03, 12, 1, true, 0, Math.PI), goldVisorMat);
        helmetBand.position.set(0, 0.44, 0.35);
        helmetBand.rotation.y = Math.PI / 2;
        car.add(helmetBand);
      }

      // ── Wheels ──
      const wheelData = [
        { x: -0.78, y: 0.28, z: 1.8, r: 0.28, w: 0.24, front: true },
        { x: 0.78, y: 0.28, z: 1.8, r: 0.28, w: 0.24, front: true },
        { x: -0.82, y: 0.30, z: -1.5, r: 0.31, w: 0.32, front: false },
        { x: 0.82, y: 0.30, z: -1.5, r: 0.31, w: 0.32, front: false },
      ];

      const wheelMeshes = [];
      wheelData.forEach(wd => {
        const wg = new THREE.Group();

        // Tire
        const tireGeo = new THREE.CylinderGeometry(wd.r, wd.r, wd.w, quality.wheelSegments);
        tireGeo.rotateZ(Math.PI / 2);
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.castShadow = shadowEnabled;
        wg.add(tire);

        // Rim
        const rimGeo = new THREE.CylinderGeometry(wd.r * 0.55, wd.r * 0.55, wd.w + 0.02, 8);
        rimGeo.rotateZ(Math.PI / 2);
        const rim = new THREE.Mesh(rimGeo, rimMat);
        wg.add(rim);

        // Rim spokes
        for (let s = 0; s < 5; s++) {
          const spokeGeo = new THREE.BoxGeometry(wd.r * 0.9, 0.02, 0.025);
          const spoke = new THREE.Mesh(spokeGeo, isPlayer ? rbYellowMat : rimMat);
          spoke.rotation.x = (s / 5) * Math.PI;
          wg.add(spoke);
        }

        // Brake disc
        const discGeo = new THREE.CylinderGeometry(wd.r * 0.45, wd.r * 0.45, 0.04, 12);
        discGeo.rotateZ(Math.PI / 2);
        const discMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.3 });
        const disc = new THREE.Mesh(discGeo, discMat);
        wg.add(disc);

        // Wheel cover
        if (wd.front) {
          const coverGeo = new THREE.CylinderGeometry(wd.r * 0.85, wd.r * 0.9, 0.04, quality.wheelSegments);
          coverGeo.rotateZ(Math.PI / 2);
          const cover = new THREE.Mesh(coverGeo, bodyMat);
          cover.position.x = wd.x > 0 ? wd.w * 0.5 + 0.02 : -(wd.w * 0.5 + 0.02);
          wg.add(cover);
        }

        wg.position.set(wd.x, wd.y, wd.z);
        car.add(wg);
        wheelMeshes.push(wg);
      });

      // ── Floor / Diffuser ──
      const floorGeo = new THREE.BoxGeometry(1.4, 0.03, 4.2);
      const floorMesh = new THREE.Mesh(floorGeo, accentMat);
      floorMesh.position.set(0, 0.08, 0);
      car.add(floorMesh);

      // Diffuser
      const diffGeo = new THREE.BoxGeometry(0.8, 0.15, 0.3);
      const diff = new THREE.Mesh(diffGeo, accentMat);
      diff.position.set(0, 0.12, -2.0);
      car.add(diff);

      // ── Bargeboards ──
      [-0.38, 0.38].forEach(x => {
        const bbGeo = new THREE.BoxGeometry(0.02, 0.18, 0.5);
        const bb = new THREE.Mesh(bbGeo, accentMat);
        bb.position.set(x, 0.22, 0.8);
        car.add(bb);
      });

      // ── T-Cam ──
      const tcMat = new THREE.MeshStandardMaterial({ color: 0xffd100, metalness: 0.5, roughness: 0.3 });
      const tc = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.06), tcMat);
      tc.position.set(0, 0.55, -1.1);
      car.add(tc);

      // ── Exhaust ──
      const exhGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.1, 8);
      exhGeo.rotateX(Math.PI / 2);
      const exhMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.15 });
      const exh = new THREE.Mesh(exhGeo, exhMat);
      exh.position.set(0, 0.38, -2.3);
      car.add(exh);

      const fallbackShell = new THREE.Group();
      while (car.children.length) {
        fallbackShell.add(car.children[0]);
      }
      car.add(fallbackShell);
      car.userData.fallbackShell = fallbackShell;
      car.userData.wheels = wheelMeshes;
      return car;
    };

    // Parthiv Abhani Red Bull #1 (Blue Car)
    const player = buildF1Car(rbNavy, quality.shadowMapEnabled, true);
    const startT = 0.015;
    player.position.copy(curve.getPointAt(startT));
    player.position.y += 0.03;
    let heading = Math.atan2(curve.getTangentAt(startT).x, curve.getTangentAt(startT).z);
    player.rotation.y = heading;
    scene.add(player);

    // Player wheels reference
    const wheels = player.userData.wheels || [];

    // Always attempt to load detailed GLB model on top
    loadDetailedCarTemplate()
      .then((template) => {
        if (cancelled) return;
        const model = cloneDetailedCar(template, quality.shadowMapEnabled);
        model.scale.set(5.15, 5.15, 5.15);
        model.rotation.y = -Math.PI / 2;
        model.position.set(0, 0.08, 0.5);
        if (player.userData.fallbackShell) {
          player.userData.fallbackShell.visible = false;
        }
        player.add(model);
      })
      .catch((err) => {
        console.warn('Using high-fidelity procedural Red Bull RB20 livery:', err);
      });

    const npcDefs = [
      { name: 'Ferrari', color: 0xd8141f },
      { name: 'Mercedes', color: 0x00d2be },
      { name: 'McLaren', color: 0xff8000 },
      { name: 'Aston', color: 0x229971 },
      { name: 'Williams', color: 0x3571d0 },
      { name: 'Alpine', color: 0xff6bc6 }
    ];

    const npcs = npcDefs.map((def, i) => {
      const car = buildF1Car(def.color, quality.shadowMapEnabled, false);
      const t = (startT - 0.018 * (i + 1) + 1) % 1;
      car.position.copy(curve.getPointAt(t));
      car.position.y += 0.25;
      scene.add(car);
      return {
        name: def.name,
        mesh: car,
        t,
        lap: 1,
        speed: 62 + Math.random() * 6,
        lane: (Math.random() - 0.5) * 3,
        laneTarget: 0,
        aggression: 0.4 + Math.random() * 0.45,
        seed: Math.random() * 1000
      };
    });

    const standingsList = [{ id: PLAYER_ID, p: 0 }];
    npcDefs.forEach((def) => standingsList.push({ id: def.name, p: 0 }));

    const rainCount = quality.rainCount;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i += 1) {
      rainPos[i * 3] = player.position.x + (Math.random() - 0.5) * 80;
      rainPos[i * 3 + 1] = 8 + Math.random() * 35;
      rainPos[i * 3 + 2] = player.position.z + (Math.random() - 0.5) * 80;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xaed7ff, size: 0.12, transparent: true, opacity: 0.14, depthWrite: false });
    const rainFx = new THREE.Points(rainGeo, rainMat);
    rainFx.visible = false;
    scene.add(rainFx);

    const minimapSize = quality.minimapSize;
    const minimap = document.createElement('canvas');
    minimap.width = minimapSize;
    minimap.height = minimapSize;
    minimap.style.width = '100%';
    minimap.style.height = '100%';
    const minimapCtx = minimap.getContext('2d');
    const minimapHost = minimapRef.current;
    if (minimapHost) {
      minimapHost.innerHTML = '';
      minimapHost.appendChild(minimap);
    }
    const hudDom = {
      speed: document.getElementById('hud-speed'),
      gear: document.getElementById('hud-gear'),
      rpmFill: document.getElementById('hud-rpm-fill'),
      rpmLabel: document.getElementById('hud-rpm-label'),
      lapTime: document.getElementById('hud-lap-time'),
      raceTime: document.getElementById('hud-race-time'),
      position: document.getElementById('hud-pos'),
      lap: document.getElementById('hud-lap'),
      fps: document.getElementById('hud-fps')
    };
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });
    const pad = 14;
    const mapScale = Math.min((minimapSize - pad * 2) / (maxX - minX), (minimapSize - pad * 2) / (maxZ - minZ));
    const mapPos = (p) => ({
      x: pad + (p.x - minX) * mapScale,
      y: minimapSize - (pad + (p.z - minZ) * mapScale)
    });
    const mapTrackPoints = points.map((p) => mapPos(p));
    const mapDrsSegments = DRS_ZONES.map(([a, b]) => {
      const segment = [];
      for (let t = a; t <= b; t += 0.004) {
        segment.push(mapPos(curve.getPointAt(t)));
      }
      return segment;
    });
    const minimapStatic = document.createElement('canvas');
    minimapStatic.width = minimapSize;
    minimapStatic.height = minimapSize;
    const minimapStaticCtx = minimapStatic.getContext('2d');
    if (minimapStaticCtx) {
      minimapStaticCtx.fillStyle = 'rgba(8,16,28,0.92)';
      minimapStaticCtx.fillRect(0, 0, minimapSize, minimapSize);

      minimapStaticCtx.strokeStyle = '#30435c';
      minimapStaticCtx.lineWidth = 7;
      minimapStaticCtx.beginPath();
      mapTrackPoints.forEach((p, i) => {
        if (!i) minimapStaticCtx.moveTo(p.x, p.y);
        else minimapStaticCtx.lineTo(p.x, p.y);
      });
      minimapStaticCtx.closePath();
      minimapStaticCtx.stroke();

      minimapStaticCtx.strokeStyle = '#30e87a';
      minimapStaticCtx.lineWidth = 2.5;
      mapDrsSegments.forEach((segment) => {
        minimapStaticCtx.beginPath();
        segment.forEach((p, i) => {
          if (!i) minimapStaticCtx.moveTo(p.x, p.y);
          else minimapStaticCtx.lineTo(p.x, p.y);
        });
        minimapStaticCtx.stroke();
      });
    }

    const keys = keysRef.current;
    let cameraMode = 0;
    cameraActionRef.current = () => {
      cameraMode = (cameraMode + 1) % CAMERA_MODES.length;
    };

    const keyDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = true;
      if (k === 's' || k === 'arrowdown') keys.down = true;
      if (k === 'a' || k === 'arrowleft') keys.left = true;
      if (k === 'd' || k === 'arrowright') keys.right = true;
      if (k === ' ') keys.drift = true;
      if (k === 'shift') keys.drs = true;
      if (k === 'f') keys.ers = true;
      if (k === 'b') keys.repair = true;

      if (e.repeat) return;
      if (k === 'escape') {
        setPhase((prev) => {
          if (prev === 'paused') return 'racing';
          if (prev === 'racing' || prev === 'countdown') return 'paused';
          return prev;
        });
      }
      if (k === 'c') cameraMode = (cameraMode + 1) % CAMERA_MODES.length;
    };

    const keyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') keys.up = false;
      if (k === 's' || k === 'arrowdown') keys.down = false;
      if (k === 'a' || k === 'arrowleft') keys.left = false;
      if (k === 'd' || k === 'arrowright') keys.right = false;
      if (k === ' ') keys.drift = false;
      if (k === 'shift') keys.drs = false;
      if (k === 'f') keys.ers = false;
      if (k === 'b') keys.repair = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    let speed = 0;
    let steer = 0;
    let drift = 0;
    let pT = startT;
    let prevT = startT;
    let lap = 1;
    let bestLap = null;
    let lapStart = 0;
    let raceStart = 0;
    let sector = 1;
    let sectorStart = 0;
    let sectorTimes = [null, null, null];
    let lastCross = -999999;
    let ers = 100;
    let damage = 0;
    let flowState = 0;
    let peakFlow = 0;
    let weatherIdx = 0;
    let weatherTarget = 0;
    let weatherBlend = 1;
    let weatherLapTimer = 0;
    let countdownStart = performance.now();
    let countdownStep = 3;
    let finished = false;
    let fps = 60;
    let fpsFrames = 0;
    let fpsTimer = 0;
    let skyTick = 1;
    let shadowTick = 1;
    let rainTick = 0;
    let perfAdjustTick = 0;
    let lastFov = camera.fov;

    const sampleTrack = (t, outPoint, outTangent, outNormal) => {
      const wrappedT = ((t % 1) + 1) % 1;
      const scaledT = wrappedT * samples;
      const baseIdx = Math.floor(scaledT) % samples;
      const nextIdx = (baseIdx + 1) % samples;
      const blend = scaledT - Math.floor(scaledT);

      if (outPoint) outPoint.copy(points[baseIdx]).lerp(points[nextIdx], blend);
      if (outTangent) outTangent.copy(tangents[baseIdx]).lerp(tangents[nextIdx], blend).normalize();
      if (outNormal) outNormal.copy(normals[baseIdx]).lerp(normals[nextIdx], blend).normalize();
    };

    const findNearestT = (pos, around) => {
      const center = Math.floor(around * samples);
      let best = center;
      let bestD = Infinity;
      for (let o = -14; o <= 14; o += 1) {
        const idx = (center + o + samples) % samples;
        const pt = points[idx];
        const dx = pos.x - pt.x;
        const dz = pos.z - pt.z;
        const d = dx * dx + dz * dz; // 2D distance calculation
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }

      const p1 = points[best];
      const nextIdx = (best + 1) % samples;
      const prevIdx = (best - 1 + samples) % samples;

      const dNext = Math.pow(pos.x - points[nextIdx].x, 2) + Math.pow(pos.z - points[nextIdx].z, 2);
      const dPrev = Math.pow(pos.x - points[prevIdx].x, 2) + Math.pow(pos.z - points[prevIdx].z, 2);

      const secondBest = dNext < dPrev ? nextIdx : prevIdx;
      const p2 = points[secondBest];

      const dx12 = p2.x - p1.x;
      const dz12 = p2.z - p1.z;
      const lenSq = dx12 * dx12 + dz12 * dz12;

      let tOffset = 0;
      if (lenSq > 0.0001) {
        const tProj = ((pos.x - p1.x) * dx12 + (pos.z - p1.z) * dz12) / lenSq;
        tOffset = clamp(tProj, 0, 1);
      }

      let continuousT = (secondBest === nextIdx) ? (best + tOffset) : (best - tOffset);
      return ((continuousT + samples) % samples) / samples;
    };

    const resize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      targetPixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
      activePixelRatio = clamp(activePixelRatio, quality.minPixelRatio, targetPixelRatio);
      applyRendererMetrics();
    };
    window.addEventListener('resize', resize);

    let last = performance.now();
    let hudTick = 0;
    let miniTick = 0;
    const tmpA = new THREE.Vector3();
    const tmpB = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const camLift = new THREE.Vector3();
    const lookLift = new THREE.Vector3();
    const npcPoint = new THREE.Vector3();
    const npcTangent = new THREE.Vector3();
    const npcNormal = new THREE.Vector3();
    const npcTarget = new THREE.Vector3();
    const trackPoint = new THREE.Vector3();
    const trackTangent = new THREE.Vector3();
    let anim = 0;
    let manualFrameMode = false;
    let simulatedNow = last;

    const renderFrame = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.04);
      last = now;

      fpsFrames += 1;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        fps = Math.round(fpsFrames / fpsTimer);
        fpsFrames = 0;
        fpsTimer = 0;
      }
      perfAdjustTick += dt;
      if (perfAdjustTick >= 1) {
        if (fps < 28 && activePixelRatio > quality.minPixelRatio + 0.01) {
          activePixelRatio = Math.max(quality.minPixelRatio, activePixelRatio - 0.08);
          applyRendererMetrics();
        } else if (fps > 52 && activePixelRatio < targetPixelRatio - 0.01) {
          activePixelRatio = Math.min(targetPixelRatio, activePixelRatio + 0.05);
          applyRendererMetrics();
        }
        perfAdjustTick = 0;
      }

      const state = phaseRef.current;
      const inCountdown = state === 'countdown';
      const racing = state === 'racing';

      if (inCountdown) {
        const elapsed = (now - countdownStart) / 1000;
        const rem = 3 - Math.floor(elapsed);
        if (rem > 0 && rem !== countdownStep) {
          countdownStep = rem;
          setCountdown(rem);
        }
        if (elapsed >= 3 && countdownStep !== 0) {
          countdownStep = 0;
          setCountdown('GO');
        }
        if (elapsed >= 3.2) {
          setCountdown(null);
          setPhase('racing');
          raceStart = now;
          lapStart = now;
          sectorStart = now;
        }
      }

      const cfg = settingsRef.current;
      const raceSetup = setupAnalysisRef.current;
      const maxSpeed = cfg.maxSpeed / 3.6;
      const acc = 9 + (cfg.acceleration / 100) * 22;
      const brk = 13 + (cfg.brakePower / 100) * 24;
      const steerRate = 1.8 + (cfg.steering / 100) * 2.6;
      const aiTop = 68 + (cfg.aiLevel / 100) * 16;

      if (!finished && (racing || inCountdown)) {
        pT = findNearestT(player.position, pT);
        const idx = Math.floor(pT * samples) % samples;
        const center = points[idx];
        const normal = normals[idx];
        sampleTrack(pT, trackPoint, trackTangent, null);

        tmpA.copy(player.position).sub(center);
        const lateral = tmpA.dot(normal);
        const offTrack = Math.abs(lateral) > TRACK_WIDTH * 0.48;
        const hardOff = Math.abs(lateral) > TRACK_WIDTH * 0.72;

        const wA = WEATHER_PRESETS[weatherIdx];
        const wB = WEATHER_PRESETS[weatherTarget];
        if (weatherIdx !== weatherTarget) {
          weatherBlend = clamp(weatherBlend + dt * 0.15, 0, 1);
        }
        const rainLevel = lerp(wA.rain, wB.rain, weatherBlend);
        const fog = lerp(wA.fog, wB.fog, weatherBlend);
        const sunInt = lerp(wA.sun, wB.sun, weatherBlend);
        const ambInt = lerp(wA.ambient, wB.ambient, weatherBlend);
        if (weatherBlend >= 1 && weatherIdx !== weatherTarget) weatherIdx = weatherTarget;

        scene.fog.density = fog;
        ambient.intensity = ambInt + 0.12;
        sun.intensity = sunInt * 1.12;
        hemi.intensity = 0.62 + (1 - rainLevel) * 0.28;

        const sunPhase = (now * 0.00002) % 1;
        skyTick += dt;
        if (skyTick >= quality.skyUpdateInterval) {
          paintSky(skyCtx, quality.skyResolution, quality.skyResolution, WEATHER_PRESETS[weatherTarget], sunPhase);
          skyTexture.needsUpdate = true;
          skyTick = 0;
        }
        sun.position.set(150 * Math.cos(sunPhase * Math.PI * 2), 150 + 130 * Math.sin(sunPhase * Math.PI), 120 * Math.sin(sunPhase * Math.PI * 2));
        shadowTick += dt;
        if (quality.shadowMapEnabled && shadowTick >= quality.shadowUpdateInterval) {
          renderer.shadowMap.needsUpdate = true;
          shadowTick = 0;
        }

        roadMat.roughness = 0.68 - rainLevel * 0.3;
        roadMat.metalness = 0.14 + rainLevel * 0.26;

        rainFx.visible = rainLevel > 0.08 && quality.rainCount > 0;
        rainMat.opacity = clamp(0.08 + rainLevel * 0.65, 0.1, 0.78);
        if (rainFx.visible) {
          rainTick += dt;
          if (rainTick >= quality.rainUpdateInterval) {
            for (let i = 0; i < rainCount; i += 1) {
              const r = i * 3;
              rainPos[r + 1] -= (18 + rainLevel * 68) * rainTick;
              if (rainPos[r + 1] < 0 || Math.abs(rainPos[r] - player.position.x) > 50 || Math.abs(rainPos[r + 2] - player.position.z) > 50) {
                rainPos[r] = player.position.x + (Math.random() - 0.5) * 84;
                rainPos[r + 1] = 8 + Math.random() * 32;
                rainPos[r + 2] = player.position.z + (Math.random() - 0.5) * 84;
              }
            }
            rainGeo.attributes.position.needsUpdate = true;
            rainTick = 0;
          }
        } else {
          rainTick = 0;
        }

        const kmh = Math.abs(speed) * 3.6;
        const gearRanges = [0, 44, 75, 105, 138, 173, 215, 255, 400];
        let gear = 1;
        for (let i = 1; i < gearRanges.length; i += 1) {
          if (kmh >= gearRanges[i]) gear = Math.min(8, i + 1);
        }
        const rpm = clamp(4000 + ((kmh - gearRanges[gear - 1]) / Math.max(1, gearRanges[gear] - gearRanges[gear - 1])) * 13500, 4000, 18000);
        const drsReady = inDrsZone(pT) && kmh > 135;
        const drsOn = racing && keys.drs && drsReady;

        let slip = 0;
        const forward = tmpB.set(Math.sin(heading), 0, Math.cos(heading));
        npcs.forEach((npc) => {
          tmpA.copy(npc.mesh.position).sub(player.position);
          const dist = tmpA.length();
          if (dist > 4 && dist < 24) {
            const dirDot = forward.dot(tmpA.normalize());
            const lat = Math.abs(tmpA.dot(normal));
            if (dirDot > 0.78 && lat < 3.3) slip = Math.max(slip, 1 - dist / 24);
          }
        });

        const sInput = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
        const lineDiscipline = clamp(1 - Math.abs(lateral) / (TRACK_WIDTH * 0.46), 0, 1);
        const steeringDiscipline = clamp(1 - Math.abs(sInput) * clamp((kmh - 115) / 210, 0, 1) * 0.38, 0, 1);
        const platformBalance = clamp(1 - drift * 0.42 - damage * 0.24 - (offTrack ? 0.34 : 0), 0, 1);
        const flowTarget = clamp(
          lineDiscipline * 0.4 +
          steeringDiscipline * 0.22 +
          platformBalance * 0.28 +
          (slip > 0.18 ? 0.1 : 0) +
          (kmh > 165 ? 0.08 : 0) -
          rainLevel * 0.08,
          0,
          1
        );
        const paceFactor = clamp(kmh / 180, 0, 1);
        const pacedFlowTarget = clamp(flowTarget * paceFactor + (1 - paceFactor) * 0.12, 0, 1);
        flowState = lerp(flowState, pacedFlowTarget, clamp(dt * 2.4, 0, 1));
        peakFlow = Math.max(peakFlow, flowState);

        const ersOn = racing && keys.ers && ers > 1 && kmh > 60;
        ers = ersOn ? clamp(ers - dt * 24, 0, 100) : clamp(ers + dt * (8.5 + flowState * 7.5), 0, 100);

        if (racing) {
          const grip = clamp(1 - rainLevel * 0.28 - damage * 0.22 + flowState * 0.05, 0.45, 1.02);
          const offPenalty = offTrack ? (hardOff ? 0.4 : 0.24) : 0;

          if (keys.up) speed += acc * (grip - offPenalty) * dt;
          if (keys.down) speed -= brk * dt;
          if (!keys.up && !keys.down) speed *= Math.exp(-(offTrack ? 2 : 1.35) * dt);

          drift = keys.drift && kmh > 85 ? clamp(drift + dt * 1.7, 0, 1) : clamp(drift - dt * 2.3, 0, 1);
          if (keys.repair && inDrsZone(pT) && kmh < 55) {
            damage = clamp(damage - dt * 0.22, 0, 1);
            speed = Math.min(speed, 12);
          }

          let targetV = maxSpeed * (1 - damage * 0.24);
          targetV *= 1 - offPenalty * 0.68;
          targetV *= 1 + slip * 0.08;
          targetV *= 1 + flowState * 0.025;
          if (drsOn) targetV *= 1.14;
          if (ersOn) targetV *= 1.09;
          speed = clamp(speed, -25, targetV);

          steer = lerp(steer, sInput, clamp(dt * 10, 0, 1));
          const vRatio = clamp(Math.abs(speed) / Math.max(targetV, 1), 0, 1);
          const authority = (1 - vRatio * 0.72) * (grip - offPenalty * 0.35);
          heading += steer * steerRate * authority * (1 + drift * 0.45) * Math.sign(speed || 1) * dt;
          heading = normAngle(heading);

          const moveYaw = heading + steer * drift * 0.25;
          player.position.x += Math.sin(moveYaw) * speed * dt;
          player.position.z += Math.cos(moveYaw) * speed * dt;
          player.position.y = trackPoint.y + 0.03;
          if (offTrack) player.position.addScaledVector(normal, -lateral * dt * 0.8);

          npcs.forEach((npc) => {
            const d = player.position.distanceTo(npc.mesh.position);
            if (d < 2.6) {
              tmpA.copy(npc.mesh.position).sub(player.position).normalize();
              const impact = clamp((Math.abs(speed - npc.speed) / 70) + 0.08, 0.05, 1);
              player.position.addScaledVector(tmpA, -impact * 0.8);
              npc.mesh.position.addScaledVector(tmpA, impact * 1.2);
              speed *= 0.95;
              npc.speed *= 0.95;
              damage = clamp(damage + impact * 0.005, 0, 1);
              // Screen shake on collision
              shakeIntensity = Math.max(shakeIntensity, impact * 1.5);
              shakeDecay = 0.4;
              if (soundEnabledRef.current) playCollisionSound();
            }
          });

          // ── Barrier collision ──
          if (Math.abs(lateral) > TRACK_WIDTH * 0.58) {
            const pushBack = Math.sign(lateral) * (Math.abs(lateral) - TRACK_WIDTH * 0.56);
            player.position.addScaledVector(normal, -pushBack * 0.7);
            speed *= 0.88;
            damage = clamp(damage + 0.002, 0, 1);
            if (Math.abs(speed) > 20) {
              shakeIntensity = Math.max(shakeIntensity, 0.6);
              shakeDecay = 0.3;
              // Spawn sparks at barrier contact
              for (let si = 0; si < 6; si++) {
                const sIdx3 = sparkIdx * 3;
                sparkPositions[sIdx3] = player.position.x + (Math.random() - 0.5) * 2;
                sparkPositions[sIdx3 + 1] = player.position.y + 0.3 + Math.random() * 0.5;
                sparkPositions[sIdx3 + 2] = player.position.z + (Math.random() - 0.5) * 2;
                sparkVel[sIdx3] = (Math.random() - 0.5) * 12;
                sparkVel[sIdx3 + 1] = 3 + Math.random() * 8;
                sparkVel[sIdx3 + 2] = (Math.random() - 0.5) * 12;
                sparkLife[sparkIdx] = 0.4 + Math.random() * 0.3;
                sparkIdx = (sparkIdx + 1) % SPARK_COUNT;
              }
            }
          }
        }

        wheels.forEach((w, i) => {
          if (w.children) {
            w.children.forEach(child => {
              if (child.geometry && child.geometry.type === 'CylinderGeometry') {
                child.rotation.x = (child.rotation.x || 0) + speed * dt * 2.6;
              }
            });
          }
          if (i < 2) w.rotation.y = steer * 0.3;
        });
        if (player.userData.drsFlap) {
          player.userData.drsFlap.rotation.x = lerp(player.userData.drsFlap.rotation.x, drsOn ? 0.5 : 0.1, dt * 9);
        }

        // ── Tire smoke when drifting ──
        if (drift > 0.3 && kmh > 80) {
          for (let si = 0; si < 2; si++) {
            const sIdx3 = smokeIdx * 3;
            const rearOff = si === 0 ? -1 : 1;
            smokePositions[sIdx3] = player.position.x - Math.sin(heading) * 2 + rearOff * Math.cos(heading) * 0.8 + (Math.random() - 0.5);
            smokePositions[sIdx3 + 1] = player.position.y + 0.15 + Math.random() * 0.3;
            smokePositions[sIdx3 + 2] = player.position.z - Math.cos(heading) * 2 - rearOff * Math.sin(heading) * 0.8 + (Math.random() - 0.5);
            smokeVel[sIdx3] = (Math.random() - 0.5) * 2;
            smokeVel[sIdx3 + 1] = 0.8 + Math.random() * 1.5;
            smokeVel[sIdx3 + 2] = (Math.random() - 0.5) * 2;
            smokeLife[smokeIdx] = 1.0 + Math.random() * 0.6;
            smokeSizes[smokeIdx] = 0.6 + Math.random() * 0.8;
            smokeIdx = (smokeIdx + 1) % SMOKE_COUNT;
          }
        }

        // ── Sparks on high-speed ground scrape (lock-up under braking) ──
        if (keys.down && kmh > 140) {
          const sIdx3 = sparkIdx * 3;
          sparkPositions[sIdx3] = player.position.x + (Math.random() - 0.5) * 1.5;
          sparkPositions[sIdx3 + 1] = player.position.y + 0.1;
          sparkPositions[sIdx3 + 2] = player.position.z + (Math.random() - 0.5) * 1.5;
          sparkVel[sIdx3] = (Math.random() - 0.5) * 8;
          sparkVel[sIdx3 + 1] = 2 + Math.random() * 5;
          sparkVel[sIdx3 + 2] = (Math.random() - 0.5) * 8;
          sparkLife[sparkIdx] = 0.3 + Math.random() * 0.2;
          sparkIdx = (sparkIdx + 1) % SPARK_COUNT;
        }

        // ── Update smoke particles ──
        for (let pi = 0; pi < SMOKE_COUNT; pi++) {
          if (smokeLife[pi] > 0) {
            smokeLife[pi] -= dt;
            const pi3 = pi * 3;
            smokePositions[pi3] += smokeVel[pi3] * dt;
            smokePositions[pi3 + 1] += smokeVel[pi3 + 1] * dt;
            smokePositions[pi3 + 2] += smokeVel[pi3 + 2] * dt;
            smokeVel[pi3 + 1] += 0.5 * dt; // rise
            smokeSizes[pi] += dt * 2; // expand
          } else {
            smokePositions[pi * 3 + 1] = -999;
          }
        }
        smokeGeo.attributes.position.needsUpdate = true;
        smokeGeo.attributes.size.needsUpdate = true;
        smokeMat.opacity = drift > 0.3 ? 0.3 : 0.15;

        // ── Update spark particles ──
        for (let pi = 0; pi < SPARK_COUNT; pi++) {
          if (sparkLife[pi] > 0) {
            sparkLife[pi] -= dt;
            const pi3 = pi * 3;
            sparkPositions[pi3] += sparkVel[pi3] * dt;
            sparkPositions[pi3 + 1] += sparkVel[pi3 + 1] * dt;
            sparkPositions[pi3 + 2] += sparkVel[pi3 + 2] * dt;
            sparkVel[pi3 + 1] -= 18 * dt; // gravity
          } else {
            sparkPositions[pi * 3 + 1] = -999;
          }
        }
        sparkGeo.attributes.position.needsUpdate = true;

        // ── Screen shake decay ──
        if (shakeIntensity > 0.01) {
          shakeDecay -= dt;
          if (shakeDecay <= 0) shakeIntensity *= 0.85;
        } else {
          shakeIntensity = 0;
        }

        // Visual Chassis Physics
        const hillSlope = Math.atan2(trackTangent.y, Math.sqrt(trackTangent.x * trackTangent.x + trackTangent.z * trackTangent.z));

        // 1. Pitch (Braking Dive & Acceleration Squat & Hill Slope)
        let targetPitch = -hillSlope;
        if (keys.down && speed > 10) targetPitch += 0.06; // Braking dive
        else if (keys.up && speed > 5) targetPitch -= 0.035; // Acceleration squat

        const aeroSquat = clamp(kmh / 300, 0, 1) * -0.015; // Downforce pushes car down at high speed
        targetPitch += aeroSquat;

        player.rotation.x = lerp(player.rotation.x, targetPitch, dt * 8);

        // 2. Roll (Lateral G-Forces)
        const lateralG = steer * clamp(kmh / 150, 0, 1);
        const targetRoll = -lateralG * 0.14;
        player.rotation.z = lerp(player.rotation.z, targetRoll, dt * 10);

        // 3. Yaw (Slip Angle is naturally handled by difference between 'heading' and 'moveYaw')
        player.rotation.y = heading;

        // 4. High-Speed Vibrations
        const rpmNorm = clamp(kmh / maxSpeed, 0.2, 1);
        const vibAmp = (clamp((kmh - 100) / 200, 0, 1) * 0.015) + (rpmNorm * 0.005);

        player.children.forEach((child) => {
          // Identify the loaded GLB model by checking scale (set to ~5.15)
          if (child.type === 'Group' && child.scale.x > 3) {
            child.position.x = (Math.random() - 0.5) * vibAmp;
            child.position.y = 0.08 + (Math.random() - 0.5) * vibAmp;
            child.position.z = 0.5;
          }
        });

        weatherLapTimer += dt;

        npcs.forEach((npc, n) => {
          const ni = Math.floor(npc.t * samples) % samples;
          const c = curvatures[(ni + 6) % samples];
          const laneWobble = Math.sin(now * 0.00025 + npc.seed) * 2.2;
          npc.laneTarget = clamp(laneWobble + (n % 2 ? -0.9 : 0.9), -3.6, 3.6);
          if (Math.abs(npc.t - pT) < 0.035) npc.laneTarget += speed > npc.speed ? -1.1 : 1.1;
          npc.lane = lerp(npc.lane, npc.laneTarget, clamp(dt * 0.9, 0, 1));

          const cornerPenalty = c * (0.36 + rainLevel * 0.22);
          const aggro = (cfg.aiLevel / 100) * 0.24 + npc.aggression * 0.14;
          const tSpeed = aiTop * (1 - cornerPenalty) * (1 + aggro * 0.16);
          npc.speed = lerp(npc.speed, tSpeed, clamp(dt * 1.7, 0, 1));
          npc.t += (npc.speed * dt) / trackLength;
          if (npc.t >= 1) {
            npc.t -= 1;
            npc.lap += 1;
          }

          sampleTrack(npc.t, npcPoint, npcTangent, npcNormal);
          npcTarget.copy(npcPoint).addScaledVector(npcNormal, npc.lane);
          npcTarget.y += 0.25;
          npc.mesh.position.lerp(npcTarget, clamp(dt * 4.2, 0, 1));

          const yaw = Math.atan2(npcTangent.x, npcTangent.z);
          npc.mesh.rotation.y += normAngle(yaw - npc.mesh.rotation.y) * clamp(dt * 4.5, 0, 1);
          npc.mesh.rotation.z = -normAngle(yaw - npc.mesh.rotation.y) * 0.12;

          const npcHillSlope = Math.atan2(npcTangent.y, Math.sqrt(npcTangent.x * npcTangent.x + npcTangent.z * npcTangent.z));
          npc.mesh.rotation.x = -npcHillSlope;
        });
        prevT = pT;
        pT = findNearestT(player.position, pT);

        const isLineCross = ((prevT > 0.85 && pT < 0.15) || (prevT - pT > 0.7)) && (now - lastCross > 4000);
        if (racing && isLineCross && (Math.abs(speed) > 2 || kmh > 15)) {
          lastCross = now;
          const lapSecs = lapStart > 0 ? (now - lapStart) / 1000 : 0;
          if (lap > 1 && lapSecs > 15) bestLap = bestLap === null ? lapSecs : Math.min(bestLap, lapSecs);

          lap += 1;
          lapStart = now;
          sector = 1;
          sectorStart = now;
          sectorTimes = [null, null, null];

          if (lap > TOTAL_LAPS) {
            finished = true;
            setPhase('finished');
            standingsList[0].p = (lap - 1) + pT;
            npcs.forEach((n, i) => { standingsList[i + 1].p = (n.lap - 1) + n.t; });
            standingsList.sort((a, b) => b.p - a.p);
            const finalPosition = standingsList.findIndex((x) => x.id === PLAYER_ID) + 1;
            const totalTime = raceStart ? (now - raceStart) / 1000 : 0;
            const currentCareer = careerStatsRef.current;
            const isNewBestLap = bestLap !== null && (currentCareer.bestLap === null || bestLap < currentCareer.bestLap);
            const nextCareer = {
              races: currentCareer.races + 1,
              wins: currentCareer.wins + (finalPosition === 1 ? 1 : 0),
              podiums: currentCareer.podiums + (finalPosition <= 3 ? 1 : 0),
              bestLap: isNewBestLap ? bestLap : currentCareer.bestLap,
              lastPosition: finalPosition,
              lastWeather: WEATHER_PRESETS[weatherTarget].name,
              recentResults: [
                {
                  position: finalPosition,
                  total: Number(totalTime.toFixed(3)),
                  weather: WEATHER_PRESETS[weatherTarget].name,
                  timestamp: Date.now()
                },
                ...currentCareer.recentResults
              ].slice(0, 4)
            };
            careerStatsRef.current = nextCareer;
            setCareerStats(nextCareer);
            setResult({
              position: finalPosition,
              total: totalTime,
              best: bestLap,
              weather: WEATHER_PRESETS[weatherTarget].name,
              isNewBestLap,
              personalBest: nextCareer.bestLap,
              setupName: raceSetup.preset.name,
              flowPeak: Math.round(peakFlow * 100),
              career: nextCareer,
              standings: standingsList.map((s, idx) => ({ id: s.id, position: idx + 1, laps: Math.floor(s.p) }))
            });
          }

          if (lap >= 2 && lap <= TOTAL_LAPS && weatherLapTimer > 40) {
            weatherLapTimer = 0;
            weatherTarget = (weatherTarget + 1 + Math.floor(Math.random() * 2)) % WEATHER_PRESETS.length;
            weatherBlend = 0;
          }
        }

        if (racing) {
          const newSector = pT < 0.333 ? 1 : (pT < 0.666 ? 2 : 3);
          if (newSector !== sector) {
            sectorTimes[sector - 1] = sectorStart ? (now - sectorStart) / 1000 : 0;
            sectorStart = now;
            sector = newSector;
          }
        }

        standingsList[0].p = (lap - 1) + pT;
        npcs.forEach((n, i) => { standingsList[i + 1].p = (n.lap - 1) + n.t; });
        standingsList.sort((a, b) => b.p - a.p);
        const pos = standingsList.findIndex((x) => x.id === PLAYER_ID) + 1;
        const raceTime = raceStart ? (now - raceStart) / 1000 : 0;
        const lapTime = lapStart ? (now - lapStart) / 1000 : 0;
        let hudMessage = '';
        if (offTrack) hudMessage = 'OFF TRACK - GRIP REDUCED';
        else if (keys.repair && inDrsZone(pT) && kmh < 55) hudMessage = 'PIT REPAIR IN PROGRESS';
        else if (flowState > 0.84 && kmh > 185) hudMessage = raceSetup.preset.id === 'hammer' ? 'HAMMER TIME' : 'FLOW STATE';
        else if (slip > 0.2) hudMessage = 'SLIPSTREAM BOOST';
        else if (damage > 0.45) hudMessage = 'CAR DAMAGE HIGH - PIT WINDOW OPEN';
        else if (drsReady && !drsOn) hudMessage = 'DRS READY';

        const vRatio = clamp(Math.abs(speed) / Math.max(maxSpeed, 1), 0, 1);
        const camForward = tmpA.set(Math.sin(heading), 0, Math.cos(heading));
        const side = tmpB.set(camForward.z, 0, -camForward.x);

        if (cameraMode === 0) {
          camLift.set(0, 4 + vRatio * 2.5, 0);
          lookLift.set(0, 1.2, 0);
          camTarget.copy(player.position).addScaledVector(camForward, -11 - vRatio * 5).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 10 + vRatio * 5).add(lookLift);
          camera.fov = 72 + vRatio * 16;
          camera.position.lerp(camTarget, clamp(dt * 6.2, 0, 1));
        } else if (cameraMode === 1) {
          camLift.set(0, 1.05, 0);
          lookLift.set(0, 1.3, 0);
          camTarget.copy(player.position).addScaledVector(camForward, 1.4).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 30).add(lookLift);
          camera.fov = 84 + vRatio * 8;
          camera.position.lerp(camTarget, clamp(dt * 12, 0, 1));
        } else {
          camLift.set(0, 8 + vRatio * 2.5, 0);
          lookLift.set(0, 1.2, 0);
          camTarget.copy(player.position).addScaledVector(side, 12).addScaledVector(camForward, 3.5).add(camLift);
          lookTarget.copy(player.position).addScaledVector(camForward, 11).add(lookLift);
          camera.fov = 66 + vRatio * 8;
          camera.position.lerp(camTarget, clamp(dt * 3.8, 0, 1));
        }
        // ── Apply screen shake ──
        if (shakeIntensity > 0.01) {
          camera.position.x += (Math.random() - 0.5) * shakeIntensity;
          camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.6;
          camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        }

        camera.lookAt(lookTarget);
        if (Math.abs(lastFov - camera.fov) > 0.01) {
          camera.updateProjectionMatrix();
          lastFov = camera.fov;
        }

        miniTick += dt;
        if (miniTick > quality.minimapInterval && minimapCtx) {
          miniTick = 0;
          minimapCtx.drawImage(minimapStatic, 0, 0);

          npcs.forEach((npc) => {
            const m = mapPos(npc.mesh.position);
            minimapCtx.fillStyle = '#ffab47';
            minimapCtx.beginPath();
            minimapCtx.arc(m.x, m.y, 3.6, 0, Math.PI * 2);
            minimapCtx.fill();
          });

          const pm = mapPos(player.position);
          minimapCtx.save();
          minimapCtx.translate(pm.x, pm.y);
          minimapCtx.rotate(-heading);
          minimapCtx.fillStyle = '#ff1f51';
          minimapCtx.beginPath();
          minimapCtx.moveTo(0, -7);
          minimapCtx.lineTo(5.5, 6);
          minimapCtx.lineTo(-5.5, 6);
          minimapCtx.closePath();
          minimapCtx.fill();
          minimapCtx.restore();
        }

        hudTick += dt;
        if (hudTick > 0.09) {
          hudTick = 0;
          // Fast DOM updates to bypass React re-renders for high-frequency data.
          if (hudDom.speed) hudDom.speed.textContent = Math.round(kmh);
          if (hudDom.gear) hudDom.gear.textContent = `G${gear}`;
          if (hudDom.rpmFill) hudDom.rpmFill.style.width = `${(Math.round(rpm) / 18000) * 100}%`;
          if (hudDom.rpmLabel) hudDom.rpmLabel.textContent = `${Math.round(rpm / 1000)}K RPM`;
          if (hudDom.lapTime) hudDom.lapTime.textContent = formatTime(lapTime);
          if (hudDom.raceTime) hudDom.raceTime.textContent = formatTime(raceTime);
          if (hudDom.position) hudDom.position.textContent = `P ${pos}/${npcs.length + 1}`;
          if (hudDom.lap) hudDom.lap.textContent = `LAP ${Math.min(lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
          if (hudDom.fps) hudDom.fps.textContent = `FPS: ${fps}`;

          setHud((prev) => ({
            ...prev,
            speed: Math.round(kmh),
            gear,
            rpm: Math.round(rpm),
            lap: Math.min(lap, TOTAL_LAPS),
            lapTime,
            raceTime,
            position: pos,
            bestLap,
            sector,
            sectors: [...sectorTimes],
            drsReady,
            drsOn,
            ers: Math.round(ers),
            ersOn,
            damage: Math.round(damage * 100),
            weather: WEATHER_PRESETS[weatherTarget].name,
            camera: CAMERA_MODES[cameraMode],
            fps,
            flow: Math.round(flowState * 100),
            profile: raceSetup.preset.shortLabel,
            slipstream: slip > 0.2,
            offTrack,
            message: hudMessage,
            leaders: standingsList.slice(0, 4).map((entry) => entry.id)
          }));

          debugStateRef.current = {
            coordinateSystem: 'trackProgress is 0..1 around the circuit; lateralOffsetMeters is signed from centerline (+left, -right).',
            phase: state,
            countdown: inCountdown ? (countdownStep === 0 ? 'GO' : countdownStep) : null,
            player: {
              lap: Math.min(lap, TOTAL_LAPS),
              trackProgress: Number(pT.toFixed(3)),
              lateralOffsetMeters: Number(lateral.toFixed(2)),
              speedKmh: Math.round(kmh),
              gear,
              rpm: Math.round(rpm),
              damagePct: Math.round(damage * 100)
            },
            race: {
              position: pos,
              competitors: npcs.length + 1,
              sector,
              fps,
              lapTime: Number(lapTime.toFixed(3)),
              raceTime: Number(raceTime.toFixed(3)),
              bestLap: bestLap ? Number(bestLap.toFixed(3)) : null,
              drsReady,
              drsOn,
              ersPct: Math.round(ers),
              ersOn,
              flowPct: Math.round(flowState * 100),
              weather: WEATHER_PRESETS[weatherTarget].name,
              camera: CAMERA_MODES[cameraMode],
              setupProfile: raceSetup.preset.name,
              renderScale: Number(activePixelRatio.toFixed(2)),
              slipstream: slip > 0.2,
              offTrack,
              finished
            },
            leaders: standingsList.slice(0, 3).map((entry) => ({
              id: entry.id,
              progress: Number(entry.p.toFixed(3))
            })),
            hudMessage: hudMessage || null
          };
        }

        
            // ── Sound Updates ──
            if (soundEnabledRef.current) {
              updateEngineSound(kmh, rpm, keys.up);
              if (keys.up && !prevThrottleRef.current) playGearShiftSound();
            }
            prevThrottleRef.current = keys.up;
      }

      renderer.render(scene, camera);
    };

    const animate = () => {
      if (manualFrameMode) return;
      renderFrame(performance.now());
      if (!finished || phaseRef.current !== 'menu') anim = requestAnimationFrame(animate);
    };

    window.advanceTime = async (ms) => {
      manualFrameMode = true;
      cancelAnimationFrame(anim);
      simulatedNow += Math.max(ms, 40);
      renderFrame(simulatedNow);
    };

    anim = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      cameraActionRef.current = null;
      Object.keys(keys).forEach((key) => {
        keys[key] = false;
      });
      cancelAnimationFrame(anim);
      delete window.advanceTime;
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('resize', resize);
      smokeGeo.dispose();
      smokeMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      barrierGeo.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      skyTexture.dispose();
      grassTexture.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      lineGeo.dispose();
      stopAudio();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose && m.dispose());
          else if (obj.material.dispose) obj.material.dispose();
        }
      });
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      if (minimapHost) minimapHost.innerHTML = '';
    };
  }, [sessionId]);

  const toggleSound = () => {
    if (!audioCtx) initAudio();
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundOn(next);
    if (!next) stopAudio();
  };


  return (
    <div className="f1-root">
      <div ref={containerRef} className="f1-canvas" />

      {/* ── 5-Second Landing Page (Vertical P1 Artwork) ── */}
      {showLanding && (
        <div className="landing-screen" onClick={() => setShowLanding(false)}>
          <img
            src="./p1_splash.jpg"
            alt="P1 Formula 1 Grand Prix"
            className="landing-image"
          />
          <div className="landing-footer">
            <div className="landing-progress-bar">
              <div className="landing-progress-fill" />
            </div>
            <span className="landing-prompt">TAP ANYWHERE TO ENTER</span>
          </div>
        </div>
      )}

      {/* ── Minimal Orientation Prompt ── */}
      {isPortrait && !dismissOrientationPrompt && !showLanding && (
        <div className="portrait-banner">
          <span>Rotate phone to landscape for optimal racing view</span>
          <button type="button" onClick={() => setDismissOrientationPrompt(true)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Minimal Homepage (90% removed, stylish 10% kept) ── */}
      {phase === 'menu' && !showLanding && (
        <div className="p1-menu-overlay">
          <div className="p1-menu-card">
            {/* Header */}
            <div className="p1-menu-header">
              <div className="p1-brand">
                <span className="p1-logo-badge">P1</span>
                <span className="p1-brand-title">GRAND PRIX</span>
              </div>
              <div className="p1-by-credit">BY SHLOK VIJ</div>
            </div>

            {/* P1 GRAND PRIX CRAFT (Single option) */}
            <div className="p1-craft-box">
              <div className="p1-craft-top">
                <span className="p1-craft-badge">CHAMPIONSHIP SPEC</span>
                <span className="p1-craft-num">#1</span>
              </div>
              <h2 className="p1-craft-name">P1 GRAND PRIX CRAFT</h2>
              <div className="p1-craft-car">RED BULL RACING RB20 · BLUE LIVERY</div>
              <div className="p1-craft-driver">DRIVER: PARTHIV ABHANI #1</div>

              <div className="p1-craft-specs">
                <div className="craft-spec-item">
                  <span className="spec-label">POWER</span>
                  <span className="spec-val">1040 BHP</span>
                </div>
                <div className="craft-spec-item">
                  <span className="spec-label">TOP SPEED</span>
                  <span className="spec-val">350+ KM/H</span>
                </div>
                <div className="craft-spec-item">
                  <span className="spec-label">DOWNFORCE</span>
                  <span className="spec-val">GROUND EFFECT</span>
                </div>
              </div>
            </div>

            {/* Start Race Button */}
            <div className="p1-menu-actions">
              <button id="start-btn" type="button" className="p1-btn-start" onClick={startRace}>
                START RACE
              </button>
            </div>

            {/* Sound & Footer */}
            <div className="p1-menu-footer">
              <button type="button" className="p1-sound-btn" onClick={toggleSound}>
                {soundOn ? 'SOUND: ON' : 'SOUND: OFF'}
              </button>
              <span className="p1-footer-tag">FORMULA 1 · BY SHLOK VIJ</span>
            </div>
          </div>
        </div>
      )}

      {/* ── In-Race HUD & Controls ── */}
      {phase !== 'menu' && !showLanding && (
        <>
          {/* Top-Left: F1 Broadcast Timing Tower */}
          <div className="f1-timing-tower">
            <div className="f1-tower-header">
              <span className="f1-red-tag">P1</span>
              <span className="f1-tower-title">RACE</span>
              <span className="f1-tower-lap">LAP {Math.min(hud.lap, TOTAL_LAPS)}/{TOTAL_LAPS}</span>
            </div>
            <div className="f1-tower-sub">
              <span>LAPS DONE: <strong>{Math.max(0, hud.lap - 1)}/{TOTAL_LAPS}</strong></span>
            </div>
            <div className="f1-tower-list">
              {(hud.leaders && hud.leaders.length > 0
                ? hud.leaders
                : [PLAYER_ID, 'VERSTAPPEN', 'NORRIS', 'HAMILTON']
              ).slice(0, 4).map((name, idx) => {
                const isPlayer = name === PLAYER_ID || name.includes('PARTHIV');
                return (
                  <div key={name + idx} className={`f1-tower-row ${isPlayer ? 'f1-row-player' : ''}`}>
                    <span className="f1-pos">{idx + 1}</span>
                    <span className="f1-driver">{isPlayer ? 'PARTHIV ABHANI' : name}</span>
                    {isPlayer && <span className="f1-car-tag">RB#1</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top-Right: Telemetry & Controls */}
          <div className="f1-top-right-box">
            <div className="f1-pos-badge">
              <span className="f1-pos-num">P{hud.position}</span>
              <span className="f1-pos-total">/{hud.competitors}</span>
            </div>
            <div className="f1-lap-chip">
              <span className="f1-lap-label">LAPS DONE</span>
              <span className="f1-lap-val">{Math.max(0, hud.lap - 1)}/{TOTAL_LAPS}</span>
            </div>
            <div className="f1-time-chip">
              <span className="f1-time-label">LAP TIME</span>
              <span className="f1-time-val">{formatTime(hud.lapTime)}</span>
            </div>
            <div className="f1-util-btns">
              <button
                type="button"
                className="f1-util-btn"
                onClick={() => cameraActionRef.current?.()}
                title="Switch Camera"
              >
                CAM: {hud.camera}
              </button>
              <button
                type="button"
                className="f1-util-btn"
                onClick={() => setPhase((prev) => prev === 'racing' ? 'paused' : 'racing')}
                title="Pause"
              >
                ⏸
              </button>
              <button
                type="button"
                className="f1-util-btn"
                onClick={toggleSound}
                title="Toggle Sound"
              >
                {soundOn ? '🔊' : '🔇'}
              </button>
            </div>
          </div>

          {/* Bottom-Center: F1 Digital Cockpit Dashboard */}
          <div className="f1-dash">
            <div className="f1-dash-rpm-bar">
              <div
                className="f1-dash-rpm-fill"
                style={{ width: `${Math.min(100, (hud.rpm / 16000) * 100)}%` }}
              />
            </div>
            <div className="f1-dash-core">
              <div className="f1-dash-speed">
                <span className="f1-speed-num">{hud.speed}</span>
                <span className="f1-speed-unit">KM/H</span>
              </div>
              <div className="f1-dash-gear">
                <span className="f1-gear-label">GEAR</span>
                <span className="f1-gear-num">{hud.gear}</span>
              </div>
              <div className="f1-dash-badges">
                <div className={`f1-drs-badge ${hud.drsOn ? 'f1-drs-on' : (hud.drsReady ? 'f1-drs-ready' : '')}`}>
                  DRS
                </div>
                <div className={`f1-ers-badge ${hud.ersOn ? 'f1-ers-on' : ''}`}>
                  ERS {hud.ers}%
                </div>
              </div>
            </div>
          </div>

          {hud.message && <div className="event-banner">{hud.message}</div>}

          <div ref={minimapRef} className="minimap-shell" />

          {/* ── Mobile Touch Controls (Non-overlapping clusters) ── */}
          {showTouchControls && (
            <div className="f1-touch-controls">
              {/* Left cluster: Steering */}
              <div className="f1-touch-left">
                <TouchControlButton
                  className="f1-touch-steer f1-steer-left"
                  controlKey="left"
                  keysRef={keysRef}
                  ariaLabel="Steer Left"
                >
                  ◀
                </TouchControlButton>
                <TouchControlButton
                  className="f1-touch-steer f1-steer-right"
                  controlKey="right"
                  keysRef={keysRef}
                  ariaLabel="Steer Right"
                >
                  ▶
                </TouchControlButton>
              </div>

              {/* Right cluster: Aux + Pedals */}
              <div className="f1-touch-right">
                <div className="f1-touch-aux">
                  <TouchControlButton
                    className={`f1-aux-btn ${hud.drsReady ? 'f1-aux-drs-ready' : ''} ${hud.drsOn ? 'f1-aux-drs-on' : ''}`}
                    controlKey="drs"
                    keysRef={keysRef}
                    ariaLabel="DRS"
                  >
                    DRS
                  </TouchControlButton>
                  <TouchControlButton
                    className={`f1-aux-btn ${hud.ersOn ? 'f1-aux-ers-on' : ''}`}
                    controlKey="ers"
                    keysRef={keysRef}
                    ariaLabel="ERS Boost"
                  >
                    ERS
                  </TouchControlButton>
                </div>
                <div className="f1-touch-pedals">
                  <TouchControlButton
                    className="f1-pedal f1-pedal-brake"
                    controlKey="down"
                    keysRef={keysRef}
                    ariaLabel="Brake and Reverse"
                  >
                    <span>BRAKE</span>
                    <small>▼</small>
                  </TouchControlButton>
                  <TouchControlButton
                    className="f1-pedal f1-pedal-gas"
                    controlKey="up"
                    keysRef={keysRef}
                    ariaLabel="Throttle"
                  >
                    <span>GAS</span>
                    <small>▲</small>
                  </TouchControlButton>
                </div>
              </div>
            </div>
          )}

          {/* ── Starting Lights ── */}
          {countdown !== null && (
            <div className="countdown-overlay">
              <div className="starting-lights">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`light-col ${countdown !== 'GO' && (6 - countdown) >= n ? 'light-on' : ''} ${countdown === 'GO' ? 'light-go' : ''}`}>
                    <div className="light-bulb" />
                    <div className="light-bulb" />
                  </div>
                ))}
              </div>
              <div className="countdown-value">{countdown}</div>
            </div>
          )}

          {/* ── Paused Modal (Black, White, Red) ── */}
          {phase === 'paused' && (
            <div className="p1-modal-overlay">
              <div className="p1-modal-card">
                <div className="p1-modal-tag">PAUSED</div>
                <h2>P1 GRAND PRIX</h2>
                <p>Red Bull Racing #1 · Driven by Parthiv Abhani</p>
                <div className="p1-modal-actions">
                  <button type="button" className="p1-btn-primary" onClick={() => setPhase('racing')}>RESUME</button>
                  <button type="button" className="p1-btn-secondary" onClick={restartRace}>RESTART</button>
                  <button type="button" className="p1-btn-ghost" onClick={backToMenu}>MAIN MENU</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Finished Modal (Black, White, Red) ── */}
          {phase === 'finished' && result && (
            <div className="p1-modal-overlay">
              <div className="p1-modal-card p1-finish-card">
                <div className="p1-modal-tag">{result.position === 1 ? 'VICTORY' : `P${result.position} FINISH`}</div>
                <h2>{result.position === 1 ? 'P1 VICTORY' : `CLASSIFICATION: P${result.position}`}</h2>
                <div className="p1-finish-driver">PARTHIV ABHANI · RED BULL RACING #1</div>
                <div className="p1-finish-stats">
                  <div className="finish-stat"><span className="stat-lbl">POSITION</span><span className="stat-v">P{result.position} / 7</span></div>
                  <div className="finish-stat"><span className="stat-lbl">TOTAL TIME</span><span className="stat-v">{formatTime(result.total)}</span></div>
                  <div className="finish-stat"><span className="stat-lbl">BEST LAP</span><span className="stat-v">{result.best ? formatTime(result.best) : '--:--.---'}</span></div>
                </div>
                {result.standings && (
                  <div className="p1-standings-box">
                    <div className="p1-standings-hdr">FINAL CLASSIFICATION</div>
                    {result.standings.map((s) => (
                      <div key={s.id} className={`p1-standings-row ${s.id === PLAYER_ID ? 'standings-player' : ''}`}>
                        <span className="s-pos">P{s.position}</span>
                        <span className="s-name">{s.id === PLAYER_ID ? 'PARTHIV ABHANI (Red Bull #1)' : s.id}</span>
                        <span className="s-laps">{s.laps} LAPS</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p1-modal-actions">
                  <button type="button" className="p1-btn-primary" onClick={restartRace}>RACE AGAIN</button>
                  <button type="button" className="p1-btn-ghost" onClick={backToMenu}>MAIN MENU</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
