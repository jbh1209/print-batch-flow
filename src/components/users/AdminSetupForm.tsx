
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function AdminSetupForm() {
  const { user } = useAuth();
  const [userId, setUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill the user ID when the component mounts and user is available
  useEffect(() => {
    if (user?.id) {
      setUserId(user.id);
    }
  }, [user]);

  const handleSetAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId.trim()) {
      toast.error("Please enter a valid user ID");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the add_admin_role database function
      const { data, error } = await supabase.rpc('add_admin_role', {
        admin_user_id: userId
      });
      
      if (error) throw error;
      
      toast.success("Admin role successfully assigned");
      // Reload the page after a short delay to show the updated UI
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Error setting admin role:", error);
      toast.error(`Failed to set admin role: ${error.message}`);
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
