import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Campos de fecha que pueden venir como "YYYY-MM-DD" o como timestamptz completo ("...T...+00:00")
export function parseFechaSegura(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = value.includes("T") ? parseISO(value) : parseISO(`${value}T00:00:00`);
  return isValid(parsed) ? parsed : null;
}

export function formatFechaCorta(value?: string | null, fallback = "Sin fecha"): string {
  const parsed = parseFechaSegura(value);
  return parsed ? format(parsed, "dd/MM/yyyy") : fallback;
}
