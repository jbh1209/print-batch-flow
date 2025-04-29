
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function InitialAdminSetup() {
  const [email, setEmail] = useState("james@impressweb.co.za");
  const [password, setPassword] = useState("Hawkeye@12209");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    
    try {
      // Register the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Assign admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: data.user.id, role: 'admin' }
          ]);
          
        if (roleError) throw roleError;
        
        toast.success('Admin account created successfully!');
        toast.info('You can now sign in with your credentials');
        
        // Sign the user in
        await supabase.auth.signInWithPassword({
          email,
          password
        });
      }
    } catch (error: any) {
      toast.error(`Error creating admin account: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto mt-12">
      <CardHeader>
        <CardTitle>Create Admin Account</CardTitle>
        <CardDescription>Set up your admin account to manage the application</CardDescription>
      </CardHeader>
      <form onSubmit={handleCreateAdmin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              required
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
