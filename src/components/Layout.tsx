
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/ui/sidebar';
import SearchBar from './SearchBar';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
          <SearchBar />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
