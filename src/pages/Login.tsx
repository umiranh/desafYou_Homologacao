import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validateTextInput } from '@/utils/inputSanitizer';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '', 
    displayName: '' 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(loginData.email, loginData.password);
    
    if (!error) {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  // Password strength validation
  const validatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.match(/[a-z]/)) strength += 25;
    if (password.match(/[A-Z]/)) strength += 25;
    if (password.match(/[0-9]/)) strength += 25;
    return strength;
  };

  const handlePasswordChange = (password: string) => {
    setSignupData({ ...signupData, password });
    setPasswordStrength(validatePasswordStrength(password));
  };

  const getStrengthColor = () => {
    if (passwordStrength < 25) return 'bg-destructive';
    if (passwordStrength < 50) return 'bg-orange-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 25) return 'Muito fraca';
    if (passwordStrength < 50) return 'Fraca';
    if (passwordStrength < 75) return 'Média';
    return 'Forte';
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Erro na confirmação",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }
    
    // Enhanced security validation
    if (signupData.password.length < 8) {
      toast({
        title: "Senha muito fraca",
        description: "A senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      });
      return;
    }

    // Validate display name
    const nameValidation = validateTextInput(signupData.displayName, 50);
    if (!nameValidation.isValid) {
      toast({
        title: "Erro no nome",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }
    
    if (passwordStrength < 50) {
      toast({
        title: "Senha muito fraca",
        description: "Use pelo menos 8 caracteres com letras maiúsculas, minúsculas e números",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signUp(
      signupData.email, 
      signupData.password, 
      signupData.displayName
    );
    
    if (!error) {
      // User will need to verify email first
      setSignupData({ email: '', password: '', confirmPassword: '', displayName: '' });
      setPasswordStrength(0);
    }
    
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="w-full max-w-sm mx-auto space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="text-5xl font-black tracking-tighter">
            <span className="text-primary">DESAF</span>
            <span className="text-accent">YOU</span>
          </div>
        </div>

        <Card className="border-0 shadow-xl backdrop-blur-sm bg-white/90 rounded-3xl overflow-hidden">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/30 rounded-2xl p-1 mx-6 mt-6">
              <TabsTrigger value="login" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-6 px-6 pb-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Usuário"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Senha"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-lg font-semibold" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full h-12 border-2 border-muted rounded-3xl hover:bg-muted/50 bg-white">
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Entrar com Google
                    </Button>
                    
                    <Button variant="outline" className="w-full h-12 border-2 border-muted rounded-3xl hover:bg-muted/50 bg-white">
                      <svg className="w-5 h-5 mr-3" fill="#1877F2" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Entrar com Facebook
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-6 px-6 pb-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Nome completo"
                      value={signupData.displayName}
                      onChange={(e) =>
                        setSignupData({ ...signupData, displayName: e.target.value })
                      }
                      className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={signupData.email}
                      onChange={(e) =>
                        setSignupData({ ...signupData, email: e.target.value })
                      }
                      className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
                      required
                    />
                  </div>
                   <div className="space-y-2">
                     <div className="relative">
                       <Input
                         type={showPassword ? "text" : "password"}
                         placeholder="Senha (mín. 8 caracteres)"
                         value={signupData.password}
                         onChange={(e) => handlePasswordChange(e.target.value)}
                         className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0 pr-12"
                         required
                       />
                       <Button
                         type="button"
                         variant="ghost"
                         size="sm"
                         className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                         onClick={() => setShowPassword(!showPassword)}
                       >
                         {showPassword ? (
                           <EyeOff className="h-4 w-4" />
                         ) : (
                           <Eye className="h-4 w-4" />
                         )}
                       </Button>
                     </div>
                      {signupData.password && (
                        <PasswordStrengthIndicator password={signupData.password} />
                      )}
                   </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Confirmar senha"
                      value={signupData.confirmPassword}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="h-12 bg-transparent border-0 border-b-2 border-muted-foreground/30 rounded-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-0"
                      required
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-lg font-semibold" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}