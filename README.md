# Recetario interactivo

Aplicación estática que muestra un catálogo moderno de recetas optimizado para móvil. No es necesario ejecutar ningún servidor: basta con publicar la carpeta en GitHub Pages (por ejemplo en `https://albercha17.github.io/Recetario/`) o abrir `index.html` en el navegador.

## ¿Cómo funciona?

- Al cargar la página se descarga `recipes.json`, se interpreta en el navegador y se generan las fichas de cada receta.
- Cada tarjeta muestra la fotografía (si existe), el tipo de plato y el nombre de la receta. Al tocarla se abre un panel con ingredientes, pasos y consejos.
- El buscador filtra en tiempo real por nombre, tipo o por cualquier texto incluido en los ingredientes, los pasos o los consejos.
- Cada vez que actualices el archivo JSON y publiques los cambios en GitHub, la web mostrará automáticamente la nueva información.

## Publicación en GitHub Pages

1. Sube todos los archivos del repositorio (incluido `recipes.json` y la carpeta donde guardes las fotografías) a la rama que GitHub Pages tenga configurada.
2. Abre la URL de GitHub Pages para ver el recetario actualizado. El navegador se encargará de cargar los últimos cambios del JSON.

## Desarrollo local

Simplemente abre `index.html` en tu navegador (puedes arrastrarlo y soltarlo). Al tratarse de un fichero local, algunos navegadores bloquean las peticiones `fetch` a archivos del sistema de ficheros. Si ocurre, sirve la carpeta con cualquier servidor estático (`python -m http.server`, `npx serve`, etc.) para pruebas puntuales.

## Estructura del proyecto

- `recipes.json`: listado de recetas con título, tipo, ingredientes, pasos, consejos y la ruta relativa de la imagen (`ruta_imagen`).
- Carpeta de imágenes: crea la carpeta que prefieras (por ejemplo `imagenes/`) con las fotografías referenciadas en el JSON.
- `index.html`: página principal y punto de entrada.
- `styles.css`: estilos del recetario.
- `app.js`: lógica que carga el JSON, gestiona el buscador y la interfaz interactiva.

## Personalización rápida

- Edita `recipes.json` para añadir, quitar o modificar recetas.
- Añade tus fotografías en la carpeta que hayas creado y actualiza `ruta_imagen` en `recipes.json`.
- Ajusta `styles.css` para cambiar colores, tipografías o el diseño de las tarjetas.
- El modal de detalles está en `index.html`; puedes añadir secciones extras o enlaces.
