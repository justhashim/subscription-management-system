"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  CreditCard,
  FileCheck2,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { Logo } from "./logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  customerOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      {
        href: "/subscriptions",
        label: "Subscriptions",
        icon: CreditCard,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Boxes },
      { href: "/plans", label: "Plans", icon: Layers },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/users",
        label: "Users",
        icon: Users,
        adminOnly: true,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/quotations", label: "Quotations", icon: FileCheck2 },
      { href: "/invoices", label: "Invoices", icon: ReceiptText },
      { href: "/payments", label: "Payments", icon: WalletCards },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/billing", label: "Billing runs", icon: RefreshCw },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/discounts", label: "Discounts", icon: Sparkles, adminOnly: true },
    ],
  },
  {
    label: "Self-service",
    items: [
      { href: "/portal", label: "Customer portal", icon: ShieldCheck, customerOnly: true },
    ],
  },
];

const sectionTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/subscriptions": "Subscriptions",
  "/products": "Products",
  "/plans": "Plans",
  "/users": "Users",
  "/customers": "Customers",
  "/quotations": "Quotations",
  "/invoices": "Invoices",
  "/payments": "Payments",
  "/billing": "Billing runs",
  "/discounts": "Discounts",
  "/reports": "Reports",
  "/portal": "Customer portal",
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({
  pathname,
  isAdmin,
  isCustomer,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  isCustomer: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Workspace navigation"
      className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
    >
      {navigation.map((group) => {
        const items = group.items.filter(
          (item) =>
            (!item.adminOnly || isAdmin) &&
            (!item.customerOnly || isCustomer),
        );

        if (items.length === 0) {
          return null;
        }

        return (
          <div key={group.label}>
            <p className="px-2 pb-2 font-mono text-[10px] font-semibold tracking-[0.16em] text-muted-foreground/80 uppercase">
              {group.label}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex min-h-10 items-center gap-2.5 border-l-2 border-transparent px-2.5 py-2 font-mono text-xs font-medium uppercase transition-colors",
                      active
                         ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, isCustomer, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const currentSection =
    Object.entries(sectionTitles).find(([href]) =>
      isActive(pathname, href),
    )?.[1] ?? "Workspace";

  if (loading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-primary/10">
            <span className="size-5 rounded-md bg-primary/40" />
          </div>
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b-2 border-sidebar-border px-5">
          <Logo />
        </div>
        <NavigationLinks pathname={pathname} isAdmin={isAdmin} isCustomer={isCustomer} />
        <div className="border-t p-3">
            <div className="border-t border-sidebar-border pt-3">
            <div className="flex items-center gap-2 text-xs font-medium text-sidebar-accent-foreground">
              <ShieldCheck className="size-3.5" />
              Demo workspace
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Data is stored locally and resets with the browser.
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="flex h-16 justify-center border-b px-5">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <NavigationLinks
                pathname={pathname}
                isAdmin={isAdmin}
                isCustomer={isCustomer}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="hidden min-w-0 sm:block">
            <p className="text-xs text-muted-foreground">Workspace</p>
            <p className="truncate text-sm font-medium">{currentSection}</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
             <Badge variant="outline" className="hidden border-primary/25 bg-primary/5 text-primary sm:inline-flex">
              {isAdmin ? "Admin access" : user.role === "STAFF" ? "Internal staff access" : "Customer access"}
            </Badge>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Open account menu for ${user.name}`}
                  className="flex min-h-11 items-center gap-2 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-muted"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 flex-col sm:flex">
                    <span className="max-w-32 truncate text-xs font-medium">
                      {user.name}
                    </span>
                    <span className="max-w-32 truncate text-[10px] text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="py-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                  Signed in as {user.role.toLowerCase()}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void logout()}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
