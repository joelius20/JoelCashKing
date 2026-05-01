# JoelCashKing V12

Versión 12 del MVP de JoelCashKing.

## Incluye

- Página de inicio pública.
- Zona de registro.
- Zona de login.
- Área privada solo para usuarios registrados.
- Panel del usuario con nombre, email y monedas.
- Minijuegos:
  - Quiz.
  - Sopa de letras 1, más difícil y con más palabras.
  - Sopa de letras 2, todavía más difícil.
  - Ruleta diaria.
- Anuncio recompensado simulado.
- Tienda de recompensas.
- Solicitud de retirada por PayPal.
- Solicitud de retirada en efectivo solo España.
- Dashboard de administrador.
- Sistema básico para aprobar, rechazar o marcar como pagada una retirada.

## Instalar

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

Dashboard admin:

```text
http://localhost:3000/admin
```

Clave admin por defecto:

```text
joel-dev
```

## Cambiar clave admin

En Linux/WSL:

```bash
ADMIN_KEY="mi-clave-segura" npm run dev
```

En Windows PowerShell:

```powershell
$env:ADMIN_KEY="mi-clave-segura"
npm run dev
```

## Funcionamiento de PayPal

Esta versión NO manda dinero automáticamente por PayPal.

Lo que hace es:

1. El usuario solicita retirada.
2. Se descuentan monedas.
3. La solicitud aparece en el dashboard admin.
4. El admin revisa.
5. El admin paga manualmente por PayPal.
6. El admin marca la solicitud como pagada.

Este sistema es más seguro para empezar porque evita pagar automáticamente a usuarios fraudulentos.

## Siguiente fase

Para producción real:

1. Cambiar `db.json` por Supabase/PostgreSQL.
2. Añadir email verification.
3. Añadir recuperación de contraseña.
4. Integrar AdMob real.
5. Crear panel admin con login real.
6. Añadir antifraude:
   - límite por IP,
   - límite por dispositivo,
   - detección de multicuentas,
   - historial de actividad,
   - bloqueo de usuarios sospechosos.
7. Añadir documentos legales:
   - Términos de uso,
   - Política de privacidad,
   - Política de recompensas,
   - Reglas de retirada.
8. Convertir la PWA en app Android/iOS con Capacitor.


## Cambios de la V3

- Añadida retirada en efectivo solo para España.
- La tienda ahora permite elegir entre PayPal y Efectivo España.
- El dashboard admin muestra los datos de PayPal o los datos de entrega en efectivo.
- La recompensa de sopa de letras baja de 40 monedas a 30 monedas.
- La primera sopa de letras ahora es más difícil.
- Añadida una segunda sopa de letras más difícil.
- Al completar la primera sopa, se carga automáticamente la segunda.


## Cambios de la V4

- La ruleta mantiene 1 tirada gratuita al día.
- Cuando el usuario gasta la tirada gratuita diaria, las siguientes tiradas son extra.
- Cada tirada extra requiere ver 2 anuncios de Unity Ads.
- En esta versión web los Unity Ads están simulados.
- Para Android/iOS real habría que integrar Unity LevelPlay/Unity Ads o el SDK correspondiente dentro de Capacitor, Flutter o React Native.


## Cambios de la V5

- La ruleta ahora tiene solo 1 tirada gratuita al día.
- Después de esa tirada, cada tirada extra necesita 2 Unity Ads vistos.


## Cambios de la V6

- La app ahora arranca como pantalla de acceso: primero usuario y contraseña.
- El registro sigue disponible para crear nuevos usuarios.
- Cada usuario tiene su propio nombre de usuario, email, contraseña y coins.
- Añadida pestaña Perfil dentro de la zona privada.
- El perfil muestra:
  - nombre de usuario,
  - email,
  - coins actuales,
  - coins totales ganadas,
  - fecha de creación,
  - progreso de anuncios, quiz, sopas y ruleta.
- Se añade `coinsEarned` para medir las monedas totales ganadas, aunque el usuario retire coins.


## Cambios de la V7

- Añadido historial de solicitudes de retiro para cada usuario.
- El historial aparece en:
  - Perfil.
  - Tienda.
- Cada solicitud muestra:
  - método de retiro,
  - coins solicitadas,
  - equivalente en euros,
  - fecha,
  - datos de PayPal o efectivo,
  - estado.
- Estados visibles para el usuario:
  - Pendiente.
  - Aprobado.
  - Completado.
  - Rechazado.
- En el panel admin, el estado `paid` ahora se muestra como `Completado`.


## Cambios de la V8

- La zona de solicitud de retiro ahora tiene aspecto de tienda visual.
- Añadidas tarjetas de métodos de retiro con estilo de logo:
  - PayPal
  - Bizum
  - Retiro cajero / efectivo España
- Añadido nuevo método de solicitud: Bizum.
- La tienda muestra el método seleccionado y el formulario correspondiente.
- El panel admin y el historial del usuario muestran también los datos de Bizum.


## Cambios de la V9

- La tienda de retiros tiene un diseño más profesional.
- Añadido encabezado visual con saldo disponible.
- Añadidas tarjetas de métodos más completas:
  - PayPal
  - Bizum
  - Retiro cajero / efectivo
- Añadido resumen del método seleccionado.
- Añadida previsualización aproximada en euros según las coins introducidas.
- Mejorado el historial de retiros dentro de la tienda.
- Añadido botón de actualizar historial en la tienda.


## Cambios de la V10

- Añadidas tarjetas regalo como métodos de retiro:
  - Amazon
  - Google Play
  - Steam
  - Apple
  - Spotify
- La tienda queda dividida en:
  - Dinero y efectivo
  - Tarjetas regalo
- Añadido formulario único para tarjetas regalo.
- Añadida ruta backend `/api/shop/withdraw-gift-card`.
- El historial del usuario y el panel admin muestran la tarjeta solicitada y el email de entrega.


## Cambios de la V11

- Preparación para producción MVP.
- Añadido `.env.example`.
- Añadido `.gitignore`.
- Añadido `README_DEPLOY_RAILWAY.md`.
- Añadida ruta `/health`.
- Añadida carpeta de datos persistente configurable con `DATA_DIR`.
- En producción, `ADMIN_KEY` es obligatorio.
- Añadido rate limit básico para login, registro y retiros.
- Añadido `compression`.
- Mejorada seguridad básica con `helmet`, `trust proxy` y límite de JSON.
- Añadidas páginas básicas:
  - `/terms.html`
  - `/privacy.html`
- Bump de cache PWA a V11.


## Cambios de la V12

- Nueva página de inicio premium antes del login.
- Hero visual con presentación de JoelCashKing.
- Vista previa tipo móvil con saldo, ruleta y métodos.
- Sección “Cómo funciona”.
- Sección de métodos de retiro.
- Sección de minijuegos.
- Login y registro integrados al final de la portada.
- Cache PWA actualizado a V12.
