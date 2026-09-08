# DEPLOYMENT — CONTROL IA

Guía para levantar el proyecto completo desde cero, sin depender de
ninguna conversación previa.

## 1. Supabase

1. Crear proyecto en supabase.com (región recomendada: la más cercana a Paraguay — São Paulo).
2. SQL Editor → ejecutar, **en este orden exacto**:
   ```
   schema.sql
   migration_002_fase1_gaps.sql
   migration_003_admin_helpers.sql
   migration_004_financial_engine.sql
   migration_005_mi_negocio.sql
   migration_006_security_hardening.sql
   migration_007_revoke_anon_admin_functions.sql
   migration_008_revoke_public_execute.sql
   migration_009_storage_bucket.sql
   migration_010_fix_onboarding_cuenta_default.sql
   migration_011_cuenta_predeterminada.sql
   migration_012_admin_user_detail.sql
   migration_013_fix_admin_get_user_detail.sql
   migration_014_fix_admin_get_user_detail_v2.sql
   ```
   (007-009 y 012-013 quedan superados por 008 y 014 respectivamente,
   pero se ejecutan igual por orden e idempotencia — ver comentarios en
   cada archivo. `migration_009` ya crea el bucket `comprobantes`, no
   hace falta crearlo a mano si se corre completa.)
3. (Opcional, para pruebas) `supabase/seed_auditoria.sql` — dataset ficticio completo.
4. Settings → API: copiar **Project URL**, **anon public key**, **service_role key**.
5. Convertir el primer usuario en administrador (después de registrarse en la app):
   ```sql
   update public.profiles set role = 'super_admin' where id = 'SU-USER-ID';
   ```

## 2. Variables de entorno

```
cp .env.example .env.local
```

Completar como mínimo `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY` para tener la app funcional (Personal/Negocio, movimientos,
IA de chat). El resto (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`WHATSAPP_*`) solo son necesarias para activar WhatsApp — ver `WHATSAPP_ARCHITECTURE.md`.

## 3. Local

```bash
npm install
npm run dev
```

## 4. Vercel (producción)

1. Conectar el repositorio de GitHub al proyecto de Vercel (Settings → Git).
2. **Root Directory:** dejar vacío si el código está en la raíz del repo (recomendado). Si en algún momento el código quedó en una subcarpeta, ese campo debe apuntar exactamente a esa subcarpeta — un desajuste acá fue la causa de una incidencia real documentada en `KNOWN_ISSUES.md` (punto E).
3. Cargar las mismas variables de entorno del paso 2 en Settings → Environment Variables.
4. Deploy — Next.js se detecta automáticamente, sin configuración de build adicional.

## 5. Dominio

Por defecto, Vercel asigna `<proyecto>.vercel.app`. Dominio propio: Settings → Domains (requiere plan Pro para dominio gratis con Vercel, o se puede apuntar un dominio propio comprado aparte).

## 6. Storage

`migration_009_storage_bucket.sql` crea el bucket `comprobantes` (público) con sus políticas. No requiere configuración manual adicional.

## 7. IA (Anthropic)

Crear cuenta en console.anthropic.com, generar una API key en Settings → API Keys, **cargar saldo** en Billing (la API se cobra por uso, no por suscripción). Sin saldo, el chat de IA responde con un mensaje amigable en vez de fallar — pero no ejecuta ninguna acción real hasta que haya crédito.

## 8. WhatsApp (opcional, no activo por defecto)

Ver checklist completo en `WHATSAPP_ARCHITECTURE.md`. Requiere cuenta de Meta Business, verificación real del negocio, y completar 4 variables de entorno + implementar los métodos de `MetaDirectProvider`.

## 9. Nota real de verificación (encontrada al preparar este export)

`npm run build` **falla** si `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
no tienen ningún valor (ni siquiera un placeholder) — varios componentes
cliente instancian `createClient()` de Supabase en el nivel superior del
módulo, y Next.js intenta pre-renderizar esas páginas durante el build.
Con las variables completamente ausentes, la construcción del cliente
de Supabase falla y tira abajo el build entero. **Solución:** siempre
tener al menos un valor de relleno (ej. `https://placeholder.supabase.co`
/ `placeholder`) en build time si todavía no se cuenta con el proyecto
real — verificado que esto sí compila limpio (34 rutas, sin errores).

## 10. Verificación post-deploy

1. Registrar un usuario de prueba real → confirmar que se crea con una cuenta "Efectivo" automática.
2. Registrar un gasto manual → confirmar que aparece en Dashboard Y en Movimientos con el mismo valor.
3. Si se cargó `ANTHROPIC_API_KEY` con saldo, probar el chat de IA con "Gasté 50 mil en supermercado".
4. Convertir ese usuario en `super_admin` y confirmar acceso a `/admin`.
