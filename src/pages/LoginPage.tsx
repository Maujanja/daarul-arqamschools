import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Eye, EyeOff, AlertCircle, User, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import dasLogo from '@/assets/das-logo.png';

type RoleKey = 'admin' | 'teacher' | 'parent' | 'secretary' | 'accountant' | 'head';
type LoginResult = { success: boolean; error?: string };

interface RoleConfig {
  heading: string;
  subtitle: string;
  welcome: string;
  field1: { label: string; placeholder: string; icon: 'user' | 'hash' };
  field2: { label: string; placeholder: string; secret: boolean };
}

const ROLES: Record<RoleKey, RoleConfig> = {
  admin: {
    heading: 'Administrator', subtitle: 'Login as system administrator', welcome: 'Welcome Admin!',
    field1: { label: 'Username', placeholder: 'Enter username', icon: 'user' },
    field2: { label: 'Password', placeholder: 'Enter password', secret: true },
  },
  teacher: {
    heading: 'Teacher', subtitle: 'Login with credentials provided by admin', welcome: 'Welcome Teacher!',
    field1: { label: 'Name', placeholder: 'Enter your name', icon: 'user' },
    field2: { label: 'Password', placeholder: 'Enter your password', secret: true },
  },
  parent: {
    heading: 'Parent', subtitle: "Login with your child's information", welcome: 'Welcome Parent!',
    field1: { label: 'Student Name', placeholder: "Enter your child's name", icon: 'user' },
    field2: { label: 'Student ID Number', placeholder: "Enter your child's ID number", secret: false },
  },
  secretary: {
    heading: 'Secretary', subtitle: 'Login to manage admissions', welcome: 'Welcome Secretary!',
    field1: { label: 'Username', placeholder: 'Enter username', icon: 'user' },
    field2: { label: 'Password', placeholder: 'Enter password', secret: true },
  },
  accountant: {
    heading: 'Accountant', subtitle: 'Login to manage fees and payments', welcome: 'Welcome Accountant!',
    field1: { label: 'Username', placeholder: 'Enter username', icon: 'user' },
    field2: { label: 'Password', placeholder: 'Enter password', secret: true },
  },
  head: {
    heading: 'Head of School', subtitle: 'Login to manage your section', welcome: 'Welcome Head of School!',
    field1: { label: 'Username', placeholder: 'Enter username', icon: 'user' },
    field2: { label: 'Password', placeholder: 'Enter password', secret: true },
  },
};

const ROW1: RoleKey[] = ['admin', 'teacher', 'parent'];
const ROW2: RoleKey[] = ['secretary', 'accountant', 'head'];
const ROLE_LABEL: Record<RoleKey, string> = {
  admin: 'Admin', teacher: 'Teacher', parent: 'Parent', secretary: 'Secretary', accountant: 'Accountant', head: 'Head',
};

function LoginSpinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      Logging in...
    </span>
  );
}

interface Beam {
  tlX: number; trX: number; tY: number; blX: number; brX: number; bY: number;
  ctlX: number; ctrX: number; cblX: number; cbrX: number; cx: number; cy: number;
}
const EMPTY_BEAM: Beam = { tlX: 0, trX: 0, tY: 0, blX: 0, brX: 0, bY: 0, ctlX: 0, ctrX: 0, cblX: 0, cbrX: 0, cx: 0, cy: 0 };

