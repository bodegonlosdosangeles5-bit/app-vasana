-- Agrega un campo de observaciones libre a las materias primas (inventory_items).
-- No participa del filtro de búsqueda server-side (InventoryService.getInventoryItemsPage
-- solo busca en name/certificate/location), es solo para notas del usuario.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS observaciones text;
