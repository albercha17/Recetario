# Recetario interactivo

Aplicación estática que lee el contenido de `recetario.docx` directamente en el navegador y muestra un catálogo moderno de recetas optimizado para iPhone. No es necesario ejecutar ningún servidor: basta con publicar la carpeta en GitHub Pages (por ejemplo en `https://albercha17.github.io/Recetario/`) o abrir `index.html` en el navegador.

## ¿Cómo funciona?

- Al cargar la página se descarga `recetario.docx`, se descomprime en el navegador y se analizan los títulos, secciones e imágenes para generar las fichas.
- Cada tarjeta muestra únicamente la fotografía (si existe) y el nombre de la receta. Al tocarla se abre un panel con ingredientes, preparación, consejos y tiempos.
- El buscador filtra en tiempo real por nombre de receta.
- Cada vez que actualices el documento Word y publiques los cambios en GitHub, la web mostrará automáticamente la nueva información.

## Publicación en GitHub Pages

1. Sube todos los archivos del repositorio (incluido `recetario.docx`) a la rama que GitHub Pages tenga configurada.
2. Abre la URL de GitHub Pages para ver el recetario actualizado. El navegador se encargará de cargar los últimos cambios del Word.

## Desarrollo local

Simplemente abre `index.html` en tu navegador (puedes arrastrarlo y soltarlo). Al tratarse de un fichero local, algunos navegadores bloquean las peticiones `fetch` a archivos del sistema de ficheros. Si ocurre, sirve la carpeta con cualquier servidor estático (`python -m http.server`, `npx serve`, etc.) para pruebas puntuales.

## Estructura del proyecto

- `recetario.docx`: documento fuente con recetas e imágenes.
- `index.html`: página principal y punto de entrada.
- `styles.css`: estilos del recetario.
- `app.js`: lógica que analiza el DOCX en el cliente, construye el buscador y la interfaz interactiva.

## Personalización rápida

- Edita `styles.css` para cambiar colores, tipografías o el diseño de las tarjetas.
- El modal de detalles está en `index.html`; puedes añadir secciones extras o enlaces.
- Si el documento DOCX utiliza otros estilos (p. ej. títulos distintos a "Heading 1"), ajusta el parser en `app.js` para reconocerlos.
