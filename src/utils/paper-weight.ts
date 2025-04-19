
import { PaperType } from '@/components/batches/types/PostcardTypes';

export function extractPaperWeight(paperType: PaperType): string {
  const match = paperType.match(/(\d+gsm)/);
  return match ? match[0] : "350gsm";
}

