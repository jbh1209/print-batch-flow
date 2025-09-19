import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cleanupAuthState } from '@/utils/authCleanup';
const Auth = () => {
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    // Redirect if user is already logged in
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }
    setLoading(true);
    try {
      console.log("Attempting login for:", email);

      // Clean up any existing auth state first
      cleanupAuthState();

      // Attempt global sign out first to clear any stuck sessions
      try {
        await supabase.auth.signOut({
          scope: 'global'
        });
      } catch (err) {
        // Continue even if this fails
        console.log('Pre-login signout failed (expected):', err);
      }
      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      console.log("Login successful, user:", data.user?.id);
      toast.success("Login successful!");

      // Redirect to root instead of forcing reload
      navigate('/');
    } catch (error: any) {
      console.error("Auth error:", error);
      setErrorMessage(error.message || 'Error signing in');
      toast.error(`Error signing in: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex justify-center items-center min-h-screen relative" style={{
    backgroundImage: `url('/lovable-uploads/cead37e0-6caa-4eab-aacc-372ee18df48c.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  }}>
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      
      <div className="w-full max-w-md px-4 relative z-10">
        <Card className="backdrop-blur-sm bg-white/90 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-gray-800">Printstream Login</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your printing workflow</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errorMessage && <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>;
};
export default Auth;