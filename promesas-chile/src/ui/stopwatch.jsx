/* ============================================================
   stopwatch.jsx — cronómetro preciso con vueltas (reutilizable)
   ============================================================ */
import { useState, useRef, useEffect, useCallback } from 'react';

export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0);   // segundos
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);
  const baseRef = useRef(0);
  const intRef = useRef(null);

  const clear = () => { if (intRef.current) { clearInterval(intRef.current); intRef.current = null; } };

  const start = useCallback(() => {
    if (intRef.current) return;
    startRef.current = performance.now();
    setRunning(true);
    intRef.current = setInterval(() => {
      setElapsed(baseRef.current + (performance.now() - startRef.current) / 1000);
    }, 33);
  }, []);

  const stop = useCallback(() => {
    if (!intRef.current) return;
    clear();
    baseRef.current += (performance.now() - startRef.current) / 1000;
    setElapsed(baseRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    clear();
    baseRef.current = 0; setElapsed(0); setRunning(false);
  }, []);

  useEffect(() => () => clear(), []);
  return { elapsed, running, start, stop, reset };
}

export function clockParts(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const cs = Math.floor((secs * 100) % 100);
  return { m: String(m).padStart(2, '0'), s: String(s).padStart(2, '0'), cs: String(cs).padStart(2, '0') };
}
