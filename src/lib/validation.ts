// =============================================
// VALIDACIÓN DE DATOS - SEGURIDAD
// =============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// =============================================
// VALIDACIÓN DE FÓRMULAS
// =============================================

interface RawFormula {
  id?: string;
  name?: string;
  batchSize?: number;
  destination?: string;
  status?: string;
  type?: string;
  date?: string;
  clientName?: string;
}

export const validateFormula = (formula: unknown): ValidationResult => {
  const errors: string[] = [];
  const f = formula as RawFormula;

  // Validar ID
  if (!f.id || typeof f.id !== 'string') {
    errors.push('ID de fórmula es requerido y debe ser una cadena');
  } else if (f.id.length < 3 || f.id.length > 50) {
    errors.push('ID de fórmula debe tener entre 3 y 50 caracteres');
  } else if (!/^[a-zA-Z0-9-_]+$/.test(f.id)) {
    errors.push('ID de fórmula solo puede contener letras, números, guiones y guiones bajos');
  }

  // Validar nombre
  if (!f.name || typeof f.name !== 'string') {
    errors.push('Nombre de fórmula es requerido');
  } else if (f.name.length < 2 || f.name.length > 100) {
    errors.push('Nombre de fórmula debe tener entre 2 y 100 caracteres');
  } else if (!/^[a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]+$/.test(f.name)) {
    errors.push('Nombre de fórmula contiene caracteres no válidos');
  }

  // Validar batch size
  if (typeof f.batchSize !== 'number' || f.batchSize <= 0) {
    errors.push('Tamaño de lote debe ser un número positivo');
  } else if (f.batchSize > 10000) {
    errors.push('Tamaño de lote no puede ser mayor a 10,000 kg');
  }

  // Validar destino
  const validDestinations = ['Villa Martelli', 'Florencio Varela'];
  if (!f.destination || !validDestinations.includes(f.destination)) {
    errors.push('Destino debe ser "Villa Martelli" o "Florencio Varela"');
  }

  // Validar estado
  const validStatuses = ['available', 'incomplete'];
  if (!f.status || !validStatuses.includes(f.status)) {
    errors.push('Estado debe ser uno de: available, incomplete');
  }

  // Validar tipo
  const validTypes = ['stock', 'client', 'cliente', 'exportacion', 'uso_interno'];
  if (!f.type || !validTypes.includes(f.type)) {
    errors.push('Tipo debe ser uno de: stock, client, cliente, exportacion, uso_interno');
  }

  // Validar fecha
  if (f.date) {
    const date = new Date(f.date);
    if (isNaN(date.getTime())) {
      errors.push('Fecha debe ser una fecha válida');
    } else if (date > new Date()) {
      errors.push('Fecha no puede ser futura');
    }
  }

  // Validar nombre de cliente si es tipo cliente
  if (f.type === 'client' || f.type === 'cliente') {
    if (!f.clientName || typeof f.clientName !== 'string') {
      errors.push('Nombre de cliente es requerido para fórmulas de tipo cliente');
    } else if (f.clientName.length < 2 || f.clientName.length > 100) {
      errors.push('Nombre de cliente debe tener entre 2 y 100 caracteres');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================================
// VALIDACIÓN DE INGREDIENTES FALTANTES
// =============================================

interface RawIngredient {
  name?: string;
  required?: number;
  unit?: string;
}

export const validateMissingIngredient = (ingredient: unknown): ValidationResult => {
  const errors: string[] = [];
  const ing = ingredient as RawIngredient;

  // Validar nombre
  if (!ing.name || typeof ing.name !== 'string') {
    errors.push('Nombre de ingrediente es requerido');
  } else if (ing.name.length < 2 || ing.name.length > 100) {
    errors.push('Nombre de ingrediente debe tener entre 2 y 100 caracteres');
  } else if (!/^[a-zA-Z0-9\s\-_áéíóúÁÉÍÓÚñÑ]+$/.test(ing.name)) {
    errors.push('Nombre de ingrediente contiene caracteres no válidos');
  }

  // Validar cantidad requerida
  if (typeof ing.required !== 'number' || ing.required <= 0) {
    errors.push('Cantidad requerida debe ser un número positivo');
  } else if (ing.required > 1000) {
    errors.push('Cantidad requerida no puede ser mayor a 1,000');
  }

  // Validar unidad
  const validUnits = ['kg', 'g', 'L', 'ml', 'unidades'];
  if (!ing.unit || !validUnits.includes(ing.unit)) {
    errors.push('Unidad debe ser una de: kg, g, L, ml, unidades');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================================
// VALIDACIÓN DE ITEMS DE INVENTARIO
// =============================================

interface RawInventoryItem {
  name?: string;
  certificate?: string;
  currentStock?: number;
  minStock?: number;
  maxStock?: number;
  location?: string;
}

export const validateInventoryItem = (item: unknown): ValidationResult => {
  const errors: string[] = [];
  const i = item as RawInventoryItem;

  // Validar nombre
  if (!i.name || typeof i.name !== 'string') {
    errors.push('Nombre de item es requerido');
  } else if (i.name.length < 2 || i.name.length > 100) {
    errors.push('Nombre de item debe tener entre 2 y 100 caracteres');
  }

  // Validar certificado
  if (!i.certificate || typeof i.certificate !== 'string') {
    errors.push('Certificado es requerido');
  } else if (i.certificate.length < 3 || i.certificate.length > 50) {
    errors.push('Certificado debe tener entre 3 y 50 caracteres');
  }

  // Validar stock actual
  if (typeof i.currentStock !== 'number' || i.currentStock < 0) {
    errors.push('Stock actual debe ser un número no negativo');
  }

  // Validar stock mínimo
  if (typeof i.minStock !== 'number' || i.minStock < 0) {
    errors.push('Stock mínimo debe ser un número no negativo');
  }

  // Validar stock máximo
  if (typeof i.maxStock !== 'number' || i.maxStock < 0) {
    errors.push('Stock máximo debe ser un número no negativo');
  }

  // Validar que stock mínimo no sea mayor que máximo
  if (i.minStock > i.maxStock) {
    errors.push('Stock mínimo no puede ser mayor que stock máximo');
  }

  // Validar ubicación
  if (!i.location || typeof i.location !== 'string') {
    errors.push('Ubicación es requerida');
  } else if (i.location.length < 2 || i.location.length > 50) {
    errors.push('Ubicación debe tener entre 2 y 50 caracteres');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================================
// VALIDACIÓN DE ENVÍOS
// =============================================

interface RawEnvio {
  numero_envio?: string;
  destino?: string;
  estado?: string;
  total_kilos?: number;
  total_remitos?: number;
}

export const validateEnvio = (envio: unknown): ValidationResult => {
  const errors: string[] = [];
  const e = envio as RawEnvio;

  // Validar número de envío
  if (!e.numero_envio || typeof e.numero_envio !== 'string') {
    errors.push('Número de envío es requerido');
  } else if (!/^ENV-\d{4}-\d{2}-\d{2}-\d{4}$/.test(e.numero_envio)) {
    errors.push('Número de envío debe tener formato ENV-YYYY-MM-DD-XXXX');
  }

  // Validar destino
  const validDestinations = ['Villa Martelli', 'Florencio Varela'];
  if (!e.destino || !validDestinations.includes(e.destino)) {
    errors.push('Destino debe ser "Villa Martelli" o "Florencio Varela"');
  }

  // Validar estado
  const validStatuses = ['pendiente', 'en_transito', 'entregado', 'cancelado'];
  if (!e.estado || !validStatuses.includes(e.estado)) {
    errors.push('Estado debe ser uno de: pendiente, en_transito, entregado, cancelado');
  }

  // Validar total kilos
  if (typeof e.total_kilos !== 'number' || e.total_kilos < 0) {
    errors.push('Total de kilos debe ser un número no negativo');
  }

  // Validar total remitos
  if (typeof e.total_remitos !== 'number' || e.total_remitos < 0) {
    errors.push('Total de remitos debe ser un número no negativo');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// =============================================
// FUNCIONES DE SANITIZACIÓN
// =============================================

export const sanitizeString = (str: string): string => {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remover caracteres HTML peligrosos
    .replace(/javascript:/gi, '') // Remover javascript: URLs
    .replace(/on\w+=/gi, ''); // Remover event handlers
};

export const sanitizeNumber = (num: unknown): number => {
  const parsed = typeof num === 'string' ? parseFloat(num) : (typeof num === 'number' ? num : 0);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
};

// =============================================
// VALIDACIÓN DE SQL INJECTION
// =============================================

export const containsSQLInjection = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+'.*?'\s*=\s*'.*?')/i,
    /(\b(OR|AND)\s+".*?"\s*=\s*".*?")/i,
    /(UNION\s+SELECT)/i,
    /(DROP\s+TABLE)/i,
    /(DELETE\s+FROM)/i,
    /(INSERT\s+INTO)/i,
    /(UPDATE\s+SET)/i,
    /(ALTER\s+TABLE)/i,
    /(CREATE\s+TABLE)/i,
    /(EXEC\s*\()/i,
    /(SCRIPT\s*\()/i,
    /(--|\/\*|\*\/)/,
    /(;|\||&)/,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
};

// =============================================
// VALIDACIÓN DE XSS
// =============================================

export const containsXSS = (input: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
    /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /onfocus\s*=/gi,
    /onblur\s*=/gi,
    /onchange\s*=/gi,
    /onsubmit\s*=/gi,
    /onreset\s*=/gi,
    /onselect\s*=/gi,
    /onkeydown\s*=/gi,
    /onkeyup\s*=/gi,
    /onkeypress\s*=/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
};
