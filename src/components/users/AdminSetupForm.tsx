
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import * as userService from "@/services/userService";

export function AdminSetupForm() {
  const { user } = useAuth();
  const { refreshAdminStatus } = useAdminAuth();
  const [userId, setUserId] = useState(user?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSetAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    
    if (!userId.trim()) {
      setErrorMessage("Please enter a valid user ID");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log('🔧 Setting admin role for user:', userId);
      await userService.addAdminRole(userId);
      setSuccessMessage("Admin role successfully assigned! Refreshing...");
      
      // Refresh admin status and reload page
      await refreshAdminStatus();
      setTimeout(() => {
        console.log('🔄 Reloading page after admin setup');
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('❌ Admin setup failed:', error);
      setErrorMessage(error.message || "Failed to set admin role");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Initial Admin Setup</CardTitle>
        <CardDescription>
          No administrators are currently configured. Set up the first administrator account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSetAsAdmin}>
        <CardContent>
          <div className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            {successMessage && (
              <Alert className="bg-green-50 border-green-200 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{successMessage}</AlertDescription>
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
              />
              {user && (
                <p className="text-sm text-gray-500">
                  Your user ID: <span className="font-mono">{user.id}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="text-xs ml-2 h-auto p-1" 
                    onClick={() => setUserId(user.id)}
                  >
                    Use my ID
                  </Button>
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                To make yourself an admin, use your own user ID shown above.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Setting up admin..." : "Set as Administrator"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
