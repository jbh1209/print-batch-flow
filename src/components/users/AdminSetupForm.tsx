
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUsers } from '@/contexts/UserContext';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AdminSetupFormProps {
  onAdminCreated?: () => void;
}

export function AdminSetupForm({ onAdminCreated }: AdminSetupFormProps) {
  const { user } = useAuth();
  const { addAdminRole } = useUsers();
  const [userId, setUserId] = useState(user?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    
    if (!userId.trim()) {
      setError('Please enter a valid user ID');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await addAdminRole(userId);
      setSuccess(true);
      
      // Reload after a short delay
      setTimeout(() => {
        if (onAdminCreated) {
          onAdminCreated();
        } else {
          window.location.reload();
        }
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to set admin role');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initial Admin Setup</CardTitle>
          <CardDescription>
            No administrators are configured. Set up the first administrator account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert variant="success" className="bg-green-50 border-green-200 text-green-800">
                <AlertDescription>
                  Admin role successfully assigned! Refreshing the page...
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium">
                User ID
              </label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full"
              />
              
              {user && (
                <p className="text-sm text-muted-foreground mt-2">
                  Your user ID: <span className="font-mono font-semibold">{user.id}</span>
                  <Button 
                    type="button"
                    variant="link"
                    className="px-2 py-0 h-auto text-xs"
                    onClick={() => setUserId(user.id)}
                  >
                    Use my ID
                  </Button>
                </p>
              )}
              
              <p className="text-sm text-muted-foreground">
                To make yourself an admin, use your own user ID shown above.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up admin...
                </>
              ) : (
                'Set as Administrator'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
