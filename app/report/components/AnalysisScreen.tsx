'use client'

import type { Report } from '@/shared/types/report'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const STEPS = [
  'Retrieving your data',
  'Computing metrics',
  'Running AI analysis',
]

export function AnalysisScreen({ staleReport }: { staleReport: Report | null }) {
  const monthLabel = MONTH_NAMES[new Date().getMonth()]
  const teaserFinding = staleReport?.findings[0]

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
        gap: '22px',
        padding: '0 28px',
      }}
    >
      <style>{`
        @keyframes logoOrbit  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes logoOrbit2 { from { transform: rotate(200deg); } to { transform: rotate(560deg);  } }
        @keyframes logoPulse  { 0%,100% { opacity:.32; transform:scale(1); } 50% { opacity:.9; transform:scale(1.07); } }
        @keyframes logoRing   { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes indeterminate {
          0%   { left: -35%; right: 100%; }
          60%  { left: 100%; right: -90%; }
          100% { left: 100%; right: -90%; }
        }
        @keyframes indeterminate2 {
          0%   { left: -200%; right: 100%; }
          60%  { left: 107%;  right: -8%;  }
          100% { left: 107%;  right: -8%;  }
        }
      `}</style>

      {/* Small logo */}
      <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1.5px dashed rgba(255,101,53,.18)',
          animation: 'logoRing 18s linear infinite',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 0, height: 0,
          animation: 'logoOrbit 4.8s linear infinite',
        }}>
          <div style={{
            position: 'absolute', width: '8px', height: '8px',
            background: '#FF6535', borderRadius: '50%',
            left: '24px', top: '-4px',
            boxShadow: '0 0 7px rgba(255,101,53,.7)',
          }} />
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 0, height: 0,
          animation: 'logoOrbit2 7.2s linear infinite',
        }}>
          <div style={{
            position: 'absolute', width: '6px', height: '6px',
            background: '#6BCB77', borderRadius: '50%',
            left: '18px', top: '-3px',
            boxShadow: '0 0 6px rgba(107,203,119,.6)',
          }} />
        </div>
        <div style={{
          position: 'absolute', inset: '15px', background: '#1F1E22', borderRadius: '50%',
          border: '1.5px solid rgba(255,101,53,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'logoPulse 3.2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#FF6535' }}>M</span>
        </div>
      </div>

      {/* Heading + steps + progress */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: '280px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#F4EFE6', marginBottom: '12px' }}>
          Analyzing your {monthLabel}…
        </div>

        {/* Step list */}
        <div style={{
          textAlign: 'left', background: 'rgba(255,255,255,.03)',
          borderRadius: '10px', padding: '11px 14px', marginBottom: '16px',
        }}>
          {STEPS.map((step) => (
            <div key={step} style={{ fontSize: '11px', color: 'rgba(255,255,255,.3)', lineHeight: 1.9 }}>
              {step}
            </div>
          ))}
        </div>

        {/* Indeterminate progress bar */}
        <div style={{
          background: 'rgba(255,255,255,.07)', borderRadius: '4px',
          height: '4px', overflow: 'hidden', position: 'relative',
          marginBottom: '20px',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: '#FF6535', borderRadius: '4px',
            animation: 'indeterminate 2.1s cubic-bezier(.65,.815,.735,.395) infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: '#FF6535', borderRadius: '4px',
            animation: 'indeterminate2 2.1s cubic-bezier(.165,.84,.44,1) 1.15s infinite',
          }} />
        </div>
      </div>

      {/* Teaser card — shown when a previous report exists */}
      {teaserFinding && (
        <div style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.06)',
          borderRadius: '12px',
          padding: '12px 14px',
          width: '100%',
          maxWidth: '280px',
        }}>
          <div style={{
            fontSize: '9px', color: 'rgba(255,255,255,.22)', fontWeight: 800,
            letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '5px',
          }}>
            Previous insight
          </div>
          <div style={{
            fontSize: '12px', color: 'rgba(244,239,230,.5)',
            lineHeight: 1.55, fontStyle: 'italic',
          }}>
            &ldquo;{teaserFinding.description}&rdquo;
          </div>
        </div>
      )}
    </div>
  )
}
