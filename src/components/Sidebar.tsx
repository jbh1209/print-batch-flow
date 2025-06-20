
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Layers, 
  CreditCard, 
  FileText, 
  Package, 
  Box, 
  Sticker, 
  Book, 
  Image, 
  Users, 
  Settings, 
  ChevronLeft,
  Mail,
  ClipboardList,
  Home,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isHeading?: boolean;
}

const NavItem = ({ to, icon, label, isActive, isHeading = false }: NavItemProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-4 py-2 text-sm font-medium rounded-md",
        isActive 
          ? "bg-white/10 text-white" 
          : "text-white/70 hover:bg-white/10 hover:text-white",
        isHeading ? "text-xs uppercase tracking-wider text-white/50 py-1" : ""
      )}
    >
      <div className="mr-3">{icon}</div>
      <span>{label}</span>
    </Link>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-batchflow-primary text-white flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && (
          <div>
            <h1 className="text-xl font-bold">BatchFlow</h1>
            <p className="text-xs text-white/70">Printing Management</p>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-full hover:bg-white/10"
        >
          <ChevronLeft size={18} className={cn(
            "transition-transform",
            collapsed ? "rotate-180" : ""
          )} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {!collapsed && <div className="mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">General</div>}
        <nav className="flex flex-col gap-1">
          <NavItem 
            to="/batchflow" 
            icon={<LayoutDashboard size={20} />} 
            label={collapsed ? "" : "Dashboard"} 
            isActive={location.pathname === "/batchflow"} 
          />
          <NavItem 
            to="/batchflow/all-jobs" 
            icon={<ClipboardList size={20} />} 
            label={collapsed ? "" : "All Jobs"} 
            isActive={location.pathname === "/batchflow/all-jobs"} 
          />
          <NavItem 
            to="/batchflow/batches" 
            icon={<Layers size={20} />} 
            label={collapsed ? "" : "All Batches"} 
            isActive={location.pathname === "/batchflow/batches"} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Batch Types</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/batchflow/batches/business-cards" 
            icon={<CreditCard size={20} />} 
            label={collapsed ? "" : "Business Cards"} 
            isActive={location.pathname.includes("/batchflow/batches/business-cards")} 
          />
          <NavItem 
            to="/batchflow/batches/flyers" 
            icon={<FileText size={20} />} 
            label={collapsed ? "" : "Flyers"} 
            isActive={location.pathname.includes("/batchflow/batches/flyers")} 
          />
          <NavItem 
            to="/batchflow/batches/postcards" 
            icon={<Mail size={20} />} 
            label={collapsed ? "" : "Postcards"} 
            isActive={location.pathname.includes("/batchflow/batches/postcards")} 
          />
          <NavItem 
            to="/batchflow/batches/sleeves" 
            icon={<Package size={20} />} 
            label={collapsed ? "" : "Shipper Box Sleeves"} 
            isActive={location.pathname.includes("/batchflow/batches/sleeves")} 
          />
          <NavItem 
            to="/batchflow/batches/boxes" 
            icon={<Box size={20} />} 
            label={collapsed ? "" : "Product Boxes"} 
            isActive={location.pathname.includes("/batchflow/batches/boxes")} 
          />
          <NavItem 
            to="/batchflow/batches/stickers" 
            icon={<Sticker size={20} />} 
            label={collapsed ? "" : "Zund Stickers"} 
            isActive={location.pathname.includes("/batchflow/batches/stickers")} 
          />
          <NavItem 
            to="/batchflow/batches/covers" 
            icon={<Book size={20} />} 
            label={collapsed ? "" : "Covers"} 
            isActive={location.pathname.includes("/batchflow/batches/covers")} 
          />
          <NavItem 
            to="/batchflow/batches/posters" 
            icon={<Image size={20} />} 
            label={collapsed ? "" : "Posters"} 
            isActive={location.pathname.includes("/batchflow/batches/posters")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Administration</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/batchflow/users" 
            icon={<Users size={20} />} 
            label={collapsed ? "" : "Users"} 
            isActive={location.pathname === "/batchflow/users"} 
          />
          <NavItem 
            to="/batchflow/settings" 
            icon={<Settings size={20} />} 
            label={collapsed ? "" : "Settings"} 
            isActive={location.pathname === "/batchflow/settings"} 
          />
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <Button 
          asChild 
          variant="outline" 
          size="sm" 
          className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <Link to="/" className="flex items-center gap-2">
            <Home size={16} />
            {!collapsed && "Switch Apps"}
          </Link>
        </Button>
        {!collapsed && (
          <Button 
            asChild 
            variant="ghost" 
            size="sm" 
            className="w-full mt-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Link to="/tracker" className="flex items-center gap-2">
              <Target size={16} />
              Tracker
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
