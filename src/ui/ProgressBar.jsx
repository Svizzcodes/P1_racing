import React from 'react';

export default function ProgressBar({value=0}){
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{width:200, height:12, background:'#222', borderRadius:6}}>
      <div style={{width:`${pct}%`, height:'100%', background:'#0fa', borderRadius:6}} />
    </div>
  );
}
