# Contexto del Proyecto

Este documento sirve como referencia rápida de la arquitectura, configuración y convenciones del proyecto para futuras consultas y modificaciones.

## 1. RESUMEN GENERAL
- **Nombre del proyecto:** Aplicación de Gestión de Producción e Inventario
- **Propósito:** Sistema integral para seguimiento de fórmulas de producción, métricas en tiempo real, control de stock de materias primas y administración de remitos/envíos.
- **Empresa/Planta:** Planta de Producción V (basado en referencias al logo de *V rosa*).
- **Stack Tecnológico:**
  - **Frontend:** React 18, Vite, TypeScript, Tailwind CSS.
  - **Componentes y UI:** Radix UI, Shadcn, Lucide React, Framer Motion, Recharts.
  - **Base de Datos / Backend:** Supabase (PostgreSQL), Supabase Realtime, Supabase Auth.
  - **Otras Librerías:** `date-fns` (fechas), `jspdf` & `jspdf-autotable` (PDFs), `sonner` (notificaciones/toasts).
- **Cómo correr el proyecto localmente:**
  ```bash
  npm install
  npm run dev
  ```
  La app se ejecutará en http://localhost:8080.

## 2. ESTRUCTURA DE CARPETAS
Mapeo de la carpeta `src/` que agrupa el código fuente de la aplicación:
```text
src/
├── components/      → Contiene casi toda la UI de la aplicación.
│   ├── Auth/        → Componentes para inicio de sesión, contexto de Auth y protección de rutas.
│   ├── ui/          → Componentes base genéricos y primitivos (Shadcn / Radix).
│   └── (varios)     → Componentes funcionales principales: Navigation, Tablas, Modales, etc.
├── contexts/        → Originalmente destinado a Context API (ahora vacío, la app usa /components/Auth).
├── hooks/           → Custom hooks para React. Contiene toda la lógica de suscripción a Supabase Realtime (`useRealtimeProductos`, `useRealtimeInventory`, etc).
├── integrations/    → Configuraciones de librerías externas. Contiene el cliente singleton de `supabase/client.ts`.
├── lib/             → Utilidades generales como `utils.ts` para merging de clases CSS (clsx, twMerge).
├── pages/           → Vistas de nivel superior. Principalmente `Index.tsx` que orquesta los componentes y las URLs.
├── services/        → Archivos de interacción directa con Supabase (`productoService.ts`, `userService.ts`, etc.) aislando lógica de BD.
├── types/           → Interfaces y tipos globales de TypeScript.
└── utils/           → Pequeñas funciones de utilidad o formateadores.
```

## 3. ROLES Y PERMISOS
El sistema opera a través de 3 roles principales gestionados en Supabase:
- **`admin`:** Control total. Puede crear/editar usuarios, alterar datos maestros (fórmulas, inventario en masa), visualizar dashboards completos y hacer operaciones críticas o destructivas.
- **`user`:** Operador logueado. Puede registrar producciones, crear remitos, ver inventario y actualizar el progreso diario. No puede gestionar usuarios.
- **`consulta`:** Perfil de solo lectura. Permite ver el estado en tiempo real, dashboards y reportes, pero no puede ejecutar operaciones de escritura ni borrar datos.
- **Dónde se validan:**
  - **Frontend:** En React, mediante utilidades como `checkAdminStatus` en los propios componentes y evaluando `user.role` desde el hook `useAuth()`.
  - **Backend (Supabase):** Mediante políticas RLS (Row Level Security) en las tablas de PostgreSQL y en las funciones RPC de base de datos.
- **Detección:** Se utiliza el React Context `AuthContext` (en `src/components/Auth/AuthProvider.tsx`) que almacena la información devuelta por el servidor (con un respaldo en localStorage) e hidrata una estructura `{ id, user_name, role, ... }`.

## 4. BASE DE DATOS
Se utiliza **Supabase (PostgreSQL)** como base de datos en la nube y controlador backend.
- **Tablas Principales:**
  - `productos`: Almacena las "fórmulas" y productos a fabricar.
  - `inventory`: Sistema de gestión de stock de materias primas.
  - `users`: Creenciales y roles para operadores.
  - `remitos` / `envios`: Tablas que registran el movimiento de despachos.
