import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="mb-6">
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" aria-label="Back to main app">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to app
          </Link>
        </Button>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-muted-foreground">Admin</span>
      </nav>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
