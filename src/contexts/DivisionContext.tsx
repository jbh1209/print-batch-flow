import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Division {
  code: string;
  name: string;
  color: string;
  icon: string;
}

interface DivisionContextType {
  selectedDivision: string;
  setSelectedDivision: (code: string) => void;
  availableDivisions: Division[];
  currentDivision: Division | null;
  isLoading: boolean;
}

const DivisionContext = createContext<DivisionContextType | undefined>(undefined);

export const DivisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedDivision, setSelectedDivisionState] = useState<string>(() => {
    return localStorage.getItem('selected_division') || 'DIG';
  });
  const [availableDivisions, setAvailableDivisions] = useState<Division[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDivisions = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Get user's division assignments directly
        const { data: userDivisions } = await supabase
          .from('user_division_assignments')
          .select('division_code, is_primary')
          .eq('user_id', user.id);

        const divisionCodes = userDivisions?.map(ud => ud.division_code) || ['DIG'];
        const primaryDivision = userDivisions?.find(ud => ud.is_primary)?.division_code;

        // Fetch division details
        const { data: divisions } = await supabase
          .from('divisions')
          .select('*')
          .in('code', divisionCodes)
          .eq('is_active', true)
          .order('sort_order');

        setAvailableDivisions(divisions || []);
        
        // If selected division is not accessible, switch to primary or first available
        if (!divisionCodes.includes(selectedDivision)) {
          setSelectedDivisionState(primaryDivision || divisions?.[0]?.code || 'DIG');
        }
      } catch (error) {
        console.error('Failed to fetch divisions:', error);
        setAvailableDivisions([{ 
          code: 'DIG', 
          name: 'Digital', 
          color: '#3B82F6', 
          icon: 'printer' 
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDivisions();
  }, [user, selectedDivision]);

  const setSelectedDivision = (code: string) => {
    setSelectedDivisionState(code);
    localStorage.setItem('selected_division', code);
  };

  const currentDivision = availableDivisions.find(d => d.code === selectedDivision) || null;

  return (
    <DivisionContext.Provider value={{
      selectedDivision,
      setSelectedDivision,
      availableDivisions,
      currentDivision,
      isLoading
    }}>
      {children}
    </DivisionContext.Provider>
  );
};

export const useDivision = () => {
  const context = useContext(DivisionContext);
  if (!context) {
    throw new Error('useDivision must be used within DivisionProvider');
  }
  return context;
};
