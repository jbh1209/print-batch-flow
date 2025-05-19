
// Only updating the problematic code section where 'matt' is used
import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LaminationType } from '@/config/productTypes';

interface BatchSettingsPanelProps {
  paperType: string;
  setPaperType: (value: string) => void;
  paperWeight: string;
  setPaperWeight: (value: string) => void;
  laminationType: LaminationType;
  setLaminationType: (value: LaminationType) => void;
  printerType: string;
  setPrinterType: (value: string) => void;
  sheetSize: string;
  setSheetSize: (value: string) => void;
}

export function BatchSettingsPanel({
  paperType,
  setPaperType,
  paperWeight,
  setPaperWeight,
  laminationType,
  setLaminationType,
  printerType,
  setPrinterType,
  sheetSize,
  setSheetSize
}: BatchSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Batch Settings</h3>
        
        {/* Paper Type */}
        <div className="space-y-2 mb-4">
          <Label>Paper Type</Label>
          <RadioGroup value={paperType} onValueChange={setPaperType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Gloss" id="gloss" />
              <Label htmlFor="gloss">Gloss</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Silk" id="silk" />
              <Label htmlFor="silk">Silk</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Paper Weight */}
        <div className="space-y-2 mb-4">
          <Label>Paper Weight</Label>
          <RadioGroup value={paperWeight} onValueChange={setPaperWeight}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="130gsm" id="130gsm" />
              <Label htmlFor="130gsm">130gsm</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="170gsm" id="170gsm" />
              <Label htmlFor="170gsm">170gsm</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="250gsm" id="250gsm" />
              <Label htmlFor="250gsm">250gsm</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Lamination */}
        <div className="space-y-2 mb-4">
          <Label>Lamination</Label>
          <RadioGroup value={laminationType} onValueChange={setLaminationType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="no-lamination" />
              <Label htmlFor="no-lamination">None</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gloss" id="gloss-lamination" />
              <Label htmlFor="gloss-lamination">Gloss</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="matte" id="matte-lamination" /> {/* Changed from 'matt' to 'matte' */}
              <Label htmlFor="matte-lamination">Matte</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Printer Type */}
        <div className="space-y-2 mb-4">
          <Label>Printer</Label>
          <RadioGroup value={printerType} onValueChange={setPrinterType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="HP 12000" id="hp12000" />
              <Label htmlFor="hp12000">HP 12000</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Indigo 7800" id="indigo7800" />
              <Label htmlFor="indigo7800">Indigo 7800</Label>
            </div>
          </RadioGroup>
        </div>
        
        {/* Sheet Size */}
        <div className="space-y-2">
          <Label>Sheet Size</Label>
          <RadioGroup value={sheetSize} onValueChange={setSheetSize}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="530x750mm" id="530x750" />
              <Label htmlFor="530x750">530 x 750 mm</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="364x520mm" id="364x520" />
              <Label htmlFor="364x520">364 x 520 mm</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
