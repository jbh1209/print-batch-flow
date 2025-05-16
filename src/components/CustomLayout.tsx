
import React from 'react';
import { Outlet } from 'react-router-dom';
import CustomSidebar from './CustomSidebar';
import SearchBar from './SearchBar';

export function CustomLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <CustomSidebar />
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

export default CustomLayout;
