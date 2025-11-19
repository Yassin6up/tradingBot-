import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Brain, Settings } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/", label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: "/analytics", label: t('nav.analytics'), icon: Brain },
    { path: "/settings", label: t('nav.settings'), icon: Settings },
  ];

  return (
    <nav className="flex items-center gap-1 bg-muted/30 rounded-md p-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path;
        return (
          <Link
            key={item.path}
            href={item.path}
            className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition-colors hover-elevate ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
            data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
