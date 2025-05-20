
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LaminationType } from "@/config/productTypes";

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
  availablePaperWeights?: string[];
  availableLaminationTypes?: LaminationType[];
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
  availablePaperTypes = ["Gloss", "Silk", "Uncoated"],
  availableLaminationTypes = ["none", "matt", "gloss"],
  availablePaperWeights = ["170gsm", "250gsm", "350gsm"]
}: BatchSettingsPanelProps) {
  // Function to format lamination type for display
  const formatLaminationType = (type: string): string => {
    switch(type) {
      case "none": return "None";
      case "matt": return "Matt";
      case "gloss": return "Gloss";
      case "soft_touch": return "Soft Touch";
      default: return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Batch Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set the properties for this batch
        </p>
      </div>
      
      {/* Paper Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="paperType">Paper Type</Label>
        <Select value={paperType} onValueChange={setPaperType}>
          <SelectTrigger className="w-full">
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
      
      {/* Paper Weight Selection - only show if there are available options */}
      {availablePaperWeights && availablePaperWeights.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="paperWeight">Paper Weight</Label>
          <Select value={paperWeight} onValueChange={setPaperWeight}>
            <SelectTrigger className="w-full">
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
      )}
      
      {/* Lamination Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="laminationType">Lamination</Label>
        <Select 
          value={laminationType} 
          onValueChange={(value) => setLaminationType(value as LaminationType)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select lamination type" />
          </SelectTrigger>
          <SelectContent>
            {availableLaminationTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {formatLaminationType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Printer Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="printerType">Printer</Label>
        <Select value={printerType} onValueChange={setPrinterType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select printer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="HP 12000">HP 12000</SelectItem>
            <SelectItem value="Zund">Zund</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Sheet Size Selection */}
      <div className="space-y-2">
        <Label htmlFor="sheetSize">Sheet Size</Label>
        <Select value={sheetSize} onValueChange={setSheetSize}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select sheet size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="530x750mm">530x750mm</SelectItem>
            <SelectItem value="297x420mm">297x420mm (A3)</SelectItem>
            <SelectItem value="320x450mm">320x450mm</SelectItem>
            <SelectItem value="Custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
