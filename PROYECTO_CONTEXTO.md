# Contexto del Proyecto

Este documento sirve como referencia rápida de la arquitectura, configuración y convenciones del proyecto para futuras consultas y modificaciones.

## 1. RESUMEN GENERAL
- **Nombre del proyecto:** Aplicación de Gestión de Producción e Inventario
- **Propósito:** Sistema integral para seguimiento de fórmulas de producción, métricas en tiempo real, control de stock de materias primas y administración de remitos/envíos.
- **Empresa/Planta:** VASANA SA — Planta Varela.
- **Stack Tecnológico:**
  - **Frontend:** React 18, Vite, TypeScript, Tailwind CSS.
  - **Componentes y UI:** Radix UI, Shadcn, Lucide React, Framer Motion, Recharts.
  - **Base de Datos / Backend:** Supabase (PostgreSQL), Supabase Realtime, Supabase Auth.
  - **Otras Librerías:** `date-fns` (fechas), `jspdf` & `jspdf-autotable` (PDFs), `sonner` (notificaciones/toasts).
- **Cómo correr el proyecto localmente:**
  ```bash
  npm install
  vercel dev
  ```
  La app se ejecutará en http://localhost:3000 (o el puerto que asigne Vercel).
  > ⚠️ **Importante:** usar `vercel dev` en lugar de `npm run dev` para que las rutas serverless `/api/login` y `/api/get-metrics` funcionen correctamente. Evitar el uso de `host: "::"` en `vite.config.ts` para no crashear el proxy local de Vercel en Windows (Node IPv6 ECONNRESET).

## 2. ESTRUCTURA DE CARPETAS
Mapeo de la carpeta `src/` que agrupa el código fuente de la aplicación:
```text
src/
├── components/      → Contiene casi toda la UI de la aplicación.
│   ├── Auth/        → Componentes para inicio de sesión, contexto de Auth y protección de rutas.
│   ├── ui/          → Componentes base genéricos y primitivos (Shadcn / Radix).
│   └── (varios)     → Componentes funcionales principales: Navigation, Tablas, Modales, etc.
├── contexts/        → Originalmente destinado a Context API (ahora vacío, la app usa /components/Auth).
├── hooks/           → Custom hooks para React. Contiene toda la lógica de suscripción a Supabase Realtime.
├── integrations/    → Configuraciones de librerías externas. Contiene el cliente singleton `supabase/client.ts`.
├── lib/             → Utilidades generales como `utils.ts` para merging de clases CSS (clsx, twMerge).
├── pages/           → Vistas de nivel superior. Principalmente `Index.tsx` que orquesta componentes.
├── services/        → Archivos de interacción directa con Supabase aislando lógica de BD.
├── types/           → Interfaces y tipos globales de TypeScript.
└── utils/           → Pequeñas funciones de utilidad o formateadores.
api/
├── login.ts         → Función serverless Vercel. Autentica usuarios usando `service_role` para bypassear RLS.
└── get-metrics.ts   → Función serverless Vercel. Ejecuta vistas SQL de métricas de producción.
```

## 3. ROLES Y PERMISOS
El sistema opera a través de 3 roles principales gestionados en Supabase:
- **`admin` / `superadmin`:** Control total. Puede crear/editar usuarios, alterar datos maestros, visualizar dashboards completos y hacer operaciones críticas o destructivas. También pueden generar remitos y eliminar lotes.
- **`user`:** Operador logueado. Puede registrar producciones, crear remitos, ver inventario y actualizar progreso diario. No puede gestionar usuarios.
- **`consulta`:** Perfil de solo lectura. Permite ver el estado en tiempo real, dashboards y reportes, pero no puede ejecutar operaciones de escritura ni borrar datos. **No ve la sección ENVIOS.**
- **Usuario especial:** El usuario con `user_name === 'jose'` tiene permisos de edición/eliminación equivalentes a admin, independientemente de su rol formal.
- **Dónde se validan:**
  - **Frontend:** Evaluando `user.role` y `user.user_name` desde el hook `useAuth()`.
  - **Backend (Supabase):** Mediante políticas RLS y funciones RPC de base de datos.
