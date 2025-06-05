
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Search, 
  RefreshCw,
  QrCode,
  Users,
  Settings
} from "lucide-react";

interface MobileHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onQRScan: () => void;
  onBulkActions: () => void;
  selectedCount: number;
  isRefreshing: boolean;
  title: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  onQRScan,
  onBulkActions,
  selectedCount,
  isRefreshing,
  title
}) => {
  return (
    <div className="bg-white border-b sticky top-0 z-10 p-4 space-y-4">
      {/* Title and actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={onRefresh}
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 touch-manipulation"
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <Button 
            onClick={onQRScan}
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 touch-manipulation"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search jobs, customers..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-12 text-base touch-manipulation"
        />
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-blue-600">
              {selectedCount} selected
            </Badge>
          </div>
          <Button
            onClick={onBulkActions}
            size="sm"
            className="h-8 touch-manipulation"
          >
            <Users className="h-4 w-4 mr-1" />
            Actions
          </Button>
        </div>
      )}
    </div>
  );
};
