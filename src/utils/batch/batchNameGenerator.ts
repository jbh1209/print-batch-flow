
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getProductTypeCode } from "./productTypeCodes";

// Generate a batch name with the correct prefix format based on product type
export const generateBatchName = async (productType: string): Promise<string> => {
  // Special handling for flyer batches - use dedicated function
  if (productType === "Flyers") {
    return generateFlyerBatchNumber();
  }
  
  // Get the correct code for the product type
  const typeCode = getProductTypeCode(productType);
  
  try {
    // Check for existing batches with this prefix to determine next number
    const { data, error } = await supabase
      .from("batches")
      .select("name")
      .ilike("name", `DXB-${typeCode}-%`);
    
    if (error) {
      console.error("Error counting batches:", error);
      throw error;
    }
    
    // Default to 1 if no batches found
    let nextNumber = 1;
    
    if (data && data.length > 0) {
      // Extract numbers from existing batch names
      const numbers = data.map(batch => {
        const match = batch.name.match(/DXB-[A-Z]+-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      
      // Find the highest number and increment
      nextNumber = Math.max(0, ...numbers) + 1;
    }
    
    // Format with 5 digits padding
    const formattedNumber = nextNumber.toString().padStart(5, '0');
    const batchName = `DXB-${typeCode}-${formattedNumber}`;
    
    console.log(`Generated batch name: ${batchName} for product type: ${productType}`);
    return batchName;
  } catch (err) {
    console.error("Error generating batch name:", err);
    // Fallback to timestamp-based name if error occurs
    const timestamp = format(new Date(), "yyyyMMddHHmm");
    return `DXB-${typeCode}-${timestamp}`;
  }
};

// Dedicated function for flyer batch numbering starting with DXB-FL-00001
const generateFlyerBatchNumber = async (): Promise<string> => {
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
    
    // Format with 5 digits padding starting from 00001
    const batchNumber = `DXB-FL-${nextNumber.toString().padStart(5, '0')}`;
    
    console.log(`Generated flyer batch number: ${batchNumber}`);
    return batchNumber;
  } catch (err) {
    console.error('Error generating flyer batch number:', err);
    return `DXB-FL-${new Date().getTime().toString().substr(-5).padStart(5, '0')}`; // Fallback using timestamp
  }
};
