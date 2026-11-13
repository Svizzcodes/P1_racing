import React, { useEffect, useMemo, useState } from 'react';
import useGameLoop from './useGameLoop';
import { SKINS } from '../shop/skins';
import SkinSelector from '../shop/SkinSelector';
import Modal from '../ui/Modal';
import ProgressBar from '../ui/ProgressBar';
import HUD from '../ui/HUD';
import { getJson, setJson } from '../utils/storage';

const PROFILE_KEY = 'lumina-profile';
const DEFAULT_PROFILE = {
  totalXP: 0,
  highscore: 0,
  selectedSkinId: SKINS[0].id
};

const sanitizeProfile = (raw) => {
  const selectedExists = SKINS.some((skin) => skin.id === raw?.selectedSkinId);
  return {
    totalXP: Math.max(0, Number(raw?.totalXP) || 0),
    highscore: Math.max(0, Number(raw?.highscore) || 0),
    selectedSkinId: selectedExists ? raw.selectedSkinId : SKINS[0].id
  };
};

export default function LuminaGame() {
  useGameLoop();

  const [score, setScore] = useState(0);
  const [profile, setProfile] = useState(() => sanitizeProfile(getJson(PROFILE_KEY, DEFAULT_PROFILE)));
  const [showSkins, setShowSkins] = useState(false);

  const { totalXP, highscore, selectedSkinId } = profile;

  const unlockedSkinIds = useMemo(
    () => SKINS.filter((skin) => totalXP >= skin.unlockAt).map((skin) => skin.id),
    [totalXP]
  );

  const selectedSkin = useMemo(() => {
    const found = SKINS.find((skin) => skin.id === selectedSkinId) ?? SKINS[0];
    return totalXP >= found.unlockAt ? found : SKINS[0];
  }, [selectedSkinId, totalXP]);

  const nextSkin = SKINS.find((skin) => totalXP < skin.unlockAt);
  const progressValue = nextSkin ? (totalXP / nextSkin.unlockAt) * 100 : 100;

  const updateProfile = (updater) => {
    setProfile((current) => {
      const nextValue = typeof updater === 'function' ? updater(current) : updater;
      const sanitized = sanitizeProfile(nextValue);
      setJson(PROFILE_KEY, sanitized);
      return sanitized;
    });
  };

  useEffect(() => {
    if (selectedSkin.id !== selectedSkinId) {
      updateProfile((current) => ({ ...current, selectedSkinId: selectedSkin.id }));
    }
  }, [selectedSkin.id, selectedSkinId]);

  const earnXp = () => {
    const gained = 15;
    setScore((prevScore) => {
      const newScore = prevScore + gained;
      updateProfile((current) => ({
        ...current,
        totalXP: current.totalXP + gained,
        highscore: Math.max(current.highscore, newScore)
      }));
      return newScore;
    });
  };

  const resetRun = () => {
    setScore(0);
  };

  const handleSelectSkin = (skinId) => {
    const skin = SKINS.find((entry) => entry.id === skinId);
    if (!skin || totalXP < skin.unlockAt) return;
    updateProfile((current) => ({ ...current, selectedSkinId: skinId }));
    setShowSkins(false);
  };

  return (
    <div style={{ padding: 20, color: '#fff', display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Lumina Game</h2>
      <HUD score={score} highscore={highscore} totalXP={totalXP} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          {nextSkin ? `Next unlock: ${nextSkin.name} at ${nextSkin.unlockAt} XP` : 'All skins unlocked'}
        </span>
        <ProgressBar value={progressValue} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40 }}>
          <span style={selectedSkin.style} />
        </span>
        <span style={{ opacity: 0.9 }}>Selected skin: {selectedSkin.name}</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={earnXp}>Score +15</button>
        <button type="button" onClick={resetRun}>Reset Run Score</button>
        <button type="button" onClick={() => setShowSkins(true)}>Choose Skin</button>
      </div>

      {showSkins && (
        <Modal onClose={() => setShowSkins(false)}>
          <h3 style={{ marginTop: 0 }}>Choose Your Skin</h3>
          <SkinSelector
            skins={SKINS}
            selectedSkinId={selectedSkin.id}
            unlockedSkinIds={unlockedSkinIds}
            onSelect={handleSelectSkin}
            points={totalXP}
          />
        </Modal>
      )}
    </div>
  );
}
