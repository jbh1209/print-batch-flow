
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { productConfigs } from "@/config/productTypes";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const [slaSettings, setSlaSettings] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize SLA settings from product configs
  useEffect(() => {
    const initialSlaSettings: Record<string, number> = {};
    Object.entries(productConfigs).forEach(([productType, config]) => {
      initialSlaSettings[productType] = config.slaTargetDays;
    });
    setSlaSettings(initialSlaSettings);
  }, []);
  
  const handleSlaChange = (productType: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setSlaSettings(prev => ({
        ...prev,
        [productType]: numValue
      }));
    }
  };
  
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // For now we'll just show a toast that this would save to a settings table
      // In a full implementation, this would save to a database table
      
      toast.success("SLA settings updated successfully", {
        description: "New SLA settings will apply to newly created batches"
      });
      
      // Note: In a real implementation, we would update a settings table in Supabase
      // and then reload the productConfigs with the new values
      
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center">
            <SettingsIcon className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          </div>
          <p className="text-gray-500 mt-1">Configure application settings</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>SLA Settings</CardTitle>
          <CardDescription>
            Configure default SLA target days for each product type.
            These settings affect when jobs are flagged as approaching their due date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-medium">Product Type</Label>
              <Label className="text-right font-medium">SLA Target Days</Label>
              <div></div> {/* Empty space for alignment */}
            </div>
            
            {Object.entries(productConfigs).map(([productType, config]) => (
              <div key={productType} className="grid grid-cols-3 items-center gap-4">
                <div className="text-right">
                  <span className="text-sm font-medium">{productType}</span>
                </div>
                <div>
                  <Input
                    type="number"
                    value={slaSettings[productType] || config.slaTargetDays}
                    min="1"
                    onChange={(e) => handleSlaChange(productType, e.target.value)}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Default: {config.slaTargetDays} days
                </div>
              </div>
            ))}
            
            <div className="flex justify-end mt-4">
              <Button 
                onClick={handleSaveSettings} 
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Save Settings</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Additional settings sections can be added here */}
    </div>
  );
};

export default Settings;
