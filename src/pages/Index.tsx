
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, Settings, Users } from "lucide-react";

const Index = () => {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
            <p className="text-gray-600">Choose your application to get started</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link to="/apps" className="block p-6">
                <CardHeader className="text-center">
                  <FileText className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <CardTitle>Batch Flow</CardTitle>
                  <CardDescription>
                    Manage business cards, flyers, and other print jobs in organized batches
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <Link to="/tracker" className="block p-6">
                <CardHeader className="text-center">
                  <BarChart3 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <CardTitle>Production Tracker</CardTitle>
                  <CardDescription>
                    Track jobs through production stages with real-time updates
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-500">Logged in as: {user.email}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PrintFlow</h1>
          <p className="text-gray-600">Streamlined production management</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Sign in to access your production dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/auth">
              <Button className="w-full" size="lg">
                Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
