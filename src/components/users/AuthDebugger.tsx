
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Info } from "lucide-react";
import { toast } from "sonner";

export function AuthDebugger() {
  const { user, isAdmin, profile } = useAuth();

  if (!user) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Authentication Status
          <Badge variant={isAdmin ? "success" : "secondary"}>
            {isAdmin ? "Admin" : "User"}
          </Badge>
        </CardTitle>
        <CardDescription>Debug information about current authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <strong>User ID:</strong>
            <span className="font-mono text-xs truncate max-w-[150px] sm:max-w-[250px]">{user.id}</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => copyToClipboard(user.id, "User ID")}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy ID</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-between">
          <span><strong>Email:</strong> {user.email}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => copyToClipboard(user.email || "", "Email")}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy email</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center justify-between">
          <span><strong>Name:</strong> {profile?.full_name || "Not set"}</span>
          {!profile?.full_name && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  Consider setting a name in user settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
