
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ClockFace from './components/ClockFace';
import { THEMES, CLOCK_SIZE_PRESETS, DEFAULT_CLOCK_SIZE } from './constants';
import { Alarm, ClockTheme, StopwatchState, Lap, WeatherData, MoonData } from './types';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  // --- CORE STATE ---
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  
  // --- WEATHER STATE ---
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);

  // --- LUNAR STATE ---
  const [showMoonDetail, setShowMoonDetail] = useState(false);

  // --- PRESTIGE SETTINGS ---
  const [currentTheme, setCurrentTheme] = useState<ClockTheme>(() => {
    const saved = localStorage.getItem('deba_theme');
    return saved ? JSON.parse(saved) : THEMES[0];
  });
  const [faceOpacity, setFaceOpacity] = useState(() => {
    const saved = localStorage.getItem('deba_opacity');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [clockSize, setClockSize] = useState(() => {
    const saved = localStorage.getItem('deba_size');
    return saved ? parseInt(saved) : DEFAULT_CLOCK_SIZE;
  });
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => {
    const saved = localStorage.getItem('deba_format');
    return (saved as '12h' | '24h') || '24h';
  });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);

  // --- UI MODES ---
  const [activePanel, setActivePanel] = useState<'alarms' | 'stopwatch' | null>(null);
  const [showAddAlarm, setShowAddAlarm] = useState(false);

  // --- ALARM STATE ---
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    const saved = localStorage.getItem('deba_alarms');
    return saved ? JSON.parse(saved) : [];
  });
  const [triggeringAlarm, setTriggeringAlarm] = useState<Alarm | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [newAlarm, setNewAlarm] = useState<Omit<Alarm, 'id' | 'isActive'>>({ 
    label: 'Morning Call',
    hour: new Date().getHours(), 
    minute: new Date().getMinutes(),
    date: new Date().toISOString().split('T')[0] 
  });

  // --- STOPWATCH STATE ---
  const [stopwatch, setStopwatch] = useState<StopwatchState>({
    startTime: null,
    elapsedTime: 0,
    isRunning: false,
    laps: []
  });

  // --- REFS ---
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 50, y: 50 });
  const targetPos = useRef({ x: 50, y: 50 });
  const isDraggingRef = useRef(false);
  const rafId = useRef<number | null>(null);
  const stopwatchRafId = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlarmedMinute = useRef<string | null>(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem('deba_alarms', JSON.stringify(alarms));
    localStorage.setItem('deba_theme', JSON.stringify(currentTheme));
    localStorage.setItem('deba_opacity', faceOpacity.toString());
    localStorage.setItem('deba_size', clockSize.toString());
    localStorage.setItem('deba_format', timeFormat);
  }, [alarms, currentTheme, faceOpacity, clockSize, timeFormat]);

  // --- WEATHER ENGINE ---
  const fetchWeather = useCallback(async () => {
    if (isWeatherLoading) return;
    setIsWeatherLoading(true);
    
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Based on these coordinates: Lat ${pos.coords.latitude}, Lng ${pos.coords.longitude}, provide current weather. 
      Return ONLY a JSON object: {"temp": number, "condition": "Sunny"|"Cloudy"|"Rainy"|"Snowy"|"Clear", "location": "City Name"}. 
      Ensure the data is as up-to-date as possible.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || '{}');
      const sourceUrl = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0]?.web?.uri;

      setWeather({
        temp: data.temp || 0,
        condition: data.condition || 'Unknown',
        location: data.location || 'Unknown',
        sourceUrl
      });
    } catch (err) {
      console.error('Weather Sync Failed:', err);
    } finally {
      setIsWeatherLoading(false);
    }
  }, [isWeatherLoading]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 1800000); // Sync every 30 mins
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // --- LUNAR ENGINE ---
  const moonData = useMemo<MoonData>(() => {
    const now = new Date();
    const lp = 2551443; 
    const new_moon = new Date(1970, 0, 7, 20, 35, 0);
    const phase = ((now.getTime() - new_moon.getTime()) / 1000) % lp;
    const res = Math.floor(phase / (24 * 3600)) + 1;
    const phasePercent = phase / lp;
    
    let name = "";
    if (phasePercent < 0.03 || phasePercent > 0.97) name = "New Moon";
    else if (phasePercent < 0.22) name = "Waxing Crescent";
    else if (phasePercent < 0.28) name = "First Quarter";
    else if (phasePercent < 0.47) name = "Waxing Gibbous";
    else if (phasePercent < 0.53) name = "Full Moon";
    else if (phasePercent < 0.72) name = "Waning Gibbous";
    else if (phasePercent < 0.78) name = "Last Quarter";
    else name = "Waning Crescent";

    const illumination = phasePercent < 0.5 ? phasePercent * 2 * 100 : (1 - phasePercent) * 2 * 100;

    return {
      phase: phasePercent,
      phaseName: name,
      illumination: Math.round(illumination)
    };
  }, []);

  // --- WINDOW SIZE & CLICK OUTSIDE ---
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('resize', handleResize);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // --- AUDIO SYNTHESIS ---
  const playLuxuryChime = useCallback((isLoop = true) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const playTone = (freq: number, startTime: number, duration: number, volume = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    const notes = [440.00, 554.37, 659.25, 830.61]; 
    notes.forEach((f, i) => {
      playTone(f, now + i * 0.4, 2.5, 0.15 - (i * 0.02));
    });

    if (isLoop && triggeringAlarm) {
      setTimeout(() => {
        if (triggeringAlarm) playLuxuryChime(true);
      }, 4000);
    }
  }, [triggeringAlarm]);

  // --- ALARM CHECK ENGINE ---
  useEffect(() => {
    const checkAlarms = () => {
      if (triggeringAlarm) return;
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const currentD = now.toISOString().split('T')[0];
      const minuteKey = `${currentD}-${currentH}:${currentM}`;
      
      if (lastAlarmedMinute.current === minuteKey) return;
      
      const match = alarms.find(a => {
        const timeMatch = a.isActive && a.hour === currentH && a.minute === currentM;
        const dateMatch = !a.date || a.date === currentD;
        return timeMatch && dateMatch;
      });

      if (match) {
        lastAlarmedMinute.current = minuteKey;
        setTriggeringAlarm(match);
        playLuxuryChime(true);
      }
    };
    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [alarms, triggeringAlarm, playLuxuryChime]);

  // --- STOPWATCH ENGINE ---
  const updateStopwatch = useCallback(() => {
    if (!stopwatch.isRunning) return;
    setStopwatch(prev => ({
      ...prev,
      elapsedTime: prev.elapsedTime + (Date.now() - (prev.startTime || Date.now())),
      startTime: Date.now()
    }));
    stopwatchRafId.current = requestAnimationFrame(updateStopwatch);
  }, [stopwatch.isRunning]);

  useEffect(() => {
    if (stopwatch.isRunning) {
      stopwatchRafId.current = requestAnimationFrame(updateStopwatch);
    } else {
      if (stopwatchRafId.current) cancelAnimationFrame(stopwatchRafId.current);
    }
    return () => {
      if (stopwatchRafId.current) cancelAnimationFrame(stopwatchRafId.current);
    };
  }, [stopwatch.isRunning, updateStopwatch]);

  const toggleStopwatch = () => {
    setStopwatch(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      startTime: !prev.isRunning ? Date.now() : null
    }));
  };

  const resetStopwatch = () => {
    setStopwatch({
      startTime: null,
      elapsedTime: 0,
      isRunning: false,
      laps: []
    });
  };

  const lapStopwatch = () => {
    if (stopwatch.elapsedTime === 0) return;
    setStopwatch(prev => {
      const lastSplit = prev.laps.length > 0 ? prev.laps[0].splitTime : 0;
      const duration = prev.elapsedTime - lastSplit;
      const newLap: Lap = {
        splitTime: prev.elapsedTime,
        duration: duration
      };
      return {
        ...prev,
        laps: [newLap, ...prev.laps].slice(0, 15)
      };
    });
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const fastestLapDuration = useMemo(() => {
    if (stopwatch.laps.length === 0) return Infinity;
    return Math.min(...stopwatch.laps.map(l => l.duration));
  }, [stopwatch.laps]);

  // --- DRAG ENGINE ---
  const updateDragPosition = useCallback(() => {
    if (!containerRef.current || !isDraggingRef.current) return;
    const constrainedX = Math.max(0, Math.min(targetPos.current.x, window.innerWidth - clockSize));
    const constrainedY = Math.max(-80, Math.min(targetPos.current.y, window.innerHeight - clockSize - 80));
    currentPos.current = { x: constrainedX, y: constrainedY };
    containerRef.current.style.transform = `translate3d(${constrainedX}px, ${constrainedY}px, 0)`;
    rafId.current = requestAnimationFrame(updateDragPosition);
  }, [clockSize]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isPinned || triggeringAlarm) return;
    const isOverPanel = (e.target as HTMLElement).closest('.alarm-panel, .stopwatch-panel, .quick-actions');
    if (isOverPanel) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    dragOffset.current = {
      x: e.clientX - currentPos.current.x,
      y: e.clientY - currentPos.current.y
    };
    targetPos.current = { x: currentPos.current.x, y: currentPos.current.y };
    rafId.current = requestAnimationFrame(updateDragPosition);
    e.preventDefault();
  };

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    targetPos.current = {
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    };
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (containerRef.current) {
        try { containerRef.current.releasePointerCapture(e.pointerId); } catch(err) {}
    }
    setPosition({ x: currentPos.current.x, y: currentPos.current.y });
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // --- ALARM HANDLERS ---
  const deactivateAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, isActive: false } : a));
  };

  const handleDismiss = () => {
    if (!triggeringAlarm) return;
    if (triggeringAlarm.date) deactivateAlarm(triggeringAlarm.id);
    setTriggeringAlarm(null);
  };

  const handleSnooze = (mins: number) => {
    if (!triggeringAlarm) return;
    if (triggeringAlarm.date) deactivateAlarm(triggeringAlarm.id);

    const snoozeTime = new Date();
    snoozeTime.setMinutes(snoozeTime.getMinutes() + mins);
    
    const snoozeAlarm: Alarm = { 
      id: `snooze-${Date.now()}`, 
      label: `Snooze (${triggeringAlarm.label})`,
      hour: snoozeTime.getHours(), 
      minute: snoozeTime.getMinutes(), 
      date: snoozeTime.toISOString().split('T')[0],
      isActive: true 
    };

    setAlarms(prev => [...prev, snoozeAlarm]);
    setTriggeringAlarm(null);
  };

  const addAlarm = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlarms([{ ...newAlarm, id, isActive: true }, ...alarms]);
    setShowAddAlarm(false);
  };

  const deleteAlarm = (id: string) => {
    setAlarms(alarms.filter(a => a.id !== id));
  };

  const toggleAlarmStatus = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  // --- UI CALCS ---
  const edgeOpacity = useMemo(() => {
    const threshold = 120; 
    const minDist = Math.min(position.x, position.y + 80, windowSize.width - (position.x + clockSize), windowSize.height - (position.y + clockSize + 80));
    if (minDist < 0) return 0.25;
    if (minDist > threshold) return 1;
    return 0.25 + (0.75) * (minDist / threshold);
  }, [position, windowSize, clockSize]);

  const finalOpacity = useMemo(() => {
    if (!isVisible) return 0;
    if (isHovered || isDragging || triggeringAlarm || activePanel) return 1;
    return isPinned ? Math.min(edgeOpacity, 0.6) : edgeOpacity;
  }, [isVisible, isHovered, isDragging, isPinned, edgeOpacity, triggeringAlarm, activePanel]);

  const activeSnoozes = useMemo(() => alarms.filter(a => a.id.startsWith('snooze-') && a.isActive), [alarms]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); setIsVisible(prev => !prev); }
      if (e.key === 'Escape') { 
        if (triggeringAlarm) handleDismiss(); 
        else if (isPinned) setIsPinned(false); 
        setContextMenu(null); 
        setActivePanel(null); 
        setShowWeatherDetail(false);
        setShowMoonDetail(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinned, triggeringAlarm]);

  return (
    <div className="fixed inset-0 pointer-events-none bg-transparent overflow-hidden touch-none font-sans select-none">
      
      {/* Interaction Hint */}
      <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/80 backdrop-blur-2xl rounded-full border border-white/10 text-[11px] text-neutral-300 transition-all duration-700 shadow-2xl ${isVisible ? 'opacity-0 -translate-y-8' : 'opacity-100 translate-y-0'}`}>
        DEBA is hidden. Press <span style={{color: currentTheme.primary}} className="font-bold">ALT + D</span> to summon.
      </div>

      {/* COMMAND CENTER (Context Menu) */}
      {contextMenu && (
        <div 
          className="fixed z-[500] w-64 bg-neutral-900/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-4 pointer-events-auto animate-in fade-in zoom-in duration-200"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{color: currentTheme.primary}}>Horology Theme</h4>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setCurrentTheme(t)}
                  className={`prestige-tooltip w-10 h-10 rounded-xl border-2 transition-all ${currentTheme.id === t.id ? 'scale-110 shadow-lg' : 'opacity-60 border-transparent hover:opacity-100'}`}
                  style={{ backgroundColor: t.primary, borderColor: currentTheme.id === t.id ? 'white' : 'transparent' }}
                >
                  <span className="tooltip-content" style={{ borderColor: t.primary }}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{color: currentTheme.primary}}>Instrument Scale</h4>
            <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
              {Object.entries(CLOCK_SIZE_PRESETS).map(([key, value]) => (
                <button 
                  key={key}
                  onClick={() => setClockSize(value)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${clockSize === value ? 'text-black shadow-inner' : 'text-neutral-500 hover:text-white'}`}
                  style={{ backgroundColor: clockSize === value ? currentTheme.primary : 'transparent' }}
                >
                  {key.charAt(0)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
             <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{color: currentTheme.primary}}>Time Engine</h4>
             <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                <button onClick={() => setTimeFormat('12h')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${timeFormat === '12h' ? 'text-black shadow-inner' : 'text-neutral-500 hover:text-white'}`} style={{ backgroundColor: timeFormat === '12h' ? currentTheme.primary : 'transparent' }}>
                  12 Hour
                </button>
                <button onClick={() => setTimeFormat('24h')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${timeFormat === '24h' ? 'text-black shadow-inner' : 'text-neutral-500 hover:text-white'}`} style={{ backgroundColor: timeFormat === '24h' ? currentTheme.primary : 'transparent' }}>
                  24 Hour
                </button>
             </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em]" style={{color: currentTheme.primary}}>Crystal Opacity</h4>
              <span className="text-[10px] text-neutral-500 font-mono">{Math.round(faceOpacity * 100)}%</span>
            </div>
            <div className="prestige-tooltip w-full">
              <input 
                type="range" min="0.1" max="1" step="0.05" 
                value={faceOpacity} 
                onChange={(e) => setFaceOpacity(parseFloat(e.target.value))}
                className="w-full accent-neutral-200 cursor-pointer"
              />
              <span className="tooltip-content">Adjust Watch Face</span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-white/5">
            <button onClick={() => { setActivePanel('alarms'); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-neutral-300 hover:bg-white/5 rounded-lg transition-all text-left group">
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" style={{color: currentTheme.primary}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2 2zM18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z"/></svg>
              Set Alarms
            </button>
            <button onClick={() => { setActivePanel('stopwatch'); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-neutral-300 hover:bg-white/5 rounded-lg transition-all text-left group">
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" style={{color: currentTheme.primary}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Chronograph
            </button>
            <button onClick={() => { setIsPinned(!isPinned); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-neutral-300 hover:bg-white/5 rounded-lg transition-all text-left group">
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" style={{color: currentTheme.primary}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {isPinned ? 'Unlock Position' : 'Pin Position'}
            </button>
            <button onClick={() => { setIsVisible(false); setContextMenu(null); }} className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 rounded-lg transition-all text-left">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Minimize Instrument
            </button>
          </div>
        </div>
      )}

      {/* Main Draggable Clock Container */}
      <div 
        ref={containerRef}
        onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e); }}
        className={`
          absolute will-change-transform touch-none flex flex-col items-center justify-center pointer-events-auto
          ${isVisible ? (isHovered && !isDragging ? 'scale-[1.04]' : 'scale-100') : 'scale-90 pointer-events-none opacity-0'}
          ${isDragging ? 'cursor-grabbing z-[200] transition-none' : 'cursor-grab z-[100] transition-[opacity,scale,transform] duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)'}
        `}
        style={{ 
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`, 
          width: clockSize, 
          height: clockSize + 160, 
          opacity: finalOpacity,
          paddingTop: 80,
          paddingBottom: 80
        }}
        onPointerDown={onPointerDown}
        onMouseEnter={() => !triggeringAlarm && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Quick Actions Bar */}
        <div className={`
          quick-actions absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-neutral-900/95 backdrop-blur-3xl rounded-2xl border border-white/10 transition-all duration-300 shadow-2xl z-[150]
          ${(isHovered || activePanel) && !triggeringAlarm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
        `}>
          <div className="prestige-tooltip">
            <button onClick={() => setActivePanel(activePanel === 'alarms' ? null : 'alarms')} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${activePanel === 'alarms' ? 'text-black shadow-lg' : 'text-neutral-400 hover:bg-white/5'}`} style={{ backgroundColor: activePanel === 'alarms' ? currentTheme.primary : 'transparent' }}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2 2zM18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9z"/></svg>
            </button>
            <span className="tooltip-content" style={{ borderColor: currentTheme.primary }}>Alarms</span>
          </div>

          <div className="prestige-tooltip">
            <button onClick={() => setActivePanel(activePanel === 'stopwatch' ? null : 'stopwatch')} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${activePanel === 'stopwatch' ? 'text-black shadow-lg' : 'text-neutral-400 hover:bg-white/5'}`} style={{ backgroundColor: activePanel === 'stopwatch' ? currentTheme.primary : 'transparent' }}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </button>
            <span className="tooltip-content" style={{ borderColor: currentTheme.primary }}>Stopwatch</span>
          </div>
          
          <div className="w-[1px] h-4 bg-white/10" />
          
          <div className="prestige-tooltip">
            <button onClick={() => setIsPinned(!isPinned)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl ${isPinned ? 'text-black' : 'text-neutral-400 hover:text-white'}`} style={{ backgroundColor: isPinned ? currentTheme.primary : 'transparent' }}>
               {isPinned ? 'Unlock' : 'Lock'}
            </button>
            <span className="tooltip-content" style={{ borderColor: currentTheme.primary }}>{isPinned ? 'Release Instrument' : 'Lock Position'}</span>
          </div>

          <div className="prestige-tooltip">
            <button onClick={() => setIsVisible(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/40 text-red-500 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
            <span className="tooltip-content" style={{ borderColor: '#ef4444' }}>Minimize Clock</span>
          </div>
        </div>

        {/* Weather Complication Overlay */}
        {weather && showWeatherDetail && (
           <div 
             className="absolute left-[-180px] top-1/2 -translate-y-1/2 w-44 p-4 bg-neutral-900/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl z-[150] animate-in slide-in-from-right-8 duration-500"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="space-y-3">
                 <div className="flex flex-col gap-1">
                    <span className="text-[7px] font-black uppercase tracking-[0.3em] opacity-40">Climate Node</span>
                    <h5 className="text-[11px] font-bold text-white truncate">{weather.location}</h5>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-3xl font-mono text-white tabular-nums">{weather.temp}°</span>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-tight" style={{ color: currentTheme.primary }}>{weather.condition}</span>
                 </div>
                 <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                    <button onClick={fetchWeather} className="text-[8px] font-bold text-neutral-500 hover:text-white transition-colors uppercase">Sync Now</button>
                    {weather.sourceUrl && (
                       <a href={weather.sourceUrl} target="_blank" rel="noopener" className="text-[8px] font-bold uppercase opacity-30 hover:opacity-100 transition-opacity" style={{ color: currentTheme.accent }}>Source</a>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* Lunar Complication Overlay */}
        {showMoonDetail && (
           <div 
             className="absolute right-[-180px] top-1/2 -translate-y-1/2 w-44 p-4 bg-neutral-900/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl z-[150] animate-in slide-in-from-left-8 duration-500"
             onClick={(e) => e.stopPropagation()}
           >
              <div className="space-y-3">
                 <div className="flex flex-col gap-1">
                    <span className="text-[7px] font-black uppercase tracking-[0.3em] opacity-40">Lunar Telemetry</span>
                    <h5 className="text-[11px] font-bold text-white uppercase tracking-wider">{moonData.phaseName}</h5>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono text-white tabular-nums">{moonData.illumination}%</span>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-40">Visible Surface</span>
                 </div>
                 <div className="pt-2 border-t border-white/5">
                    <p className="text-[8px] text-neutral-500 leading-relaxed font-medium">Precision astronomical tracking synced to GMT reference cycle.</p>
                 </div>
              </div>
           </div>
        )}

        {/* The Clock Component */}
        <div className="relative group rounded-full overflow-visible prestige-tooltip">
          {triggeringAlarm && <div className="absolute inset-0 rounded-full border-4 animate-[ping_1.5s_infinite] pointer-events-none" style={{ borderColor: `${currentTheme.accent}80` }} />}
          <div className={`absolute inset-0 rounded-full blur-3xl scale-150 transition-opacity duration-1000 ${isHovered || triggeringAlarm ? 'opacity-40' : 'opacity-10'} pointer-events-none`} style={{ backgroundColor: triggeringAlarm ? `${currentTheme.accent}40` : `${currentTheme.primary}20` }} />
          <ClockFace 
            isHovered={isHovered} 
            isAlarming={!!triggeringAlarm} 
            theme={currentTheme} 
            faceOpacity={faceOpacity} 
            size={clockSize} 
            timeFormat={timeFormat}
            weather={weather}
            onWeatherToggle={() => { setShowWeatherDetail(!showWeatherDetail); setShowMoonDetail(false); }}
            moonData={moonData}
            onMoonToggle={() => { setShowMoonDetail(!showMoonDetail); setShowWeatherDetail(false); }}
          />
          <div className={`absolute inset-[10px] rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-40'}`} />
          <div className={`absolute inset-0 rounded-full transition-all duration-1000 pointer-events-none ${isHovered || triggeringAlarm ? 'shadow-2xl ring-[3px]' : 'shadow-none ring-1 ring-white/10'}`} style={{ ringColor: triggeringAlarm ? `${currentTheme.accent}` : (isHovered ? `${currentTheme.primary}80` : undefined) }} />
          {!triggeringAlarm && <span className="tooltip-content" style={{ bottom: '105%', borderColor: currentTheme.primary }}>Right-click to Calibrate</span>}
        </div>

        {/* ALARM MANAGEMENT PANEL */}
        <div className={`alarm-panel absolute top-[calc(100%-80px)] left-1/2 -translate-x-1/2 w-80 bg-neutral-950/98 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-0 shadow-[0_30px_100px_rgba(0,0,0,0.8)] transition-all duration-500 origin-top z-[160] overflow-hidden ${activePanel === 'alarms' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="flex justify-between items-center p-6 pb-4 border-b border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em]" style={{color: currentTheme.primary}}>Alarm Suite</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAddAlarm(!showAddAlarm)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`w-3.5 h-3.5 transition-transform duration-300 ${showAddAlarm ? 'rotate-45' : ''}`}><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
          
          <div className={`transition-all duration-500 overflow-hidden ${showAddAlarm ? 'max-h-80 opacity-100 p-6 pt-4 border-b border-white/5' : 'max-h-0 opacity-0'}`}>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] text-neutral-500 font-black uppercase tracking-[0.2em]">Label</span>
                <input 
                  type="text" 
                  value={newAlarm.label} 
                  placeholder="Focus Session..."
                  onChange={e => setNewAlarm({...newAlarm, label: e.target.value})}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white font-medium text-xs focus:outline-none focus:border-white/30 placeholder:text-neutral-800"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] text-neutral-500 font-black uppercase tracking-[0.2em]">Date</span>
                    <input type="date" value={newAlarm.date} onChange={e => setNewAlarm({...newAlarm, date: e.target.value})} className="bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono text-[10px] focus:outline-none" style={{ colorScheme: 'dark' }} />
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <span className="text-[8px] text-neutral-500 font-black uppercase tracking-[0.2em]">Time</span>
                    <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-2.5 gap-1">
                      <input type="number" min="0" max="23" value={newAlarm.hour} onChange={e => setNewAlarm({...newAlarm, hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0))})} className="w-1/2 bg-transparent text-white text-center font-mono focus:outline-none" />
                      <span className="opacity-30">:</span>
                      <input type="number" min="0" max="59" value={newAlarm.minute} onChange={e => setNewAlarm({...newAlarm, minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})} className="w-1/2 bg-transparent text-white text-center font-mono focus:outline-none" />
                    </div>
                 </div>
              </div>

              <button onClick={addAlarm} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.4em] transition-all" style={{ color: currentTheme.primary }}>
                 Deploy Alert
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {alarms.length === 0 && <p className="text-[9px] text-neutral-600 text-center py-8 italic uppercase tracking-[0.2em]">No Synchronized Alerts</p>}
            {alarms.map(a => (
              <div key={a.id} className="relative group/item flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl transition-all hover:bg-white/[0.07] overflow-hidden">
                {a.isActive && <div className="absolute left-0 top-0 bottom-0 w-[2px] blur-[1px] animate-pulse" style={{ backgroundColor: currentTheme.primary }} />}
                
                <div className="flex flex-col gap-0.5 z-10">
                  <span className={`text-[8px] font-black uppercase tracking-widest truncate max-w-[120px] transition-colors ${a.isActive ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {a.label || 'Standard Alert'}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-xl transition-colors tabular-nums ${a.isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-neutral-600'}`}>
                      {a.hour.toString().padStart(2,'0')}:{a.minute.toString().padStart(2,'0')}
                    </span>
                    {a.date && <span className="text-[8px] text-neutral-500 font-mono tracking-tighter">{a.date}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 z-10">
                   <div className="prestige-tooltip">
                    <div onClick={() => toggleAlarmStatus(a.id)} className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${a.isActive ? '' : 'bg-neutral-800'}`} style={{ backgroundColor: a.isActive ? currentTheme.primary : undefined }}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-lg ${a.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <span className="tooltip-content" style={{ bottom: '150%' }}>{a.isActive ? 'Online' : 'Dormant'}</span>
                  </div>
                  <button onClick={() => deleteAlarm(a.id)} className="p-2 text-neutral-600 hover:text-red-500 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHRONOGRAPH PANEL */}
        <div className={`stopwatch-panel absolute top-[calc(100%-80px)] left-1/2 -translate-x-1/2 w-80 bg-neutral-950/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.8)] transition-all duration-500 origin-top z-[160] ${activePanel === 'stopwatch' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
           <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em]" style={{color: currentTheme.primary}}>Chronograph</h3>
            <button onClick={resetStopwatch} className="text-[9px] text-neutral-500 hover:text-white uppercase font-bold transition-colors">Full Reset</button>
          </div>

          <div className="text-center py-8">
             <div className="text-4xl font-mono tracking-tighter text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                {formatTime(stopwatch.elapsedTime)}
             </div>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button 
              onClick={toggleStopwatch}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl active:scale-95 overflow-hidden group relative"
              style={{ 
                backgroundColor: stopwatch.isRunning ? '#ef4444' : currentTheme.primary,
                color: stopwatch.isRunning ? 'white' : 'black'
              }}
            >
              <span className="relative z-10">{stopwatch.isRunning ? 'Halt' : 'Ignite'}</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
            <button 
              onClick={lapStopwatch}
              disabled={!stopwatch.isRunning}
              className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all border border-white/10 ${stopwatch.isRunning ? 'text-white hover:bg-white/10' : 'text-neutral-700 opacity-50'}`}
            >
              Lap Split
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar border-t border-white/5 pt-6">
            {stopwatch.laps.map((lap, i) => {
              const isFastest = lap.duration === fastestLapDuration && stopwatch.laps.length > 1;
              return (
                <div 
                  key={i} 
                  className={`relative flex items-center justify-between p-4 bg-white/[0.03] border rounded-2xl transition-all ${isFastest ? 'border-accent shadow-[0_0_20px_-10px_rgba(255,255,255,0.2)]' : 'border-white/[0.05]'}`}
                  style={{ borderColor: isFastest ? currentTheme.accent : undefined }}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <span className="text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">Mark {stopwatch.laps.length - i}</span>
                       {isFastest && (
                         <span className="text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse" style={{ backgroundColor: currentTheme.accent, color: '#000' }}>
                           Prestige Record
                         </span>
                       )}
                    </div>
                    <span className={`text-xl font-mono tabular-nums leading-none ${isFastest ? 'text-white' : 'text-neutral-200'}`}>
                      {formatTime(lap.duration)}
                    </span>
                  </div>
                  <div className="text-right">
                     <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest block mb-1">Telemetry Split</span>
                     <span className="text-[10px] font-mono text-neutral-500 tabular-nums">{formatTime(lap.splitTime)}</span>
                  </div>
                </div>
              );
            })}
            {stopwatch.laps.length === 0 && <p className="text-[10px] text-neutral-600 text-center py-8 italic uppercase tracking-widest opacity-40">No telemetry recorded.</p>}
          </div>
        </div>

        {/* ALARM TRIGGER MODAL */}
        {triggeringAlarm && (
          <div className="absolute inset-0 z-[300] flex flex-col items-center justify-center pointer-events-auto">
             <div className="absolute inset-0 rounded-full blur-[140px] animate-[pulse_2s_infinite]" style={{ backgroundColor: `${currentTheme.accent}30` }} />
             
             <div className="relative bg-black/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 flex flex-col items-center gap-6 shadow-[0_40px_120px_rgba(0,0,0,0.9)] w-80 text-center scale-110">
                <div className="space-y-2">
                   <h2 className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse" style={{ color: currentTheme.accent }}>Critical Protocol</h2>
                   <h1 className="text-xl font-bold text-white tracking-tight">{triggeringAlarm.label}</h1>
                   <div className="text-4xl font-mono text-white opacity-40 tabular-nums">
                     {triggeringAlarm.hour.toString().padStart(2,'0')}:{triggeringAlarm.minute.toString().padStart(2,'0')}
                   </div>
                </div>

                <button onClick={handleDismiss} className="w-full relative text-black py-5 rounded-full font-black uppercase tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all overflow-hidden" style={{backgroundColor: currentTheme.accent}}>
                  <span className="relative z-10">Dismiss</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                </button>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button onClick={() => handleSnooze(5)} className="bg-white/5 border border-white/10 text-white/60 hover:text-white py-3 rounded-2xl font-bold uppercase tracking-[0.2em] transition-all text-[9px]">
                    Snooze 5m
                  </button>
                  <button onClick={() => handleSnooze(10)} className="bg-white/5 border border-white/10 text-white/60 hover:text-white py-3 rounded-2xl font-bold uppercase tracking-[0.2em] transition-all text-[9px]">
                    Snooze 10m
                  </button>
                </div>
             </div>
          </div>
        )}

        {isPinned && !isHovered && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 bg-neutral-950/90 backdrop-blur-md border border-white/5 rounded-full text-[9px] text-neutral-400 font-black uppercase tracking-[0.3em] whitespace-nowrap shadow-2xl">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{backgroundColor: currentTheme.primary}} />
              Locked
            </span>
          </div>
        )}
      </div>

      {/* DASHBOARD MONITOR */}
      <div className={`fixed bottom-12 right-12 p-8 bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[3.5rem] max-w-xs pointer-events-none transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-3 h-3 rounded-full shadow-lg animate-pulse" style={{backgroundColor: currentTheme.primary, boxShadow: `0 0 20px ${currentTheme.primary}`}} />
          <h2 className="text-[12px] font-black text-white uppercase tracking-[0.5em]">DEBA PRESTIGE</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
             <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-widest">{currentTheme.name} Edition</p>
             {activeSnoozes.length > 0 && (
               <div className="flex items-center gap-1.5 animate-pulse bg-white/5 px-2 py-1 rounded-full border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.primary }} />
                  <span className="text-[8px] font-black uppercase tracking-tighter" style={{ color: currentTheme.primary }}>Snooze Queue: {activeSnoozes.length}</span>
               </div>
             )}
          </div>
          <p className="text-[10px] text-neutral-600 leading-relaxed font-medium italic opacity-80">
            Precision chronometry active. {alarms.length} alert vector{alarms.length === 1 ? '' : 's'} managed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
