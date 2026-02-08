import { supabase } from '@/integrations/supabase/client';

export interface Producto {
  id: string;
  lote_code: string; // New field for the actual Lote Number
  name: string;
  batchSize: number; // Historical Production Amount
  stock_actual: number; // Current Available Stock
  status: 'available' | 'incomplete';
  destination: string;
  date?: string;
  type: 'stock' | 'client';
  clientName?: string;
  missingIngredients?: Array<{
    name: string;
    required: number;
    unit: string;
  }>;
  ingredients?: Array<{
    name: string;
    required: number;
    available: number;
    unit: string;
  }>;
}

export class ProductoService {
  // Obtener todos los productos usando consulta directa con RLS
  static async getProductos(): Promise<Producto[]> {
    try {
      console.log('🔍 ProductoService.getProductos - Iniciando consulta directa...');
      
      // Consultar directamente la tabla productos con RLS aplicado
      const { data: productos, error } = await supabase
        .from('productos')
        .select(`
          id,
          lote_code,
          name,
          batch_size,
          stock_actual,
          status,
          destination,
          date,
          type,
          client_name,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      console.log('🔍 ProductoService.getProductos - Respuesta de Supabase:', { productos, error });

      if (error) {
        console.error('❌ Error en consulta de productos:', error);
        // Si es un error 403, intentar recargar la sesión
        if (error.message?.includes('403') || error.message?.includes('JWT')) {
          console.log('🔄 Error de autenticación detectado, intentando recargar sesión...');
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('⚠️ No hay sesión activa, redirigiendo al login...');
            window.location.href = '/login';
            return [];
          }
        }
        throw error;
      }

      if (!productos || productos.length === 0) {
        console.log('ℹ️ No hay productos en la base de datos');
        return [];
      }
      
      console.log(`✅ ProductoService.getProductos - ${productos.length} productos encontrados`);

      // Obtener ingredientes faltantes para todos los productos
      const productoIds = productos.map(p => p.id);
      
      const { data: missingIngredients } = await supabase
        .from('missing_ingredients')
        .select('producto_id, name, required, unit')
        .in('producto_id', productoIds);

      const { data: availableIngredients } = await supabase
        .from('available_ingredients')
        .select('producto_id, name, required, available, unit')
        .in('producto_id', productoIds);

      // Agrupar ingredientes por producto, evitando duplicados
      const missingByProducto = (missingIngredients || []).reduce((acc, ingredient) => {
        if (!acc[ingredient.producto_id]) {
          acc[ingredient.producto_id] = [];
        }
        
        // Verificar si el ingrediente ya existe para evitar duplicados
        const existingIngredient = acc[ingredient.producto_id].find(
          existing => existing.name === ingredient.name
        );
        
        if (!existingIngredient) {
          acc[ingredient.producto_id].push({
            name: ingredient.name,
            required: parseFloat(ingredient.required.toString()),
            unit: ingredient.unit
          });
        } else {
          // Si ya existe, sumar las cantidades requeridas
          existingIngredient.required += parseFloat(ingredient.required.toString());
        }
        
        return acc;
      }, {} as Record<string, Array<{name: string, required: number, unit: string}>>);

      // Log para debugging
      console.log('🔍 Ingredientes faltantes agrupados:', missingByProducto);

      const availableByProducto = (availableIngredients || []).reduce((acc, ingredient) => {
        if (!acc[ingredient.producto_id]) {
          acc[ingredient.producto_id] = [];
        }
        acc[ingredient.producto_id].push({
          name: ingredient.name,
          required: parseFloat(ingredient.required.toString()),
          available: parseFloat(ingredient.available.toString()),
          unit: ingredient.unit
        });
        return acc;
      }, {} as Record<string, Array<{name: string, required: number, available: number, unit: string}>>);

      return productos.map(producto => ({
        id: producto.id,
        lote_code: (producto as any).lote_code || producto.id, // Fallback to ID for old records
        name: producto.name,
        batchSize: producto.batch_size,
        stock_actual: (producto as any).stock_actual !== undefined ? (producto as any).stock_actual : producto.batch_size, // Fallback to batch_size
        status: producto.status as 'available' | 'incomplete',
        destination: producto.destination,
        date: producto.date || undefined,
        type: producto.type as 'stock' | 'client',
        clientName: producto.client_name || undefined,
        missingIngredients: missingByProducto[producto.id] || [],
        ingredients: availableByProducto[producto.id] || []
      }));
    } catch (error) {
      console.error('Error fetching productos:', error);
      return [];
    }
  }

  // Crear un nuevo producto
  static async createProducto(producto: Omit<Producto, 'id'> & { id?: string }): Promise<Producto | null> {
    try {
      console.log('🔧 Creando producto con datos:', producto);
      
      // Usar ID proporcionado o generar uno único
      // Generate unique ID: Lote + Timestamp + Random to allow repetitions of Lote Number
      const uniqueId = `P-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const loteCode = producto.lote_code || producto.id || `L-${Date.now()}`; // Use provided ID as Lote if lote_code is missing
      
      const { data, error } = await supabase
        .from('productos')
        .insert({
          id: uniqueId,
          lote_code: loteCode,
          name: producto.name,
          batch_size: producto.batchSize,
          stock_actual: producto.batchSize, // Initial stock equals production amount
          status: producto.status,
          destination: producto.destination,
          date: producto.date || null,
          type: producto.type,
          client_name: producto.clientName || null
        })
        .select()
        .single();

      console.log('📊 Respuesta de Supabase:', { data, error });

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw error;
      }

      // Insertar ingredientes faltantes si existen
      if (producto.missingIngredients && producto.missingIngredients.length > 0) {
        const missingIngredientsData = producto.missingIngredients.map(ingredient => ({
          producto_id: uniqueId,
          name: ingredient.name,
          required: ingredient.required,
          unit: ingredient.unit
        }));

        await supabase
          .from('missing_ingredients')
          .insert(missingIngredientsData);
      }

      // Insertar ingredientes disponibles si existen
      if (producto.ingredients && producto.ingredients.length > 0) {
        const availableIngredientsData = producto.ingredients.map(ingredient => ({
          producto_id: uniqueId,
          name: ingredient.name,
          required: ingredient.required,
          available: ingredient.available,
          unit: ingredient.unit
        }));

        await supabase
          .from('available_ingredients')
          .insert(availableIngredientsData);
      }

      const result = {
        ...producto,
        id: uniqueId,
        lote_code: loteCode,
        stock_actual: producto.batchSize
      };
      
      console.log('✅ Producto creado exitosamente:', result);
      return result;
    } catch (error) {
      console.error('❌ Error creating producto:', error);
      return null;
    }
  }

