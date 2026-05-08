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
    <div className="min-h-screen flex">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <div className="mb-8">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-24 h-24 object-contain mb-6" />
            <h1 className="text-3xl font-display font-bold mb-2">DAARUL-ARQAM</h1>
            <h2 className="text-2xl font-display font-semibold mb-4">SCHOOLS</h2>
            <p className="text-lg text-primary-foreground/80">Exam Results Management System</p>
          </div>
          
          <div className="space-y-4 mt-8">
            {[
              { icon: UserCheck, title: 'Admin', desc: 'Full system control' },
              { icon: User, title: 'Teacher', desc: 'Marks entry & reports' },
              { icon: Hash, title: 'Parent', desc: "View child's results" },
              { icon: FileText, title: 'Secretary', desc: 'Student admission' },
              { icon: DollarSign, title: 'Accountant', desc: 'Fee management' },
              { icon: School, title: 'Head of School', desc: 'Section oversight' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-primary-foreground/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden text-center">
            <img src={dasLogo} alt="Daarul Arqam Logo" className="w-20 h-20 object-contain mx-auto mb-4" />
            <h1 className="text-xl font-display font-bold text-foreground">DAARUL-ARQAM</h1>
            <p className="text-sm text-muted-foreground">SCHOOLS</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive animate-scale-in">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="admin" className="text-xs">Admin</TabsTrigger>
              <TabsTrigger value="teacher" className="text-xs">Teacher</TabsTrigger>
              <TabsTrigger value="parent" className="text-xs">Parent</TabsTrigger>
              <TabsTrigger value="secretary" className="text-xs">Secretary</TabsTrigger>
              <TabsTrigger value="accountant" className="text-xs">Accountant</TabsTrigger>
              <TabsTrigger value="head" className="text-xs">Head</TabsTrigger>
            </TabsList>

            {/* Admin Login */}
            <TabsContent value="admin" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-foreground">Administrator</h2>
                <p className="text-muted-foreground mt-2">Login as system administrator</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsAdmin(adminUsername, adminPassword), "Welcome Admin!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="admin-username" type="text" placeholder="Enter username" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
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
                <h2 className="text-2xl font-display font-bold text-foreground">Teacher</h2>
                <p className="text-muted-foreground mt-2">Login with credentials provided by admin</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsTeacher(teacherName, teacherPassword), "Welcome Teacher!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="teacher-name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="teacher-name" type="text" placeholder="Enter your name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-password">Password</Label>
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
                <h2 className="text-2xl font-display font-bold text-foreground">Parent</h2>
                <p className="text-muted-foreground mt-2">Login with your child's information</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsParent(studentName, studentRollNumber), "Welcome Parent!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="student-name">Student Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="student-name" type="text" placeholder="Enter your child's name" value={studentName} onChange={(e) => setStudentName(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-roll">Student ID Number</Label>
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
                <h2 className="text-2xl font-display font-bold text-foreground">Secretary</h2>
                <p className="text-muted-foreground mt-2">Login to manage admissions</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsSecretary(secretaryUsername, secretaryPassword), "Welcome Secretary!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="secretary-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="secretary-username" type="text" placeholder="Enter username" value={secretaryUsername} onChange={(e) => setSecretaryUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretary-password">Password</Label>
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
                <h2 className="text-2xl font-display font-bold text-foreground">Accountant</h2>
                <p className="text-muted-foreground mt-2">Login to manage fees and payments</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsAccountant(accountantUsername, accountantPassword), "Welcome Accountant!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="accountant-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="accountant-username" type="text" placeholder="Enter username" value={accountantUsername} onChange={(e) => setAccountantUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountant-password">Password</Label>
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
                <h2 className="text-2xl font-display font-bold text-foreground">Head of School</h2>
                <p className="text-muted-foreground mt-2">Login to manage your section</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleLogin(() => loginAsHeadOfSchool(headUsername, headPassword), "Welcome Head of School!"); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="head-username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input id="head-username" type="text" placeholder="Enter username" value={headUsername} onChange={(e) => setHeadUsername(e.target.value)} className="pl-10 input-enhanced" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="head-password">Password</Label>
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