- **Detección:** Se utiliza el React Context `AuthContext` (`src/components/Auth/AuthProvider.tsx`) que almacena la información devuelta por la serverless `/api/login` y la persiste en localStorage.

## 4. BASE DE DATOS
Se utiliza **Supabase (PostgreSQL)** como base de datos en la nube.
- **Tablas Principales:**
  - `productos`: Almacena los lotes de producción (fórmulas). Campos clave: `status`, `destination`, `stock_actual`, `batchSize`, `lote_code`.
  - `inventory`: Sistema de gestión de stock de materias primas.
  - `users`: Credenciales y roles para operadores.
  - `remitos`: Cabecera de los remitos de despacho (id, destino, fecha, total_kilos, estado, observaciones).
  - `remito_items`: Líneas de detalle de cada remito (producto_id, nombre_producto, kilos_sumados, lote, etc.).
  - `envios`: Agrupa remitos en envíos/viajes hacia un destino.
  - `activity_logs`: Historial de auditoría de acciones admin (ediciones y eliminaciones de lotes).
- **Vistas SQL usadas (vía API serverless):**
  - `vista_metricas_produccion_total`: Producción histórica agrupada por fecha.
  - `vista_comparativa_hoy_ayer`: Comparación de kilos producidos hoy vs ayer.
- **Realtime:** Se utiliza extensivamente, permitiendo actualizaciones de UI multicliente sin refresh.
- **Fallback de Métricas:** Si la API serverless no responde, `DashboardMetrics` calcula totales directamente desde los productos cargados en memoria como fallback.

## 5. COMPONENTES PRINCIPALES
- **`Navigation.tsx`**: Menú principal. Labeling actualizado: "Producción" → **"ENVIOS"**. Filtra ítems según rol (consulta no ve ENVIOS ni Usuarios).
- **`DashboardMetrics.tsx`**: Hub analítico principal. Muestra métricas diarias/semanales/mensuales con fallback de cálculo local si la API falla. También incluye botones de exportación PDF y Vista Previa.
- **`ProductionSection.tsx`**: Panel de control de envíos. Contiene:
  - Botón dorado **"REMITO MANUAL"** (abre `RemitoManualModal`).
  - Indicador de "Kilos en Viaje" (suma de `stock_actual` de productos `available` en Villa Martelli).
  - Tabs: **"Envios a Villa Martelli"** (antes "Remito Villa Martelli") y **"Envíos"**.
  - Historial de cambios de auditoría (últimos 5 logs de `activity_logs`).
- **`RemitoProduction.tsx`**: Workflow de generación del Remito principal. Permite seleccionar ítems y generar un remito en Supabase. Genera envío + remito en una transacción. **No modificar su lógica.**
- **`RemitoManualModal.tsx`**: Modal de carga manual de remitos. Permite:
  - Editar el encabezado de impresión (3 líneas: empresa, dirección, localidad) con valores por defecto `VASANA SA / TALCAHUANO 279 / VILLA MARTELLI`.
  - Agregar filas con Lote, Producto, Cliente/Destino y Kilos.
  - Guardar en Supabase (tablas `remitos` + `remito_items`) con ID `REM-MAN-{timestamp}`.
  - Imprimir en formato A4 vía `VistaPreviaRemitoManual`.
- **`VistaPreviaRemitoManual.tsx`**: Componente de impresión A4 para remitos manuales. Acepta `items` y `headerLines` (las 3 líneas de encabezado editables). Usa `createPortal` para inyectarse en `document.body` solo al imprimir.
- **`VistaPreviaPlantaVarela.tsx`**: Componente de impresión A4 para el remito oficial de producción. **Textos de encabezado fijos, no modificar.**
- **`EnvioDetailModal.tsx`**: Modal que muestra el detalle de un envío con sus remitos asociados.
- **`InventorySection.tsx`**: Panel de tabla de materias primas con conversiones Gramos ↔ Kilogramos.
- **`UserAdminPanel.tsx`**: Gestión de usuarios exclusiva de admin. Incluye QR de credenciales y heartbeat de actividad.
- **`ProductionStatsModal.tsx`**: Modal de KPIs y rendimiento de la planta.
- **`Auth/` (AuthProvider, LoginForm, ProtectedRoute)**: Wrappers de autenticación. El login llama a `/api/login` (serverless).

