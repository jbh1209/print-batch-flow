
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function AdminSetupForm() {
  const { user } = useAuth();
  const [userId, setUserId] = useState(user?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSetAsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId.trim()) {
      toast.error("Please enter a valid user ID");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Call the add_admin_role function
      const { data, error } = await supabase.rpc('add_admin_role', {
        admin_user_id: userId
      });
      
      if (error) throw error;
      
      toast.success("User has been granted admin privileges");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Error setting admin role:", error);
      toast.error(`Failed to set admin role: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin Setup</CardTitle>
        <CardDescription>
          No administrators configured. Use this form to set up an initial administrator.
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
                </p>
              )}
              <p className="text-sm text-gray-500">
                Enter the User ID you want to make an administrator. You can use your own ID shown above.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Setting up admin..." : "Set as Administrator"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
