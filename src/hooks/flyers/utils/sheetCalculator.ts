
import { FlyerJob } from '@/components/batches/types/FlyerTypes';

/**
 * Calculates total sheets required for a set of flyer jobs based on size and quantity
 */
export const calculateSheetsRequired = (jobs: FlyerJob[]): number => {
  let totalSheets = 0;
  
  for (const job of jobs) {
    // Calculate sheets based on size and quantity
    let sheetsPerJob = 0;
    
    switch (job.size) {
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
    
    totalSheets += sheetsPerJob;
  }
  
  // Add some extra sheets for setup and testing
  totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
  
  return totalSheets;
};
