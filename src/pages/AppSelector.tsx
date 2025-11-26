import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Package, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ProofApprovalFixer } from "@/components/utils/ProofApprovalFixer";
const AppSelector = () => {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('🎯 AppSelector - loading:', loading, 'user:', !!user);
  }, [loading, user]);
  
  useEffect(() => {
    // Redirect to auth if not logged in
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Show loading while checking auth
  if (loading) {
    console.log('⏳ AppSelector rendering loading state');
    return <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>;
  }

  // Don't render anything if redirecting to auth
  if (!user) {
    return null;
  }
  return <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-8">
      <div className="max-w-4xl w-full px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Your Workspace</h1>
          <p className="text-xl text-gray-600 mb-2">Choose your application to get started</p>
          {user?.email && <p className="text-sm text-gray-500">Logged in as {user.email}</p>}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Tracker App */}
          <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 bg-green-100 rounded-full w-20 h-20 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <ClipboardList className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Tracker</CardTitle>
              <CardDescription className="text-gray-600">
                Production job tracking and workflow management
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-gray-600 mb-6 space-y-2">
                <li>• Upload and manage production jobs</li>
                <li>• Track job status with Kanban boards</li>
                <li>• Generate work sheets and reports</li>
                <li>• Real-time production monitoring</li>
              </ul>
              <Button asChild size="lg" className="w-full bg-green-600 hover:bg-green-700">
                <Link to="/tracker/dashboard" className="flex items-center justify-center gap-2">
                  Open Tracker
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Printstream App */}
          <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Package className="h-10 w-10 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">BatchFlow</CardTitle>
              <CardDescription className="text-gray-600">
                Printing batch management and production workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-gray-600 mb-6 space-y-2">
                <li>• Manage printing batches and jobs</li>
                <li>Open Batchflow</li>
                <li>• Batch optimization and scheduling</li>
                <li>• PDF generation and management</li>
              </ul>
              <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700">
                <Link to="/printstream" className="flex items-center justify-center gap-2">
                  Open Printstream
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Schedule Board App */}
          <Card className="hover:shadow-xl transition-all duration-300 group cursor-pointer">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-4 bg-purple-100 rounded-full w-20 h-20 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <ClipboardList className="h-10 w-10 text-purple-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Schedule Board</CardTitle>
              <CardDescription className="text-gray-600">
                Weekly production scheduling and time slot management
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-gray-600 mb-6 space-y-2">
                <li>• Plan weekly production schedules</li>
                <li>• Assign jobs to specific time slots</li>
                <li>• Monday to Friday shift management</li>
                <li>• Visual schedule overview</li>
              </ul>
              <Button asChild size="lg" className="w-full bg-purple-600 hover:bg-purple-700">
                <Link to="/schedule-board" className="flex items-center justify-center gap-2">
                  Open Schedule Board
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Temporary fix utility - remove after fixing proof approvals */}
        <div className="mt-8 flex justify-center">
          <ProofApprovalFixer />
        </div>
      </div>
    </div>;
};
export default AppSelector;