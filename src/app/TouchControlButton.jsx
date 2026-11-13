import React, { useRef, useState } from 'react';

export default function TouchControlButton({
  className = '',
  controlKey,
  keysRef,
  onPress,
  children,
  ariaLabel
}) {
  const [active, setActive] = useState(false);
  const activePointersRef = useRef(new Set());

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(14);
      }
    } catch {
      // Haptics optional
    }
  };

  const handleStart = (event, id) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    activePointersRef.current.add(id);
    if (keysRef && controlKey) {
      keysRef.current[controlKey] = true;
    }
    setActive(true);
    triggerHaptic();
    if (onPress) onPress();
  };

  const handleEnd = (event, id) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    activePointersRef.current.delete(id);
    if (activePointersRef.current.size === 0) {
      if (keysRef && controlKey) {
        keysRef.current[controlKey] = false;
      }
      setActive(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel || controlKey}
      className={`touch-btn ${className} ${active ? 'touch-btn-active' : ''}`}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // ignore
        }
        handleStart(e, e.pointerId);
      }}
      onPointerUp={(e) => {
        try {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
            e.currentTarget.releasePointerCapture?.(e.pointerId);
          }
        } catch {
          // ignore
        }
        handleEnd(e, e.pointerId);
      }}
      onPointerCancel={(e) => handleEnd(e, e.pointerId)}
      onPointerLeave={(e) => {
        if ((e.buttons & 1) === 0) {
          handleEnd(e, e.pointerId);
        }
      }}
      onTouchStart={(e) => {
        const touch = e.changedTouches[0];
        handleStart(e, touch ? touch.identifier : 'touch');
      }}
      onTouchEnd={(e) => {
        const touch = e.changedTouches[0];
        handleEnd(e, touch ? touch.identifier : 'touch');
      }}
      onTouchCancel={(e) => {
        const touch = e.changedTouches[0];
        handleEnd(e, touch ? touch.identifier : 'touch');
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
