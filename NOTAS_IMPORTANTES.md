# Notas importantes para JoelCashKing

## Retiradas por PayPal

La retirada debe ser manual al principio. No conectes pagos automáticos hasta tener:

- antifraude,
- verificación de email,
- límites por usuario,
- revisión de actividad,
- normas claras,
- margen económico real.

## Ruleta

La ruleta debe mantenerse como tirada gratuita. No permitas comprar tiradas con dinero real, porque eso puede parecer apuestas.

## Monedas

Las monedas son internas. No prometas dinero garantizado.

Ejemplo correcto:

> Gana monedas jugando y solicita recompensas cuando llegues al mínimo.

Ejemplo peligroso:

> Gana dinero fácil y rápido todos los días.

## Anuncios

En esta demo el anuncio está simulado. Para producción habría que integrar AdMob Rewarded Ads en Android/iOS.

## Consejo de modelo económico

Antes de pagar 1€ por cada 1000 monedas, revisa cuánto genera realmente cada usuario con anuncios.
Si pagas más de lo que ganas, la app pierde dinero.


## Retirada en efectivo solo España

Este método queda limitado a España en el backend. El usuario debe indicar:

- país,
- ciudad o zona,
- contacto para coordinar,
- notas opcionales.

Recomendación: para producción real, no publiques direcciones personales ni quedadas sin un proceso seguro. Lo ideal sería gestionar pagos de forma digital o con puntos/colaboradores verificados.

## Sopas de letras V3

- Sopa 1: más difícil que la versión anterior.
- Sopa 2: más difícil que la primera.
- Recompensa por sopa: 30 monedas.


## Unity Ads para ruleta

La lógica añadida es:

1. El usuario tiene 1 tirada gratuita al día.
2. Cuando se acaba esa tirada gratis, aparece el botón para ver Unity Ads.
3. Cada Unity Ad suma progreso para la ruleta.
4. Con 2 Unity Ads vistos, se desbloquea 1 tirada extra.
5. Al girar la tirada extra, se consumen esos 2 anuncios.

En esta webapp el anuncio está simulado. Para producción en Android/iOS hay que conectar Unity Ads real desde el SDK.


## Ruleta V5

La ruleta queda así:

- 1 tirada gratis al día.
- Después, cada tirada extra requiere 2 Unity Ads.
- Al usar la tirada extra, se consumen esos 2 anuncios.


## Perfil de usuario V6

Cada usuario registrado tiene su propio perfil. La app diferencia entre:

- Coins actuales: saldo disponible.
- Coins totales ganadas: histórico de monedas conseguidas jugando, viendo anuncios o usando la ruleta.

Cuando el usuario solicita retirada, bajan las coins actuales, pero no baja el histórico de coins ganadas.


## Historial de retiros V7

El usuario puede ver todas sus solicitudes de retiro en su perfil y en la tienda.

Estados:

- Pendiente: solicitud enviada, todavía no revisada.
- Aprobado: solicitud revisada y aceptada.
- Completado: retiro pagado o entregado.
- Rechazado: solicitud denegada por el administrador.

El estado se actualiza desde el dashboard admin.


## Tienda de retiros V8

La zona de retiros ahora funciona como una tienda visual. El usuario elige un método con tarjetas.

Métodos disponibles:
- PayPal
- Bizum
- Retiro cajero / efectivo España

Bizum se ha añadido como solicitud manual. Igual que los otros métodos, queda pendiente de revisión hasta que el admin lo marque.


## Tienda profesional V9

La tienda ahora está pensada como una pantalla principal de retiros:

- saldo visible arriba,
- métodos de retiro en tarjetas,
- resumen del método elegido,
- cálculo aproximado en euros,
- historial debajo.

La conversión por defecto sigue siendo demo:
1000 coins = 1€.


## Tarjetas regalo V10

Métodos añadidos:

- Amazon
- Google Play
- Steam
- Apple
- Spotify

Todas las tarjetas regalo se gestionan como solicitud manual pendiente. El admin debe revisar y entregar el código o tarjeta correspondiente antes de marcar la solicitud como completada.


## Producción V11

Antes de abrir a usuarios reales:

- Cambia ADMIN_KEY.
- Configura DATA_DIR=/data en Railway.
- Crea un volumen persistente en Railway montado en /data.
- Revisa términos y privacidad.
- Mantén los retiros manuales.
- No prometas ganancias garantizadas.

Para escalar a muchos usuarios, cambia db.json por PostgreSQL/Supabase.


## Portada V12

La página de inicio se ha rediseñado para que la app parezca más profesional antes de publicarla:

- explica qué es JoelCashKing,
- muestra cómo se ganan coins,
- enseña métodos de retiro,
- lleva al usuario al login/registro.

Antes de publicarla en Railway, revisa textos legales y cambia las variables de entorno.