  // Actualizar un producto
  static async updateProducto(id: string, updates: Partial<Producto>): Promise<Producto | null> {
    try {
      const { data, error } = await supabase
        .from('productos')
        .update({
          name: updates.name,
          lote_code: updates.lote_code, // Allow updating lote_code
          batch_size: updates.batchSize,
          stock_actual: updates.stock_actual, // Allow updating stock
          status: updates.status,
          destination: updates.destination,
          date: updates.date || null,
          type: updates.type,
          client_name: updates.clientName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Actualizar ingredientes faltantes si se proporcionan
      if (updates.missingIngredients) {
        // Eliminar ingredientes existentes
        await supabase
          .from('missing_ingredients')
          .delete()
          .eq('producto_id', id);

        // Insertar nuevos ingredientes
        if (updates.missingIngredients.length > 0) {
          const missingIngredientsData = updates.missingIngredients.map(ingredient => ({
            producto_id: id,
            name: ingredient.name,
            required: ingredient.required,
            unit: ingredient.unit
          }));

          await supabase
            .from('missing_ingredients')
            .insert(missingIngredientsData);
        }
      }

      return {
        ...updates,
        id: id
      } as Producto;
    } catch (error) {
      console.error('Error updating producto:', error);
      return null;
    }
  }

  // Agregar ingrediente faltante a un producto
  static async addMissingIngredient(productoId: string, ingredient: {
    name: string;
    required: number;
    unit: string;
  }): Promise<boolean> {
    try {
      // Verificar si el ingrediente ya existe para este producto
      const { data: existingIngredient, error: checkError } = await supabase
        .from('missing_ingredients')
        .select('id')
        .eq('producto_id', productoId)
        .eq('name', ingredient.name)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      // Si ya existe, no agregar duplicado
      if (existingIngredient) {
        console.log(`⚠️ Ingrediente "${ingredient.name}" ya existe para el producto ${productoId}`);
        return true; // Retornar true porque no es un error, solo no se duplicó
      }

      // Si no existe, agregarlo
      const { error } = await supabase
        .from('missing_ingredients')
        .insert({
          producto_id: productoId,
          name: ingredient.name,
          required: ingredient.required,
          unit: ingredient.unit
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding missing ingredient:', error);
      return false;
    }
  }

  // Eliminar ingrediente faltante de un producto
  static async removeMissingIngredient(productoId: string, ingredientName: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('missing_ingredients')
        .delete()
        .eq('producto_id', productoId)
        .eq('name', ingredientName);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing missing ingredient:', error);
      return false;
    }
  }

  // Eliminar un producto
  static async deleteProducto(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting producto:', error);
      return false;
    }
  }

  // Actualizar automáticamente el estado de productos incompletos sin faltantes
  static async updateIncompleteProductosStatus(): Promise<{ updated: number; productos: Producto[] }> {
    try {
      console.log('🔄 Verificando productos incompletos sin faltantes...');
      
      // Obtener todos los productos con estado incomplete
      const { data: incompleteProductos, error: productosError } = await supabase
        .from('productos')
        .select('id, name, status')
        .eq('status', 'incomplete');

      if (productosError) throw productosError;

      if (!incompleteProductos || incompleteProductos.length === 0) {
        console.log('✅ No hay productos incompletos para verificar');
        return { updated: 0, productos: [] };
      }

      const productoIds = incompleteProductos.map(p => p.id);
      
      // Obtener ingredientes faltantes para estos productos
      const { data: missingIngredients, error: missingError } = await supabase
        .from('missing_ingredients')
        .select('producto_id')
        .in('producto_id', productoIds);

      if (missingError) throw missingError;

      // Agrupar ingredientes faltantes por producto
      const missingByProducto = (missingIngredients || []).reduce((acc, ingredient) => {
        if (!acc[ingredient.producto_id]) {
          acc[ingredient.producto_id] = [];
        }
        acc[ingredient.producto_id].push(ingredient);
        return acc;
      }, {} as Record<string, Array<{producto_id: string}>>);

      // Encontrar productos incompletos sin ingredientes faltantes
      const productosToUpdate = incompleteProductos.filter(producto => 
        !missingByProducto[producto.id] || missingByProducto[producto.id].length === 0
      );

      console.log(`🔍 Encontrados ${productosToUpdate.length} productos incompletos sin faltantes:`, 
        productosToUpdate.map(p => p.name));

      if (productosToUpdate.length === 0) {
        console.log('✅ No hay productos que actualizar');
        return { updated: 0, productos: [] };
      }

      // Actualizar el estado de estos productos a 'available'
      const productoIdsToUpdate = productosToUpdate.map(p => p.id);
      
      const { error: updateError } = await supabase
        .from('productos')
        .update({ 
          status: 'available',
          updated_at: new Date().toISOString()
        })
        .in('id', productoIdsToUpdate);

      if (updateError) throw updateError;

      console.log(`✅ Actualizados ${productosToUpdate.length} productos a estado 'available'`);

      // Obtener los productos actualizados con todos sus datos
      const updatedProductos = await this.getProductos();
      const updatedProductosList = updatedProductos.filter(p => productoIdsToUpdate.includes(p.id));

      return { 
        updated: productosToUpdate.length, 
        productos: updatedProductosList 
      };
    } catch (error) {
      console.error('❌ Error actualizando productos incompletos:', error);
      return { updated: 0, productos: [] };
    }
  }
}
