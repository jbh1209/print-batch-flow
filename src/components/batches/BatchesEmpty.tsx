
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const BatchesEmpty = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow p-8 text-center">
      <h2 className="text-xl font-semibold mb-2">No Active Batches</h2>
      <p className="text-gray-500 mb-4">There are currently no active batches in the system.</p>
      <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
    </div>
  );
};

export default BatchesEmpty;
