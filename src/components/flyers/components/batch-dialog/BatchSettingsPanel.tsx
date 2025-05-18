
import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  availablePaperTypes: string[];
  availableLaminationTypes: LaminationType[];
  availablePaperWeights: string[];
}

export const BatchSettingsPanel: React.FC<BatchSettingsPanelProps> = ({
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
  availablePaperTypes,
  availableLaminationTypes,
  availablePaperWeights
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Batch Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure the settings for this batch
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paperType">Paper Type</Label>
        <Select value={paperType} onValueChange={setPaperType}>
          <SelectTrigger>
            <SelectValue placeholder="Select paper type" />
          </SelectTrigger>
          <SelectContent>
            {availablePaperTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paperWeight">Paper Weight</Label>
        <Select value={paperWeight} onValueChange={setPaperWeight}>
          <SelectTrigger>
            <SelectValue placeholder="Select paper weight" />
          </SelectTrigger>
          <SelectContent>
            {availablePaperWeights.map((weight) => (
              <SelectItem key={weight} value={weight}>
                {weight}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="laminationType">Lamination Type</Label>
        <Select value={laminationType} onValueChange={(value) => setLaminationType(value as LaminationType)}>
          <SelectTrigger>
            <SelectValue placeholder="Select lamination type" />
          </SelectTrigger>
          <SelectContent>
            {availableLaminationTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type === 'none' ? 'None' : type === 'matt' ? 'Matt' : 'Gloss'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="printerType">Printer</Label>
        <Select value={printerType} onValueChange={setPrinterType}>
          <SelectTrigger>
            <SelectValue placeholder="Select printer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HP 12000">HP Indigo 12000</SelectItem>
            <SelectItem value="Xerox iGen5">Xerox iGen5</SelectItem>
            <SelectItem value="KM 1250i">Konica Minolta 1250i</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sheetSize">Sheet Size</Label>
        <Select value={sheetSize} onValueChange={setSheetSize}>
          <SelectTrigger>
            <SelectValue placeholder="Select sheet size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="530x750mm">530x750mm</SelectItem>
            <SelectItem value="364x520mm">364x520mm</SelectItem>
            <SelectItem value="320x450mm">320x450mm</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
