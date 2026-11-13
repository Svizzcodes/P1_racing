const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const DEFAULT_SETTINGS = {
  maxSpeed: 345,
  acceleration: 85,
  steering: 75,
  brakePower: 82,
  aiLevel: 75
};

export const DEFAULT_CAREER_STATS = {
  races: 0,
  wins: 0,
  podiums: 0,
  bestLap: null,
  lastPosition: null,
  lastWeather: 'CLEAR',
  recentResults: []
};

export const DRIVER_PRESETS = [
  {
    id: 'p1-racecraft',
    name: 'P1 GRAND PRIX CRAFT',
    shortLabel: 'P1 CRAFT',
    callSign: 'Red Bull Racing #1',
    summary: 'Championship Red Bull #1 aerodynamic package with Honda RBPT hybrid unit, dialed for maximum speed and razor turn-in.',
    focus: 'Direct drive throttle and floor ground-effect downforce.',
    traits: ['aerodynamic bite', 'ers boost', 'top speed'],
    settings: {
      maxSpeed: 345,
      acceleration: 85,
      steering: 75,
      brakePower: 82,
      aiLevel: 75
    }
  }
];

const normalizeSetting = (value, min, max) => clamp((value - min) / (max - min), 0, 1);

export const getSetupMetrics = (cfg) => {
  const topEnd = normalizeSetting(cfg.maxSpeed, 220, 360);
  const launch = normalizeSetting(cfg.acceleration, 30, 100);
  const turnIn = normalizeSetting(cfg.steering, 25, 100);
  const braking = normalizeSetting(cfg.brakePower, 30, 100);
  const pressure = normalizeSetting(cfg.aiLevel, 25, 100);
  const score = (raw) => Math.round(52 + clamp(raw, 0, 1) * 43);

  return {
    attack: score(topEnd * 0.42 + launch * 0.34 + pressure * 0.24),
    precision: score(turnIn * 0.46 + braking * 0.34 + (1 - topEnd) * 0.2),
    tyreCare: score((1 - launch) * 0.34 + braking * 0.28 + turnIn * 0.18 + (1 - topEnd) * 0.14 + (1 - pressure) * 0.06)
  };
};

export const analyzeSetup = (cfg) => {
  let bestPreset = DRIVER_PRESETS[0];
  let bestDistance = Infinity;

  DRIVER_PRESETS.forEach((preset) => {
    const distance =
      Math.abs(cfg.maxSpeed - preset.settings.maxSpeed) / 140 +
      Math.abs(cfg.acceleration - preset.settings.acceleration) / 70 +
      Math.abs(cfg.steering - preset.settings.steering) / 75 +
      Math.abs(cfg.brakePower - preset.settings.brakePower) / 70 +
      Math.abs(cfg.aiLevel - preset.settings.aiLevel) / 75;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPreset = preset;
    }
  });

  return {
    preset: bestPreset,
    matchPct: Math.round(clamp(1 - bestDistance / 5, 0, 1) * 100),
    metrics: getSetupMetrics(cfg)
  };
};

export const buildEngineerBrief = (analysis, careerStats) => {
  const recentLine = Number.isFinite(careerStats.lastPosition)
    ? `Last classification: P${careerStats.lastPosition}.`
    : 'Fresh telemetry session. Shlok Vij engineering notes loaded.';

  const weatherLine = careerStats.lastWeather === 'STORM'
    ? 'Rain radar active. Use progressive throttle and trail the brakes.'
    : analysis.preset.id === 'p1-attack'
      ? 'Peak downforce calibrated. Brake deep, rotate quickly, and open up the steering on exit.'
      : analysis.preset.id === 'p1-racecraft'
        ? 'Optimal race balance. Protect tyre life and execute decisive DRS overtakes.'
        : 'Slick conditions detected. Rely on aerodynamic stability through the high-speed sections.';

  return {
    eyebrow: `CHIEF ENGINEER SHLOK VIJ · ${analysis.preset.callSign}`,
    title: analysis.preset.name,
    copy: `${analysis.preset.summary} ${weatherLine} ${recentLine}`,
    focus: analysis.preset.focus,
    metrics: [
      { label: 'Aero Attack', value: analysis.metrics.attack },
      { label: 'Cornering Precision', value: analysis.metrics.precision },
      { label: 'Tyre Management', value: analysis.metrics.tyreCare },
      { label: 'Telemetry Match', value: `${analysis.matchPct}%` }
    ]
  };
};

export const DEFAULT_SETUP_ANALYSIS = analyzeSetup(DEFAULT_SETTINGS);

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem('p1-settings') || localStorage.getItem('f1-pro-settings');
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      maxSpeed: clamp(Number(parsed.maxSpeed) || DEFAULT_SETTINGS.maxSpeed, 220, 360),
      acceleration: clamp(Number(parsed.acceleration) || DEFAULT_SETTINGS.acceleration, 30, 100),
      steering: clamp(Number(parsed.steering) || DEFAULT_SETTINGS.steering, 25, 100),
      brakePower: clamp(Number(parsed.brakePower) || DEFAULT_SETTINGS.brakePower, 30, 100),
      aiLevel: clamp(Number(parsed.aiLevel) || DEFAULT_SETTINGS.aiLevel, 25, 100)
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem('p1-settings', JSON.stringify(settings));
  } catch {
    // LocalStorage quota or access error
  }
};

export const loadCareerStats = () => {
  try {
    const raw = localStorage.getItem('p1-career') || localStorage.getItem('f1-pro-career');
    if (!raw) return DEFAULT_CAREER_STATS;
    const parsed = JSON.parse(raw);
    return {
      races: Math.max(0, Number(parsed.races) || 0),
      wins: Math.max(0, Number(parsed.wins) || 0),
      podiums: Math.max(0, Number(parsed.podiums) || 0),
      bestLap: Number.isFinite(parsed.bestLap) ? parsed.bestLap : null,
      lastPosition: Number.isFinite(parsed.lastPosition) ? parsed.lastPosition : null,
      lastWeather: typeof parsed.lastWeather === 'string' ? parsed.lastWeather : 'CLEAR',
      recentResults: Array.isArray(parsed.recentResults)
        ? parsed.recentResults
          .filter((entry) => entry && Number.isFinite(entry.position) && Number.isFinite(entry.total))
          .slice(0, 4)
        : []
    };
  } catch {
    return DEFAULT_CAREER_STATS;
  }
};

export const saveCareerStats = (stats) => {
  try {
    localStorage.setItem('p1-career', JSON.stringify(stats));
  } catch {
    // LocalStorage quota or access error
  }
};
