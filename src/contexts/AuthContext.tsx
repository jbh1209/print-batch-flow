
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeGet, castToUUID, prepareUpdateParams } from "@/utils/database/dbHelpers";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name?: string; avatar_url?: string } | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (fullName: string, avatarUrl?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  isAdmin: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
});

// Export the useAuth hook here so it can be imported directly
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        setSession(data.session);
        setUser(data.session?.user || null);

        if (data.session?.user) {
          await fetchUserProfile(data.session.user.id);
          await checkIfAdmin(data.session.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error getting session:", error);
        setError("Failed to get session");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);
        
        if (newSession?.user) {
          await fetchUserProfile(newSession.user.id);
          await checkIfAdmin(newSession.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const checkIfAdmin = async (userId: string) => {
    try {
      // Use the public function to check admin status
      const { data, error } = await supabase.rpc('is_admin', {
        _user_id: userId
      });

      if (error) {
        console.error("Error checking admin status:", error);
        return;
      }

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", castToUUID(userId))
        .single();

      if (error) {
        // If profile doesn't exist, create one
        if (error.code === "PGRST116") {
          const insertData = prepareUpdateParams({
            id: castToUUID(userId)
          });
          
          await supabase.from("profiles").insert(insertData);
          
          setProfile({ full_name: "", avatar_url: "" });
        } else {
          console.error("Error fetching profile:", error);
        }
        return;
      }

      // Check if data is available before setting profile
      if (data) {
        setProfile({
          full_name: safeGet(data, 'full_name') || "",
          avatar_url: safeGet(data, 'avatar_url') || "",
        });
      } else {
        setProfile({ full_name: "", avatar_url: "" });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success("Signed in successfully");
      navigate("/");
    } catch (error: any) {
      console.error("Error signing in:", error);
      setError(error.message || "Failed to sign in");
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      toast.success(
        "Registration successful! Please check your email to confirm your account."
      );
      navigate("/auth/login");
    } catch (error: any) {
      console.error("Error signing up:", error);
      setError(error.message || "Failed to sign up");
      toast.error(error.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      
      toast.success("Signed out successfully");
      navigate("/auth/login");
    } catch (error: any) {
      console.error("Error signing out:", error);
      setError(error.message || "Failed to sign out");
      toast.error(error.message || "Failed to sign out");
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (fullName: string, avatarUrl?: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const updates = prepareUpdateParams({
        full_name: fullName,
        ...(avatarUrl && { avatar_url: avatarUrl }),
        updated_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", castToUUID(user.id));

      if (error) throw error;
      
      setProfile(prev => ({
        ...prev,
        full_name: fullName,
        ...(avatarUrl && { avatar_url: avatarUrl }),
      }));
      
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setError(error.message || "Failed to update profile");
      toast.error(error.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        error,
        isAdmin,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
