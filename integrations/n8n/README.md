# Alertas de inversiones con n8n

El workflow `finanzas-alertas-telegram-email.json` consulta Finanzas cada 5 minutos,
actualiza precios, detecta cruces nuevos y envía cada alerta a Telegram, email,
WhatsApp o una combinación de ellos según la regla guardada en la aplicación.

Las reglas pueden dispararse por rentabilidad porcentual, por un precio objetivo
en EUR o por ambas condiciones. El precio objetivo solo está disponible para
activos individuales; la cartera completa se vigila por porcentaje.

## Configuración

1. En Finanzas configura las variables secretas de automatización:

   ```dotenv
   AUTOMATION_SECRET=un-secreto-largo-y-unico
   AUTOMATION_USER_ID=1
   ```

   `AUTOMATION_USER_ID` es opcional cuando solo existe un usuario.

2. Importa el JSON en n8n.
3. Define en n8n estas variables de entorno:

   ```dotenv
   FINANZAS_BASE_URL=https://finanzas.tudominio.com
   FINANZAS_AUTOMATION_SECRET=el-mismo-secreto-que-en-finanzas
   TELEGRAM_CHAT_ID=tu-chat-id
   ALERT_EMAIL_TO=tu-destino@tudominio.com
   N8N_BLOCK_ENV_ACCESS_IN_NODE=false
   ```

4. Asigna las credenciales de n8n:

   - Telegram: una credencial `telegramApi` existente o el bot creado con
     `@BotFather`.
   - Email: una credencial `gmailOAuth2` llamada `Gmail account`, autorizada con
     OAuth2 en Google Cloud. El nodo Gmail envía desde la cuenta autorizada y
     utiliza `ALERT_EMAIL_TO` como destinatario.
   - WhatsApp: crea una plantilla aprobada en Meta con un único parámetro de
     texto en el cuerpo y completa la tarjeta **WhatsApp para alertas** de
     `/configuracion` en Finanzas. Allí se guardan cifrados el token, el Graph
     URL, el Phone Number ID, el destinatario y la plantilla. n8n solo llama al
     endpoint protegido de Finanzas; no necesita duplicar esos secretos.

5. Activa el workflow cuando las credenciales estén disponibles.

## Prueba manual protegida

El workflow incluye el webhook `POST /webhook/finanzas-alertas-test`. Requiere el
mismo secreto de automatización en el header `x-finanzas-test-token` y dispara
la consulta completa de Finanzas:

```bash
curl -X POST https://n8n.tudominio.com/webhook/finanzas-alertas-test \
  -H "x-finanzas-test-token: $FINANZAS_AUTOMATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Para ver un envío real, crea temporalmente una regla con un umbral porcentual o
un precio objetivo que ya se haya cruzado y el canal deseado; después elimina
esa regla de prueba. El
workflow devuelve `200` al aceptar la ejecución y n8n conserva el resultado en
el historial de ejecuciones.

Las credenciales de Telegram y email siguen en n8n. La configuración de WhatsApp
se guarda cifrada en Finanzas y no se devuelve completa. El endpoint solo devuelve
alertas nuevas al cruzar el umbral; mientras el activo siga por encima o por
debajo no repite el mensaje. El rearme predeterminado es de un punto porcentual.

## Endpoint protegido

```http
GET /api/automatizaciones/inversiones/alertas
Authorization: Bearer <AUTOMATION_SECRET>
```

Se puede seleccionar el usuario con `?user_id=1` si no se define
`AUTOMATION_USER_ID`. La respuesta incluye `notifications`, `checkedRules`, los
errores de cotización y el estado de la comprobación.
