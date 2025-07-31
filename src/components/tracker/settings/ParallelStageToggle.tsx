import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParallelStageConfig } from "@/hooks/useParallelStageConfig";

export const ParallelStageToggle = () => {
  const { config, toggleParallelStagesSeparately } = useParallelStageConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parallel Stage Display</CardTitle>
        <CardDescription>
          Control how jobs with parallel stages are displayed in the tracker
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="parallel-stages"
            checked={config.showParallelStagesSeparately}
            onCheckedChange={toggleParallelStagesSeparately}
          />
          <Label htmlFor="parallel-stages">
            Show parallel stages separately
          </Label>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {config.showParallelStagesSeparately 
            ? "Jobs with parallel stages will show separate entries for each stage (e.g., Cover HP 12000, Text HP 12000)"
            : "Jobs with parallel stages will show as single consolidated entries"
          }
        </p>
      </CardContent>
    </Card>
  );
};