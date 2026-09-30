# Generación de SKU

Herramienta interna de Servicom Global para armar, validar y confirmar SKUs antes del alta en Tango, en una sola pantalla.

Trabaja con **datos reales** extraídos de CODIFICACION 2023 y CODIFICACION GENERICOS (`src/data/datosRealesTodasLasMarcas.json`), usados como mock. **No hay conexión a Tango, SQL ni APIs**: nada se envía a ningún lado.

## Cómo correrlo

```bash
npm install
npm run dev     # servidor de desarrollo
npm test        # tests de reglas (Vitest)
npm run build   # build de producción
```

## Cómo funciona

1. **Marca**: LS2, MAC, URBAX, NTO, GUD, CLIMAX o 921.
2. **Línea** (MAC y GUD): cascos o producto.
3. Según la marca y la línea se aplica un motor:

| Motor | Marcas | Estructura | Ejemplo real |
|---|---|---|---|
| LS2 | LS2 | Cascos: LS2 + 7 dígitos del código de barras + 2 libres + .talle; resto según familia | LS2980600201.S |
| Cascos | MAC, URBAX | Marca(3) + Tipología(2) + Calota(3) + Gráfica(2) + Color(2) + Talle | MAC939070001.TU |
| Producto | MAC, NTO, CLIMAX | Origen(1) + Marca(3) + Familia(1) + Tipología(2) + Género(1) + Artículo(2) + Color(2) + Talle | IMAC30010102.S |
| Producto GUD | GUD | Igual a Producto, con catálogos de GUD | — |
| Cascos GUD | GUD | GUD(3) + Tipología(2) + Gráfica(2) + Acabado(2) + Color(2) + Talle | GUD92030102.S |
| 921 | 921 | Producto sin letra de origen | 92161110102.S |

4. **Validaciones** (todas las marcas): largo máximo 15, formato según el motor, duplicados (lote, artículos existentes y sesión), código genérico obligatorio, EAN con dígito verificador cuando se carga y talle según la tabla del motor. LS2 además controla código de barras, precio y descripción Tango.
5. **Confirmación**: resumen para copiar y descarga .xlsx (formato provisorio hasta tener la plantilla oficial de Tango).
6. **Auditoría** (informativa): SKUs reales que no cumplen su estructura, con la corrección sugerida.

## Código

- `src/data/` — datos reales y ejemplos.
- `src/rules/` — motor de LS2, descripciones, lote, auditoría.
- `src/engines/` — motores de las demás marcas (armado, descomposición y validación).
- `src/hooks/` — estado de cada pantalla.
- `src/components/`, `src/pages/` — interfaz.

## Pendientes para validar con Andrés

### Todas las marcas (Etapa D)
- **Cascos GUD**: la hoja REF. CASCOS GUD describe Familia(1) + Género(1) + Gráfica(3), que sumaría 17 caracteres; los 27 SKUs reales siguen otra estructura (13 caracteres).
- **Artículo GUD**: la hoja REF. INDUMENTARIA GUD dice 3 dígitos, pero los 288 SKUs reales usan 2.
- **Muestras**: para qué se usa la hoja REFERENCIA MUESTRAS (no implementada) y qué es la marca MTR, que aparece sin código. También los 39 SKUs de COD SHOWROOM con sufijo `.MUE` (hoy solo cuentan para duplicados).
- **Acabados GUD con códigos repetidos**: MATT figura como 01, 02, 03, 05, 06 y 08. **GRIS** repetido en colores de cascos GUD (03 y 06).
- **Marca 921**: si lleva letra de origen.
- **CLIMAX**: si está activa (tiene código de marca pero ningún SKU histórico).
- **Genéricos**: CLIMAX y 921 no tienen genéricos cargados; hoy se advierte en lugar de bloquear.
- **Productos sin talle**: en qué casos un producto va sin talle (hay 51 SKUs reales así).
- **Talles de calzado**: la tabla de referencia los tiene sin punto ("40"), pero los SKUs reales usan ".40".
- **Talle ".XX"** en cascos MAC/URBAX: talle viejo equivalente a 2X.
- **Genérico en cascos MAC/URBAX**: se filtra por CASCOS en tipologías de casco y por REPUESTOS en el resto (a validar).
- **Correlativo de artículo**: hoy se sugiere el siguiente al más alto usado (no se reutilizan huecos).
- **Códigos reales que no están en los catálogos**: 20 SKUs de URBAX con gráficas fuera de `graficasURBAX`, 63 SKUs de producto con tipologías fuera de `tipologiasPorFamilia`, 4 con talles fuera de la tabla (.44, .22, .23, .20) y 1 de GUD con un color fuera de catálogo (NGUD61420157). Respetan la estructura, pero no se pueden generar desde los desplegables.

### LS2
- Rango de dígitos libres 01–09.
- Armado de Indumentaria, Guantes, Cordura, Rainwear y Calzado (código del proveedor sin letras + talle) y cómo se resuelve un talle ambiguo.
- Repuestos: códigos de 8, 11 o 12 caracteres (en los datos reales hay de 7 a 11); Equipaje y Accesorios con .TU.
- Si la regla de 7 dígitos + 2 libres aplica a las familias que no son cascos.
- Límite de 30 caracteres de la descripción Tango (el ejemplo del 21/09 tiene 34).
- Equivalencias de colores fuera de la tabla (GREEN, TURQUOISE, GRAY, HI VIS YELLOW) y errores de tipeo de la tabla (GREEEN, TURQOISE, HIGT V YELLOW).
- Descripción GS1: cómo se indica el talle y qué pasa con los números del modelo.
- Si LS2 siempre envía el código del proveedor.
- Tipo "SKU importado" para todos los artículos LS2 y formato del árbol de clasificación.
- Códigos genéricos asociados a más de un modelo.
- Sinónimo: qué se valida.
- Reparto del precio en las 11 listas y plantilla oficial de importación a Tango.
