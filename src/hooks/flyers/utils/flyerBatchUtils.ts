
import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a unique batch number for flyer batches with DXB-FL prefix
 */
export const generateFlyerBatchNumber = async (): Promise<string> => {
  try {
    // Get the count of existing flyer batches only (with DXB-FL prefix)
    const { data, error } = await supabase
      .from('batches')
      .select('name')
      .ilike('name', 'DXB-FL-%');
    
    if (error) throw error;
    
    // Extract numbers from existing batch names
    let nextNumber = 1;
    if (data && data.length > 0) {
      const numbers = data.map(batch => {
        const match = batch.name.match(/DXB-FL-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      
      // Find the highest number and increment
      nextNumber = Math.max(0, ...numbers) + 1;
    }
    
    // Format with 5 digits padding
    const batchNumber = `DXB-FL-${nextNumber.toString().padStart(5, '0')}`;
    
    return batchNumber;
  } catch (err) {
    console.error('Error generating batch number:', err);
    return `DXB-FL-${new Date().getTime().toString().substr(-5).padStart(5, '0')}`; // Fallback using timestamp
  }
};
