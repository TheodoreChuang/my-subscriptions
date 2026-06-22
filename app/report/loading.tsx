export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#18171A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '28px',
      }}
    >
      <style>{`
        @keyframes logoOrbit   { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes logoOrbit2  { from { transform: rotate(200deg); } to { transform: rotate(560deg);  } }
        @keyframes logoPulse   { 0%,100% { opacity:.32; transform:scale(1); } 50% { opacity:.9; transform:scale(1.07); } }
        @keyframes logoRing    { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes logoRingRev { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes dotPulse    { 0%,100% { opacity:.32; } 50% { opacity:.9; } }
      `}</style>

      {/* Logo */}
      <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
        {/* Outer dashed ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1.5px dashed rgba(255,101,53,.18)',
          animation: 'logoRing 18s linear infinite',
        }} />
        {/* Inner ring counter-rotate */}
        <div style={{
          position: 'absolute', inset: '11px', borderRadius: '50%',
          border: '1px solid rgba(255,101,53,.06)',
          animation: 'logoRingRev 28s linear infinite',
        }} />
        {/* Orbit dot 1 — orange */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 0, height: 0,
          animation: 'logoOrbit 4.8s linear infinite',
        }}>
          <div style={{
            position: 'absolute', width: '10px', height: '10px',
            background: '#FF6535', borderRadius: '50%',
            left: '37px', top: '-5px',
            boxShadow: '0 0 10px rgba(255,101,53,.75)',
          }} />
        </div>
        {/* Orbit dot 2 — green */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 0, height: 0,
          animation: 'logoOrbit2 7.2s linear infinite',
        }}>
          <div style={{
            position: 'absolute', width: '8px', height: '8px',
            background: '#6BCB77', borderRadius: '50%',
            left: '26px', top: '-4px',
            boxShadow: '0 0 8px rgba(107,203,119,.65)',
          }} />
        </div>
        {/* M center */}
        <div style={{
          position: 'absolute', inset: '22px', background: '#1F1E22', borderRadius: '50%',
          border: '1.5px solid rgba(255,101,53,.32)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'logoPulse 3.2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: '19px', fontWeight: 800, color: '#FF6535', letterSpacing: '-.04em' }}>M</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, color: '#F4EFE6', letterSpacing: '-.02em', marginBottom: '6px' }}>
          MySubscriptions
        </div>
        <div style={{ fontSize: '9px', color: 'rgba(244,239,230,.18)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
          Personal Insight Engine
        </div>
      </div>

      {/* Three pulsing dots */}
      <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
        {[0, 0.3, 0.6].map((delay, i) => (
          <div
            key={i}
            style={{
              width: '5px', height: '5px',
              background: 'rgba(255,101,53,.55)', borderRadius: '50%',
              animation: `dotPulse 1.5s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
