
import React, { useEffect, useState } from 'react';
import { TimeState, ClockTheme, WeatherData, MoonData } from '../types';

interface ClockFaceProps {
  isHovered?: boolean;
  isAlarming?: boolean;
  theme: ClockTheme;
  faceOpacity?: number;
  size: number;
  timeFormat?: '12h' | '24h';
  weather?: WeatherData | null;
  onWeatherToggle?: () => void;
  moonData?: MoonData | null;
  onMoonToggle?: () => void;
}

const ClockFace: React.FC<ClockFaceProps> = ({ 
  isHovered = false, 
  isAlarming = false, 
  theme,
  faceOpacity = 1,
  size,
  timeFormat = '24h',
  weather = null,
  onWeatherToggle,
  moonData = null,
  onMoonToggle
}) => {
  const [time, setTime] = useState<TimeState & { day: number; weekday: string; ms: number }>({
    seconds: 0,
    minutes: 0,
    hours: 0,
    day: new Date().getDate(),
    weekday: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()],
    ms: 0
  });

  useEffect(() => {
    let frameId: number;
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const update = () => {
      const now = new Date();
      setTime({
        seconds: now.getSeconds() + now.getMilliseconds() / 1000,
        minutes: now.getMinutes() + now.getSeconds() / 60,
        hours: (now.getHours() % 12) + now.getMinutes() / 60,
        day: now.getDate(),
        weekday: days[now.getDay()],
        ms: now.getMilliseconds()
      });
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const center = size / 2;
  const secAngle = time.seconds * 6;
  const minAngle = time.minutes * 6;
  const hourAngle = time.hours * 30;

  // Scaling factor based on base size of 280
  const scale = size / 280;

  const markers = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i + 1) * 30 * (Math.PI / 180);
    const r = center - (5 * scale);
    const x1 = center + Math.sin(angle) * (r - (2 * scale));
    const y1 = center - Math.cos(angle) * (r - (2 * scale));
    const x2 = center + Math.sin(angle) * (r - (12 * scale));
    const y2 = center - Math.cos(angle) * (r - (12 * scale));
    const lx = center + Math.sin(angle) * (r - (32 * scale));
    const ly = center - Math.cos(angle) * (r - (32 * scale));

    return { x1, y1, x2, y2, lx, ly, val: i + 1 };
  });

  // Formatting digital parts
  const now = new Date();
  const rawHours = now.getHours();
  const dHours = timeFormat === '12h' 
    ? ((rawHours % 12) || 12).toString().padStart(2, '0') 
    : rawHours.toString().padStart(2, '0');
  const dMinutes = now.getMinutes().toString().padStart(2, '0');
  const dSeconds = now.getSeconds().toString().padStart(2, '0');
  const dMs = time.ms.toString().padStart(3, '0');
  const ampm = rawHours >= 12 ? 'PM' : 'AM';

  // Alarm dynamic colors
  const primaryStroke = isAlarming ? theme.accent : theme.primary;
  const secondaryStroke = isAlarming ? theme.accent : theme.secondary;

  const getWeatherIcon = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return (
      <circle cx="0" cy="0" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2">
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="10s" repeatCount="indefinite" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
          <line key={a} x1="0" y1="-6" x2="0" y2="-8" transform={`rotate(${a})`} />
        ))}
      </circle>
    );
    if (c.includes('cloud')) return (
      <path d="M-5 2 A3 3 0 0 1 -2 -1 A4 4 0 0 1 5 1 A3 3 0 0 1 5 4 L-5 4 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
    );
    if (c.includes('rain')) return (
      <g>
        <path d="M-4 1 A2.5 2.5 0 0 1 -2 -1.5 A3.5 3.5 0 0 1 4 0.5 A2.5 2.5 0 0 1 4 3 L-4 3 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <line x1="-2" y1="4" x2="-3" y2="6" stroke="currentColor" strokeWidth="0.8" />
        <line x1="1" y1="4" x2="0" y2="6" stroke="currentColor" strokeWidth="0.8" />
        <line x1="3" y1="3" x2="2" y2="5" stroke="currentColor" strokeWidth="0.8" />
      </g>
    );
    return <circle cx="0" cy="0" r="3" fill="currentColor" />;
  };

  const getMoonPath = (phase: number) => {
    // Phase 0: New, 0.5: Full, 1: New
    const r = 8;
    const sweep = phase <= 0.5 ? 0 : 1;
    const innerR = Math.abs(Math.cos(phase * 2 * Math.PI) * r);
    const innerSweep = phase > 0.25 && phase < 0.75 ? (phase <= 0.5 ? 1 : 0) : (phase <= 0.5 ? 0 : 1);
    
    return `M 0 -${r} A ${r} ${r} 0 0 ${sweep} 0 ${r} A ${innerR} ${r} 0 0 ${innerSweep} 0 -${r}`;
  };

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`} 
      className={`transition-all duration-700 ${isHovered ? 'drop-shadow-[0_25px_60px_rgba(0,0,0,0.9)]' : 'drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]'} ${isAlarming ? 'scale-[1.02]' : ''}`}
    >
      <defs>
        <linearGradient id="themeMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isAlarming ? theme.accent : (isHovered ? theme.secondary : theme.primary)} />
          <stop offset="50%" stopColor={isAlarming ? theme.accent : (isHovered ? theme.secondary : theme.primary)} stopOpacity="0.8" />
          <stop offset="100%" stopColor={isAlarming ? theme.accent : theme.primary} />
        </linearGradient>

        <radialGradient id="luxuryBlackFace" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isAlarming ? "#1a0000" : (isHovered ? "#2a2a2a" : "#1a1a1a")} stopOpacity={faceOpacity} />
          <stop offset="100%" stopColor="#050505" stopOpacity={faceOpacity} />
        </radialGradient>

        <radialGradient id="surfaceShine" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        <filter id="softNeedleShadow">
          <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodOpacity="0.6" />
        </filter>
        
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        <filter id="starsGlow">
           <feGaussianBlur stdDeviation="0.8" result="blur" />
           <feMerge>
             <feMergeNode in="blur" />
             <feMergeNode in="SourceGraphic" />
           </feMerge>
        </filter>
      </defs>

      {/* Alarm Pulse Aura */}
      {isAlarming && (
        <circle 
          cx={center} cy={center} r={center - (6 * scale)} 
          fill="none" 
          stroke={theme.accent} 
          strokeWidth={15 * scale} 
          className="animate-[ping_2s_infinite] opacity-20"
        />
      )}

      <circle 
        cx={center} cy={center} r={center - (6 * scale)} 
        fill="none" 
        stroke="url(#themeMetallic)" 
        strokeWidth={6 * scale} 
        className={`transition-all duration-500 ${isAlarming ? 'animate-pulse' : ''}`}
      />

      <circle 
        cx={center} cy={center} r={center - (9 * scale)} 
        fill="url(#luxuryBlackFace)" 
        className="transition-all duration-700"
      />

      <circle 
        cx={center} cy={center} r={center - (9 * scale)} 
        fill="url(#surfaceShine)" 
        className="pointer-events-none transition-all duration-700"
      />
      
      <circle 
        cx={center} cy={center} r={center - (22 * scale)} 
        fill="none" stroke={primaryStroke} 
        strokeWidth="0.5" strokeDasharray="1,4" 
        style={{ opacity: isAlarming ? 0.6 : (isHovered ? 0.3 : 0.15) }}
        className="transition-all duration-500"
      />

      {/* Weather Complication at 9 o'clock */}
      {weather && (
        <g 
          transform={`translate(${center - (68 * scale)}, ${center})`} 
          className="cursor-pointer group/weather"
          onClick={(e) => { e.stopPropagation(); onWeatherToggle?.(); }}
        >
          <circle r={18 * scale} fill="rgba(0,0,0,0.5)" stroke={secondaryStroke} strokeWidth="0.5" className="transition-all group-hover/weather:stroke-white" />
          <g transform={`scale(${1.2 * scale})`} style={{ color: secondaryStroke }}>
             {getWeatherIcon(weather.condition)}
          </g>
          <text 
            y={28 * scale} 
            textAnchor="middle" 
            fill={primaryStroke} 
            fontSize={7 * scale} 
            fontWeight="black" 
            className="uppercase tracking-widest opacity-40 group-hover/weather:opacity-100 transition-opacity"
          >
            {weather.temp}°C
          </text>
        </g>
      )}

      {/* Lunar Complication at 3 o'clock */}
      {moonData && (
        <g 
          transform={`translate(${center + (68 * scale)}, ${center})`} 
          className="cursor-pointer group/moon"
          onClick={(e) => { e.stopPropagation(); onMoonToggle?.(); }}
        >
          <circle r={18 * scale} fill="#050811" stroke={secondaryStroke} strokeWidth="0.5" className="transition-all group-hover/moon:stroke-white" />
          
          {/* Moon Stars */}
          <g filter="url(#starsGlow)">
             <circle cx="-5" cy="-7" r="0.3" fill="white" opacity="0.8" />
             <circle cx="6" cy="-4" r="0.4" fill="white" opacity="0.6" />
             <circle cx="-3" cy="8" r="0.3" fill="white" opacity="0.9" />
             <circle cx="8" cy="2" r="0.2" fill="white" opacity="0.5" />
             <circle cx="2" cy="-9" r="0.3" fill="white" opacity="0.7" />
          </g>

          <g transform={`scale(${scale})`}>
             <circle r="8" fill="rgba(255,255,255,0.05)" />
             <path d={getMoonPath(moonData.phase)} fill="url(#themeMetallic)" />
          </g>
          
          <text 
            y={28 * scale} 
            textAnchor="middle" 
            fill={primaryStroke} 
            fontSize={7 * scale} 
            fontWeight="black" 
            className="uppercase tracking-widest opacity-40 group-hover/moon:opacity-100 transition-opacity"
          >
            {moonData.illumination}%
          </text>
        </g>
      )}

      {/* BRANDING */}
      <g className={`transition-all duration-500 ${isAlarming ? 'animate-pulse' : ''}`} style={{ opacity: isHovered ? 0.05 : 1 }}>
        <text x={center} y={center - (45 * scale)} fill={primaryStroke} fontSize={14 * scale} fontWeight="900" textAnchor="middle" className="tracking-[0.4em] uppercase select-none pointer-events-none font-serif">DEBA</text>
        <text x={center} y={center - (32 * scale)} fill={primaryStroke} fontSize={6 * scale} fontWeight="bold" textAnchor="middle" className="tracking-[0.2em] uppercase select-none pointer-events-none opacity-40">Master Horology</text>
      </g>

      {/* DIGITAL READOUT */}
      <g className={`transition-all duration-500 pointer-events-none ${(isHovered || isAlarming) ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} filter="url(#glow)">
        <rect 
          x={center - (70 * scale)} y={center - (55 * scale)} 
          width={140 * scale} height={35 * scale} rx={8 * scale}
          fill={isAlarming ? "rgba(20,0,0,0.8)" : "rgba(0,0,0,0.6)"} 
          stroke={isAlarming ? theme.accent : "rgba(255,255,255,0.05)"}
          className={isAlarming ? 'animate-pulse' : ''}
        />
        <text 
          x={center} y={center - (36 * scale)} 
          fill={primaryStroke} 
          fontSize={16 * scale} 
          fontWeight="900" 
          textAnchor="middle" 
          className="font-mono tracking-tighter tabular-nums"
        >
          {dHours}<tspan fill={secondaryStroke} opacity="0.5">:</tspan>{dMinutes}<tspan fill={secondaryStroke} opacity="0.5">:</tspan>{dSeconds}<tspan fontSize={10 * scale} fill={isAlarming ? theme.primary : theme.accent} opacity="0.8">.{dMs}</tspan>
          {timeFormat === '12h' && <tspan fontSize={7 * scale} dx={4 * scale} fill={secondaryStroke} opacity="0.6">{ampm}</tspan>}
        </text>
        <text 
          x={center} y={center - (22 * scale)} 
          fill={primaryStroke} 
          fontSize={6 * scale} 
          fontWeight="black" 
          textAnchor="middle" 
          className="uppercase tracking-[0.3em] opacity-40"
        >
          {isAlarming ? 'Alert Protocol' : `Precision Sync ${timeFormat === '12h' ? '12H' : '24H'}`}
        </text>
      </g>

      {/* DATE & WEEKDAY WINDOW */}
      <g transform={`translate(${center - (30 * scale)}, ${center + (48 * scale)})`}>
        <rect 
          width={60 * scale} height={22 * scale} rx={4 * scale}
          fill="#000"
          stroke="url(#themeMetallic)" strokeWidth="1"
        />
        <text 
          x={30 * scale} y={13 * scale}
          fill={primaryStroke} fontSize={10 * scale} fontWeight="900"
          textAnchor="middle" dominantBaseline="middle"
          className="font-mono select-none pointer-events-none tracking-tighter"
        >
          <tspan fill={secondaryStroke} opacity="0.7" fontSize={8 * scale}>{time.weekday}</tspan> {time.day.toString().padStart(2, '0')}
        </text>
      </g>

      {markers.map((m) => (
        <React.Fragment key={m.val}>
          <line 
            x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} 
            stroke={m.val % 3 === 0 ? "url(#themeMetallic)" : primaryStroke} 
            strokeWidth={m.val % 3 === 0 ? (3 * scale) : (1.2 * scale)} 
            style={{ opacity: m.val % 3 === 0 ? 1 : (isHovered || isAlarming ? 0.8 : 0.6) }}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
          {m.val % 3 === 0 && (
             <text 
             x={m.lx} y={m.ly} 
             fill={primaryStroke} 
             fontSize={24 * scale} 
             fontWeight="900"
             textAnchor="middle" 
             dominantBaseline="middle"
             className="select-none pointer-events-none font-serif transition-transform duration-500"
             style={{ 
               transform: (isHovered || isAlarming) ? `scale(1.05)` : 'scale(1)',
               transformOrigin: `${m.lx}px ${m.ly}px`
             }}
           >
             {m.val}
           </text>
          )}
        </React.Fragment>
      ))}

      <g transform={`rotate(${hourAngle}, ${center}, ${center})`} filter="url(#softNeedleShadow)">
        <path
          d={`M ${center-(5 * scale)} ${center+(15 * scale)} L ${center+(5 * scale)} ${center+(15 * scale)} L ${center+(2 * scale)} ${center-(60 * scale)} L ${center-(2 * scale)} ${center-(60 * scale)} Z`}
          fill="url(#themeMetallic)"
        />
      </g>

      <g transform={`rotate(${minAngle}, ${center}, ${center})`} filter="url(#softNeedleShadow)">
        <path
          d={`M ${center-(3 * scale)} ${center+(20 * scale)} L ${center+(3 * scale)} ${center+(20 * scale)} L ${center+(1.2 * scale)} ${center-(100 * scale)} L ${center-(1.2 * scale)} ${center-(100 * scale)} Z`}
          fill={secondaryStroke}
        />
      </g>

      <g transform={`rotate(${secAngle}, ${center}, ${center})`}>
        <line
          x1={center} y1={center + (25 * scale)}
          x2={center} y2={center - (110 * scale)}
          stroke={isAlarming ? theme.primary : theme.accent}
          strokeWidth={1.2 * scale}
        />
        <circle cx={center} cy={center - (90 * scale)} r={3 * scale} fill={isAlarming ? theme.primary : theme.accent} />
      </g>

      <circle cx={center} cy={center} r={9 * scale} fill="url(#themeMetallic)" stroke="#000" strokeWidth="1" />
      <circle cx={center} cy={center} r={3 * scale} fill="#000" />
    </svg>
  );
};

export default ClockFace;
