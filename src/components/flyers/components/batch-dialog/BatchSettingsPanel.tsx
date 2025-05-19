
import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LaminationType } from '@/config/types/productConfigTypes';

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
  availablePaperTypes?: string[];
  availableLaminationTypes?: LaminationType[];
  availablePaperWeights?: string[];
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
  setSheetSize,
  availablePaperTypes = ["Gloss", "Silk"],
  availablePaperWeights = ["130gsm", "170gsm", "250gsm"],
  availableLaminationTypes = ["none", "gloss", "matte", "soft_touch"]
}: BatchSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Batch Settings</h3>
        
        {/* Paper Type */}
        <div className="space-y-2 mb-4">
          <Label>Paper Type</Label>
          <RadioGroup value={paperType} onValueChange={setPaperType}>
            {availablePaperTypes.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <RadioGroupItem value={type} id={`paper-${type}`} />
                <Label htmlFor={`paper-${type}`}>{type}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        {/* Paper Weight */}
        <div className="space-y-2 mb-4">
          <Label>Paper Weight</Label>
          <RadioGroup value={paperWeight} onValueChange={setPaperWeight}>
            {availablePaperWeights.map(weight => (
              <div key={weight} className="flex items-center space-x-2">
                <RadioGroupItem value={weight} id={`weight-${weight}`} />
                <Label htmlFor={`weight-${weight}`}>{weight}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        {/* Lamination */}
        <div className="space-y-2 mb-4">
          <Label>Lamination</Label>
          <RadioGroup 
            value={laminationType} 
            onValueChange={(value) => {
              // Ensure the value is of type LaminationType
              setLaminationType(value as LaminationType);
            }}
          >
            {availableLaminationTypes.map(type => (
              <div key={type} className="flex items-center space-x-2">
                <RadioGroupItem value={type} id={`lamination-${type}`} />
                <Label htmlFor={`lamination-${type}`}>
                  {type === "none" ? "None" : 
                   type === "matte" ? "Matte" : 
                   type === "gloss" ? "Gloss" : 
                   type === "soft_touch" ? "Soft Touch" : type}
                </Label>
              </div>
            ))}
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
