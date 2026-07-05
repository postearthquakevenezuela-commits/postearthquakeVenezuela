# El sonsaque

Sitio web (estático, multipágina) por las víctimas del terremoto en Venezuela.
Estética editorial/galería (referencia: tremainecollection.org).
**Toda donación se entrega a Poliritmo.**

## Estructura
- **`index.html`** — intro a pantalla completa (clic/toque revela el subtítulo) + página principal con GIF y accesos a las 4 secciones.
- **`art-fair.html`** — obras a la venta para recaudar.
- **`courses.html`** — cursos en video.
- **`archive.html`** — archivo/memoria.
- **`polyrithm.html`** — donaciones (PayPal + Zelle) y transparencia (Google Sheet).
- `css/styles.css`, `js/main.js`, `assets/`.

## Qué falta completar (busca `TODO` y `CONFIG`)
- **Intro/copy** — textos definitivos si quieres afinarlos.
- **GIF del héroe** (`assets/hero.gif`) — se genera desde las imágenes cuyos enlaces están en el Excel de Google Drive. Pásame ese enlace y lo armo.
- **PayPal** (`polyrithm.html`) — reemplaza `TU_HOSTED_BUTTON_ID`.
- **Zelle** (`polyrithm.html`) — correo, titular, banco.
- **Cursos** (`courses.html`) — `src` reales de los `<iframe>`.
- **Art Fair / Archive** — imágenes y datos reales (`assets/work-*.jpg`, `assets/archive-*.jpg`).
- **`js/main.js` → `CONFIG`** — `goal`, `currency`, `sheetCsvUrl` (Google Sheet publicado como CSV).

## Google Sheet (transparencia)
Encabezados esperados (cualquier orden): `fecha | concepto | destino | monto`.
En Sheets: **Archivo → Compartir → Publicar en la web → (hoja) → CSV**; pega el enlace
(`…output=csv`) en `CONFIG.sheetCsvUrl`. Sin enlace, se muestran datos de demostración.

## Ver en local
```bash
python3 -m http.server 5178
# abre http://localhost:5178
```

## Publicar en GitHub Pages
1. Crea tu cuenta: https://github.com/signup
2. Crea un repositorio (p. ej. `el-sonsaque`) y sube estos archivos.
3. Settings → Pages → Source: rama `main`, carpeta `/root` → Save.
4. Queda en `https://TU-USUARIO.github.io/el-sonsaque/`.
