
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplatesPage } from "./TemplatesPage";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export function ProductPagesAdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>("templates");

  useEffect(() => {
    // Set the active tab based on the URL
    const path = location.pathname.split("/").pop();
    if (path === "templates") {
      setActiveTab("templates");
    } else if (path === "jobs") {
      setActiveTab("jobs");
    } else if (path === "batches") {
      setActiveTab("batches");
    }
  }, [location]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`/admin/product-pages/${value}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Product Pages Administration</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage product page templates, jobs, and batches.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
