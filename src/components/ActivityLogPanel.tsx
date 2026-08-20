import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/Auth/AuthProvider';
import { ActivityLogService, ActivityLogEntry, ColorTag } from '@/services/activityLogService';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';

export const ActivityLogPanel = () => {
  const { user } = useAuth();
  
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [entidad, setEntidad] = useState('todas');
  const [tipo, setTipo] = useState('todos');

  // Pagination (server-side)
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const loadLogs = async (pageToLoad: number) => {
    setLoading(true);
    let color_tag: ColorTag | undefined = undefined;
    if (tipo === 'green') color_tag = 'green';
    if (tipo === 'yellow') color_tag = 'yellow';
    if (tipo === 'red') color_tag = 'red';

    const { logs: data, total } = await ActivityLogService.getLogs(user?.role ?? '', {
      desde: desde || undefined,
      hasta: hasta || undefined,
      entidad: entidad !== 'todas' ? entidad : undefined,
      color_tag,
      page: pageToLoad,
      pageSize: itemsPerPage,
    });
    setLogs(data);
    setTotalLogs(total);
    setLoading(false);
  };

  // Al cambiar filtros, volver a la página 1
  useEffect(() => {
    if (user?.role === 'superadmin') {
      setPage(1);
      loadLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, desde, hasta, entidad, tipo]);

  // Al cambiar de página, traer esa página del servidor
  useEffect(() => {
    if (user?.role === 'superadmin') {
      loadLogs(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (user?.role !== 'superadmin') {
    return null;
  }

  const getBadgeClass = (color: ColorTag) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200';
      case 'red': return 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200';
      default: return '';
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalLogs / itemsPerPage));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Historial de Cambios</h3>
          <p className="text-xs text-muted-foreground">Se conservan solo los últimos 7 días; los registros más antiguos se eliminan automáticamente.</p>
        </div>
        <Button onClick={() => loadLogs(page)} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
        <div className="space-y-2">
          <label className="text-sm font-medium">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Entidad</label>
          <Select value={entidad} onValueChange={setEntidad}>
            <SelectTrigger>
              <SelectValue placeholder="Entidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="Productos">Productos</SelectItem>
              <SelectItem value="Inventario">Inventario</SelectItem>
              <SelectItem value="Usuarios">Usuarios</SelectItem>
              <SelectItem value="Envíos">Envíos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Tipo de Acción</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="green">Creaciones</SelectItem>
              <SelectItem value="yellow">Ediciones</SelectItem>
              <SelectItem value="red">Eliminaciones</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Etiqueta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  {loading ? 'Cargando registros...' : 'Sin registros para los filtros seleccionados'}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(parseISO(log.created_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{log.user_name}</div>
                    <div className="text-xs text-muted-foreground">{log.user_role}</div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{log.accion}</TableCell>
                  <TableCell className="text-sm">{log.entidad}</TableCell>
                  <TableCell className="text-sm max-w-[300px] truncate" title={log.descripcion}>
                    {log.descripcion}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getBadgeClass(log.color_tag)}>
                      {log.color_tag === 'green' ? 'Creación' : log.color_tag === 'yellow' ? 'Edición' : 'Eliminación'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
