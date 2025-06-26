
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export const usePublicHolidays = () => {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHolidays = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Failed to fetch holidays');
    } finally {
      setIsLoading(false);
    }
  };

  const addHoliday = async (holiday: Omit<PublicHoliday, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('public_holidays')
        .insert([holiday])
        .select()
        .single();

      if (error) throw error;
      setHolidays(prev => [...prev, data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      toast.success('Holiday added successfully');
      return true;
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
      return false;
    }
  };

  const updateHoliday = async (id: string, updates: Partial<PublicHoliday>) => {
    try {
      const { data, error } = await supabase
        .from('public_holidays')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setHolidays(prev => prev.map(h => h.id === id ? data : h));
      toast.success('Holiday updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast.error('Failed to update holiday');
      return false;
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('public_holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success('Holiday deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
      return false;
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  return {
    holidays,
    isLoading,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    refetch: fetchHolidays
  };
};
