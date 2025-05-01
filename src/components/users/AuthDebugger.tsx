
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AuthDebugger() {
  const { user, isAdmin, profile } = useAuth();

  if (!user) return null;

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
        <div>
          <strong>User ID:</strong> <span className="font-mono">{user.id}</span>
        </div>
        <div>
          <strong>Email:</strong> {user.email}
        </div>
        <div>
          <strong>Name:</strong> {profile?.full_name || "Not set"}
        </div>
      </CardContent>
    </Card>
  );
}
