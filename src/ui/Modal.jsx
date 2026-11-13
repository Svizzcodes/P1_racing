import React from 'react';

export default function Modal({children, onClose}){
  return (
    <div style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:'rgba(0,0,0,0.5)'}}>
      <div style={{background:'#111',padding:20,borderRadius:8}}>
        {children}
        <div style={{marginTop:12,textAlign:'right'}}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
