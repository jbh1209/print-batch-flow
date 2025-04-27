
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, ProductConfig } from '@/config/productTypes';

export function useBatchHelper(config: ProductConfig) {
  // Helper to calculate sheets required based on job type
  const calculateSheetsRequired = <T extends BaseJob>(jobs: T[]): number => {
    let totalSheets = 0;
    
    for (const job of jobs) {
      let sheetsPerJob = 0;
      
      // Calculate differently based on product type
      if (config.productType === "Flyers") {
        // Use existing flyer calculation logic
        const jobSize = job.size;
        if (jobSize) {
          switch (jobSize) {
            case 'A5':
              // Assuming 2 A5s per sheet
              sheetsPerJob = Math.ceil(job.quantity / 2);
              break;
            case 'A4':
              // Assuming 1 A4 per sheet
              sheetsPerJob = job.quantity;
              break;
            case 'DL':
              // Assuming 3 DLs per sheet
              sheetsPerJob = Math.ceil(job.quantity / 3);
              break;
            case 'A3':
              // Assuming 1 A3 per sheet (special case)
              sheetsPerJob = job.quantity * 1.5; // A3 might require more paper
              break;
            default:
              sheetsPerJob = job.quantity;
          }
        } else {
          sheetsPerJob = job.quantity;
        }
      } else {
        // Default calculation for other product types
        // Use a simple multiplier based on quantity
        sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    // Add some extra sheets for setup and testing
    totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
    
    return totalSheets;
  };

  // Helper to get 2-letter product code
  const getProductCode = (productType: string): string => {
    switch (productType) {
      case "Flyers": return "FL";
      case "Postcards": return "PC";
      case "Posters": return "PO";
      case "Stickers": return "ST";
      case "Sleeves": return "SL";
      case "Boxes": return "BX";
      case "Covers": return "CV";
      case "Business Cards": return "BC";
      default: return "XX";
    }
  };

  // Generate a batch number with format DXB-XX-00001 specific to product type
  const generateBatchNumber = async (productType: string): Promise<string> => {
    try {
      // Get product code for batch prefix
      const productCode = getProductCode(productType);
      
      // Simple typing for query
      const result = await supabase
        .from("batches")
        .select('name')
        .filter('name', 'ilike', `DXB-${productCode}-%`);
      
      if (result.error) throw result.error;
      
      const data = result.data;
      
      // Generate the batch number starting from 00001
      const batchCount = (data?.length || 0) + 1;
      const batchNumber = `DXB-${productCode}-${batchCount.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `DXB-${getProductCode(productType)}-${new Date().getTime()}`; // Fallback using timestamp
    }
  };

  return {
    calculateSheetsRequired,
    generateBatchNumber
  };
}
