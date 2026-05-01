# JoelCashKing V22

Versión 14 del MVP de JoelCashKing.

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


## Cambios de la V13

- El quiz ahora tiene varios packs de preguntas.
- Al completar un quiz, se carga automáticamente otro quiz diferente.
- Añadida Sopa de letras 3.
- La Sopa 3 es más sencilla que la Sopa 2.
- La Sopa 3 da 10 coins.
- La Sopa 1 y la Sopa 2 mantienen 30 coins.
- Cache PWA actualizado a V13.


## Cambios de la V14

- Añadida pestaña **Encuestas** después de Ruleta.
- Añadida integración configurable para offerwall/Offerway con `OFFERWALL_URL`.
- La URL del offerwall puede recibir tokens:
  - `{{USER_ID}}`
  - `{{USERNAME}}`
  - `{{EMAIL}}`
  - `{{PUBLIC_URL}}`
- Añadida pestaña **Puzzle** después de Encuestas.
- Añadido minijuego de puzzle con 3 puzzles internos.
- Cada puzzle da 15 coins.
- Después de completar un puzzle:
  - hay que esperar 2 minutos,
  - hay que ver un Unity Ad recompensado antes del siguiente.
- Cache PWA actualizado a V14.


## Cambios de la V15

- Integrado el tag Vignette Banner como anuncio recompensado controlado.
- Zona usada: `10950905`.
- El botón de anuncio del inicio ahora carga el Vignette y espera 15 segundos antes de aplicar coins.
- La ruleta usa este anuncio para desbloquear progreso de tirada extra.
- El puzzle usa este anuncio para desbloquear el siguiente puzzle.
- Añadido overlay visual de anuncio recompensado con contador.
- Cache PWA actualizado a V15.

### Aviso

Este formato no trae callback de “anuncio completado” como un rewarded SDK nativo.
La recompensa se concede tras un contador controlado por la app.
Para recompensas de alto valor, usa postback/callback real del proveedor.


## Cambios de la V16

- Cada recompensa por anuncio ahora exige completar 5 anuncios.
- El overlay de anuncio muestra:
  - anuncio actual,
  - total de anuncios necesarios,
  - barra de progreso,
  - contador de 15 segundos por anuncio.
- Se aplica a:
  - botón de coins por anuncio,
  - desbloqueo/progreso de ruleta,
  - desbloqueo del siguiente puzzle.
- Cache PWA actualizado a V16.

### Importante

Con esta versión, cada recompensa tarda aproximadamente:
5 anuncios x 15 segundos = 75 segundos, más la carga entre anuncios.


## Cambios de la V17

- Validación backend de anuncios recompensados.
- Ahora no basta con que el frontend espere 5 anuncios.
- Cada anuncio terminado se registra en el servidor mediante:
  - `/api/rewarded-ad/progress`
- Las recompensas solo se aplican si el servidor tiene 5 anuncios registrados para ese tipo:
  - `coins`
  - `roulette`
  - `puzzle`
- `/api/reward/ad` consume 5 anuncios registrados antes de dar coins.
- `/api/roulette/unity-ad` consume 5 anuncios registrados antes de sumar progreso de ruleta.
- `/api/puzzle/unity-ad` consume 5 anuncios registrados antes de desbloquear el siguiente puzzle.
- Añadida variable:
  - `REQUIRED_ADS_PER_REWARD=5`
- `/health` ahora muestra `requiredAdsPerReward`.
- Cache PWA actualizado a V17.

### Nota de seguridad

Esto es más fuerte que la V16, porque el backend ya no concede recompensa sin progreso de anuncios.
Aun así, como el proveedor Vignette no da callback real, para seguridad máxima haría falta un postback/callback oficial del proveedor.


## Cambios de la V18

- Integración de ayeT-Studios Rewarded Video SDK for HTML5.
- Se carga el SDK:
  - `https://cdn.ayet.io/offerwall/js/ayetvideosdk.min.js`
- Añadido endpoint:
  - `/api/ayet/config`
- Añadido endpoint:
  - `/api/rewarded-ad/ayet-reward`
- La app usa `AyetVideoSdk.callbackRewarded` para validar vídeo completado.
- El backend valida:
  - `status`
  - `rewarded`
  - `externalIdentifier`
  - `conversionId`
  - conversiones duplicadas
  - signature si configuras `AYET_API_KEY`
- Si ayeT no está configurado o no carga, la app conserva fallback con Vignette.
- Cache PWA actualizado a V18.

## Variables Railway para ayeT

```env
AYET_PLACEMENT_ID=TU_PLACEMENT_ID_NUMERICO
AYET_ADSLOT_NAME=TU_REWARDED_VIDEO_ADSLOT_NAME
AYET_OPTIONAL_PARAMETER=joelcashking
AYET_API_KEY=TU_API_KEY_DE_AYET
REQUIRED_ADS_PER_REWARD=5
```

En ayeT debes crear:
- Placement Type: Website
- AdSlot Type: Rewarded Video

También añade las líneas de `ads.txt` que ayeT te dé en su dashboard.


## Cambios de la V19

- Añadido endpoint S2S para ayeT:
  - `/api/ayet/s2s-callback`
