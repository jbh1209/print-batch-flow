
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useProductTypes } from '@/hooks/admin/useProductTypes';
import { CreditCard, LayoutDashboard, Files, Package, Users, Settings } from 'lucide-react';

type SidebarItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  hasSubmenu?: boolean;
  onClick?: () => void;
  className?: string;
};

export const SidebarItem = ({
  href,
  label,
  icon,
  isActive = false,
  hasSubmenu = false,
  onClick,
  className,
}: SidebarItemProps) => {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center px-3 py-2 text-sm rounded-md',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center flex-1">
        <span className="mr-3 h-5 w-5">{icon}</span>
        <span>{label}</span>
      </div>
      {hasSubmenu && <span className="ml-2">▼</span>}
    </Link>
  );
};

export function CustomSidebar() {
  const location = useLocation();
  const { productTypes, fetchProductTypes } = useProductTypes();
  
  useEffect(() => {
    fetchProductTypes();
  }, [fetchProductTypes]);

  // Get icon component for dynamic product cards
  const getProductIcon = (iconName: string) => {
    switch (iconName) {
      case 'CreditCard': return <CreditCard className="h-5 w-5" />;
      case 'FileText': 
      case 'Files': return <Files className="h-5 w-5" />;
      case 'Package': return <Package className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-sidebar border-r border-r-slate-100 dark:border-r-slate-800">
      <div className="flex-1 overflow-auto py-2">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
            GENERAL
          </h2>
          <div className="space-y-1">
            <SidebarItem
              href="/dashboard"
              label="Dashboard"
              icon={<LayoutDashboard className="h-5 w-5" />}
              isActive={location.pathname === '/dashboard'}
            />
            <SidebarItem
              href="/all-jobs"
              label="All Jobs"
              icon={<Files className="h-5 w-5" />}
              isActive={location.pathname === '/all-jobs'}
            />
            <SidebarItem
              href="/batches"
              label="All Batches"
              icon={<Package className="h-5 w-5" />}
              isActive={location.pathname === '/batches'}
            />
          </div>
        </div>

        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
            PRODUCTS
          </h2>
          <div className="space-y-1">
            {/* Always show Business Cards as it's our core product */}
            <SidebarItem
              href="/batches/business-cards"
              label="Business Cards"
              icon={<CreditCard className="h-5 w-5" />}
              isActive={location.pathname.startsWith('/batches/business-cards')}
            />
            
            {/* Dynamically show products from database */}
            {productTypes
              .filter(product => product.slug !== 'business-cards') // Exclude Business Cards as it's already shown
              .map(product => (
                <SidebarItem
                  key={product.id}
                  href={`/batches/${product.slug}`}
                  label={product.name}
                  icon={getProductIcon(product.icon_name)}
                  isActive={location.pathname.startsWith(`/batches/${product.slug}`)}
                />
              ))}
          </div>
        </div>

        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
            ADMINISTRATION
          </h2>
          <div className="space-y-1">
            <SidebarItem
              href="/admin/products"
              label="Product Manager"
              icon={<Package className="h-5 w-5" />}
              isActive={location.pathname.startsWith('/admin/products')}
            />
            <SidebarItem
              href="/users"
              label="Users"
              icon={<Users className="h-5 w-5" />}
              isActive={location.pathname === '/users'}
            />
            <SidebarItem
              href="/settings"
              label="Settings"
              icon={<Settings className="h-5 w-5" />}
              isActive={location.pathname === '/settings'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomSidebar;
