import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Spinner } from '@/components/ui/spinner';
import { 
  castToUUID, 
  prepareUpdateParams,
  toSafeString
} from "@/utils/database/dbHelpers";

// Replace processDbFields with explicit adapters from typeAdapters
import { adaptUserProfile } from "@/utils/database/typeAdapters";

interface AuthContextProps {
  user: User | null | undefined;
  session: Session | null | undefined;
  isLoading: boolean;
  signOut: () => Promise<void>;
  updateUserProfile: (fullName: string, avatarUrl: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: undefined,
  session: undefined,
  isLoading: true,
  signOut: async () => {},
  updateUserProfile: async () => {},
});

interface AuthContextProviderProps {
  children: React.ReactNode;
}

export const AuthContextProvider: React.FC<AuthContextProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        setSession(session);
        setUser(session?.user || null);
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      setSession(session || null);
    });
  }, []);

  // Function to update user profile data
  const updateUserProfile = async (fullName: string, avatarUrl: string) => {
    if (!user) {
      console.error("No user to update profile for.");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Prepare update parameters
      const updates = prepareUpdateParams({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });
      
      console.log("Updating user profile with:", updates);

      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { returning: 'minimal' });

      if (error) {
        throw error;
      }
      
      // Update user state
      setUser(prevState => ({
        ...prevState,
        user_metadata: {
          ...prevState?.user_metadata,
          full_name: fullName,
          avatar_url: avatarUrl,
        },
      } as User));
      
      console.log("User profile updated successfully");
      
    } catch (error) {
      console.error("Error updating user profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = { user, session, isLoading, signOut, updateUserProfile };

  return (
    <AuthContext.Provider value={value}>
      {isLoading ? <div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
};
