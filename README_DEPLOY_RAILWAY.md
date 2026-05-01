# Despliegue en Railway - JoelCashKing V11

## Variables recomendadas

En Railway > Service > Variables, configura:

```env
NODE_ENV=production
APP_NAME=JoelCashKing
ADMIN_KEY=pon-una-clave-larga-y-segura
DATA_DIR=/data
```

Cuando Railway te dé el dominio público, añade también:

```env
PUBLIC_URL=https://tu-app.up.railway.app
ALLOWED_ORIGIN=https://tu-app.up.railway.app
```

## Volumen persistente

Para no perder usuarios, coins ni retiros:

1. En Railway, abre tu servicio.
2. Crea o añade un Volume.
3. Monta el volumen en:

```text
/data
```

4. Mantén la variable:

```env
DATA_DIR=/data
```

La app guardará la base de datos en:

```text
/data/db.json
```

## Comandos

Railway normalmente detecta Node.js desde `package.json`.

Build:

```bash
npm install
```

Start:

```bash
npm start
```

## Healthcheck

La app tiene:

```text
/health
```

Puedes usarlo para comprobar que está viva.

## Aviso importante

Esta V11 es producción MVP. Para crecer con muchos usuarios, lo siguiente recomendable es migrar de `db.json` a PostgreSQL/Supabase.


## Variables para encuestas / offerwall

Si vas a conectar un offerwall de encuestas, añade:

```env
OFFERWALL_NAME=Offerway
OFFERWALL_URL=https://tu-offerwall.com/wall?user_id={{USER_ID}}&username={{USERNAME}}&email={{EMAIL}}
```

Tokens disponibles:
- `{{USER_ID}}`
- `{{USERNAME}}`
- `{{EMAIL}}`
- `{{PUBLIC_URL}}`
```


## Variables para ayeT-Studios Rewarded Video

Añade en Railway:

```env
AYET_PLACEMENT_ID=TU_PLACEMENT_ID_NUMERICO
AYET_ADSLOT_NAME=TU_REWARDED_VIDEO_ADSLOT_NAME
AYET_OPTIONAL_PARAMETER=joelcashking
AYET_API_KEY=TU_API_KEY_DE_AYET
REQUIRED_ADS_PER_REWARD=5
```

En ayeT, usa:
- Placement Type: Website
- AdSlot Type: Rewarded Video

Después redeploy.


## Callback URL S2S de ayeT

En ayeT pon esta URL:

```text
https://joelcashking-production.up.railway.app/api/ayet/s2s-callback?transaction_id={transaction_id}&external_identifier={external_identifier}&currency_amount={currency_amount}&payout_usd={payout_usd}&adslot_id={adslot_id}&placement_identifier={placement_identifier}&custom_1={custom_1}&callback_type={callback_type}&is_chargeback={is_chargeback}
```

Variables Railway recomendadas:

```env
AYET_REWARD_MODE=s2s
AYET_API_KEY=TU_API_KEY_DE_AYET
```

Recuerda activar `Send S2S Callbacks` en el AdSlot de Rewarded Video.


## Variables para Direct Link Ads

En Railway añade:

```env
DIRECT_AD_URL=TU_DIRECT_LINK_DEL_PROVEEDOR
DIRECT_AD_WAIT_SECONDS=30
DIRECT_AD_COOLDOWN_SECONDS=180
DIRECT_AD_REWARD_COINS=5
```


## Varios botones Direct Ads

Para añadir varios botones en Railway:

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

Puedes usar hasta `DIRECT_AD_LINK_10_URL`.
