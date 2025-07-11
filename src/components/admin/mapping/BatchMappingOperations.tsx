import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  Target, 
  Database, 
  Filter, 
  CheckCircle, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BatchMappingOperationsProps {
  onOperationComplete?: () => void;
}

export function BatchMappingOperations({ onOperationComplete }: BatchMappingOperationsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [minConfidence, setMinConfidence] = useState(80);
  const [verificationThreshold, setVerificationThreshold] = useState(150);
  const { toast } = useToast();

  const handleConsolidateMappings = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('consolidate_excel_mappings');
      
      if (error) throw error;

      const result = data?.[0];
      if (result) {
        toast({
          title: "Mappings Consolidated",
          description: `Merged ${result.merged_count} duplicates, found ${result.conflict_count} conflicts`,
        });
      }

      onOperationComplete?.();
    } catch (error: any) {
      toast({
        title: "Consolidation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBoostConfidence = async () => {
    setIsProcessing(true);
    try {
      // Update confidence scores for mappings with verification
      const { data, error } = await supabase
        .from('excel_import_mappings')
        .update({ 
          confidence_score: verificationThreshold,
          is_verified: true 
        })
        .gte('confidence_score', minConfidence)
        .eq('is_verified', false)
        .select('count');

      if (error) throw error;

      toast({
        title: "Confidence Boosted",
        description: `Updated confidence scores for verified mappings above ${minConfidence}%`,
      });

      onOperationComplete?.();
    } catch (error: any) {
      toast({
        title: "Confidence Boost Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanupLowConfidence = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from('excel_import_mappings')
        .delete()
        .lt('confidence_score', 50)
        .eq('is_verified', false);

      if (error) throw error;

      toast({
        title: "Low Confidence Mappings Removed",
        description: "Cleaned up mappings with confidence below 50%",
      });

      onOperationComplete?.();
    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Batch Mapping Operations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Confidence Management */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <h4 className="font-medium">Confidence Management</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minConfidence">Minimum Confidence (%)</Label>
              <Input
                id="minConfidence"
                type="number"
                min="0"
                max="100"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verificationThreshold">Verification Threshold (%)</Label>
              <Input
                id="verificationThreshold"
                type="number"
                min="100"
                max="200"
                value={verificationThreshold}
                onChange={(e) => setVerificationThreshold(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBoostConfidence}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Boost Verified Mappings
            </Button>
            <Button
              variant="outline"
              onClick={handleCleanupLowConfidence}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Filter className="h-4 w-4 mr-2" />
              )}
              Clean Low Confidence
            </Button>
          </div>
        </div>

        <Separator />

        {/* Database Operations */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <h4 className="font-medium">Database Operations</h4>
          </div>

          <Button
            variant="outline"
            onClick={handleConsolidateMappings}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            Consolidate Duplicate Mappings
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h5 className="font-medium text-sm">Operation Guidelines:</h5>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Boost</Badge>
              <span>Increases confidence for verified mappings above threshold</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Clean</Badge>
              <span>Removes unverified mappings with very low confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Consolidate</Badge>
              <span>Merges duplicate mappings and identifies conflicts</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}