# Recetario interactivo

Aplicación web ligera para consultar el `recetario.docx` desde el navegador del iPhone. El backend lee el documento de Word en cada petición (con caché por fecha de modificación) y expone los datos y las imágenes en formato JSON; la interfaz web permite buscar recetas por nombre, ingredientes o pasos.

## Requisitos

- Python 3.11 o superior (incluye las dependencias utilizadas).

## Puesta en marcha

```bash
python server.py --host 0.0.0.0 --port 8000
```

La aplicación quedará disponible en [http://localhost:8000](http://localhost:8000). Para usarla en el iPhone conectado a la misma red, sustituye `localhost` por la IP de tu ordenador.

### Actualización automática tras editar el Word

El servidor comprueba la fecha de modificación de `recetario.docx` en cada petición. Cada vez que guardes cambios en el archivo, vuelve a cargar la página o pulsa buscar para obtener las recetas actualizadas sin reiniciar el servidor.

## Estructura del proyecto

- `recetario.docx`: documento fuente con las recetas e imágenes.
- `server.py`: servidor HTTP que sirve la SPA y el endpoint JSON.
- `app/parser.py`: parser XML que transforma el DOCX en datos estructurados.
- `app/repository.py`: caché en memoria que invalida cuando cambia el DOCX.
- `public/`: activos estáticos de la interfaz (HTML, CSS y JavaScript).

## Personalización

- Los estilos están pensados para móviles (layout responsive y soporte para modo oscuro).
- El buscador elimina tildes para facilitar las coincidencias.
- Si prefieres regenerar archivos estáticos en lugar de usar un servidor dinámico, puedes reutilizar `DocxRecipeParser` para generar un JSON y servirlo en cualquier entorno.
