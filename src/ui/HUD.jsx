import React from 'react';

export default function HUD({ score=0, highscore=0, totalXP=0 }){
  return (
    <div style={{display:'flex',gap:12,alignItems:'center'}}>
      <div>Score: {score}</div>
      <div>High: {highscore}</div>
      <div>XP: {totalXP}</div>
    </div>
  );
}
