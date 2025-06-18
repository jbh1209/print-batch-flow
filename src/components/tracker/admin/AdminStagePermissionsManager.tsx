
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StagePermissionsManager } from "./StagePermissionsManager";
import { Settings, Users } from "lucide-react";

interface ProductionStage {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

export const AdminStagePermissionsManager: React.FC = () => {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState<ProductionStage | null>(null);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('production_stages')
        .select('id, name, color, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setStages(data || []);
    } catch (error) {
      console.error('Error fetching stages:', error);
      toast.error('Failed to load production stages');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading stages...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Stage Permissions Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Select a production stage to manage user group permissions for that stage.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stages.map((stage) => (
              <Button
                key={stage.id}
                variant={selectedStage?.id === stage.id ? "default" : "outline"}
                onClick={() => setSelectedStage(stage)}
                className="flex items-center gap-2 h-auto p-3"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-sm font-medium truncate">{stage.name}</span>
              </Button>
            ))}
          </div>

          {stages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No active production stages found. Create stages first to manage permissions.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedStage.color }}
              />
              {selectedStage.name} Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StagePermissionsManager stage={selectedStage} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
