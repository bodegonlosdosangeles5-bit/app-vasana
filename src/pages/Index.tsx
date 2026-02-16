import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { InventorySection } from "@/components/InventorySection";
import { FormulasSection } from "@/components/FormulasSection";
import { ProductionSection } from "@/components/ProductionSection";
import { UserAdminPanel } from "@/components/UserAdminPanel";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Producto } from "@/services/productoService";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";
import { AuthProvider } from "@/components/Auth/AuthProvider";

const Index = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  
  // Usar el hook de productos con Supabase Realtime
  const { 
    productos, 
    loading, 
    error, 
    createProducto, 
    updateProducto, 
    deleteProducto,
    addMissingIngredient,
    removeMissingIngredient,
    updateIncompleteProductosStatus
  } = useRealtimeProductos();

  // Usar el hook de actualizaciones en tiempo real
  const { isConnected, lastUpdate } = useRealtimeUpdates();
  
  // Rastrear actividad del usuario (heartbeat)
  useUserActivity();
  
  // Logging para debug
  console.log('🏠 Index.tsx - Estado actual:', { 
    productosCount: productos.length, 
    loading, 
    error, 
    activeSection,
    isConnected,
    lastUpdate,
    productos: productos
  });
  
  // Log adicional para debug
  if (error) {
    console.error('🚨 Error en Index.tsx:', error);
  }
  
  if (loading) {
    console.log('⏳ Index.tsx - Cargando productos...');
  }

  // Log de actualizaciones en tiempo real
  if (lastUpdate) {
    console.log('🔄 Actualización en tiempo real detectada:', lastUpdate);
  }

  const renderSection = () => {
    switch (activeSection) {
      case "inventory":
        return <InventorySection />;
      case "formulas":
        return <FormulasSection 
          formulas={productos} 
          setFormulas={() => {}} // Función vacía ya que usamos Supabase Realtime
          createFormula={createProducto}
          updateFormula={updateProducto}
          deleteFormula={deleteProducto}
          addMissingIngredient={addMissingIngredient}
          removeMissingIngredient={removeMissingIngredient}
          updateIncompleteFormulasStatus={async () => {
            const result = await updateIncompleteProductosStatus();
            return { updated: result.updated, formulas: result.productos };
          }}
          loading={loading}
          error={error}
        />;
      case "production":
        return <ProductionSection formulas={productos as Producto[]} />;
      case "users":
        return <UserAdminPanel />;
      default:
        return <DashboardMetrics 
          formulas={productos as Producto[]} 
          onNavigateToProduction={() => setActiveSection("production")}
        />;
    }
  };

  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
          <div className="particles-container"></div>
          <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
          
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
            {/* Dashboard Header with Date/Time */}
            <div className="mb-10 lg:mb-14">
              <DashboardHeader enableDateDialog />
            </div>
            
            <div className="max-w-7xl mx-auto">
              <div className="transition-all duration-500 ease-in-out">
                {renderSection()}
              </div>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
};

export default Index;