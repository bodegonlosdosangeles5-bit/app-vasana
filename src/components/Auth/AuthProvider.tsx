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
      console.log('🔐 AuthProvider: Iniciando signIn para usuario mediante Backend Serverless:', username);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('❌ AuthProvider: Error desde la API de login:', result.error);
        return { error: result.error || 'Usuario o contraseña incorrectos' };
      }

      console.log('✅ AuthProvider: Login server-side exitoso, guardando info completa...');
      
      const userDataComplete = {
        id: result.userData.id,
        user_name: result.userData.user_name,
        role: result.userData.role,
        created_at: result.userData.created_at
      };
      
      setUser(userDataComplete);
      localStorage.setItem('user', JSON.stringify(userDataComplete));
      
      console.log('✅ AuthProvider: Usuario guardado en localStorage y estado');
      
      return { error: null };
    } catch (error) {
      console.error('❌ AuthProvider: Error inesperado en signIn:', error);
      return { error: 'Error inesperado al conectar con el servidor.' };
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
