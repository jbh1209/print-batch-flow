/**
 * GapFillReport Component
 * Panel showing gap fill statistics and top savings
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Clock } from "lucide-react";
import { GapFillRecord } from "@/types/scheduler";

interface GapFillReportProps {
  gapFills: GapFillRecord[];
}

export function GapFillReport({ gapFills }: GapFillReportProps) {
  if (!gapFills || gapFills.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gap Fill Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No gap fills in this scheduling run.</p>
        </CardContent>
      </Card>
    );
  }

  const totalDaysSaved = gapFills.reduce((sum, gf) => sum + (gf.days_saved || 0), 0);
  const topSavings = [...gapFills]
    .sort((a, b) => (b.days_saved || 0) - (a.days_saved || 0))
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          Gap Fill Optimization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Stages Optimized</p>
            <p className="text-2xl font-bold">{gapFills.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Days Saved</p>
            <p className="text-2xl font-bold text-success">{totalDaysSaved.toFixed(1)}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Top Savings
          </h4>
          <div className="space-y-2">
            {topSavings.map((gf, idx) => (
              <div key={gf.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    #{idx + 1}
                  </Badge>
                  <span className="text-sm font-mono text-muted-foreground">
                    {gf.stage_instance_id.slice(0, 8)}...
                  </span>
                </div>
                <Badge variant="default" className="bg-success/10 text-success hover:bg-success/20">
                  {gf.days_saved.toFixed(1)} days
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {topSavings.length < gapFills.length && (
          <p className="text-xs text-muted-foreground text-center pt-2 border-t">
            Showing top {topSavings.length} of {gapFills.length} gap fills
          </p>
        )}
      </CardContent>
    </Card>
  );
}
