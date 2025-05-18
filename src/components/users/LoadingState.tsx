
import { Spinner } from "@/components/ui/spinner";

export const LoadingState = () => {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="flex flex-col items-center">
        <Spinner size={40} />
        <p className="mt-4 text-muted-foreground">Loading user data...</p>
      </div>
    </div>
  );
};
