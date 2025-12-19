import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Lock, Eye, EyeOff, AlertCircle, User, Hash, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types';

export default function LoginPage() {
  // Admin login
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Teacher login
  const [teacherName, setTeacherName] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  
  // Parent login
  const [studentName, setStudentName] = useState('');
  const [studentRollNumber, setStudentRollNumber] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { loginAsAdmin, loginAsTeacher, loginAsParent, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginAsAdmin(adminUsername, adminPassword);
      if (result.success) {
        toast({
          title: "Karibu Admin!",
          description: "Umefanikiwa kuingia kama msimamizi.",
        });
        navigate('/dashboard');
      } else {
        setError(result.error || 'Jina au nywila si sahihi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginAsTeacher(teacherName, teacherPassword);
      if (result.success) {
        toast({
          title: "Karibu Mwalimu!",
          description: "Umefanikiwa kuingia.",
        });
        navigate('/dashboard');
      } else {
        setError(result.error || 'Jina au nywila si sahihi');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginAsParent(studentName, studentRollNumber);
      if (result.success) {
        toast({
          title: "Karibu Mzazi!",
          description: "Umefanikiwa kuingia.",
        });
        navigate('/dashboard');
      } else {
        setError(result.error || 'Jina la mwanafunzi au ID si sahihi');
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

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative z-10 flex flex-col justify-center p-12 text-primary-foreground">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 backdrop-blur-sm flex items-center justify-center mb-6">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-display font-bold mb-4">
              EduManage
            </h1>
            <p className="text-xl text-primary-foreground/80">
              Mfumo wa Usimamizi wa Masomo
            </p>
          </div>
          
          <div className="space-y-6 mt-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Admin</h3>
                <p className="text-sm text-primary-foreground/70">Ingia kwa jina la mtumiaji na nywila</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Mwalimu</h3>
                <p className="text-sm text-primary-foreground/70">Ingia kwa jina na nywila uliyopewa na admin</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Mzazi</h3>
                <p className="text-sm text-primary-foreground/70">Ingia kwa jina la mwanao na ID yake</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center mb-4">
              <GraduationCap className="w-10 h-10 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">EduManage</h1>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive animate-scale-in">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="admin">Admin</TabsTrigger>
              <TabsTrigger value="teacher">Mwalimu</TabsTrigger>
              <TabsTrigger value="parent">Mzazi</TabsTrigger>
            </TabsList>

            {/* Admin Login */}
            <TabsContent value="admin" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-foreground">Msimamizi</h2>
                <p className="text-muted-foreground mt-2">Ingia kama msimamizi wa mfumo</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Jina la Mtumiaji</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="admin-username"
                      type="text"
                      placeholder="Ingiza jina la mtumiaji"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="pl-10 input-enhanced"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password">Nywila</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingiza nywila"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="pl-10 pr-10 input-enhanced"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full btn-gradient h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Inaingia...
                    </span>
                  ) : (
                    'Ingia'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Teacher Login */}
            <TabsContent value="teacher" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-foreground">Mwalimu</h2>
                <p className="text-muted-foreground mt-2">Ingia kwa taarifa ulizopewa na admin</p>
              </div>

              <form onSubmit={handleTeacherLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="teacher-name">Jina</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="teacher-name"
                      type="text"
                      placeholder="Ingiza jina lako"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      className="pl-10 input-enhanced"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-password">Nywila</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="teacher-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ingiza nywila yako"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      className="pl-10 pr-10 input-enhanced"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full btn-gradient h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Inaingia...
                    </span>
                  ) : (
                    'Ingia'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Parent Login */}
            <TabsContent value="parent" className="space-y-6 mt-6">
              <div className="text-center lg:text-left">
                <h2 className="text-2xl font-display font-bold text-foreground">Mzazi</h2>
                <p className="text-muted-foreground mt-2">Ingia kwa taarifa za mwanao</p>
              </div>

              <form onSubmit={handleParentLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="student-name">Jina la Mwanafunzi</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="student-name"
                      type="text"
                      placeholder="Ingiza jina la mwanao"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="pl-10 input-enhanced"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-roll">ID Namba ya Mwanafunzi</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="student-roll"
                      type="text"
                      placeholder="Ingiza ID namba ya mwanao"
                      value={studentRollNumber}
                      onChange={(e) => setStudentRollNumber(e.target.value)}
                      className="pl-10 input-enhanced"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full btn-gradient h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Inaingia...
                    </span>
                  ) : (
                    'Ingia'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}