import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { DebugInfo } from "@/components/ui/debug-info";
import { clearAppCache } from "@/utils/cacheUtils";

const Index = () => {
  // Add cache reset function
  const handleResetCache = () => {
    clearAppCache();
    window.location.reload();
  };

  // Updated render to include debug info
  return (
    <div>
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-600 mb-8">Welcome to the Print Batch Flow application.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">Batches</h2>
            <p className="text-gray-500 mb-4">Manage and view all your print batches.</p>
            <Link to="/batches">
              <Button>View Batches</Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">Jobs</h2>
            <p className="text-gray-500 mb-4">Create, view, and manage print jobs.</p>
            <Link to="/all-jobs">
              <Button>View Jobs</Button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">Users</h2>
            <p className="text-gray-500 mb-4">Manage user accounts and permissions.</p>
            <Link to="/users">
              <Button>View Users</Button>
            </Link>
          </div>
        </div>
      </div>
      
      <DebugInfo 
        componentName="Index Page"
        extraInfo={{
          lastUpdate: new Date().toISOString()
        }}
        visible={true}
      />
      
      {/* Add cache reset button at the bottom */}
      <div className="mt-8 p-4 border rounded-md bg-gray-50">
        <h3 className="text-lg font-medium mb-2">Debug Tools</h3>
        <p className="text-sm text-gray-500 mb-4">
          If you're experiencing issues with the UI not updating, try clearing the application cache.
        </p>
        <Button 
          variant="outline" 
          onClick={handleResetCache}
        >
          Clear App Cache & Reload
        </Button>
      </div>
    </div>
  );
};

export default Index;
