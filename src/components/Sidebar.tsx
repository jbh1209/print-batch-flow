
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
  FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

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
  const { isAdmin } = useAuth();

  return (
    <div className={cn(
      "bg-batchflow-primary text-white flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {!collapsed && <h1 className="text-xl font-bold">BatchFlow</h1>}
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
            to="/" 
            icon={<LayoutDashboard size={20} />} 
            label={collapsed ? "" : "Dashboard"} 
            isActive={location.pathname === "/"} 
          />
          <NavItem 
            to="/all-jobs" 
            icon={<ClipboardList size={20} />} 
            label={collapsed ? "" : "All Jobs"} 
            isActive={location.pathname === "/all-jobs"} 
          />
          <NavItem 
            to="/batches" 
            icon={<Layers size={20} />} 
            label={collapsed ? "" : "All Batches"} 
            isActive={location.pathname === "/batches" || location.pathname.startsWith("/batches/all")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Batch Types</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/batches/business-cards" 
            icon={<CreditCard size={20} />} 
            label={collapsed ? "" : "Business Cards"} 
            isActive={location.pathname.includes("/batches/business-cards")} 
          />
          <NavItem 
            to="/batches/flyers" 
            icon={<FileText size={20} />} 
            label={collapsed ? "" : "Flyers"} 
            isActive={location.pathname.includes("/batches/flyers")} 
          />
          <NavItem 
            to="/batches/postcards" 
            icon={<Mail size={20} />} 
            label={collapsed ? "" : "Postcards"} 
            isActive={location.pathname.includes("/batches/postcards")} 
          />
          <NavItem 
            to="/batches/sleeves" 
            icon={<Package size={20} />} 
            label={collapsed ? "" : "Shipper Box Sleeves"} 
            isActive={location.pathname.includes("/batches/sleeves")} 
          />
          <NavItem 
            to="/batches/boxes" 
            icon={<Box size={20} />} 
            label={collapsed ? "" : "Product Boxes"} 
            isActive={location.pathname.includes("/batches/boxes")} 
          />
          <NavItem 
            to="/batches/stickers" 
            icon={<Sticker size={20} />} 
            label={collapsed ? "" : "Zund Stickers"} 
            isActive={location.pathname.includes("/batches/stickers")} 
          />
          <NavItem 
            to="/batches/covers" 
            icon={<Book size={20} />} 
            label={collapsed ? "" : "Covers"} 
            isActive={location.pathname.includes("/batches/covers")} 
          />
          <NavItem 
            to="/batches/posters" 
            icon={<Image size={20} />} 
            label={collapsed ? "" : "Posters"} 
            isActive={location.pathname.includes("/batches/posters")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Administration</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          {isAdmin && (
            <NavItem 
              to="/admin/product-pages/templates" 
              icon={<FileSpreadsheet size={20} />} 
              label={collapsed ? "" : "Product Pages"} 
              isActive={location.pathname.includes("/admin/product-pages")} 
            />
          )}
          <NavItem 
            to="/users" 
            icon={<Users size={20} />} 
            label={collapsed ? "" : "Users"} 
            isActive={location.pathname === "/users"} 
          />
          <NavItem 
            to="/settings" 
            icon={<Settings size={20} />} 
            label={collapsed ? "" : "Settings"} 
            isActive={location.pathname === "/settings"} 
          />
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