- **Realtime:** Se utiliza extensivamente `Supabase Realtime`, permitiendo actualizaciones de UI multicliente sin refrescar.
- **Ubicación Queries:** Las llamadas DML se manejan con hooks en `src/hooks/` (ej. `useRealtimeProductos.ts`) llamando internamente a los métodos exportados por los archivos dentro de `src/services/`.

## 5. COMPONENTES PRINCIPALES
- **`Navigation.tsx`**: Barra lateral / menú principal. Controla el toggle menu, ruteo por estados para SPA, y contiene el botón para cerrar sesión e instalar como PWA. Recibe `activeSection` de prop.
- **`DashboardMetrics.tsx`**: El hub analítico. Muestra métricas destacadas, gráficos circulares (Recharts) y alertas tempranas (stock bajo). Permite crear PDFs directos sobre el viaje actual o todas las fórmulas. Contiene lógica pesada y fetch generalizado para cálculos globales.
- **`InventorySection.tsx`**: Panel de tabla de materias primas. Agrupa los ítems, calcula el % de stock respecto al mínimo, maneja colores de viñetas, y permite conversiones automáticas Gramos ↔ Kilogramos a través de funciones helpers integradas (`getSmartUnit`).
- **`UserAdminPanel.tsx`**: Sección para la gestión de usuarios exclusiva de `admin`. Lista usuarios, muestra horas de última actividad (`Heartbeat/RealtimeUsers`), y permite hacer reset de passwords o compartir credenciales mediante QRCode (botón Compartir QR).
- **`ReportModal` / `ProductionStatsModal.tsx`**: Modal dedicado a visualizar KPIs y rendimiento de la planta.
- **`CalendarModal.tsx`**: Un modal robusto con un calendario interactivo (usando `date-fns` o `react-day-picker`) para trazar feriados argentinos, turnos o planificaciones en días específicos.
- **`RemitoProduction.tsx`**: Módulo del workflow de envíos que permite tildar o destildar ítems completados para consolidarlos en la generación de un nuevo Remito para Supabase.
- **`Auth/` (AuthProvider, LoginForm, ProtectedRoute)**: Wrappers clave que bloquean o inyectan dependencias globales de usuario autenticado a la jerarquía de componentes.

## 6. CONTEXTOS Y HOOKS
### Contextos (Context API)
- **`AuthContext`**: Define el estado global del usuario (session, role).
- **`ThemeContext`**: (A ravés de ThemeProvider) Inyecta el modo actual de la interface y lo persiste en localStorage.

### Hooks Personalizados (Top)
Lógica en `src/hooks/`
- **`useRealtimeProductos.ts`**: Mantienen sincronizado `productos` desde Supabase channels.
- **`useRealtimeInventory.ts`**: Mantienen sincronizada la tabla `inventory`.
- **`useRealtimeUsers.ts`**: Para presencias o lista compartida de usuarios en admin panel.
- **`usePWA.ts`**: Administra la lógica e interacción para lanzar el toast "Instalar App".
- **`useUserActivity.ts`**: Dispara un trigger periódico (Heartbeat) de la actividad del operador a la DB.

## 7. SISTEMA DE TEMAS
- **Funcionamiento Clásico:** Hay un toggle Claro/Oscuro en `ThemeToggle.tsx` (representado con un Sol y una Luna de Lucide Icons).
- **Dónde se define:** En `src/components/ThemeProvider.tsx` mediante un `createContext`. Añade dinámicamente las clases del DOM HTML `dark` o `light`.
- **Dinámica temporal:** Extrañamente el sistema detecta la hora (`hour = new Date().getHours()`) e inyecta además clases decorativas (`time-morning`, `time-afternoon`, `time-night`).

## 8. GENERACIÓN DE PDFs
- **Librería Usada:** `jspdf` y `jspdf-autotable`.
- **Tipos de PDFs:**
  - *Reporte de Producción/Métricas.*
  - *Lista de Fórmulas Consolidadas y Recetas.*
  - *Viaje Actual / Remitos exportados.*
- **Lógica e Invocación:** Múltiples generadores ubicados dentro de hooks del componente que los usa (`DashboardMetrics` o `FormulasSection.tsx` con métodos como `buildPDFContent()`). Disponen de función `didDrawPage` para el header y paginado.

