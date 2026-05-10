import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock, Eye, EyeOff, AlertCircle, User, Hash, UserCheck, FileText, DollarSign, School } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types';
import dasLogo from '@/assets/das-logo.png';
import bgLogin from '@/assets/bg-general.jpg';

function LoginSpinner() {
  return (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      Logging in...
    </span>
  );
}

export default function LoginPage() {
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentRollNumber, setStudentRollNumber] = useState('');
  const [secretaryUsername, setSecretaryUsername] = useState('');
  const [secretaryPassword, setSecretaryPassword] = useState('');
  const [accountantUsername, setAccountantUsername] = useState('');
  const [accountantPassword, setAccountantPassword] = useState('');
  const [headUsername, setHeadUsername] = useState('');
  const [headPassword, setHeadPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { loginAsAdmin, loginAsTeacher, loginAsParent, loginAsSecretary, loginAsAccountant, loginAsHeadOfSchool, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogin = async (fn: () => Promise<{ success: boolean; error?: string }>, welcomeTitle: string) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await fn();
      if (result.success) {
        toast({ title: welcomeTitle, description: "You have successfully logged in." });
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const PasswordToggle = () => (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    >
      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(20,6,43,0.75) 0%, rgba(42,15,77,0.7) 50%, rgba(91,42,140,0.65) 100%), url(${bgLogin})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Decorative purple blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, #9d5bff 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 w-[32rem] h-[32rem] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, #6a2dd1 0%, transparent 70%)' }}
      />

      {/* Glass Card */}
      <div
        data-login-glass="true"
        className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-6 sm:p-8 animate-fade-in"
      >
        <div className="w-full space-y-6">
          <div className="text-center">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-20 h-20 object-contain mx-auto mb-3 drop-shadow-lg" />
            <h1 className="text-xl font-display font-bold text-white">DAARUL-ARQAM</h1>
            <p className="text-sm text-white/70">SCHOOLS</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive animate-scale-in">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="admin" className="text-xs text-black data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Admin</TabsTrigger>
              <TabsTrigger value="teacher" className="text-xs text-black data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Teacher</TabsTrigger>
              <TabsTrigger value="parent" className="text-xs text-black data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Parent</TabsTrigger>
              <TabsTrigger value="secretary" className="text-xs text-white/80 data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Secretary</TabsTrigger>
              <TabsTrigger value="accountant" className="text-xs text-white/80 data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Accountant</TabsTrigger>
              <TabsTrigger value="head" className="text-xs text-white/80 data-[state=active]:text-white data-[state=active]:bg-purple-900/70">Head</TabsTrigger>
            </TabsList>

            {/* Admin Login */}
            <TabsContent value="admin" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Administrator</h2>
                <p className="text-white/80 mt-2">Login as system administrator</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsAdmin(adminUsername, adminPassword), "Welcome Admin!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="admin-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="admin-username" type="text" placeholder="Enter username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="admin-password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="pl-10 pr-10 input-enhanced" required />
                    <PasswordToggle />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>

            {/* Teacher Login */}
            <TabsContent value="teacher" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Teacher</h2>
                <p className="text-white/80 mt-2">Login with credentials provided by admin</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsTeacher(teacherName, teacherPassword), "Welcome Teacher!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="teacher-name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="teacher-name" type="text" placeholder="Enter your name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="teacher-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="teacher-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={teacherPassword} onChange={(e) => setTeacherPassword(e.target.value)} className="pl-10 pr-10 input-enhanced" required />
                    <PasswordToggle />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>

            {/* Parent Login */}
            <TabsContent value="parent" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Parent</h2>
                <p className="text-white/80 mt-2">Login with your child's information</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsParent(studentName, studentRollNumber), "Welcome Parent!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="student-name">Student Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="student-name" type="text" placeholder="Enter your child's name" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="student-roll">Student ID Number</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="student-roll" type="text" placeholder="Enter your child's ID number" value={studentRollNumber} onChange={(e) => setStudentRollNumber(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>

            {/* Secretary Login */}
            <TabsContent value="secretary" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Secretary</h2>
                <p className="text-white/80 mt-2">Login to manage admissions</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsSecretary(secretaryUsername, secretaryPassword), "Welcome Secretary!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="secretary-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="secretary-username" type="text" placeholder="Enter username" value={secretaryUsername} onChange={(e) => setSecretaryUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="secretary-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="secretary-password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={secretaryPassword} onChange={(e) => setSecretaryPassword(e.target.value)} className="pl-10 pr-10 input-enhanced" required />
                    <PasswordToggle />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>

            {/* Accountant Login */}
            <TabsContent value="accountant" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Accountant</h2>
                <p className="text-white/80 mt-2">Login to manage fees and payments</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsAccountant(accountantUsername, accountantPassword), "Welcome Accountant!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="accountant-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="accountant-username" type="text" placeholder="Enter username" value={accountantUsername} onChange={(e) => setAccountantUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="accountant-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="accountant-password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={accountantPassword} onChange={(e) => setAccountantPassword(e.target.value)} className="pl-10 pr-10 input-enhanced" required />
                    <PasswordToggle />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>

            {/* Head of School Login */}
            <TabsContent value="head" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-white drop-shadow">Head of School</h2>
                <p className="text-white/80 mt-2">Login to manage your section</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsHeadOfSchool(headUsername, headPassword), "Welcome Head of School!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="head-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="head-username" type="text" placeholder="Enter username" value={headUsername} onChange={(e) => setHeadUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90" htmlFor="head-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="head-password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" value={headPassword} onChange={(e) => setHeadPassword(e.target.value)} className="pl-10 pr-10 input-enhanced" required />
                    <PasswordToggle />
                  </div>
                </div>
                <Button type="submit" className="w-full btn-gradient h-12 text-base" disabled={isLoading}>
                  {isLoading ? <LoginSpinner /> : 'Login'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
