
import React from 'react';
import { Outlet } from 'react-router-dom';
import SearchBar from './SearchBar';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="w-64 border-r bg-background">
        {/* Sidebar content would go here */}
        <div className="p-4">
          <h2 className="font-semibold">Application</h2>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
          <SearchBar />
        </header>
        <main className="flex-1 overflow-auto">
          <div className="container px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
