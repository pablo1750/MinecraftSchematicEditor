# Publicación del editor en minecraft.pablogonzalez.ar/editor/

El editor mantiene su proyecto original independiente. Su compilación produce un sitio Vite estático con base `/editor/`; el servidor PHP de `pablo1750/minecraft-server` es quien exige la sesión JWT al servir **todos** los archivos bajo `/editor/`.

## Compilación y publicación

La rama de trabajo es exclusivamente `desarrollo`.

- El workflow `.github/workflows/build.yml` se ejecuta únicamente cuando cambia `run_compiler.work` en `desarrollo`.
- Siempre instala dependencias con `npm ci`, verifica tipos y ejecuta `npm run build`.
- Publica el resultado compilado `dist/` como artifact.
- Solo realiza el paso de despliegue cuando `EDITOR_DEPLOY_ENABLED=true`.
- No utiliza `rsync --delete` y su ruta de destino debe terminar en `/editor`.

La publicación **no** modifica el backend PHP, sus datos ni `config.php`. Los cambios en el frontend no deben alterar el sistema de autenticación.

## Variables del repositorio GitHub Actions

Configurarlas en **Settings > Secrets and variables > Actions > Variables**:

| Nombre | Ejemplo / significado |
| --- | --- |
| `EDITOR_DEPLOY_ENABLED` | `false` hasta verificar el acceso SSH y la ruta; después `true` |
| `EDITOR_SSH_HOST` | Nombre de host o IP públicos de SSH |
| `EDITOR_SSH_PORT` | Puerto SSH, por ejemplo `22` |
| `EDITOR_SSH_USER` | Usuario SSH autorizado a escribir solo en `/editor` |
| `EDITOR_DEPLOY_PATH` | Ruta absoluta real del sitio, terminada en `/editor`, por ejemplo `/home/USUARIO/public_html/editor` |

En **Secrets**, configurar:

- `EDITOR_SSH_KEY`: clave privada SSH del usuario de despliegue.
- `EDITOR_SSH_KNOWN_HOSTS`: entrada `known_hosts` del servidor, cuya huella se haya verificado por un canal confiable. No aceptar automáticamente cualquier host en cada compilación.

Usar permisos mínimos para el usuario de despliegue. No utilizar el token de Minecraft ni el secreto JWT como variables de Vite.

## Activación y prueba

1. Verificar en el hosting la ruta absoluta al document root de `minecraft.pablogonzalez.ar`.
2. Verificar que la ruta `editor/` está cubierta por el `.htaccess` del proyecto PHP (redirección a `index.php?editor_path=...`) y que el servidor sirve sus recursos con la misma cookie.
3. Completar las variables y secretos de SSH. Activar `EDITOR_DEPLOY_ENABLED=true`.
4. Incrementar el número de `run_compiler.work` y hacer commit en `desarrollo`.
5. Abrir `https://minecraft.pablogonzalez.ar/editor/` con sesión iniciada. Comprobar que los recursos JS, CSS, SVG y fuentes cargan.
6. Cerrar sesión: el editor y sus recursos privados deben dejar de estar accesibles.
7. Validar que el panel web y las APIs actuales siguen funcionando.

**Nota:** la verificación de Apache y la publicación real solo pueden confirmarse contra el servidor. No se deben dar por probadas por el mero éxito de `npm run build`.

## Integración pendiente con la API

El editor mantendrá sus modelos y formatos originales. Se agregará un adaptador bidireccional para listar, abrir, guardar y guardar como nueva las construcciones de nuestra API PHP. La autenticación no se implementará de nuevo en React; utilizará las cookies de sesión existentes.
