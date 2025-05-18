
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cleanupAuthState } from '@/services/auth/authService';
import { toast } from 'sonner';

// Check if we're in Lovable preview mode
const isLovablePreview = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));

interface LocationState {
  from?: {
    pathname: string;
  };
}

export const useAuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Get the location state for redirect after login
  const state = location.state as LocationState;
  const from = state?.from?.pathname || '/';

  useEffect(() => {
    // Redirect if already logged in
    if (user && !authLoading) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from, authLoading]);

  // In preview mode, offer a direct entry button
  const handlePreviewEntry = () => {
    if (isLovablePreview) {
      navigate('/');
    }
  };

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    // In preview mode, just redirect to the main page
    if (isLovablePreview) {
      navigate('/', { replace: true });
      return;
    }
    
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
    
    // In preview mode, just redirect to the main page
    if (isLovablePreview) {
      navigate('/', { replace: true });
      return;
    }
    
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
      setLoginEmail(signupEmail);
      setLoginPassword('');
    } catch (error: any) {
      console.error("Signup error:", error);
      setErrorMessage(error.message || 'Error signing up');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    signupEmail,
    setSignupEmail,
    signupPassword,
    setSignupPassword,
    signupConfirmPassword,
    setSignupConfirmPassword,
    fullName,
    setFullName,
    isLoading,
    errorMessage,
    handleLogin,
    handleSignup,
    handlePreviewEntry,
    isLovablePreview,
    authLoading,
  };
};
