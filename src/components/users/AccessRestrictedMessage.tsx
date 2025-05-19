
import { Card, CardContent } from "@/components/ui/card";

export function AccessRestrictedMessage() {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-gray-500">You need administrator privileges to manage users.</p>
      </CardContent>
    </Card>
  );
}
