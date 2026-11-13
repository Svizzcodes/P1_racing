import React, { useMemo } from 'react';

export default function SkinSelector({
  skins = [],
  selectedSkinId,
  unlockedSkinIds = [],
  onSelect,
  points = 0
}) {
  const unlocked = useMemo(() => new Set(unlockedSkinIds), [unlockedSkinIds]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {skins.map((skin) => {
        const isUnlocked = unlocked.has(skin.id);
        const isSelected = selectedSkinId === skin.id;
        return (
          <button
            key={skin.id}
            type="button"
            onClick={() => isUnlocked && onSelect?.(skin.id)}
            disabled={!isUnlocked}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr auto',
              alignItems: 'center',
              gap: 12,
              borderRadius: 10,
              border: isSelected ? '1px solid #6ce8ff' : '1px solid rgba(255,255,255,0.2)',
              background: isSelected ? 'rgba(108, 232, 255, 0.15)' : 'rgba(255,255,255,0.06)',
              color: '#fff',
              padding: '10px 12px',
              cursor: isUnlocked ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              opacity: isUnlocked ? 1 : 0.65
            }}
          >
            <div style={{ display: 'grid', placeItems: 'center', width: 42, height: 42 }}>
              <div style={skin.style} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{skin.name}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {isUnlocked ? 'Unlocked' : `Unlocks at ${skin.unlockAt} XP`}
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {isUnlocked ? (isSelected ? 'Selected' : 'Select') : `${Math.max(0, skin.unlockAt - points)} XP to go`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