## 6. CONTEXTOS Y HOOKS
### Contextos (Context API)
- **`AuthContext`**: Estado global del usuario (session, role, user_name).
- **`ThemeContext`**: Inyecta modo claro/oscuro y lo persiste en localStorage.

### Hooks Personalizados
Lógica en `src/hooks/`:
- **`useRealtimeProductos.ts`**: Sincroniza `productos` desde Supabase Realtime channels. Expone `createProducto`, `updateProducto`, `deleteProducto`.
- **`useRealtimeInventory.ts`**: Sincroniza la tabla `inventory`.
- **`useRealtimeEnvios.ts`**: Sincroniza la tabla `envios` + helper `getEnvioConRemitos`.
- **`useRealtimeRemitos.ts`**: Sincroniza remitos activos (con fallback a polling).
- **`useRemitosPolling.ts`**: Alternativa por polling si Realtime falla.
- **`useRemitos.ts`**: Hook para consultar todos los remitos con sus items.
- **`useRealtimeUsers.ts`**: Lista compartida de usuarios en admin panel.
- **`usePWA.ts`**: Lógica para instalar la app como PWA.
- **`useUserActivity.ts`**: Heartbeat periódico de actividad del operador a la DB.

## 7. SISTEMA DE TEMAS
- **Toggle Claro/Oscuro** en `ThemeToggle.tsx` con íconos Sol/Luna (Lucide).
- **Definido en:** `src/components/ThemeProvider.tsx` con `createContext`. Añade clases `dark`/`light` al DOM.
- **Dinámica temporal:** Detecta la hora e inyecta clases decorativas adicionales (`time-morning`, `time-afternoon`, `time-night`).

## 8. GENERACIÓN DE PDFs / IMPRESIÓN
- **Librería PDF:** `jspdf` y `jspdf-autotable` — usada en `DashboardMetrics.tsx` para reportes exportables.
- **Impresión A4 via Portal:**
  - `VistaPreviaPlantaVarela.tsx` → Remito oficial de producción (encabezado fijo).
  - `VistaPreviaRemitoManual.tsx` → Remito manual (encabezado editable por el usuario).
  - Ambos usan `createPortal(content, document.body)` y CSS `@media print` para aislar el layout de impresión del DOM web.
  - Paginado: 25 ítems por hoja, con totales en la última página. Margen superior 8cm, inferior 6cm.

## 9. AUTENTICACIÓN SERVERLESS Y SEGURIDAD
- **Flujo:** `LoginForm.tsx` → POST a `/api/login` → función Vercel con `supabaseAdmin` (`service_role`) → consulta tabla `users` → responde con datos del usuario.
- **Seguridad Backend:** El endpoint `/api/login` está protegido con un **Rate Limit** en memoria (10 intentos / 15 mins por IP). Los endpoints serverless `/api/*` poseen política restrictiva de **CORS** (`Vary: Origin`) permitiendo solo los dominios explícitos locales y el de Vercel de producción.
- **Contraseñas Seguras (Bcrypt):** Las contraseñas en la tabla `users` están hasheadas usando `bcryptjs`. La función de login soporta fallback automático para texto plano de cara a transiciones suaves. *(Migrado via `scripts/hash-passwords.mjs`)*.
- **Manejo de Sesión:** `AuthProvider.tsx` gestiona las sesiones en el frontend usando Context y persistencia en `localStorage`. Se agregó una expiración forzada de **12 horas**, validada tanto al inicio como en almacenamiento.
- **Por qué Serverless:** La tabla `users` tiene RLS activo. El `anon key` público no puede leerla. La clave `service_role` nunca se expone al browser — solo vive en las variables de entorno del servidor Vercel.
- **Variables de Entorno requeridas (`.env`):**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ← solo disponible en el servidor, nunca en el cliente.
- **Métricas Serverless:** `/api/get-metrics` ejecuta las vistas SQL de producción usando `service_role`. Si esta ruta no está disponible (ej. `npm run dev` puro), `DashboardMetrics` usa el fallback de cálculo en memoria.

