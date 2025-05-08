import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cleanupAuthState } from '@/services/auth/authService';
interface LocationState {
  from?: {
    pathname: string;
  };
}
const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isLoading: authLoading
  } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<string>('login');

  // Get the location state for redirect after login
  const state = location.state as LocationState;
  const from = state?.from?.pathname || '/';
  useEffect(() => {
    // Redirect if already logged in
    if (user && !authLoading) {
      navigate(from, {
        replace: true
      });
    }
  }, [user, navigate, from, authLoading]);

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!loginEmail || !loginPassword) {
      setErrorMessage('Please enter both email and password');
      return;
    }
    setIsLoading(true);
    try {
      // Clean up any existing auth state
      cleanupAuthState();

      // Attempt sign in
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });
      if (error) throw error;
      toast.success("Login successful!");
      navigate(from, {
        replace: true
      });
    } catch (error: any) {
      console.error("Auth error:", error);
      setErrorMessage(error.message || 'Error signing in');
      if (error.message?.includes('Invalid login')) {
        setErrorMessage('Invalid email or password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle signup form submission
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!signupEmail || !signupPassword) {
      setErrorMessage('Please enter email and password');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    setIsLoading(true);
    try {
      // Clean up any existing auth state
      cleanupAuthState();

      // Attempt sign up
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
      toast.success("Signup successful! Please check your email to verify your account.");
      setActiveTab('login');
    } catch (error: any) {
      console.error("Signup error:", error);
      setErrorMessage(error.message || 'Error signing up');
    } finally {
      setIsLoading(false);
    }
  };

  // While checking auth status
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">
        <Spinner size={40} />
      </div>;
  }
  return <div className="flex justify-center items-center min-h-screen bg-gray-50 bg-cover bg-center bg-no-repeat" style={{
    backgroundImage: "url('/HPIndigo12000DigitalPressImage_LR.jpg')",
    backgroundSize: 'cover'
  }}>
      <div className="w-full max-w-md px-4 z-10">
        <Card className="backdrop-blur-sm bg-white/90 shadow-xl">
          <CardHeader className="space-y-1 bg-batchflow-secondary">
            <CardTitle className="text-2xl font-bold text-center">BatchFlow</CardTitle>
            <CardDescription className="text-center text-white">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <div className="px-6">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </div>
            
            {errorMessage && <div className="px-6 pt-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              </div>}
            
            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Enter your email" required className="bg-white/50 backdrop-blur-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Enter your password" required className="bg-white/50 backdrop-blur-sm" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <>
                        <Spinner size={16} className="mr-2" /> 
                        Signing in...
                      </> : "Sign In"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input id="full-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" className="bg-white/50 backdrop-blur-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="Enter your email" required className="bg-white/50 backdrop-blur-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="Create a password" required className="bg-white/50 backdrop-blur-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input id="signup-confirm-password" type="password" value={signupConfirmPassword} onChange={e => setSignupConfirmPassword(e.target.value)} placeholder="Confirm your password" required className="bg-white/50 backdrop-blur-sm" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <>
                        <Spinner size={16} className="mr-2" /> 
                        Creating account...
                      </> : "Create Account"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>;
};
export default Auth;