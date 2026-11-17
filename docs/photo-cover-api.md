# Guardado exclusivo de portada desde modo foto

El editor dispone del botón **Guardar foto en construcción** en el modo foto.

## Contrato requerido por backend PHP

`POST /api/construcciones?accion=editor_imagen_guardar` con sesión autenticada y `multipart/form-data`:

- `categoria`: categoría existente de la construcción.
- `id_construccion`: identificador existente.
- `imagen`: archivo PNG de la captura.

Respuesta de éxito:

```json
{"ok":true,"data":{"id":"...","categoria":"...","nombre":"...","imagen":"..."}}
```

`data` debe devolver la ficha vigente del catálogo, incluyendo la referencia de imagen actualizada.

El endpoint **solamente** debe validar permisos, formato/tamaño de imagen y existencia de la construcción; reemplazar de manera atómica su portada, e invalidar el caché correspondiente. No debe recibir ni reescribir `.schem`, metadatos, estilos, versiones ni estados de Minecraft. Si no puede guardar, debe devolver `{"ok":false,"error":"..."}` con estado HTTP apropiado.

**Importante:** este repositorio contiene el editor React, no la implementación PHP de `/api/construcciones`. La operación exclusiva no funcionará en producción hasta que el backend implemente `editor_imagen_guardar`. No usar `editor_guardar` para la operación de solo foto porque vuelve a enviar la construcción completa.

Para construcciones nuevas o sin asociación válida al catálogo, el editor pasa la captura a Propiedades como imagen pendiente. En ese caso se publica al guardar la construcción por primera vez.
