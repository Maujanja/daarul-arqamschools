import { useCallback, useEffect, useRef, useState } from 'react';
import dasLogo from '@/assets/das-logo.png';

const SHOW_MS = 4200;   // muda wa intro kabla ya kuanza kufifia
const EXIT_MS = 700;    // muda wa kufifia

const TITLE = 'DAARUL-ARQAM'.split('');

// Chembe laini zinazoelea (nafasi zimewekwa ili zisibadilike kila render)
const PARTICLES = [
  { l: 8, s: 5, d: 0.2, t: 7 }, { l: 18, s: 3, d: 1.4, t: 9 }, { l: 27, s: 6, d: 0.8, t: 8 },
  { l: 36, s: 3, d: 2.2, t: 10 }, { l: 46, s: 4, d: 0.5, t: 7.5 }, { l: 55, s: 6, d: 1.8, t: 9 },
  { l: 64, s: 3, d: 0.9, t: 8.5 }, { l: 72, s: 5, d: 2.6, t: 7 }, { l: 81, s: 4, d: 0.3, t: 10 },
  { l: 90, s: 6, d: 1.6, t: 8 }, { l: 13, s: 4, d: 2.9, t: 9.5 }, { l: 59, s: 3, d: 3.1, t: 8 },
];

export default function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(() => setVisible(false), EXIT_MS);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(finish, reduce ? 1200 : SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [finish]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Daarul-Arqam Schools"
      onClick={finish}
      className="das-intro"
      style={{
        position: 'fixed', inset: 0, zIndex: 100000, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 38%, #17665a 0%, #0e443c 42%, #072320 100%)',
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(1.04)' : 'scale(1)',
        filter: leaving ? 'blur(6px)' : 'none',
        transition: `opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease, filter ${EXIT_MS}ms ease`,
        paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <style>{`
        .das-intro * { box-sizing: border-box; }
        @keyframes dasFloatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-24px) scale(1.12)} }
        @keyframes dasFloatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-34px,28px) scale(1.1)} }
        @keyframes dasRise { 0%{transform:translateY(0);opacity:0} 15%{opacity:.7} 100%{transform:translateY(-110vh);opacity:0} }
        @keyframes dasLogoIn { 0%{opacity:0;transform:scale(.55);filter:blur(14px)} 60%{opacity:1;filter:blur(0)} 100%{opacity:1;transform:scale(1);filter:blur(0)} }
        @keyframes dasLogoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes dasDraw { to { stroke-dashoffset: 0 } }
        @keyframes dasPulse { 0%{transform:scale(.8);opacity:.55} 100%{transform:scale(1.9);opacity:0} }
        @keyframes dasShine { 0%{transform:translateX(-140%) skewX(-20deg)} 100%{transform:translateX(260%) skewX(-20deg)} }
        @keyframes dasLetter { 0%{opacity:0;transform:translateY(16px);filter:blur(7px)} 100%{opacity:1;transform:translateY(0);filter:blur(0)} }
        @keyframes dasTrack { 0%{opacity:0;letter-spacing:.1em} 100%{opacity:1;letter-spacing:.55em} }
        @keyframes dasLine { 0%{width:0;opacity:0} 100%{width:96px;opacity:1} }
        @keyframes dasFade { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dasBar { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        @media (prefers-reduced-motion: reduce) {
          .das-intro *, .das-intro *::before { animation-duration: .01ms !important; animation-delay: 0s !important; }
        }
      `}</style>

      {/* Mwanga laini wa mandharinyuma */}
      <div aria-hidden style={{ position: 'absolute', top: '-12%', left: '-18%', width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(47,181,159,.45) 0%, transparent 70%)', animation: 'dasFloatA 11s ease-in-out infinite' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-14%', right: '-20%', width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,194,48,.28) 0%, transparent 70%)', animation: 'dasFloatB 13s ease-in-out infinite' }} />

      {/* Chembe */}
      {PARTICLES.map((p, i) => (
        <span key={i} aria-hidden style={{
          position: 'absolute', bottom: -12, left: `${p.l}%`, width: p.s, height: p.s, borderRadius: '50%',
          background: i % 3 === 0 ? '#F2C230' : 'rgba(255,255,255,.8)', opacity: 0,
          animation: `dasRise ${p.t}s linear ${p.d}s infinite`, boxShadow: '0 0 10px rgba(255,255,255,.5)',
        }} />
      ))}

      {/* Kituo */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
        {/* Logo + pete */}
        <div style={{ position: 'relative', width: 168, height: 168, animation: 'dasLogoFloat 4.5s ease-in-out 1.6s infinite' }}>
          {[0.5, 1.3].map((d, i) => (
            <span key={i} aria-hidden style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '2px solid rgba(242,194,48,.55)',
              opacity: 0, animation: `dasPulse 2.6s ease-out ${d}s infinite` }} />
          ))}
          <svg aria-hidden width="168" height="168" viewBox="0 0 168 168" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <linearGradient id="dasRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFE27A" /><stop offset="100%" stopColor="#E0A91A" />
              </linearGradient>
            </defs>
            <circle cx="84" cy="84" r="80" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
            <circle cx="84" cy="84" r="80" fill="none" stroke="url(#dasRing)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="503" strokeDashoffset="503" transform="rotate(-90 84 84)"
              style={{ animation: 'dasDraw 1.6s cubic-bezier(.65,0,.25,1) .3s forwards', filter: 'drop-shadow(0 0 6px rgba(242,194,48,.7))' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', overflow: 'hidden', opacity: 0,
            boxShadow: '0 12px 40px rgba(0,0,0,.45), 0 0 50px rgba(47,181,159,.35)', animation: 'dasLogoIn 1.1s cubic-bezier(.22,1,.36,1) .45s forwards' }}>
            <img src={dasLogo} alt="Daarul-Arqam Schools" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '45%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)',
              transform: 'translateX(-140%) skewX(-20deg)', animation: 'dasShine 1.3s ease-in-out 1.7s forwards' }} />
          </div>
        </div>

        {/* Jina */}
        <h1 aria-label="DAARUL-ARQAM" style={{ margin: '26px 0 0', display: 'flex', justifyContent: 'center', fontSize: 30,
          fontWeight: 800, color: '#fff', letterSpacing: '.06em', lineHeight: 1.1, textShadow: '0 2px 18px rgba(0,0,0,.35)' }}>
          {TITLE.map((ch, i) => (
            <span key={i} aria-hidden style={{ display: 'inline-block', opacity: 0, animation: `dasLetter .7s cubic-bezier(.22,1,.36,1) ${1.0 + i * 0.05}s forwards` }}>{ch}</span>
          ))}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 600, color: '#F2C230', opacity: 0,
          animation: 'dasTrack 1.1s ease-out 1.7s forwards', paddingLeft: '.55em' }}>SCHOOLS</p>
        <span aria-hidden style={{ display: 'block', height: 2, marginTop: 18, borderRadius: 2, width: 0, opacity: 0,
          background: 'linear-gradient(90deg, transparent, #F2C230, transparent)', animation: 'dasLine .9s ease-out 2.1s forwards' }} />
        <p style={{ margin: '14px 0 0', fontSize: 12.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)',
          opacity: 0, animation: 'dasFade .9s ease-out 2.4s forwards' }}>School Management System</p>
      </div>

      {/* Upau wa maendeleo */}
      <div aria-hidden style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 44px)', left: '50%', width: 120, height: 3,
        marginLeft: -60, borderRadius: 3, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
        <div style={{ height: '100%', transformOrigin: 'left', background: 'linear-gradient(90deg, #2FB59F, #F2C230)',
          animation: `dasBar ${SHOW_MS - 300}ms cubic-bezier(.4,0,.2,1) .2s forwards`, transform: 'scaleX(0)' }} />
      </div>
    </div>
  );
}
