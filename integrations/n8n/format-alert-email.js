const alerts = Array.isArray($json.notifications) ? $json.notifications : []

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]))

const formatPercent = (value, absolute = false) => {
  const numericValue = Number(value) * 100
  if (!Number.isFinite(numericValue)) return '—'
  const formatted = Math.abs(numericValue).toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return absolute ? `${formatted}%` : `${numericValue >= 0 ? '+' : '−'}${formatted}%`
}

const formatThreshold = (value, isDrop) => {
  const numericValue = Math.abs(Number(value)) * 100
  if (!Number.isFinite(numericValue)) return '—'
  return `${isDrop ? '−' : '+'}${numericValue.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

const formatPrice = (value) => `${Number(value).toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} €`

const formatDate = (value) => new Date(value).toLocaleString('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

return alerts.map((alert) => {
  const numericReturn = Number(alert.rendimiento_pct)
  const isDrop = alert.tipo === 'caida' || (Number.isFinite(numericReturn) && numericReturn < 0)
  const eventLabel = isDrop ? 'Caída detectada' : 'Subida detectada'
  const eventIcon = isDrop ? '↓' : '↑'
  const accent = isDrop ? '#e58b8d' : '#c8f56a'
  const accentSoft = isDrop ? '#3b2028' : '#1b2a21'
  const accentText = isDrop ? '#ffd9da' : '#d8fb83'
  const assetName = escapeHtml(alert.activo || 'Activo vigilado')
  const ticker = escapeHtml(alert.ticker || '—')
  const scope = alert.alcance === 'cartera' ? 'Cartera completa' : 'Posición vigilada'
  const targetText = alert.alcance === 'cartera' ? 'Tu cartera' : `Tu posición en ${alert.activo || alert.ticker || 'este activo'}`
  const targetHtml = alert.alcance === 'cartera' ? 'Tu cartera' : `Tu posición en ${assetName}`
  const movementVerb = isDrop ? 'bajado' : 'subido'
  const movementPercent = formatPercent(alert.rendimiento_pct, true)
  const movementText = `${targetText} ha ${movementVerb} un ${movementPercent}`
  const movementHtml = `${targetHtml} ha ${movementVerb} un ${movementPercent}`
  const channelHint = [
    alert.canal_telegram ? 'Telegram' : null,
    alert.canal_email ? 'Email' : null,
  ].filter(Boolean).join(' · ')
  const currentReturn = formatPercent(alert.rendimiento_pct)
  const threshold = formatThreshold(alert.umbral_pct, isDrop)
  const targetPrice = Number(alert.precio_objetivo)
  const hasTargetTrigger = alert.razon === 'precio_objetivo' && Number.isFinite(targetPrice) && targetPrice > 0
  const targetPriceText = Number.isFinite(targetPrice) && targetPrice > 0 ? formatPrice(targetPrice) : null
  const triggerValue = hasTargetTrigger ? targetPriceText : threshold
  const triggerLabel = hasTargetTrigger ? 'Precio objetivo' : 'Aviso enviado'
  const triggerDetail = hasTargetTrigger ? 'Nivel alcanzado' : 'Al cruzar este nivel'
  const referencePrice = Number(alert.precio_referencia)
  const referencePriceText = Number.isFinite(referencePrice) && referencePrice > 0 ? formatPrice(referencePrice) : null
  const referenceLabel = alert.alcance === 'cartera' ? 'Precio base configurado' : 'Precio de referencia'
  const referenceDescription = alert.alcance === 'cartera' ? `la base configurada en ${referencePriceText}` : `el precio de referencia de ${referencePriceText}`
  const triggerDescription = hasTargetTrigger
    ? `el precio objetivo de ${targetPriceText}`
    : `la rentabilidad ha cruzado el nivel ${threshold}${referencePriceText ? ` desde ${referenceDescription}` : ''}`
  const checkedAt = formatDate(alert.checked_at)
  const subject = hasTargetTrigger
    ? `Finanzas · ${assetName} ha alcanzado ${targetPriceText}`
    : `Finanzas · ${movementText}`
  const priceRows = [
    alert.precio_actual !== null && alert.precio_actual !== undefined
      ? `<tr><td style="padding:8px 0;color:#8997a3;font-size:12px;">Precio actual</td><td align="right" style="padding:8px 0;color:#f7f5ef;font-size:12px;font-weight:700;">${formatPrice(alert.precio_actual)}</td></tr>`
      : '',
    alert.precio_referencia !== null && alert.precio_referencia !== undefined
      ? `<tr><td style="padding:8px 0;color:#8997a3;font-size:12px;">${referenceLabel}</td><td align="right" style="padding:8px 0;color:#f7f5ef;font-size:12px;font-weight:700;">${formatPrice(alert.precio_referencia)}</td></tr>`
      : '',
    targetPriceText
      ? `<tr><td style="padding:8px 0;color:#8997a3;font-size:12px;">Precio objetivo</td><td align="right" style="padding:8px 0;color:#f7f5ef;font-size:12px;font-weight:700;">${targetPriceText}</td></tr>`
      : '',
  ].filter(Boolean).join('')

  const text = [
    `${eventIcon} ${movementText}`,
    `${scope} · ${alert.ticker}`,
    `Rentabilidad actual: ${currentReturn}`,
    hasTargetTrigger ? `Precio objetivo alcanzado: ${targetPriceText}` : `Aviso enviado al cruzar: ${threshold}`,
    alert.precio_actual !== null && alert.precio_actual !== undefined ? `Precio actual: ${formatPrice(alert.precio_actual)}` : null,
    alert.precio_referencia !== null && alert.precio_referencia !== undefined ? `${referenceLabel}: ${formatPrice(alert.precio_referencia)}` : null,
    `Canales: ${channelHint}`,
    `Comprobado: ${checkedAt}`,
  ].filter(Boolean).join('\n')

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0d1118;color:#f7f5ef;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1118;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#151b25;border:1px solid #2b3743;border-radius:18px;overflow:hidden;">
            <tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 30px 24px;border-bottom:1px solid #2b3743;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <div style="color:#8997a3;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">FINANZAS / INVERSIONES</div>
                      <div style="margin-top:8px;color:#f7f5ef;font-size:19px;font-weight:700;letter-spacing:-.4px;">Tu cartera en movimiento.</div>
                    </td>
                    <td align="right" valign="top">
                      <span style="display:inline-block;width:38px;height:38px;border-radius:50%;background:${accentSoft};color:${accent};font-size:25px;line-height:38px;text-align:center;font-weight:700;">${eventIcon}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <div style="display:inline-block;padding:7px 10px;border-radius:999px;background:${accentSoft};color:${accentText};font-size:11px;font-weight:700;letter-spacing:.3px;">${eventLabel}</div>
                <h1 style="margin:18px 0 5px;color:#f7f5ef;font-size:30px;line-height:1.05;letter-spacing:-1px;">${assetName}</h1>
                <div style="color:#8997a3;font-size:12px;">${ticker} &nbsp;·&nbsp; ${scope}</div>
                <div style="margin-top:22px;color:${accent};font-size:24px;line-height:1.18;font-weight:700;letter-spacing:-.6px;">${movementHtml}</div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
                  <tr>
                    <td width="48%" style="padding:18px;background:#f7f5ef;border-radius:12px;">
                      <div style="color:#65727d;font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">Rentabilidad actual</div>
                      <div style="margin-top:8px;color:${isDrop ? '#b84e55' : '#31531d'};font-size:28px;font-weight:700;letter-spacing:-1px;">${currentReturn}</div>
                      <div style="margin-top:5px;color:#8997a3;font-size:10px;">Desde la base configurada</div>
                    </td>
                    <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td width="48%" style="padding:18px;background:${accentSoft};border-radius:12px;">
                      <div style="color:${accentText};font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">${triggerLabel}</div>
                      <div style="margin-top:8px;color:${accent};font-size:28px;font-weight:700;letter-spacing:-1px;">${triggerValue}</div>
                      <div style="margin-top:5px;color:#a8b4bd;font-size:10px;">${triggerDetail}</div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #2b3743;">
                  ${priceRows}
                  <tr><td style="padding:8px 0;color:#8997a3;font-size:12px;">Canales</td><td align="right" style="padding:8px 0;color:#f7f5ef;font-size:12px;font-weight:700;">${escapeHtml(channelHint || 'Email')}</td></tr>
                </table>

                <div style="margin-top:22px;padding:15px 16px;border-left:3px solid ${accent};background:#111821;color:#a8b4bd;font-size:11px;line-height:1.55;">${movementHtml}. Hemos enviado este aviso porque se ha alcanzado ${triggerDescription}. Se rearma cuando recupera el margen configurado. Comprobado el ${checkedAt}.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 22px;background:#111821;border-top:1px solid #2b3743;color:#667582;font-size:10px;line-height:1.5;">
                <strong style="color:#8997a3;letter-spacing:.5px;">FINANZAS</strong><br>
                Alertas de inversión · seguimiento automático de tu cartera
              </td>
            </tr>
          </table>
          <div style="max-width:620px;padding:14px 10px 0;color:#667582;font-size:10px;text-align:center;">Consulta la aplicación para revisar el detalle de la posición.</div>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { json: { ...alert, text, html, subject } }
})
