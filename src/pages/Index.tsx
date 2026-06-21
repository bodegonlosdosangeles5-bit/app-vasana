import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { InventorySection } from "@/components/InventorySection";
import { FormulasSection } from "@/components/FormulasSection";
import { ProductionSection } from "@/components/ProductionSection";
import { UserAdminPanel } from "@/components/UserAdminPanel";
import { ActivityLogPanel } from "@/components/ActivityLogPanel";
import { useRealtimeProductos } from "@/hooks/useRealtimeProductos";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useRealtimeInventory } from "@/hooks/useRealtimeInventory";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Producto } from "@/services/productoService";
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute";
import { WorldCupBall } from "@/components/WorldCupBall";
import { AuthProvider, useAuth } from "@/components/Auth/AuthProvider";
import { RemitoService } from "@/services/remitoService";
import { toast } from "sonner";

// Componente interno para poder usar useAuth() dentro del árbol AuthProvider
const IndexContent = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const { user } = useAuth();

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

  // Instancia centralizada de inventario (evita doble query desde DashboardMetrics)
  const { inventoryItems } = useRealtimeInventory();
  
  // Rastrear actividad del usuario (heartbeat)
  useUserActivity();

  // Reparar remitos huérfanos una sola vez al montar (solo admin)
  useEffect(() => {
    const repararHuerfanos = async () => {
      if (user?.role !== 'admin') return;
      try {
        const resultado = await RemitoService.repararRemitosHuerfanos();
        if (resultado.reparados > 0) {
          toast.success(
            `Se recuperaron ${resultado.reparados} envío(s) que no se habían guardado correctamente.`
          );
        }
      } catch (_) {}
    };
    repararHuerfanos();
  }, []); // Solo al montar

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
        return <ProductionSection 
          formulas={productos as Producto[]}
          updateProducto={updateProducto}
          deleteProducto={deleteProducto}
        />;
      case "users":
        if (user?.role !== 'superadmin') return null;
        return <UserAdminPanel />;
      case "historial":
        if (user?.role !== 'superadmin') return null;
        return <ActivityLogPanel />;
      default:
        return <DashboardMetrics 
          formulas={productos as Producto[]} 
          onNavigateToProduction={() => setActiveSection("production")}
          inventoryItems={inventoryItems}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      <div className="particles-container"></div>
      <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
      <WorldCupBall />
      
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
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <IndexContent />
      </ProtectedRoute>
    </AuthProvider>
  );
};

export default Index;