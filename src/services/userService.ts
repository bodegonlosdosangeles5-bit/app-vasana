import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  user_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  user_name: string;
  password: string;
  role?: string;
}

export interface UpdateUserData {
  user_name?: string;
  password?: string;
  role?: string;
}

export class UserService {
  /**
   * Obtener todos los usuarios del sistema
   */
  static async getUsers(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase.rpc('get_all_users');
      
      if (error) {
        console.error('Error obteniendo usuarios:', error);
        throw new Error('Error al obtener usuarios');
      }

      const users = data || [];
      return users.map((user) => ({
        id: user.id,
        user_name: user.user_name,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      }));
    } catch (error) {
      console.error('Error en getUsers:', error);
      throw error;
    }
  }

  /**
   * Crear un nuevo usuario
   */
  static async createUser(createUserData: CreateUserData): Promise<UserProfile> {
    try {
      const { data, error } = await supabase.rpc('create_user', {
        username_param: createUserData.user_name,
        password_param: createUserData.password,
        role_param: createUserData.role || 'user'
      });

      if (error) {
        console.error('Error creando usuario:', error);
        throw new Error(`Error al crear usuario: ${error.message}`);
      }

      const result = data as { success: boolean, error?: string, user_id?: string } | null;
      if (!result || !result.success) {
        throw new Error(result?.error || 'Error desconocido');
      }

      // Obtener el usuario creado
      const { data: createdUserData, error: getUserError } = await supabase.rpc('get_user_by_id', {
        user_id_param: result.user_id || ''
      });

      if (getUserError) {
        throw new Error('Error obteniendo usuario creado');
      }

      const userResult = createdUserData as { 
        id: string; user_name: string; role: string; created_at: string; updated_at: string; success: boolean 
      } | null;
      
      if (!userResult || !userResult.success) {
        throw new Error('Error obteniendo usuario creado');
      }

      return {
        id: userResult.id,
        user_name: userResult.user_name,
        role: userResult.role,
        created_at: userResult.created_at,
        updated_at: userResult.updated_at
      };
    } catch (error) {
      console.error('Error en createUser:', error);
      throw error;
    }
  }

  /**
   * Actualizar un usuario existente
   */
  static async updateUser(userId: string, updates: UpdateUserData): Promise<UserProfile> {
    try {
      const { data, error } = await supabase.rpc('update_user', {
        user_id_param: userId,
        new_username: updates.user_name || null,
        new_password: updates.password || null,
        new_role: updates.role || null
      });

      if (error) {
        console.error('Error actualizando usuario:', error);
        throw new Error(`Error al actualizar usuario: ${error.message}`);
      }

      const result = data as { success: boolean, error?: string, id: string; user_name: string; role: string; created_at: string; updated_at: string } | null;
      if (!result || !result.success) {
        throw new Error(result?.error || 'Error desconocido');
      }

      return {
        id: result.id,
        user_name: result.user_name,
        role: result.role,
        created_at: result.created_at,
        updated_at: result.updated_at
      };
    } catch (error) {
      console.error('Error en updateUser:', error);
      throw error;
    }
  }

  /**
   * Eliminar un usuario
   */
  static async deleteUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('delete_user', {
        user_id_param: userId
      });

      if (error) {
        console.error('Error eliminando usuario:', error);
        throw new Error(`Error al eliminar usuario: ${error.message}`);
      }

      const result = data as { success: boolean } | null;
      return result?.success || false;
    } catch (error) {
      console.error('Error en deleteUser:', error);
      throw error;
    }
  }

  /**
   * Cambiar contraseña de un usuario
   */
  static async resetUserPassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_user', {
        user_id_param: userId,
        new_username: null,
        new_password: newPassword
      });

      if (error) {
        console.error('Error cambiando contraseña:', error);
        throw new Error(`Error al cambiar contraseña: ${error.message}`);
      }

      const result = data as { success: boolean } | null;
      return result?.success || false;
    } catch (error) {
      console.error('Error en resetUserPassword:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  static async getUserStats(): Promise<{
    total: number;
    users: number;
    admins: number;
    users_role: number;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_user_stats');
      
      if (error) {
        console.error('Error obteniendo estadísticas:', error);
        throw new Error('Error al obtener estadísticas');
      }

      const result = data as { total?: number; users?: number; admins?: number; users_role?: number } | null;
      return {
        total: result?.total || 0,
        users: result?.users || 0,
        admins: result?.admins || 0,
        users_role: result?.users_role || 0
      };
    } catch (error) {
      console.error('Error en getUserStats:', error);
      throw error;
    }
  }

  /**
   * Verificar si el usuario actual es administrador
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        return false;
      }
      
      const user = JSON.parse(userData);
      return user.role === 'admin' || user.role === 'superadmin' || user.user_name === 'jose';
    } catch (error) {
      console.error('Error en isCurrentUserAdmin:', error);
      return false;
    }
  }

  /**
   * Actualizar timestamp de actividad del usuario (heartbeat)
   */
  static async updateUserActivity(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_user', {
        user_id_param: userId,
        new_username: null,
        new_password: null,
        new_role: null
      });

      if (error) {
        console.error('Error actualizando actividad del usuario:', error);
        return false;
      }

      const result = data as { success: boolean } | null;
      return result?.success || false;
    } catch (error) {
      console.error('Error en updateUserActivity:', error);
      return false;
    }
  }
}