## 10. FEATURES IMPLEMENTADAS
- [x] Autenticación serverless (User/Pass via `/api/login` con `service_role`).
- [x] Dashboard de Métricas con cálculos en vivo + fallback local si API falla.
- [x] Stock Inteligente en inventario con autoconversión Kilos-Gramos dinámica.
- [x] Generador de reportes PDF multi-páginas (Viaje y Fórmulas).
- [x] PWA Instalable por service worker.
- [x] Gestión robusta de Fórmulas y Recetarios (`FormulasSection`).
- [x] Integración Realtime nativa y centralizada (orquestación en `Index.tsx`) mitigando duplicación de queries.
- [x] Eliminación de polling de backups innecesarios y websocket reduction.
- [x] Componente UI del Calendario con feriados Argentinos.
- [x] Modal "Compartir Credenciales por QR" en `UserAdminPanel`.
- [x] Roles funcionales: Admin, User, Consulta (con ocultamiento de sección ENVIOS para Consulta).
- [x] Ordenamiento global por número de Lote (ASC) en UI, PDF y hooks.
- [x] Historial de auditoría en `ProductionSection` (últimos 5 logs de edición/eliminación).
- [x] **Remito Manual:** Modal completo (`RemitoManualModal`) con:
  - Encabezado editable (3 líneas: empresa, dirección, localidad).
  - Tabla de carga manual (Lote, Producto, Cliente, Kilos).
  - Guardado directo en Supabase (`remitos` + `remito_items`).
  - Impresión A4 con encabezado dinámico (`VistaPreviaRemitoManual`).
- [x] Texto de navegación "Producción" renombrado a **"ENVIOS"**.
- [x] Tab "Remito Villa Martelli" renombrado a **"Envios a Villa Martelli"**.
- [x] Botón y modal de remito oficial renombrados: "Generar Remito" → **"GENERAR ENVIO"**, título → **"ENVIO DE PRODUCCION VILLA MARTELLI"**.
- [x] Mapa interactivo de ubicaciones de materiales en planta (SVG dinámico) en el Detalle de Inventario.

## 11. FEATURES PENDIENTES O EN PROGRESO
- [ ] Optimización de `DashboardMetrics.tsx` (>1500 líneas — candidato a refactor modular).
- [ ] Centralizar validaciones RLS, reduciéndolas del frontend a la base de datos.
- [ ] Estandarizar completamente notificaciones `sonner` vs `alert` nativo.
- [ ] Considerar que los remitos manuales (`REM-MAN-*`) aparezcan en el historial general de `useRealtimeRemitos` si se filtra por `observaciones = 'Remito Manual'`.

## 12. DECISIONES TÉCNICAS IMPORTANTES
- **No Redux:** Toda la sincronización de estado se delegó a hooks Realtime independientes por sección.
- **Gráficos ligeros:** Recharts por su buena adaptabilidad al viewport.
- **Tipado:** Tipado fuerte en `types/` pero con algunos `any` en casos de emergencia en queries Supabase — se sugiere usar los tipos autogenerados si están disponibles.
- **Inventario en Gramos:** Nunca modificar la lógica base del `InventorySection.tsx`. *Todo entra y sale a DB como gramos; la visualización convierte a Kilos si corresponde.*
- **Integridad del Remito Original:** El flujo de `RemitoProduction.tsx` y `VistaPreviaPlantaVarela.tsx` **no debe modificarse**. El Remito Manual es un sistema paralelo e independiente.
- **`formulasData` como fuente de verdad:** En `ProductionSection` y `DashboardMetrics`, se usa `formulasData = productos.length > 0 ? productos : formulas` para asegurar que los datos de Realtime tengan prioridad, con fallback a la prop si Supabase aún no cargó.

## 13. DATOS REALES EN PRODUCCIÓN
⚠️ **SECCIÓN CRÍTICA:**
- Las credenciales y auth settings viven integradas a la metadata del proyecto en Supabase. Manipular usuarios con RPC directo es destructivo.
- Las tablas activas (`productos`, `inventory`) contienen registros actuales valiosos manejados por sincronía de Channels Postgres. Alterarlas manualmente sin pasar por el ORM/Hooks puede ocasionar colisiones on-sync en la UI.

