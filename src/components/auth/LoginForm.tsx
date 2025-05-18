
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface LoginFormProps {
  handleLogin: (e: React.FormEvent) => Promise<void>;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  isLoading: boolean;
}

const LoginForm = ({
  handleLogin,
  email,
  setEmail,
  password,
  setPassword,
  isLoading
}: LoginFormProps) => {
  return (
    <form onSubmit={handleLogin}>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input 
            id="login-email" 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="Enter your email" 
            required 
            className="bg-white/50 backdrop-blur-sm" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input 
            id="login-password" 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="Enter your password" 
            required 
            className="bg-white/50 backdrop-blur-sm" 
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Spinner size={16} className="mr-2" /> 
              Signing in...
            </>
          ) : "Sign In"}
        </Button>
      </CardFooter>
    </form>
  );
};

export default LoginForm;
