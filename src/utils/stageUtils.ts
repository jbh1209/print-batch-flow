// Utility functions for stage type detection and management

export const isPrintingStage = (stageName: string): boolean => {
  const printingKeywords = [
    'print', 'printing', 'press', 'digital', 'offset', 'litho',
    'hp', 'xerox', 'canon', 'konica', 'ricoh', 'indigo',
    'b2', 'b3', 'sra3', 'a3', 'a4', 'a5',
    'cmyk', 'process', 'colour', 'color', 'mono', 'black'
  ];
  
  const normalizedName = stageName.toLowerCase();
  
  // Check for printing keywords
  return printingKeywords.some(keyword => normalizedName.includes(keyword));
};

export const isPrePrintingStage = (stageName: string): boolean => {
  const prePrintingKeywords = [
    'dtp', 'design', 'artwork', 'preflight', 'rip', 'impose',
    'proof', 'proofing', 'approval', 'plate', 'ctp'
  ];
  
  const normalizedName = stageName.toLowerCase();
  return prePrintingKeywords.some(keyword => normalizedName.includes(keyword));
};

export const isFinishingStage = (stageName: string): boolean => {
  const finishingKeywords = [
    'lamination', 'laminate', 'uv', 'varnish', 'coating',
    'cut', 'cutting', 'trim', 'fold', 'folding', 'bind', 'binding',
    'stitch', 'staple', 'perforate', 'score', 'emboss', 'deboss',
    'die', 'finish', 'pack', 'packing', 'delivery', 'dispatch'
  ];
  
  const normalizedName = stageName.toLowerCase();
  return finishingKeywords.some(keyword => normalizedName.includes(keyword));
};

export const getStageType = (stageName: string): 'pre-printing' | 'printing' | 'finishing' | 'other' => {
  if (isPrePrintingStage(stageName)) return 'pre-printing';
  if (isPrintingStage(stageName)) return 'printing';
  if (isFinishingStage(stageName)) return 'finishing';
  return 'other';
};