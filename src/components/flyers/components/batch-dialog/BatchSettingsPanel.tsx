
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LaminationType } from "@/components/batches/types/FlyerTypes";

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

export const BatchSettingsPanel = ({
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
}: BatchSettingsPanelProps) => {
  return (
    <div className="space-y-4 lg:col-span-1">
      <div>
        <Label htmlFor="paperType">Paper Type</Label>
        <Select value={paperType} onValueChange={setPaperType}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select paper type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Matt">Matt</SelectItem>
            <SelectItem value="Gloss">Gloss</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="paperWeight">Paper Weight</Label>
        <Select value={paperWeight} onValueChange={setPaperWeight}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select paper weight" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="115gsm">115gsm</SelectItem>
            <SelectItem value="130gsm">130gsm</SelectItem>
            <SelectItem value="170gsm">170gsm</SelectItem>
            <SelectItem value="200gsm">200gsm</SelectItem>
            <SelectItem value="250gsm">250gsm</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="lamination">Lamination</Label>
        <Select 
          value={laminationType} 
          onValueChange={(value) => setLaminationType(value as LaminationType)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select lamination type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="matt">Matt</SelectItem>
            <SelectItem value="gloss">Gloss</SelectItem>
            <SelectItem value="soft_touch">Soft Touch</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="printerType">Printer Type</Label>
        <Select value={printerType} onValueChange={setPrinterType}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select printer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HP 12000">HP 12000</SelectItem>
            <SelectItem value="HP 7900">HP 7900</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label htmlFor="sheetSize">Sheet Size</Label>
        <Select value={sheetSize} onValueChange={setSheetSize}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select sheet size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="455x640mm">455x640mm</SelectItem>
            <SelectItem value="530x750mm">530x750mm</SelectItem>
            <SelectItem value="320x455mm">320x455mm</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
