
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Auth = () => {
  const navigate = useNavigate();
  const { user, refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Only redirect if user is already logged in
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
      console.log('Attempting login for:', email);
      
      // Try to sign in with provided credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      if (data.user) {
        console.log('Login successful for user:', data.user.id);
        toast.success("Login successful!");
        
        // Use React Router for navigation instead of page reload
        navigate('/', { replace: true });
      } else {
        throw new Error('Login succeeded but no user returned');
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
      // Try to provide more user-friendly error messages
      let friendlyMessage = error.message || 'Error signing in';
      
      if (error.message?.includes('credentials')) {
        friendlyMessage = 'Invalid email or password. Please try again.';
      } else if (error.message?.includes('rate limit')) {
        friendlyMessage = 'Too many login attempts. Please try again later.';
      } else if (error.message?.toLowerCase().includes('network')) {
        friendlyMessage = 'Network error. Please check your internet connection.';
      }
      
      setErrorMessage(friendlyMessage);
      toast.error(`Error signing in: ${friendlyMessage}`);
      
      // Try to recover session state
      await refreshSession();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex justify-center items-center min-h-screen bg-gray-50 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: "url('/lovable-uploads/b78c999c-7c60-48e9-be2b-97acdea8bb8e.png')",
        backgroundSize: 'cover',
      }}
    >
      <div className="w-full max-w-md px-4 z-10">
        <Card className="backdrop-blur-sm bg-white/90 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">BatchFlow</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="bg-white/50 backdrop-blur-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="bg-white/50 backdrop-blur-sm"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : "Sign In"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
