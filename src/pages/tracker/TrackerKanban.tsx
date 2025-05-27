
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductionKanban } from "@/components/tracker/ProductionKanban";

const TrackerKanban = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Kanban Board</h1>
        <p className="text-gray-600">Drag and drop jobs to update their status</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ProductionKanban />
      </div>
    </div>
  );
};

export default TrackerKanban;
