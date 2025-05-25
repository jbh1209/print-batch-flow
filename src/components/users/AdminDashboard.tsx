
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, UserCheck, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { toast } from 'sonner';
import { getAdminUserStats, syncProfilesWithAuth } from '@/services/userService';

interface AdminStats {
  total_users: number;
  admin_users: number;
  regular_users: number;
  users_without_profiles: number;
  recent_signups: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await getAdminUserStats();
      setStats(data);
    } catch (error: any) {
      console.error('Error loading admin stats:', error);
      toast.error(`Error loading statistics: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProfiles = async () => {
    try {
      setSyncing(true);
      const result = await syncProfilesWithAuth();
      
      if (result.synced_count > 0 || result.fixed_count > 0) {
        toast.success(`Sync complete: ${result.synced_count} profiles created, ${result.fixed_count} profiles fixed`);
        await loadStats(); // Reload stats after sync
      } else {
        toast.success('All profiles are already synced');
      }
    } catch (error: any) {
      console.error('Error syncing profiles:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Admin Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={loadStats} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSyncProfiles} disabled={syncing} size="sm">
            <Database className="h-4 w-4 mr-2" />
            {syncing ? 'Syncing...' : 'Sync Profiles'}
          </Button>
        </div>
      </div>

      {stats && stats.users_without_profiles > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats.users_without_profiles} users are missing profile data. Click "Sync Profiles" to fix this.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.admin_users || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.regular_users || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.recent_signups || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Profile Sync Status</span>
              <Badge variant={stats.users_without_profiles === 0 ? "default" : "destructive"}>
                {stats.users_without_profiles === 0 ? "All Synced" : `${stats.users_without_profiles} Missing`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Admin Coverage</span>
              <Badge variant={stats.admin_users > 0 ? "default" : "destructive"}>
                {stats.admin_users > 0 ? "Active" : "No Admins"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
