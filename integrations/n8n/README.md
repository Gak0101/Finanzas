# Alertas de inversiones con n8n

El workflow `finanzas-alertas-telegram-email.json` consulta Finanzas cada hora,
actualiza precios, detecta cruces nuevos y envía cada alerta a Telegram, email o
ambos según la regla guardada en la aplicación.

## Configuración

1. En Finanzas configura variables secretas:

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
   ALERT_EMAIL_FROM=alertas@tudominio.com
   ALERT_EMAIL_TO=tu-destino@tudominio.com
   ```

4. Asigna las credenciales de n8n:

   - `Finanzas Telegram`: bot creado con `@BotFather`.
   - `Finanzas SMTP`: proveedor SMTP o Gmail con contraseña de aplicación.

5. Prueba el nodo `Consultar Finanzas` manualmente y activa el workflow cuando
   el mensaje de prueba llegue correctamente.

Las credenciales no se guardan en Finanzas ni en Git. El endpoint solo devuelve
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