## 14. HISTORIAL DE CAMBIOS RECIENTES
- **Optimización de Rendimiento y Seguridad (Mar 2026):** Centralización de hooks de inventario y productos en `Index.tsx` resultando en una reducción masiva de renders y duplicidad de WS/Supabase Queries. Paralelización de obtención de ingredientes con `Promise.all()`. Eliminación de hooks de Polling de respaldo y purga de logs informativos.
- **Refuerzos Backend/Auth (Mar 2026):** Migración completa a hashes `bcryptjs` en la base de datos para usuarios. Implementación de Rate Limiting por IP para protección contra ataques de fuerza bruta en `api/login.ts` y delimitación rigurosa de dominios de CORS. Cierre forzado de sesión a las 12h embebido en `AuthProvider`.
- **Fix Red NodeJS / Vercel Dev (Mar 2026):** Se removió el forzado de puertos e IPv6 `::` en `vite.config.ts`, solucionando los cuelgues totales (`ECONNRESET`) del CLI de Vercel en Windows debido a Timeouts y desincronización del proxy HMR de Vite.
- **Remito Manual Completo (Mar 2026):** Creación de `RemitoManualModal.tsx` y `VistaPreviaRemitoManual.tsx`. El modal permite cargar filas manualmente, editar el encabezado de impresión en 3 líneas (con valores por defecto `VASANA SA / TALCAHUANO 279 / VILLA MARTELLI`), guardar en Supabase con ID `REM-MAN-{timestamp}` e imprimir en formato A4.
- **Encabezado de Remito Manual Editable (Mar 2026):** Se agregó el estado `headerLines` en `RemitoManualModal` y la prop correspondiente en `VistaPreviaRemitoManual`, reemplazando los textos fijos del bloque `company-info-block` por valores dinámicos.
- **Botón REMITO MANUAL en ProductionSection (Mar 2026):** El botón dorado fue reposicionado a la derecha del título "Control de Producción", junto al indicador de "Kilos en Viaje". Stock en viaje calcula fallback desde `batchSize` si `stock_actual` no está disponible.
- **Renombrados de Texto (Mar 2026):** "Producción" → "ENVIOS" (Navigation), "Remito Villa Martelli" → "Envios a Villa Martelli" (tab), "Generar Remito" → "GENERAR ENVIO" (botón y modal), título del modal → "ENVIO DE PRODUCCION VILLA MARTELLI".
- **Fallback de Métricas (Mar 2026):** `DashboardMetrics` calcula totales semanales/mensuales/diarios desde `formulasData` en memoria si la API serverless `/api/get-metrics` no responde, evitando que las métricas queden en 0.
- **Fix ProductionSection (Mar 2026):** Se corrigió un error de etiquetas JSX sin cerrar que impedía la correcta renderización del componente. Se reorganizó `canEdit` al inicio del componente para evitar errores de referencia circular.
- **Autenticación Serverless (Mar 2026):** Migración del login a `/api/login` (función Vercel) con `service_role` para bypassear RLS. Requiere `vercel dev` en lugar de `npm run dev`.
- **Vista Previa A4 con Portal (Mar 2026):** `VistaPreviaPlantaVarela.tsx` con márgenes A4 exactos (8cm top, 6cm bottom), fecha a 5cm, dirección de empresa en esquina superior derecha fija, sin bordes de tabla.
- **Ordenamiento por Lote (Mar 2026):** ASC global en UI, PDF y hooks sin modificar la BD.
- **Mapa Interactivo y Limpieza CAS (Abr 2026):** Creación del componente `MapaUbicacionRacks.tsx` renderizando un mapa vectorial SVG puro, dinámico y estético (fondos claros, tooltips interactivos con X/Y y puntos rojos expansivos) dentro del Modal de detalle de `InventorySection.tsx`. Se removió por completo el input y visor de estructura química de PUBCHEM (vía Número CAS) para enfocar la herramienta en logística de almacén. Implementación del script `dev.bat` para evitar errores `EADDRINUSE` con Vercel/Node en Windows.

---
*Última actualización: 12 de Abril de 2026*
