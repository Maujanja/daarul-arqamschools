import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const AUTH_STORAGE_KEY = 'edumanage_auth';

export default function SsoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get('token');
    if (!token) {
      setError('Missing SSO token.');
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke('verify-sso', { body: { token } });
      if (error || !data?.success || !data?.user) {
        setError(data?.error || error?.message || 'SSO verification failed.');
        return;
      }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      window.location.replace('/dashboard');
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-destructive mb-2">SSO Login Failed</h1>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              className="text-sm underline text-primary"
              onClick={() => navigate('/login', { replace: true })}
            >
              Go to login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}