import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  user_name: string;
  role: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  createUser: (username: string, password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay un usuario guardado en localStorage
    console.log('🔍 AuthProvider: Verificando localStorage...');
    const savedUser = localStorage.getItem('user');
    console.log('🔍 AuthProvider: Usuario guardado:', savedUser);
    
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log('✅ AuthProvider: Usuario parseado correctamente:', parsedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('❌ AuthProvider: Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    } else {
      console.log('ℹ️ AuthProvider: No hay usuario guardado en localStorage');
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      console.log('🔐 AuthProvider: Iniciando signIn para usuario:', username);
      
      // Usar la función original de autenticación
      const { data, error } = await supabase
        .rpc('authenticate_user', { 
          username_param: username, 
          password_param: password 
        });

      console.log('🔐 AuthProvider: Respuesta de authenticate_user:', { data, error });

      if (error) {
        console.error('❌ AuthProvider: Error en authenticate_user:', error);
        return { error: error.message };
      }

      interface AuthResponse {
        success: boolean;
        user_id: string;
        error?: string;
      }

      const result = data as unknown as AuthResponse;
      if (!result.success) {
        console.log('❌ AuthProvider: authenticate_user falló:', result.error);
        return { error: result.error || 'Error de autenticación' };
      }

      console.log('✅ AuthProvider: authenticate_user exitoso, obteniendo datos del usuario...');

      // Obtener información completa del usuario incluyendo el rol
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_by_id', { user_id_param: result.user_id });

      console.log('👤 AuthProvider: Respuesta de get_user_by_id:', { userData, userError });

      interface UserDataResponse {
        id: string;
        user_name: string;
        role: string;
        created_at: string;
        success: boolean;
        error?: string;
      }

      const userInfo = (userData as unknown as UserDataResponse);

      if (userError || !userInfo || !userInfo.success) {
        console.error('❌ AuthProvider: Error en get_user_by_id:', userError);
        return { error: 'Error obteniendo información del usuario' };
      }

      const userDataComplete = {
        id: userInfo.id,
        user_name: userInfo.user_name,
        role: userInfo.role,
        created_at: userInfo.created_at
      };
      
      console.log('✅ AuthProvider: Usuario completo creado:', userDataComplete);
      
      setUser(userDataComplete);
      localStorage.setItem('user', JSON.stringify(userDataComplete));
      
      console.log('✅ AuthProvider: Usuario guardado en localStorage y estado');
      
      return { error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Error inesperado en signIn:', error);
      return { error: 'Error inesperado. Por favor intenta de nuevo.' };
    }
  };


  const signOut = async () => {
    try {
      setUser(null);
      localStorage.removeItem('user');
      return { error: null };
    } catch (error) {
      console.error('Error inesperado en signOut:', error);
      return { error: 'Error al cerrar sesión' };
    }
  };

  const createUser = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase
        .rpc('create_user', { 
          username_param: username, 
          password_param: password 
        });

      if (error) {
        return { error: error.message };
      }

      interface CreateUserResponse {
        success: boolean;
        user_id?: string;
        error?: string;
      }

      const result = data as unknown as CreateUserResponse;
      if (!result.success) {
        return { error: result.error || 'Error al crear usuario' };
      }

      return { error: null };
    } catch (error) {
      return { error: 'Error inesperado. Por favor intenta de nuevo.' };
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signOut,
    createUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
