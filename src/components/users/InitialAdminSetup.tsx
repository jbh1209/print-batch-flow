// Import the addAdminRole function instead of using direct RPC call
import React, { useState } from 'react';
import { addAdminRole } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Keep the rest of the component unchanged but update the handleSetupAdmin function

const InitialAdminSetup = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSetupAdmin = async () => {
    if (!user) {
      toast.error("You must be logged in to set up admin");
      return;
    }

    setIsLoading(true);
    try {
      // Use the imported function instead of direct RPC call
      const success = await addAdminRole(user.id);
      
      if (success) {
        toast.success("Admin role setup successful! Refreshing the page...");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error("Failed to set up admin role");
      }
    } catch (error) {
      console.error("Error setting up admin:", error);
      toast.error("Failed to set up admin");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Initial Admin Setup</CardTitle>
          <CardDescription>
            Set up the initial admin user for this application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Click the button below to assign the admin role to your user account.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSetupAdmin} disabled={isLoading}>
            {isLoading ? "Setting up Admin..." : "Setup Admin"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
  // Rest of component unchanged
};

export default InitialAdminSetup;
