
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

interface AuthFormProps {
  handlePreviewEntry: () => void;
  isLovablePreview: boolean;
  errorMessage: string;
  isLoading: boolean;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleSignup: (e: React.FormEvent) => Promise<void>;
  loginEmail: string;
  setLoginEmail: (value: string) => void;
  loginPassword: string;
  setLoginPassword: (value: string) => void;
  signupEmail: string;
  setSignupEmail: (value: string) => void;
  signupPassword: string;
  setSignupPassword: (value: string) => void;
  signupConfirmPassword: string;
  setSignupConfirmPassword: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
}

const AuthForm = ({
  handlePreviewEntry,
  isLovablePreview,
  errorMessage,
  isLoading,
  handleLogin,
  handleSignup,
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
  setFullName
}: AuthFormProps) => {
  const [activeTab, setActiveTab] = useState<string>('login');

  return (
    <Card className="backdrop-blur-sm bg-white/90 shadow-xl">
      <CardHeader className="space-y-1 bg-batchflow-secondary">
        <CardTitle className="text-2xl font-bold text-center">BatchFlow</CardTitle>
        <CardDescription className="text-center text-white">
          {isLovablePreview 
            ? 'Preview Mode Active' 
            : 'Sign in to your account or create a new one'}
        </CardDescription>
      </CardHeader>
      
      {isLovablePreview && (
        <div className="p-4">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-blue-700">
              You're in preview mode. Click below to enter the application.
            </AlertDescription>
          </Alert>
          <Button 
            className="w-full mt-4" 
            onClick={handlePreviewEntry}
          >
            Enter Application Preview
          </Button>
        </div>
      )}
      
      {!isLovablePreview && (
        <>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <div className="px-6">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login" className="bg-rose-600 hover:bg-rose-500 text-white">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </div>
            
            {errorMessage && (
              <div className="px-6 pt-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              </div>
            )}
            
            <TabsContent value="login">
              <LoginForm 
                handleLogin={handleLogin}
                email={loginEmail}
                setEmail={setLoginEmail}
                password={loginPassword}
                setPassword={setLoginPassword}
                isLoading={isLoading}
              />
            </TabsContent>
            
            <TabsContent value="signup">
              <SignupForm
                handleSignup={handleSignup}
                fullName={fullName}
                setFullName={setFullName}
                email={signupEmail}
                setEmail={setSignupEmail}
                password={signupPassword}
                setPassword={setSignupPassword}
                confirmPassword={signupConfirmPassword}
                setConfirmPassword={setSignupConfirmPassword}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </Card>
  );
};

export default AuthForm;