## 9. FEATURES IMPLEMENTADAS
- [x] Autenticación dual (User/Pass validado por RPCs de base de datos) con session state.
- [x] Dashboard de Métricas con cálculos en vivo (Fórmulas Incompletas vs Completas).
- [x] Stock Inteligente en inventario y autoconversión Kilos-Gramos dinámica.
- [x] Generador de reportes PDF locales multi-páginas (Viaje y Fórmulas).
- [x] PWA Instalable por service worker.
- [x] Gestión robusta de Fórmulas y Recetarios (Componente `FormulasSection`).
- [x] Integración *Realtime* nativa para pantallas actualizándose síncronamente en todos lados.
- [x] Componente UI del Calendario con feriados Argentinos.
- [x] Modal "Compartir Credenciales por QR" nativo sobre `UserAdminPanel`.
- [x] Roles funcionales (soporte nativo para Admin, User, Consulta).

## 10. FEATURES PENDIENTES O EN PROGRESO
- [ ] Optimización de `DashboardMetrics` (A VERIFICAR: Archivo monstruo de >1500 líneas, propenso para refactor de funciones pdf-export a modulo externo).
- [ ] Centralizar más estrictamente validaciones RLS, actualmente existen fallbacks pesados en frontend que podrían mitigarse on-db.
- [ ] Estandarizar completamente notificaciones `sonner` vs las redundantes de native `alert`.

## 11. DECISIONES TÉCNICAS IMPORTANTES
- **No Refactor masivo de contexts:** A favor del setup simple de Supabase, toda la sincronización de las store state fue delegada a Hooks *Realtime* independientes por sección, en vez de un mastodonte global Redux.
- **Gráficos ligeros:** Elección de *Recharts* por su buena adaptabilidad natural al viewport en lugar de librerías costosas.
- **Tipado Flexible (A Verificar):** Hay uso explícito de tipado fuerte en `types/` pero muchos hooks importan los esquemas sobre `any` en casos de emergencia, se sugiere respeto a las queries autogeneradas de Supabase si existen.
- **Mantenibilidad:** Nunca modificar la base unit-storage matemática del `InventorySection.tsx` sin ser muy consciente. *Todo entra y sale a DB como gramos y la visualización disfraza el número si es Kilos.*

## 12. DATOS REALES EN PRODUCCIÓN
⚠️ **SECCIÓN CRÍTICA:**
- Las credenciales y auth settings viven integradas a la metadata del proyecto en Supabase en el ambiente Producción. Manipular usuarios con RPC directo es destructivo.
- Las tablas activas en Supabase (`productos`, `inventory`) contienen registros actuales valiosos manejados por sincronía de Channels Postgres. Alterarlas manualmente sin pasar por el ORM / Hooks o en un comando crudo de SQL borrará el rastro Realtime y puede ocasionar un crash por colisiones on-sync de UI.

## 13. HISTORIAL DE CAMBIOS RECIENTES
Los últimos updates notorios implican pulidos de usabilidad, organización de bases de datos y visuales de impresión:
- **Vista Previa de Remito / Impresión (A4):** Creación del componente dedicado `VistaPreviaPlantaVarela.tsx` utilizando React Portals (`createPortal`). Permite imprimir remitos con formato exacto A4 (8cm margen superior, 6cm inferior, fecha alineada a 5cm) sin interferir con el DOM web global. Además, la tabla fue optimizada (sin bordes) para acomodar ~21 productos por hoja fluidamente.
- **Impresión Directa Dashboard:** Añadido el botón "Imprimir A4" en el modal de Producción (Viaje Actual) dentro de `DashboardMetrics.tsx` para lanzar directamente el nuevo componente de Remito.
- **Ordenamiento Global por Lote:** Implementación del sistema de ordenamiento estricto por `Lote` (de forma Ascendente - ASC) a lo largo de toda la aplicación, impactando hooks, UI, y en la matriz de los generadores PDF sin alterar la base de datos de Supabase.
- **UI/UX Re-Theme:** Se rediseñó el modal superior visual (Reporte de Planta) alterando métricas UI y estilos, incorporando la fuente **Cormorant Garamond** para títulos y acoplándose al logo corporativo (**V Rosa**).
- **Control de Viajes:** Refactor del pasaje seguro de la fase Remito a sección Envíos (`fix_missing_envio` implementado).
- **Roles:** Oficializado el ROL "consulta" y su handling de solo lectura.

---
*Última actualización: 19 de Marzo de 2026*
