import { BarChart3, Package, FlaskConical, Truck, Menu, X, LogOut, User, Download, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { MobileUserIndicator } from "@/components/MobileUserIndicator";
import { DateTimeDisplay } from "@/components/DateTimeDisplay";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/Auth/AuthProvider";
import { usePWA } from "@/hooks/usePWA";
import { UserService } from "@/services/userService";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const Navigation = ({ activeSection, onSectionChange }: NavigationProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user, signOut } = useAuth();
  const { isInstallable, isInstalled, installApp } = usePWA();

  // Efecto para manejar la animación de cierre
  useEffect(() => {
    if (isMobileMenuOpen) {
      setIsAnimating(true);
    } else {
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isMobileMenuOpen]);

  // Verificar si el usuario actual es admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await UserService.isCurrentUserAdmin();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error verificando rol de administrador:', error);
        setIsAdmin(false);
      }
    };

    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  // Rol consulta: solo lectura, sin producción ni usuarios
  const isConsulta = user?.role === 'consulta';

  // Helper: etiqueta del rol para mostrar en el perfil
  const roleLabel = user?.role === 'admin' || user?.role === 'superadmin'
    ? 'Administrador'
    : user?.role === 'consulta'
    ? 'Consulta'
    : 'Usuario';
  
  const allNavItems = [
    { id: "dashboard",  label: "Dashboard",  icon: BarChart3 },
    { id: "inventory",  label: "Inventario",  icon: Package },
    { id: "formulas",   label: "Productos",   icon: FlaskConical },
    { id: "production", label: "ENVIOS",  icon: Truck,  consultaHidden: true },
    { id: "users",      label: "Usuarios",    icon: Users,  adminOnly: true },
  ];

  // Filtrar según rol: consulta no ve Producción ni Usuarios; user no ve Usuarios
  const navItems = allNavItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.consultaHidden && isConsulta) return false;
    return true;
  });

  const handleNavClick = (section: string) => {
    onSectionChange(section);
    setIsMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleInstallApp = async () => {
    const success = await installApp();
    if (success) {
      console.log('App instalada exitosamente');
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        {/* Top row with logo and navigation */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Logo size="lg" />
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {/* Main Navigation Items */}
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => onSectionChange(item.id)}
                  className={`flex items-center space-x-2 px-4 h-11 rounded-xl transition-all duration-300 ${
                    activeSection === item.id 
                      ? "bg-[#023F86] text-white shadow-lg shadow-blue-500/20" 
                      : "text-slate-500 hover:text-[#023F86] dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  size="sm"
                >
                  <Icon className={`h-4 w-4 ${activeSection === item.id ? 'animate-pulse' : ''}`} />
                  <span className="hidden lg:inline font-bold text-sm tracking-tight">{item.label}</span>
                </Button>
              );
            })}
            
            {/* Separator */}
            <div className="h-6 w-px bg-border mx-2"></div>
            
            {/* Theme Toggle */}
            <ThemeToggle />
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2 px-3">
                  <User className="h-4 w-4" />
                  <span className="hidden lg:inline text-sm truncate max-w-32">
                    {user?.user_name}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.user_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'admin' || user?.role === 'superadmin' ? 'Administrador' : user?.role === 'consulta' ? 'Consulta' : 'Usuario'}
                  </p>
                </div>
                <DropdownMenuSeparator />
                {isInstallable && !isInstalled && (
                  <>
                    <DropdownMenuItem onClick={handleInstallApp} className="flex items-center space-x-2">
                      <Download className="h-4 w-4" />
                      <span>Instalar App</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center space-x-2 text-red-600">
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button and Theme Toggle */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <MobileUserIndicator />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative transition-all duration-300 ease-in-out hover:scale-105"
            >
              <div className="relative w-5 h-5">
                <Menu 
                  className={`h-5 w-5 absolute transition-all duration-300 ease-in-out ${
                    isMobileMenuOpen 
                      ? 'opacity-0 rotate-180 scale-0' 
                      : 'opacity-100 rotate-0 scale-100'
                  }`} 
                />
                <X 
                  className={`h-5 w-5 absolute transition-all duration-300 ease-in-out ${
                    isMobileMenuOpen 
                      ? 'opacity-100 rotate-0 scale-100' 
                      : 'opacity-0 -rotate-180 scale-0'
                  }`} 
                />
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {(isMobileMenuOpen || isAnimating) && (
          <div className={`md:hidden border-t border-border bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen 
              ? 'max-h-screen opacity-100 translate-y-0' 
              : 'max-h-0 opacity-0 -translate-y-4'
          }`}>
            <div className="py-4 space-y-1">
              {/* Date/Time for Mobile */}
              <div className={`px-4 py-2 bg-muted/30 transition-all duration-500 ease-out ${
                isMobileMenuOpen 
                  ? 'opacity-100 translate-x-0' 
                  : 'opacity-0 -translate-x-4'
              }`} style={{ transitionDelay: isMobileMenuOpen ? '100ms' : '0ms' }}>
                <DateTimeDisplay format="full" />
              </div>
              
              {/* Navigation Items */}
              <div className="px-2 space-y-1">
                {navItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "default" : "ghost"}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full justify-start space-x-3 h-12 transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-md ${
                        isMobileMenuOpen 
                          ? 'opacity-100 translate-x-0' 
                          : 'opacity-0 -translate-x-4'
                      }`}
                      style={{ 
                        transitionDelay: isMobileMenuOpen ? `${150 + (index * 100)}ms` : '0ms' 
                      }}
                    >
                      <Icon className="h-5 w-5 transition-transform duration-200 ease-in-out group-hover:scale-110" />
                      <span className="text-base">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
              
              {/* Separator */}
              <div className={`border-t border-border my-3 transition-all duration-500 ease-out ${
                isMobileMenuOpen 
                  ? 'opacity-100 scale-x-100' 
                  : 'opacity-0 scale-x-0'
              }`} style={{ transitionDelay: isMobileMenuOpen ? '600ms' : '0ms' }}></div>
              
              {/* Install App Button for Mobile */}
              {isInstallable && !isInstalled && (
                <div className={`px-2 transition-all duration-500 ease-out ${
                  isMobileMenuOpen 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 -translate-x-4'
                }`} style={{ transitionDelay: isMobileMenuOpen ? '700ms' : '0ms' }}>
                  <Button
                    variant="outline"
                    onClick={handleInstallApp}
                    className="w-full justify-start space-x-3 h-12 transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-md"
                  >
                    <Download className="h-5 w-5 transition-transform duration-200 ease-in-out group-hover:scale-110" />
                    <span className="text-base">Instalar App</span>
                  </Button>
                </div>
              )}
              
              {/* User Actions for Mobile */}
              <div className={`px-2 space-y-2 transition-all duration-500 ease-out ${
                isMobileMenuOpen 
                  ? 'opacity-100 translate-x-0' 
                  : 'opacity-0 -translate-x-4'
              }`} style={{ transitionDelay: isMobileMenuOpen ? '800ms' : '0ms' }}>
                {/* User Info */}
                <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.user_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.role === 'admin' || user?.role === 'superadmin' ? 'Administrador' : user?.role === 'consulta' ? 'Consulta' : 'Usuario'}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="space-y-1">
                  {isInstallable && !isInstalled && (
                    <Button
                      variant="outline"
                      onClick={handleInstallApp}
                      className="w-full justify-start space-x-3 h-10"
                    >
                      <Download className="h-4 w-4" />
                      <span>Instalar App</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    className="w-full justify-start space-x-3 h-10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};