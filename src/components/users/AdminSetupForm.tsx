
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdminSetupFormProps {
  refreshUsers: () => Promise<void>;
}

export function AdminSetupForm({ refreshUsers }: AdminSetupFormProps) {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Auto-fill the user ID when the component mounts and user is available
  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
    }
  }, [user]);

  const handleSetAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    
    if (!userId.trim()) {
      setErrorMessage("Please enter a valid user ID");
      toast.error("Please enter a valid user ID");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the add_admin_role database function
      const { error } = await supabase.rpc('add_admin_role', {
        admin_user_id: userId
      });
      
      if (error) throw error;
      
      setSuccessMessage("Admin role successfully assigned!");
      toast.success("Admin role successfully assigned");
      
      // Reload users data after a short delay
      setTimeout(async () => {
        await refreshUsers();
      }, 1500);
    } catch (error: any) {
      console.error("Error setting admin role:", error);
      setErrorMessage(error.message || "Failed to set admin role");
      toast.error(`Failed to set admin role: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          Initial Admin Setup Required
        </CardTitle>
        <CardDescription>
          No administrators are currently configured. Set up the first administrator account to manage users.
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
                disabled={isSubmitting}
              />
              {user && (
                <p className="text-sm text-gray-500">
                  Your user ID: <span className="font-mono">{user.id}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="text-xs ml-2 h-auto p-1" 
                    onClick={() => setUserId(user.id)}
                    disabled={isSubmitting}
                  >
                    Use my ID
                  </Button>
                </p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                To make yourself an admin, use your own user ID shown above.
                This is typically what you want to do if you're setting up the application for the first time.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up admin...
              </>
            ) : (
              "Set as Administrator"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
