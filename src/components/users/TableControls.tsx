
import React from "react";
import { RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface TableControlsProps {
  onRefresh: () => Promise<void>;
  onAddUser: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
  isProcessing: boolean;
}

export function TableControls({ 
  onRefresh, 
  onAddUser, 
  isRefreshing, 
  isLoading,
  isProcessing 
}: TableControlsProps) {
  return (
    <div className="flex justify-between mb-4">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh}
        className="flex items-center gap-1"
        disabled={isRefreshing}
      >
        {isRefreshing ? <Spinner size={16} className="mr-1" /> : <RefreshCw className="h-4 w-4" />}
        Refresh Users
      </Button>
      
      <Button onClick={onAddUser} disabled={isProcessing || isLoading}>
        <UserPlus className="mr-2 h-4 w-4" />
        Add User
      </Button>
    </div>
  );
}
