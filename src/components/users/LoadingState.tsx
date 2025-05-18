
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <Skeleton className="h-6 w-6 mr-2" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="h-4 w-60 mt-1" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="border rounded-md">
        <div className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