- Añadido endpoint de estado:
  - `/api/rewarded-ad/status?purpose=coins`
- Añadido modo configurable:
  - `AYET_REWARD_MODE=s2s`
  - `AYET_REWARD_MODE=client`
- El frontend ahora envía `custom_1` con el tipo de recompensa:
  - `coins`
  - `roulette`
  - `puzzle`
- El callback S2S usa `custom_1` para saber a qué recompensa sumar progreso.
- Se guardan logs en `db.ayetS2SCallbacks`.
- Se evita duplicar recompensas usando `transaction_id`.
- Si configuras `AYET_API_KEY`, se intenta verificar el header:
  - `X-Ayetstudios-Security-Hash`
- Cache PWA actualizado a V19.

## Callback URL para poner en ayeT

```text
https://joelcashking-production.up.railway.app/api/ayet/s2s-callback?transaction_id={transaction_id}&external_identifier={external_identifier}&currency_amount={currency_amount}&payout_usd={payout_usd}&adslot_id={adslot_id}&placement_identifier={placement_identifier}&custom_1={custom_1}&callback_type={callback_type}&is_chargeback={is_chargeback}
```

En ayeT:
1. Ve a Placements / Apps.
2. Edita tu placement.
3. Pega la URL en Callback URL.
4. En tu AdSlot Rewarded Video, activa `Send S2S Callbacks`.
5. Usa el Callback Tester para probar.


## Cambios de la V20

- Añadida pestaña **Direct Ads**.
- Permite abrir un Direct Link Ad del proveedor.
- Recompensa configurable:
  - por defecto 5 coins.
- Espera mínima configurable:
  - por defecto 30 segundos.
- Cooldown configurable:
  - por defecto 3 minutos.
- Añadidos endpoints:
  - `/api/direct-ad/config`
  - `/api/direct-ad/start`
  - `/api/direct-ad/complete`
- El backend valida:
  - que primero se haya abierto el enlace,
  - que hayan pasado 30 segundos,
  - que no esté en cooldown.
- Cache PWA actualizado a V20.

## Variables Railway Direct Ads

```env
DIRECT_AD_URL=TU_DIRECT_LINK_DEL_PROVEEDOR
DIRECT_AD_WAIT_SECONDS=30
DIRECT_AD_COOLDOWN_SECONDS=180
DIRECT_AD_REWARD_COINS=5
```

### Limitación

Direct Link Ads no confirma realmente si el usuario permaneció en la página externa.
JoelCashKing controla la espera mínima y el cooldown, pero no puede verificar el comportamiento dentro del sitio externo.


## Cambios de la V21

- La sección Direct Ads ahora soporta varios botones.
- Cada botón puede tener:
  - nombre,
  - URL propia,
  - recompensa propia,
  - espera propia,
  - cooldown propio.
- Sigue siendo compatible con `DIRECT_AD_URL` antiguo.
- Nuevo sistema recomendado con variables:
  - `DIRECT_AD_LINK_1_NAME`
  - `DIRECT_AD_LINK_1_URL`
  - `DIRECT_AD_LINK_1_REWARD_COINS`
  - `DIRECT_AD_LINK_1_WAIT_SECONDS`
  - `DIRECT_AD_LINK_1_COOLDOWN_SECONDS`
- Soporta hasta 10 enlaces:
  - `DIRECT_AD_LINK_1_*`
  - ...
  - `DIRECT_AD_LINK_10_*`
- Cache PWA actualizado a V21.

## Ejemplo Railway

```env
DIRECT_AD_LINK_1_NAME=Anuncio 1
DIRECT_AD_LINK_1_URL=https://omg10.com/4/10951161
DIRECT_AD_LINK_1_REWARD_COINS=5
DIRECT_AD_LINK_1_WAIT_SECONDS=30
DIRECT_AD_LINK_1_COOLDOWN_SECONDS=180

DIRECT_AD_LINK_2_NAME=Anuncio 2
DIRECT_AD_LINK_2_URL=https://otro-enlace-directo
DIRECT_AD_LINK_2_REWARD_COINS=5
DIRECT_AD_LINK_2_WAIT_SECONDS=30
DIRECT_AD_LINK_2_COOLDOWN_SECONDS=180
```


## Cambios de la V22

- Reconfiguración de caché para producción.
- Nuevo `sw.js` con estrategia más segura:
  - `/api/*` siempre red.
  - `/health` siempre red.
  - `/` siempre red.
  - `.html` siempre red.
  - `.js` siempre red.
  - `.css` siempre red.
  - `sw.js` siempre red.
- `install` usa `self.skipWaiting()`.
- `activate` borra cachés antiguas y usa `clients.claim()`.
- `express.static` ya no cachea durante 1 hora.
- Añadidas cabeceras `Cache-Control: no-store` para rutas críticas.
- Añadido endpoint:
  - `/version`
- Cache PWA actualizado a V22.

## Por qué

Antes el service worker podía servir `app.js`, `index.html` o `styles.css` antiguos.
Ahora la interfaz y la API dependen siempre del servidor, evitando que Railway tenga una versión nueva pero el navegador muestre una vieja.
