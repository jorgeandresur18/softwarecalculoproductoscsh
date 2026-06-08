# Guía de Configuración de Supabase

Guía paso a paso para crear el proyecto en Supabase, aplicar el esquema y conectar con Next.js.

---

## 1. Crear proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) e inicia sesión.
2. Haz clic en **New Project**.
3. Completa:
   - **Organization**: tu organización (o créala)
   - **Project name**: `softwareampollas` (o el nombre que prefieras)
   - **Database Password**: elige una contraseña segura y guárdala
   - **Region**: elige la más cercana (ej. `South America (São Paulo)`)
4. Haz clic en **Create new project**.
5. Espera ~2 minutos mientras Supabase aprovisiona la base de datos.

---

## 2. Aplicar el esquema de base de datos

### 2.1 Abrir el SQL Editor

1. En el panel izquierdo de Supabase, haz clic en **SQL Editor**.
2. Haz clic en **New query**.

### 2.2 Pegar y ejecutar schema.sql

1. Abre el archivo `supabase/schema.sql` de tu proyecto.
2. Copia todo el contenido.
3. Pégalo en el SQL Editor de Supabase.
4. Haz clic en **Run** (o presiona `Ctrl+Enter`).
5. Debes ver `Success. No rows returned` si todo salió bien.

> Si ves algún error, verifica que no hayas ejecutado el archivo dos veces.
> El schema usa `CREATE TABLE IF NOT EXISTS` así que es seguro re-ejecutarlo.

### 2.3 Pegar y ejecutar rls.sql

1. Abre una **nueva query** en el SQL Editor.
2. Abre el archivo `supabase/rls.sql` de tu proyecto.
3. Copia todo el contenido.
4. Pégalo en la nueva query.
5. Haz clic en **Run**.

> Si ves errores de "policy already exists", es seguro ignorarlos. Significan que las políticas ya fueron creadas.

### 2.4 Verificar tablas creadas

1. Ve a **Table Editor** en el panel izquierdo.
2. Debes ver estas tablas:
   - `users_profiles`
   - `categories`
   - `products`
   - `symptoms`
   - `product_symptoms`
   - `serum_types`
   - `serum_products`
   - `calculation_parameters`
   - `calculations`
   - `calculation_items`

---

## 3. Obtener las credenciales de conexión

### 3.1 NEXT_PUBLIC_SUPABASE_URL

1. En Supabase, ve a **Project Settings** (ícono de engranaje en el panel izquierdo).
2. Haz clic en **API**.
3. Copia el valor de **Project URL**.
   - Tiene el formato: `https://xxxxxxxxxxxx.supabase.co`

### 3.2 NEXT_PUBLIC_SUPABASE_ANON_KEY

En la misma sección **API**:

1. Busca la sección **Project API keys**.
2. Copia el valor de **anon public**.
   - Es una cadena larga que empieza con `eyJ...`

### 3.3 SUPABASE_SERVICE_ROLE_KEY

En la misma sección **API**:

1. Busca la sección **Project API keys**.
2. Copia el valor de **service_role** (haz clic en el ojo para verlo).
3. **¡NUNCA expongas esta clave en el frontend!** Solo úsala en scripts del servidor.

---

## 4. Crear el archivo .env.local

1. En la raíz de tu proyecto (`SoftwareAmpollas/`), crea el archivo `.env.local`.
2. Agrega estas variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...tu_anon_key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...tu_service_role_key...
```

> Reemplaza los valores con los copiados en el paso 3.

3. Verifica que `.env.local` esté en `.gitignore`. Si no, agrégalo:

```
.env.local
```

---

## 5. Instalar el cliente de Supabase (ya instalado)

El proyecto ya tiene `@supabase/supabase-js` en `package.json`.
Si por algún motivo no está, ejecuta:

```bash
npm install @supabase/supabase-js
```

---

## 6. Probar la conexión

Crea un archivo temporal `scripts/test-connection.mjs` con este contenido:

```javascript
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

// Leer .env.local manualmente
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
);

const { data, error } = await supabase.from('categories').select('name');
if (error) {
  console.error('ERROR de conexión:', error.message);
} else {
  console.log('Conexión OK. Categorías en la BD:', data.map(c => c.name));
}
```

Ejecútalo con:

```bash
node scripts/test-connection.mjs
```

Debes ver las categorías que se insertaron automáticamente con el schema.

---

## 7. Crear el primer usuario administrador

1. En Supabase, ve a **Authentication** → **Users**.
2. Haz clic en **Invite user** o **Add user**.
3. Ingresa tu email y una contraseña.
4. Una vez creado, copia el **UUID** del usuario.
5. Ve a **SQL Editor** y ejecuta:

```sql
INSERT INTO users_profiles (user_id, full_name, role, active)
VALUES (
  'PEGA-AQUI-EL-UUID-DEL-USUARIO',
  'Tu nombre completo',
  'admin',
  true
);
```

---

## 8. Ejecutar el script de importación

Una vez que `.env.local` esté creado y el esquema aplicado:

### Dry-run (sin importar — solo verifica los datos):

```bash
node scripts/import-excel-data.mjs
```

### Importación real:

El script necesita leer `.env.local`. Instala `dotenv` primero:

```bash
npm install --save-dev dotenv
```

Luego ejecuta:

```bash
node --env-file=.env.local scripts/import-excel-data.mjs --import
```

> Si tu versión de Node.js es anterior a 20.6, usa:
> ```bash
> node -r dotenv/config scripts/import-excel-data.mjs --import
> ```

### Qué deberías ver al importar:

```
[1/5] Leyendo categorías desde Supabase...
  8 categorías encontradas.
[2/5] Importando síntomas...
  Síntomas importados: XX | omitidos: 0
[3/5] Importando productos...
  Productos importados: XX | omitidos: 0
[4/5] Creando relaciones producto ↔ síntoma...
  Relaciones creadas: XX | omitidas: 0
[5/5] Importación completada.
```

---

## 9. Resumen del flujo completo

```
1. Crear proyecto en supabase.com
2. Ejecutar supabase/schema.sql en el SQL Editor
3. Ejecutar supabase/rls.sql en el SQL Editor
4. Copiar URL y claves API
5. Crear .env.local con las claves
6. Crear usuario admin en Authentication
7. Insertar perfil admin en users_profiles
8. node scripts/import-excel-data.mjs --import
9. Verificar datos en Table Editor
```

---

## Solución de errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `relation "auth.users" does not exist` | El schema se ejecutó fuera de Supabase | Ejecutarlo solo en el SQL Editor de Supabase |
| `permission denied for table` | RLS activo sin credenciales | Usar service_role_key para el script de importación |
| `unique constraint violation` | El registro ya existe | Seguro ignorarlo; el script usa upsert |
| `invalid input syntax for type uuid` | UUID mal formado | Verificar el UUID copiado del usuario |
| `FetchError: fetch failed` | URL incorrecta o sin internet | Verificar NEXT_PUBLIC_SUPABASE_URL |