export default function LoginPage() {
  const [role, setRole] = useState<RoleKey>('admin');
  const [values, setValues] = useState<Record<RoleKey, [string, string]>>({
    admin: ['', ''], teacher: ['', ''], parent: ['', ''], secretary: ['', ''], accountant: ['', ''], head: ['', ''],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lampOn, setLampOn] = useState(true);

  const {
    loginAsAdmin, loginAsTeacher, loginAsParent, loginAsSecretary, loginAsAccountant, loginAsHeadOfSchool,
    isAuthenticated, isLoading: authLoading,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const loginFns: Record<RoleKey, (a: string, b: string) => Promise<LoginResult>> = {
    admin: loginAsAdmin, teacher: loginAsTeacher, parent: loginAsParent,
    secretary: loginAsSecretary, accountant: loginAsAccountant, head: loginAsHeadOfSchool,
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) navigate('/dashboard');
  }, [isAuthenticated, authLoading, navigate]);

  /* ---------- Lamp + beam ---------- */
  const cardRef = useRef<HTMLDivElement>(null);
  const lampSvgRef = useRef<SVGSVGElement>(null);
  const lampPivotRef = useRef<HTMLDivElement>(null);
  const conePolyRef = useRef<SVGPolygonElement>(null);
  const corePolyRef = useRef<SVGPolygonElement>(null);
  const glowRef = useRef<SVGEllipseElement>(null);
  const cur = useRef<Beam>({ ...EMPTY_BEAM });
  const dst = useRef<Beam>({ ...EMPTY_BEAM });
  const ready = useRef(false);
  const roleRef = useRef<RoleKey>(role);
  roleRef.current = role;

  const recalc = useCallback(() => {
    const card = cardRef.current;
    const lamp = lampSvgRef.current;
    const pivot = lampPivotRef.current;
    const btn = card?.querySelector<HTMLElement>(`[data-role="${roleRef.current}"]`);
    if (!card || !lamp || !pivot || !btn) return;

    const c = card.getBoundingClientRect();
    const l = lamp.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    // lamp rotates; use its un-rotated centre so measurements stay stable
    const pivotX = c.width / 2;
    const pivotY = l.top - c.top + 2 - 0;

    const targetX = b.left - c.left + b.width / 2;
    const targetY = b.top - c.top + b.height / 2;
    const dx = targetX - pivotX;
    const dy = Math.max(targetY - pivotY, 40);
    const maxRad = (22 * Math.PI) / 180;
    const angle = Math.max(-maxRad, Math.min(maxRad, Math.atan2(dx, dy)));
    pivot.style.transform = `rotate(${(-(angle * 180) / Math.PI).toFixed(2)}deg)`;

    const halfRim = 14, shadeH = 19;
    const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
    const rimCx = pivotX - shadeH * sinA;
    const rimCy = pivotY + shadeH * cosA;
    const tlX = rimCx - halfRim * cosA, trX = rimCx + halfRim * cosA, tY = rimCy;

    const bY = targetY + 46;
    const passLeftX = b.left - c.left - 8;
    const passRightX = b.right - c.left + 8;
    const passY = b.bottom - c.top;
    const f = (bY - tY) / Math.max(passY - tY, 20);
    const blX = tlX + (passLeftX - tlX) * f;
    const brX = trX + (passRightX - trX) * f;

    const coreHalf = 8;
    dst.current = {
      tlX, trX, tY, blX, brX, bY,
      ctlX: rimCx - coreHalf * cosA, ctrX: rimCx + coreHalf * cosA,
      cblX: blX + (brX - blX) * 0.2, cbrX: brX - (brX - blX) * 0.2,
      cx: targetX, cy: targetY,
    };
    if (!ready.current) { cur.current = { ...dst.current }; ready.current = true; }
  }, []);

  useEffect(() => { recalc(); }, [role, authLoading, recalc]);

  useEffect(() => {
    if (authLoading) return;
    let raf = 0;
    const tick = () => {
      if (ready.current) {
        const k = 0.22;
        const a = cur.current, d = dst.current;
        (Object.keys(a) as (keyof Beam)[]).forEach((key) => { a[key] += (d[key] - a[key]) * k; });
        const f = (n: number) => n.toFixed(1);
        conePolyRef.current?.setAttribute('points', `${f(a.tlX)},${f(a.tY)} ${f(a.trX)},${f(a.tY)} ${f(a.brX)},${f(a.bY)} ${f(a.blX)},${f(a.bY)}`);
        corePolyRef.current?.setAttribute('points', `${f(a.ctlX)},${f(a.tY)} ${f(a.ctrX)},${f(a.tY)} ${f(a.cbrX)},${f(a.bY)} ${f(a.cblX)},${f(a.bY)}`);
        glowRef.current?.setAttribute('cx', f(a.cx));
        glowRef.current?.setAttribute('cy', f(a.cy));
      }
      raf = requestAnimationFrame(tick);
    };
    const t = setTimeout(recalc, 60);
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', recalc);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', recalc); };
  }, [authLoading, recalc]);

  /* ---------- Login ---------- */
  const handleLogin = async (fn: () => Promise<LoginResult>, welcomeTitle: string) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await fn();
      if (result.success) {
        toast({ title: welcomeTitle, description: 'You have successfully logged in.' });
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cfg = ROLES[role];
  const [v1, v2] = values[role];
  const setVal = (idx: 0 | 1, val: string) =>
    setValues((s) => ({ ...s, [role]: idx === 0 ? [val, s[role][1]] : [s[role][0], val] }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v1.trim() || !v2.trim()) { setError('Please fill in all fields.'); return; }
    handleLogin(() => loginFns[role](v1, v2), cfg.welcome);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const tabClass = (key: RoleKey, row: 1 | 2) => {
    const base = 'py-2 px-2 rounded-[11px] text-center cursor-pointer focus:outline-none transition-all duration-300 relative z-20 ';
    if (key === role) {
      return base + (row === 1
        ? 'bg-[#7251B5] text-white font-bold text-[13px]'
        : 'bg-gradient-to-br from-[#8B68D6] to-[#6846AD] border border-white/85 text-white font-bold text-[12.5px]');
    }
    return base + (row === 1
      ? 'text-[#1E1B2E] font-medium text-[13px] hover:bg-[#7251B5]/10'
      : 'text-white/90 font-medium text-[12.5px] hover:bg-white/15 hover:text-white');
  };
  const tabShadow = (key: RoleKey, row: 1 | 2): React.CSSProperties | undefined =>
    key !== role ? undefined : {
      boxShadow: row === 1
        ? '0 0 20px rgba(255,255,255,0.95), 0 4px 14px rgba(45,28,86,0.45)'
        : '0 0 24px rgba(255,255,255,0.98), 0 4px 18px rgba(255,255,255,0.45)',
    };

  const Field1Icon = cfg.field1.icon === 'hash' ? Hash : User;

  return (
    <div
      className="min-h-[var(--app-viewport-height)] flex items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto overscroll-none touch-pan-y"
      style={{ background: 'radial-gradient(circle at 50% 15%, #372f4a 0%, #241f31 55%, #191622 100%)' }}
    >
      <style>{`
        @keyframes dasCordPull { 0%{transform:translateY(0)} 45%{transform:translateY(6px)} 100%{transform:translateY(0)} }
        .das-cord-pull { animation: dasCordPull .35s ease-out; }
      `}</style>

      <div aria-hidden className="pointer-events-none fixed -top-14 -right-20 w-[340px] h-[340px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(124,92,194,0.24) 0%, rgba(124,92,194,0) 70%)' }} />
      <div aria-hidden className="pointer-events-none fixed -bottom-24 -left-24 w-[380px] h-[380px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(94,71,156,0.22) 0%, rgba(94,71,156,0) 70%)' }} />

      <main
        ref={cardRef}
        data-login-glass="true"
        className="relative w-full max-w-[382px] rounded-[26px] overflow-hidden px-6 pt-0 pb-7 z-10 border border-white/20"
        style={{
          background: 'linear-gradient(180deg, rgba(124,88,198,0.90) 0%, rgba(93,68,156,0.92) 44%, rgba(44,41,78,0.96) 100%)',
          boxShadow: '0 24px 55px rgba(10,8,18,0.65), inset 0 1px 1px rgba(255,255,255,0.28)',
        }}
      >
        {/* Light beam */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-10 transition-opacity duration-300"
          style={{ opacity: lampOn ? 1 : 0 }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="dasConeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
              <stop offset="32%" stopColor="#FFFDF5" stopOpacity="0.78" />
              <stop offset="68%" stopColor="#FFFFFF" stopOpacity="0.42" />
              <stop offset="90%" stopColor="#FFFFFF" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="dasCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.76" />
              <stop offset="82%" stopColor="#FFFFFF" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="dasSpotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#FFFBEB" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <filter id="dasSoftBlur" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="3" /></filter>
            <filter id="dasGlowBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6.5" /></filter>
          </defs>
          <polygon ref={conePolyRef} points="0,0 0,0 0,0 0,0" fill="url(#dasConeGrad)" filter="url(#dasSoftBlur)" />
          <polygon ref={corePolyRef} points="0,0 0,0 0,0 0,0" fill="url(#dasCoreGrad)" />
          <ellipse ref={glowRef} cx="190" cy="215" rx="70" ry="28" fill="url(#dasSpotGlow)" filter="url(#dasGlowBlur)" />
        </svg>

        {/* Lamp */}
        <div className="relative z-30 flex flex-col items-center justify-start">
          <div className="w-[2px] h-3.5 bg-[#1B1829]" />
          <div
            ref={lampPivotRef}
            className="relative flex flex-col items-center"
            style={{ transformOrigin: '50% 0px', transition: 'transform 0.55s cubic-bezier(0.22,1.25,0.36,1)', willChange: 'transform' }}
          >
            <svg ref={lampSvgRef} width="40" height="21" viewBox="0 0 40 21" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
              <path d="M 16,3 C 16,0.8 24,0.8 24,3 L 25,5.5 L 15,5.5 Z" fill="#1B1829" />
              <path d="M 15,5.5 C 7.5,7.5 4,13.5 3,19.2 C 3,20 3.8,20.4 4.8,20.4 L 35.2,20.4 C 36.2,20.4 37,20 37,19.2 C 36,13.5 32.5,7.5 25,5.5 Z" fill="#1B1829" />
              <path d="M 12.5,7.5 C 9.5,9.5 7.5,13.5 7,17.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
              <ellipse cx="20" cy="20.1" rx="15" ry="2.2" fill={lampOn ? '#FFFFFF' : '#64748B'} />
            </svg>
            <button
              type="button"
              title="Zima/Washa Taa"
              aria-label="Toggle lamp light"
              onClick={(e) => {
                setLampOn((v) => !v);
                const el = e.currentTarget;
                el.classList.remove('das-cord-pull');
                void el.offsetWidth;
                el.classList.add('das-cord-pull');
              }}
              className="group absolute -right-2.5 top-3.5 flex flex-col items-center cursor-pointer focus:outline-none p-0.5"
            >
              <span className="w-[1px] h-2.5 bg-[#1B1829]/80" />
              <span className="w-1.5 h-2 rounded-full bg-[#F7C825] shadow-sm group-hover:scale-125 transition-transform" />
            </button>
          </div>
        </div>

        {/* Logo + title */}
        <div className="relative z-20 flex flex-col items-center text-center mt-1.5">
          <div className="w-[82px] h-[82px] rounded-full overflow-hidden ring-2 ring-white/35 shadow-[0_8px_22px_rgba(0,0,0,0.45)] bg-[#23265B]">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-full h-full object-cover scale-[1.06] rounded-full" />
          </div>
          <h1 className="mt-2.5 text-[20px] font-extrabold tracking-wide text-white leading-tight">DAARUL-ARQAM</h1>
          <p className="text-[13px] font-medium tracking-[0.14em] text-white/75 mt-0.5">SCHOOLS</p>
        </div>

        {/* Role selector */}
        <div className="relative z-20 mt-5">
          <div className="bg-white rounded-[14px] p-1 grid grid-cols-3 gap-1 shadow-md">
            {ROW1.map((k) => (
              <button key={k} type="button" data-role={k} onClick={() => { setRole(k); setError(''); }}
                className={tabClass(k, 1)} style={tabShadow(k, 1)}>{ROLE_LABEL[k]}</button>
            ))}
          </div>
          <div className="mt-1.5 px-1 grid grid-cols-3 gap-1">
            {ROW2.map((k) => (
              <button key={k} type="button" data-role={k} onClick={() => { setRole(k); setError(''); }}
                className={tabClass(k, 2)} style={tabShadow(k, 2)}>{ROLE_LABEL[k]}</button>
            ))}
          </div>
        </div>

        {/* Heading */}
        <div className="relative z-20 text-center mt-4 mb-5">
          <h2 className="text-[22px] font-bold text-white tracking-tight">{cfg.heading}</h2>
          <p className="text-[13.5px] text-white/75 mt-0.5">{cfg.subtitle}</p>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="relative z-20 space-y-4" noValidate>
          <div>
            <label htmlFor="login-field-1" className="block text-[13px] font-medium text-white/95 mb-1.5">{cfg.field1.label}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Field1Icon className="w-[18px] h-[18px]" />
              </span>
              <input
                id="login-field-1" type="text" autoComplete="username" placeholder={cfg.field1.placeholder}
                value={v1} onChange={(e) => setVal(0, e.target.value)}
                className="w-full h-[46px] pl-10 pr-4 rounded-[12px] bg-white text-slate-800 text-[14px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1CB5E0] shadow-sm transition"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-field-2" className="block text-[13px] font-medium text-white/95 mb-1.5">{cfg.field2.label}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                {cfg.field2.secret ? <Lock className="w-[18px] h-[18px]" /> : <Hash className="w-[18px] h-[18px]" />}
              </span>
              <input
                id="login-field-2"
                type={cfg.field2.secret && !showPassword ? 'password' : 'text'}
                autoComplete={cfg.field2.secret ? 'current-password' : 'off'}
                placeholder={cfg.field2.placeholder}
                value={v2} onChange={(e) => setVal(1, e.target.value)}
                className="w-full h-[46px] pl-10 pr-11 rounded-[12px] bg-white text-slate-800 text-[14px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1CB5E0] shadow-sm transition"
              />
              {cfg.field2.secret && (
                <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer">
                  {showPassword ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-[11px] px-3 py-2 text-[12px] font-medium bg-rose-500/25 border border-rose-300/40 text-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="pt-1.5">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[48px] rounded-[12px] text-white font-semibold text-[15px] tracking-wide cursor-pointer focus:outline-none transition hover:brightness-105 active:scale-[0.985] disabled:opacity-70"
              style={{ background: 'linear-gradient(90deg, #1CB5E0 0%, #26C281 100%)', boxShadow: '0 8px 20px -4px rgba(28,181,224,0.45)' }}
            >
              {isLoading ? <LoginSpinner /> : 'Login'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
