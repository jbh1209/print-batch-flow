
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

// Find the root element and render the app
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light" storageKey="batchflow-theme">
      <App />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);
