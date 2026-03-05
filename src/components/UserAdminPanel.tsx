import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Key, 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Circle
} from 'lucide-react';
import { UserProfile, CreateUserData, UpdateUserData, UserService } from '@/services/userService';
import { useRealtimeUsers } from '@/hooks/useRealtimeUsers';

export const UserAdminPanel: React.FC = () => {
  // Usar el hook de Realtime para usuarios
  const {
    users,
    loading,
    error,
    stats,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword
  } = useRealtimeUsers();

  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  
  // Estados para formularios
  const [newUser, setNewUser] = useState<CreateUserData>({
    user_name: '',
    password: '',
    role: 'user'
  });
  const [editUser, setEditUser] = useState<UpdateUserData>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Verificar si el usuario actual es administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const adminStatus = await UserService.isCurrentUserAdmin();
        setIsAdmin(adminStatus);
        setAccessDenied(!adminStatus);
      } catch (error) {
        console.error('Error verificando rol de administrador:', error);
        setIsAdmin(false);
        setAccessDenied(true);
      }
    };
    
    checkAdminStatus();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser({
        user_name: newUser.user_name.trim(),
        password: newUser.password,
        role: newUser.role || 'user'
      });
      setSuccess('Usuario creado exitosamente');
      setIsCreateModalOpen(false);
      setNewUser({ user_name: '', password: '', role: 'user' });
    } catch (err) {
      console.error('Error creando usuario:', err);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      await updateUser(selectedUser.id, editUser);
      setSuccess('Usuario actualizado exitosamente');
      setIsEditModalOpen(false);
      setEditUser({});
      setSelectedUser(null);
    } catch (err) {
      console.error('Error actualizando usuario:', err);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await deleteUser(selectedUser.id);
      setSuccess('Usuario eliminado exitosamente');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error eliminando usuario:', err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      await resetUserPassword(selectedUser.id, newPassword);
      setSuccess('Contraseña actualizada exitosamente');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      console.error('Error cambiando contraseña:', err);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditUser({
      user_name: user.user_name,
      role: user.role
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const openPasswordModal = (user: UserProfile) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para determinar si un usuario está activo (actualizado en los últimos 5 minutos)
  const isUserActive = (user: UserProfile): boolean => {
    if (!user.updated_at) return false;
    const updatedTime = new Date(user.updated_at).getTime();
    const now = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutos en milisegundos
    return (now - updatedTime) < fiveMinutesInMs;
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground mb-4">
            No tienes permisos para acceder al panel de administración de usuarios.
          </p>
          <p className="text-sm text-muted-foreground">
            Solo los administradores pueden ver esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate">Administración de Usuarios</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Gestiona los usuarios del sistema</p>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)} 
            className="flex items-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Nuevo Usuario</span>
            <span className="xs:hidden">Nuevo</span>
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Usuarios</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Administradores</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.admins}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Usuarios</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.users_role}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">Total Registrados</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.users}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <Label htmlFor="search" className="text-sm font-medium">Buscar</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar por nombre de usuario..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>
              </div>
              
              <div className="flex items-end sm:items-center">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()} 
                  disabled={loading}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="ml-2 hidden sm:inline">Actualizar</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de usuarios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredUsers.map((user) => (
            <Card key={user.id} className="bg-card dark:bg-white/10 backdrop-blur-md rounded-2xl shadow-md 
                                            transition-all duration-300 ease-in-out
                                            hover:shadow-xl hover:scale-105 hover:border hover:border-yellow-400/60 hover:bg-muted/50 dark:hover:bg-white/20">
              <CardHeader className="pb-3 px-4 sm:px-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg font-bold truncate text-blue-700 dark:text-yellow-400 flex items-center gap-2">
                        {user.user_name}
                        {isUserActive(user) && (
                          <span className="relative" title="Usuario activo">
                            <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
                          </span>
                        )}
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-300 truncate">Usuario</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isUserActive(user) && (
                      <span className="text-xs text-green-400 font-medium hidden sm:inline">Activo</span>
                    )}
                    <Badge 
                      variant={user.role === 'admin' ? "default" : "outline"}
                      className="text-xs"
                    >
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3 px-4 sm:px-6">
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 dark:text-gray-300 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-gray-300 font-medium">Creado:</span>
                    <span className="truncate text-slate-600 dark:text-gray-400">{formatDate(user.created_at)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 dark:text-gray-300 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-gray-300 font-medium">Actualizado:</span>
                    <span className="truncate text-slate-600 dark:text-gray-400">{formatDate(user.updated_at)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 sm:gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(user)}
                    className="text-xs sm:text-sm h-8 sm:h-9
                               transition-all duration-300 ease-in-out
                               hover:scale-110 hover:shadow-lg"
                  >
                    <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                  
      
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteModal(user)}
                    className="text-xs sm:text-sm h-8 sm:h-9
                               transition-all duration-300 ease-in-out
                               hover:scale-110 hover:shadow-lg hover:shadow-red-500/40"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredUsers.length === 0 && (
          <Card>
            <CardContent className="p-8 sm:p-12 text-center">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No se encontraron usuarios</h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchTerm
                  ? 'Intenta ajustar el filtro de búsqueda'
                  : 'No hay usuarios registrados en el sistema'
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Alertas */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Modal Crear Usuario */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-username">Usuario</Label>
                <Input
                  id="create-username"
                  type="text"
                  placeholder="Nombre de usuario"
                  value={newUser.user_name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, user_name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-password">Clave</Label>
                <Input
                  id="create-password"
                  type="password"
                  placeholder="Contraseña del usuario"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-role">Rol</Label>
                <Select value={newUser.role || 'user'} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Usuario'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Editar Usuario */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Editar Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Usuario</Label>
                <Input
                  id="edit-username"
                  type="text"
                  value={editUser.user_name || ''}
                  onChange={(e) => setEditUser(prev => ({ ...prev, user_name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Dejar vacío para mantener la actual"
                  value={editUser.password || ''}
                  onChange={(e) => setEditUser(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol</Label>
                <Select value={editUser.role || 'user'} onValueChange={(value) => setEditUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuario</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Actualizando...' : 'Actualizar Usuario'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Cambiar Contraseña */}
        <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Cambiar Contraseña</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva Contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPasswordModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Eliminar Usuario */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="sm:max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Eliminar Usuario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>¿Estás seguro de que quieres eliminar este usuario?</p>
              {selectedUser && (
                <div className="p-4 bg-muted rounded-lg">
                  <p><strong>Usuario:</strong> {selectedUser.user_name}</p>
                  <p><strong>Creado:</strong> {formatDate(selectedUser.created_at)}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer.
              </p>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={handleDeleteUser} disabled={loading}>
                {loading ? 'Eliminando...' : 'Eliminar Usuario'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
