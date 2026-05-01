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
