
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Printer {
  id: string;
  name: string;
  type: string;
  location?: string;
  capabilities: any;
  status: 'active' | 'maintenance' | 'offline';
  max_paper_size?: string;
  supported_paper_types?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const usePrinters = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrinters = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching printers...');

      const { data, error: fetchError } = await supabase
        .from('printers')
        .select('*')
        .order('name');

      if (fetchError) {
        console.error('❌ Printers fetch error:', fetchError);
        throw fetchError;
      }

      console.log('✅ Printers fetched successfully:', data?.length || 0);
      
      // Transform the data to ensure proper typing
      const transformedData = data?.map(printer => ({
        ...printer,
        status: printer.status as 'active' | 'maintenance' | 'offline'
      })) || [];
      
      setPrinters(transformedData);
    } catch (err) {
      console.error('❌ Error fetching printers:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load printers";
      setError(errorMessage);
      toast.error("Failed to load printers");
    } finally {
      setIsLoading(false);
    }
  };

  const createPrinter = async (printerData: Omit<Printer, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      console.log('🔄 Creating printer...', printerData);

      const { data, error } = await supabase
        .from('printers')
        .insert([printerData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Printer created successfully');
      toast.success('Printer created successfully');
      await fetchPrinters();
      return data;
    } catch (err) {
      console.error('❌ Error creating printer:', err);
      toast.error('Failed to create printer');
      throw err;
    }
  };

  const updatePrinter = async (id: string, updates: Partial<Printer>) => {
    try {
      console.log('🔄 Updating printer...', { id, updates });

      const { error } = await supabase
        .from('printers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Printer updated successfully');
      toast.success('Printer updated successfully');
      await fetchPrinters();
    } catch (err) {
      console.error('❌ Error updating printer:', err);
      toast.error('Failed to update printer');
      throw err;
    }
  };

  const deletePrinter = async (id: string) => {
    try {
      console.log('🔄 Deleting printer...', id);

      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Printer deleted successfully');
      toast.success('Printer deleted successfully');
      await fetchPrinters();
    } catch (err) {
      console.error('❌ Error deleting printer:', err);
      toast.error('Failed to delete printer');
      throw err;
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  return {
    printers,
    isLoading,
    error,
    fetchPrinters,
    createPrinter,
    updatePrinter,
    deletePrinter
  };
};
