
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InitialAdminSetup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("Admin User");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Step 1: Register the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName
          }
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Step 2: Use RPC to add admin role
        const adminUserId = data.user.id;
        
        const { error: roleError } = await supabase.rpc('add_admin_role', { 
          admin_user_id: adminUserId 
        });
          
        if (roleError) throw roleError;
        
        toast.success('Admin account created successfully!');
        toast.info('Signing in with your new admin account...');
        
        // Sign the user in with the new credentials
        await supabase.auth.signInWithPassword({
          email,
          password
        });
      }
    } catch (error: any) {
      console.error("Admin creation error:", error);
      toast.error(`Error creating admin account: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Admin Account</CardTitle>
        <CardDescription>Set up your admin account to manage the application</CardDescription>
      </CardHeader>
      <form onSubmit={handleCreateAdmin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input 
              id="fullName" 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Create a secure password"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Admin Account"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
