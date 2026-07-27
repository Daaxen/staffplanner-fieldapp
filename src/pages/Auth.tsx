import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar } from 'lucide-react';

const Auth = () => {
  const nav = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'setPassword' | 'reset' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      setMode('setPassword');
    }
  }, []);

  useEffect(() => {
    if (!loading && user && mode === 'login') nav('/');
  }, [user, loading, mode, nav]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) toast.error(error); else nav('/');
  };

  const onSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Password set. Signed in.');
    nav('/');
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Reset link sent if the account exists.');
    setMode('login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-lg bg-sidebar flex items-center justify-center">
            <Calendar className="w-6 h-6 text-sidebar-primary" />
          </div>
          <h1 className="text-xl font-semibold">StaffPlanner</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'setPassword' && 'Set your password'}
            {mode === 'reset' && 'Reset password'}
          </p>
        </div>

        {mode === 'login' && (
          <form onSubmit={onLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            <button type="button" onClick={() => setMode('reset')} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              Forgot password?
            </button>
            <p className="text-xs text-center text-muted-foreground">
              New users are added by an administrator via invitation email.
            </p>
            <button type="button" onClick={() => setMode('signup')} className="text-xs text-muted-foreground hover:text-foreground w-full text-center underline">
              First-time setup: create initial admin account
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await supabase.auth.signUp({
              email, password,
              options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth` },
            });
            setBusy(false);
            if (error) return toast.error(error.message);
            toast.success('Account created — check your email to confirm, then sign in.');
            setMode('login');
          }} className="space-y-4">
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded">
              The very first account created becomes admin automatically. After that, all users must be invited by an admin.
            </p>
            <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
            <button type="button" onClick={() => setMode('login')} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">Back to sign in</button>
          </form>
        )}

        {mode === 'setPassword' && (
          <form onSubmit={onSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newpw">New password</Label>
              <Input id="newpw" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Set password & continue'}</Button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={onReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remail">Email</Label>
              <Input id="remail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
            <button type="button" onClick={() => setMode('login')} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;
