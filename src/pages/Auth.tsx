
import { Spinner } from '@/components/ui/spinner';
import AuthForm from '@/components/auth/AuthForm';
import { useAuthPage } from '@/hooks/auth/useAuthPage';

const Auth = () => {
  const {
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
    authLoading
  } = useAuthPage();

  // While checking auth status
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size={40} />
      </div>
    );
  }
  
  return (
    <div 
      className="flex justify-center items-center min-h-screen bg-gray-50 bg-cover bg-center bg-no-repeat" 
      style={{
        backgroundImage: "url('/HPIndigo12000DigitalPressImage_LR.jpg')",
        backgroundSize: 'cover'
      }}
    >
      <div className="w-full max-w-md px-4 z-10">
        <AuthForm 
          handlePreviewEntry={handlePreviewEntry}
          isLovablePreview={isLovablePreview}
          errorMessage={errorMessage}
          isLoading={isLoading}
          handleLogin={handleLogin}
          handleSignup={handleSignup}
          loginEmail={loginEmail}
          setLoginEmail={setLoginEmail}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          signupEmail={signupEmail}
          setSignupEmail={setSignupEmail}
          signupPassword={signupPassword}
          setSignupPassword={setSignupPassword}
          signupConfirmPassword={signupConfirmPassword}
          setSignupConfirmPassword={setSignupConfirmPassword}
          fullName={fullName}
          setFullName={setFullName}
        />
      </div>
    </div>
  );
};

export default Auth;
