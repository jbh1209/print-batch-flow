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
  ChevronDown,
  ChevronRight,
  Plus,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

interface ProductNavProps {
  name: string;
  icon: React.ReactNode;
  basePath: string;
  currentPath: string;
  collapsed: boolean;
}

const ProductNav = ({ name, icon, basePath, currentPath, collapsed }: ProductNavProps) => {
  const [isOpen, setIsOpen] = useState(currentPath.includes(basePath));
  
  if (collapsed) {
    return (
      <div className="relative group">
        <Link
          to={basePath}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-md my-1",
            currentPath.includes(basePath) 
              ? "bg-white/10 text-white" 
              : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          <div>{icon}</div>
        </Link>
        <div className="absolute left-full ml-2 hidden group-hover:block z-10">
          <div className="bg-batchflow-primary py-1 px-2 rounded-md shadow-lg whitespace-nowrap">
            <Link
              to={basePath}
              className="block px-3 py-1 text-sm text-white/90 hover:text-white"
            >
              {name} Overview
            </Link>
            <Link
              to={`${basePath}/jobs`}
              className="block px-3 py-1 text-sm text-white/90 hover:text-white"
            >
              {name} Jobs
            </Link>
            <Link
              to={`${basePath}/jobs/new`}
              className="block px-3 py-1 text-sm text-white/90 hover:text-white"
            >
              New {name} Job
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center px-4 py-2 text-sm font-medium rounded-md",
          currentPath.includes(basePath) 
            ? "bg-white/10 text-white" 
            : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
      >
        <div className="mr-3">{icon}</div>
        <span>{name}</span>
        <div className="ml-auto">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      
      {isOpen && (
        <div className="ml-8 mt-1 space-y-1">
          <Link
            to={basePath}
            className={cn(
              "flex items-center px-3 py-1 text-sm rounded-md",
              currentPath === basePath
                ? "text-white bg-white/5" 
                : "text-white/70 hover:text-white hover:bg-white/5"
            )}
          >
            Overview
          </Link>
          <Link
            to={`${basePath}/jobs`}
            className={cn(
              "flex items-center px-3 py-1 text-sm rounded-md",
              currentPath === `${basePath}/jobs` || currentPath.includes(`${basePath}/jobs/`) && !currentPath.includes('/new')
                ? "text-white bg-white/5" 
                : "text-white/70 hover:text-white hover:bg-white/5"
            )}
          >
            <ClipboardList size={16} className="mr-2" />
            Jobs
          </Link>
          <Link
            to={`${basePath}/jobs/new`}
            className={cn(
              "flex items-center px-3 py-1 text-sm rounded-md",
              currentPath === `${basePath}/jobs/new`
                ? "text-white bg-white/5" 
                : "text-white/70 hover:text-white hover:bg-white/5"
            )}
          >
            <Plus size={16} className="mr-2" />
            New Job
          </Link>
        </div>
      )}
    </div>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const products = [
    {
      name: "Business Cards",
      icon: <CreditCard size={20} />,
      basePath: "/batches/business-cards"
    },
    {
      name: "Flyers",
      icon: <FileText size={20} />,
      basePath: "/batches/flyers"
    },
    {
      name: "Postcards",
      icon: <Mail size={20} />,
      basePath: "/batches/postcards"
    },
    {
      name: "Shipper Box Sleeves",
      icon: <Package size={20} />,
      basePath: "/batches/sleeves"
    },
    {
      name: "Product Boxes",
      icon: <Box size={20} />,
      basePath: "/batches/boxes"
    },
    {
      name: "Zund Stickers",
      icon: <Sticker size={20} />,
      basePath: "/batches/stickers"
    },
    {
      name: "Covers",
      icon: <Book size={20} />,
      basePath: "/batches/covers"
    },
    {
      name: "Posters",
      icon: <Image size={20} />,
      basePath: "/batches/posters"
    }
  ];

  // Enhanced route active detection
  const isRouteActive = (path: string): boolean => {
    // For root path, only match exact path
    if (path === "/" && location.pathname === "/") {
      return true;
    }
    
    // For other paths, match if the current path starts with the given path
    // but make sure we're matching complete segments
    if (path !== "/" && location.pathname.startsWith(path)) {
      // Check if it's an exact match or if the next character is a slash
      // or if we're at the end of the path
      if (
        location.pathname === path ||
        location.pathname.charAt(path.length) === "/" ||
        path.charAt(path.length - 1) === "/"
      ) {
        return true;
      }
    }
    
    return false;
  };

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
            isActive={isRouteActive("/")} 
          />
          <NavItem 
            to="/all-jobs" 
            icon={<ClipboardList size={20} />} 
            label={collapsed ? "" : "All Jobs"} 
            isActive={isRouteActive("/all-jobs")} 
          />
          <NavItem 
            to="/batches" 
            icon={<Layers size={20} />} 
            label={collapsed ? "" : "All Batches"} 
            isActive={isRouteActive("/batches") && !location.pathname.includes("/batches/")} 
          />
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Products</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          {products.map(product => (
            <ProductNav
              key={product.name}
              name={product.name}
              icon={product.icon}
              basePath={product.basePath}
              currentPath={location.pathname}
              collapsed={collapsed}
            />
          ))}
          
          {!collapsed && <div className="mt-6 mb-2 px-4 text-xs font-semibold text-white/50 uppercase tracking-wider">Administration</div>}
          {collapsed && <div className="my-4 border-t border-white/10"></div>}
          
          <NavItem 
            to="/admin/products" 
            icon={<Cog size={20} />} 
            label={collapsed ? "" : "Product Manager"} 
            isActive={isRouteActive("/admin/products")} 
          />
          <NavItem 
            to="/users" 
            icon={<Users size={20} />} 
            label={collapsed ? "" : "Users"} 
            isActive={isRouteActive("/users")} 
          />
          <NavItem 
            to="/settings" 
            icon={<Settings size={20} />} 
            label={collapsed ? "" : "Settings"} 
            isActive={isRouteActive("/settings")} 
          />
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
