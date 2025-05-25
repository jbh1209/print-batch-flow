
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AuthDebugger() {
  const { user, profile } = useAuth();
  const { isAdmin, adminExists, isLoading } = useAdminAuth();

  if (!user) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Authentication Status
          <div className="flex gap-2">
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "User"}
            </Badge>
            <Badge variant={adminExists ? "default" : "destructive"}>
              {adminExists ? "Admin Exists" : "No Admin"}
            </Badge>
            {isLoading && <Badge variant="outline">Loading</Badge>}
          </div>
        </CardTitle>
        <CardDescription>Debug information about current authentication</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <strong>User ID:</strong> <span className="font-mono">{user.id}</span>
        </div>
        <div>
          <strong>Email:</strong> {user.email}
        </div>
        <div>
          <strong>Name:</strong> {profile?.full_name || "Not set"}
        </div>
        <div>
          <strong>Is Admin:</strong> {isAdmin ? "Yes" : "No"}
        </div>
        <div>
          <strong>Any Admin Exists:</strong> {adminExists ? "Yes" : "No"}
        </div>
      </CardContent>
    </Card>
  );
}
