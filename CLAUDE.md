# Generación de SKU — guía del proyecto

Herramienta interna de Servicom Global para armar, validar y confirmar SKUs antes del alta en Tango. Usuario de referencia: Andrés Uribe Grautoff (valida las reglas). Idioma de la interfaz, tests y comentarios: **español**.

## Comandos

```bash
npm run dev      # servidor de desarrollo (Vite)
npm test         # Vitest (reglas, parsing, altas y pantallas con jsdom)
npm run build    # build de producción
```

No hay linter configurado (ESLint no tiene config). Prettier se usa a mano: `--no-semi --single-quote --print-width 140`.

## De dónde salen los datos (no hay base de datos)

**No hay conexión a Tango, SQL ni APIs.** Nada se envía a ningún lado.

| Qué | Dónde vive |
|---|---|
| Tablas de referencia, genéricos y SKU existentes (~3.900) | `src/data/datosRealesTodasLasMarcas.json`: foto de CODIFICACION 2023 (versión del 21/09) y CODIFICACION GENERICOS. Se carga con `src/data/realData.js`. |
| Validaciones (existencia de SKU/EAN) | `src/services/mockSkuService.js`: simula Tango con 650 ms de demora y compara contra esa foto. Un SKU creado en Tango después del 21/09 **no se detecta**. |
| Altas de referencia | `localStorage` del navegador (`sku.altas-referencia.v1`). No se comparten entre usuarios ni computadoras. |
| SKU confirmados | Memoria de la sesión. Se pierden al recargar. «Confirmar» solo permite copiar el resumen o bajar el .xlsx. |

Para conectar Tango o una base: reemplazar `mockSkuService.js` (misma firma) y el origen de las tablas; una base compartida haría comunes las altas.

Archivos fuente originales (fuera del repo): `Downloads/Automatizacion creacion de sku/Documentos/` (`CODIFICACION 2023-.xlsx` ~15 MB, **nunca se modifica**; `CODIFICACION GENERICOS.xlsx`).

## Estructura

- `src/data/` datos reales (JSON) y ejemplos.
- `src/rules/` motor de LS2: `buildProposal`, `families` (esquemas), `freeDigits`, `descriptions` (Tango/GS1), `batch`, `validateRows`, `genericSku`, `variantPlan`, `audit`.
- `src/engines/` motores de las demás marcas: `engines.js` (segmentos y catálogos), `proposal.js` (armado simple y `buildBatchProposal` para varias variantes), `correlative.js`.
- `src/parsing/` interpretación del pedido pegado, sin IA, solo reglas: `interpret.js`, `text.js` (mail), `table.js` (filas de Excel), `components.js` (descripción → tipología/calota/gráfica/color), `toScreen.js` (de lo interpretado al estado de la pantalla), `catalogs.js`.
- `src/reference/` altas de referencia: `targets.js` (qué se puede crear y dónde), `store.js` (estado, persistencia, bloqueo), `exportReferences.js` (Excel), `useAltas.js`.
- `src/hooks/` estado de cada pantalla: `useSkuGenerator` (LS2), `useEngineGenerator` (otras marcas), `useExternalLoad` (carga desde «Pegar solicitud», una vez por pedido).
- `src/pages/` `SkuGeneratorPage` (pegar solicitud + marca), `Ls2Workspace`, `EngineWorkspace`, `ReferencesPage`, `steps.js`.
- `src/components/` `ui/` (Button, LinkButton, Icon, Modal, InfoPopup, CollapsibleGroups…), `layout/` (Wizard, Sidebar), `paste/`, `reference/`, `sku/`, `engine/`.
- Estilos: `src/theme.css` (tokens de color, **no usar valores literales**) y `src/styles.css`.

## Flujo de la pantalla

Flujo de 3 pasos (`Wizard`): **1 Datos · 2 Propuesta · 3 Validar y confirmar**. Se navega con Anterior / Siguiente o clic en el número. Todos los pasos quedan montados; el inactivo solo se oculta (`hidden`), así no se pierde lo cargado.

1. **Datos:** «Pegar solicitud» (mail y/o filas de Excel) → «Interpretar» → revisión editable → **«Cargar en la pantalla»**. Si hay algo interpretado sin cargar, «Siguiente» (y los números 2/3) se frena con un aviso que explica que la carga es requerida (`stepGuard`, `Wizard.guard`). Volver atrás nunca se frena. Cambiar lo interpretado obliga a recargar.
2. **Propuesta:** composición del SKU y tabla «SKUs a generar»; con 2+ variantes se agrupan (`CollapsibleGroups`): la primera expandida y las demás plegadas.
3. **Validar y confirmar:** validaciones con «Resultado por SKU» (lista **todos** los SKU: los que tienen errores o advertencias y los que pasaron «Sin problemas»; con 2+ variantes se agrupa por variante, primero expandido), resumen **«Qué se va a crear»** (`CreationPreview`: SKU nuevos, genéricos nuevos o reutilizados, SKU ya existentes que se omiten y SKU con error que impiden confirmar), salida (LS2) y confirmación con resumen y .xlsx.

Reglas y auditoría viven en un ícono **(i)** por sección (no como tarjetas). Hay otro (i) con los formatos de pedido soportados (`FormatsInfo`).

### Formatos de pedido que se interpretan
1. Filas de Excel con encabezado (tabulaciones).
2. Mail con talles, barras y EAN (rango «S a 2X», líneas «S: barras … / EAN …»).
3. Lista de códigos con guiones bajos, una variante por línea: `FF313_AVA_ARCANO_GLOSS_BLACK_RED`. Se marcan **una o varias** variantes (o «Seleccionar todas»): con una se carga como siempre; con varias van juntas a la **carga masiva** con una curva de talles para todas y talles propios por variante («Editar talles» → Guardar / Cancelar).

### Descripción → composición del SKU (solo cascos MAC, URBAX y marcas nuevas de cascos)
`FF313 AVA ARCANO GLOSS BLACK BLUE` (URBAX) → tipología 10 (deducida por los SKU existentes de la calota) · calota AVA=313 · gráfica ARCANO=22 · color BLACK BLUE GLOSS=I7. Cada parte queda *Existe / Deducido / Elegir / No existe*. **No se inventa nada**; con más de un candidato elige el usuario. El orden de los colores importa (BLACK RED ≠ RED BLACK); el acabado (GLOSS/MATT) puede venir primero. GUD, producto (ropa/calzado) y LS2 no se descomponen.

## Reglas de negocio confirmadas por el usuario

- **LS2 cascos:** `LS2` + 7 primeros dígitos del código de barras (a veces llamado «sinónimo») + 2 dígitos libres + `.TALLE`. Orden de los libres: `01–99`, luego `A1…A9, A0, B1…B0 … Z0`, luego `1A…9A, 0A, 1B…0Z` (`FREE_DIGIT_RANGE`). Barras y EAN vienen en el mail.
- **Demás marcas:** composición según las tablas de referencia (ver `README.md` para cada motor). Largo máximo 15, todo en MAYÚSCULAS.
- **SKU genérico = el mismo SKU sin el talle** (`UBX1031322I7.S` → `UBX1031322I7`) y **ese es el «código genérico»** de todos los SKU de su curva (`.XS … .2X`): los SKU con curva de talles pertenecen a su genérico. Uno por variante, además de un SKU por talle; va primero en la confirmación y el Excel (columna «Código genérico» = el SKU genérico). No hay genérico sin curva de talles (sin talle o `.TU`): ahí sí se pide elegir uno de la lista.
  - **SKU ya existente → se omite.** Un SKU que ya existe (artículos reales o confirmado en la sesión) no bloquea: es una advertencia con el mensaje «SKU ya existente: se omitirá su creación» (`omit: true` en el resultado), la fila se atenúa en la tabla y **no entra** en la confirmación ni en el Excel; el resumen lista lo omitido. Si todos los SKU ya existen, no se puede confirmar («no hay nada nuevo para crear»). El genérico ya existente se reutiliza (no se vuelve a crear). Lo que sigue siendo error: SKU repetido dentro del mismo lote. Una fila omitida no la bloquean otros controles (EAN, descripción…).
  - La validación «Código genérico» **da ok sola** cuando hay curva (no exige elegir de la lista). Si el genérico ya existe (se deduce por los SKU existentes con esa base, porque los datos reales no listan genéricos) avisa que se **reutiliza**; solo los talles que ya existen son error de duplicado.
  - La lista de CODIFICACION GENERICOS (ej. `UBX010313AB-GR`) pasó a ser una **clasificación opcional** del modelo («Clasificación (código de la lista)»); va en su propia columna del Excel («Clasificación»).
- **Marcas:** LS2, MAC, URBAX, NTO, GUD, 921. **CLIMAX y MTR se excluyeron** a pedido.
- **Altas de referencia:** pueden crearlas los usuarios con acceso (login pendiente; hoy el creador figura como «Usuario»). Nacen *pendientes*: se pueden elegir, pero los SKU que las usan quedan **bloqueados** hasta que el usuario acepta con el popup **Aceptar / Cancelar** (`AcceptCreationDialog`, aviso `PendingAltasNotice` en el paso 3). Se exportan a un Excel **aparte** (`Altas de referencia - AAAA-MM-DD.xlsx`; por tabla: `Tabla <tipo> - <ámbito> - AAAA-MM-DD.xlsx`) con las columnas de cada hoja de origen. **Nunca se modifica CODIFICACION 2023.**

## Convenciones de interfaz

- **Botones por significado** (`Button`): `primary` verde = avanzar/crear · `success` verde oscuro = confirmar/guardar/aceptar · `danger` rojo = quitar/descartar/limpiar · `warning` ámbar = reemplazar · `dark` = analizar/ejecutar (Interpretar, Validar) · `secondary` blanco = neutro (Cancelar, Exportar). Llevan `icon` (SVG propio en `Icon.jsx`, sin librerías). Enlaces en línea: `LinkButton` (`tone`, `iconOnly` para filas angostas, con texto como etiqueta accesible).
- Los badges ya traen su símbolo (✓ ! ✕) por CSS: no agregarles iconos.
- Ventanas: `Modal` (Escape, clic afuera, devuelve el foco) e `InfoPopup`.
- **Mensajes al pasar el mouse:** `Tooltip` (se dibuja en un portal, para que no lo recorten las tablas con scroll; funciona también con foco de teclado). La Composición del SKU lo usa para explicar cada parte: los segmentos de la propuesta traen `detail: { title, text, plain?, alta? }` (motores: `segmentDetail` en `engines/proposal.js`; LS2: `proposalSegments` en `rules/buildProposal.js`). `text: null` = el código no tiene descripción en la tabla; `plain: true` = texto explicativo, sin «código → significado»; `alta` marca un dato nuevo (el mensaje avisa si falta aceptarlo). Para tooltips en un elemento dentro de una tabla, no usar `.has-tip` (se recorta).
- Contenido plegado: se **oculta** (`hidden`), no se desmonta, para no perder lo escrito.

## Tests

- Vitest; los de pantalla usan jsdom y montan componentes reales (`workspaces.smoke.test.jsx`). `LS2` y el motor de la marca se montan **a la vez**: acotar selectores con `.main:not([hidden])`.
- El estado de altas es global: usar `resetAltas()` en `afterEach`.
- Los datos son reales: al elegir SKU de ejemplo, comprobar que **no existan** ya (los de FF313 AVA ARCANO casi todos existen; `UBX103132250` está libre).
- Eventos de React en jsdom: asignar `.value` con el setter nativo del prototipo y disparar `input` / `change`.

## Gotchas de edición

- Varios archivos tienen finales de línea **CRLF** (Windows): al editar por script, normalizar y restaurar.
- En el shell, las comillas dentro de heredocs rompen scripts de reemplazo: preferir un archivo `.cjs` temporal creado con la herramienta de escritura (y borrarlo después).
- No usar Python (no está instalado); sí `node`.

## Pendientes y decisiones abiertas

Lista del usuario («Generador de SKU»):
1. Carga de imágenes / descripción / etc. al final del proceso de generación.
2. ~~Mensaje en hover del desglose del SKU~~ (hecho: cada parte de la Composición del SKU explica su código, ej. `10 → Tipología: FF SV`; ver «Convenciones de interfaz»).
3. ~~Corregir duplicado de SKU's~~ (resuelto como: los SKU ya existentes se avisan y se omiten; ver reglas). Pendiente de confirmar con el usuario si era esto lo que quería.
4. ~~Corregir SKU genérico~~ (hecho: ver reglas).
5. ~~Composición de SKU: que cargue al pulsar Siguiente~~ → resuelto con el aviso que exige «Cargar en la pantalla».
6. Altas de referencia: ajustar la forma de carga. La sugerencia de código usa una secuencia teórica y da `L0` para colores cuando la tabla va por `J4` (hay códigos sueltos hasta `K0`): **falta definir la regla** (¿siguiente al último de la tabla → `J5`? ¿primer hueco libre?). El formulario genérico es largo; simplificar.

Decisiones abiertas:
- «Sinónimo»: hoy «pendiente de definición»; si es igual a los 7 dígitos del código de barras, definirlo así.
- La carga masiva de varias variantes solo cubre cascos (MAC, URBAX, marcas nuevas, LS2). GUD y producto, de a una.
- Un único «Código genérico» (clasificación) por lote: no se puede elegir uno distinto por variante (sólido vs. gráfica).
- Mejorar el aviso «Ya hay datos cargados… ¿Reemplazarlos?» para que diga qué hay cargado y qué se pierde.
- Pendientes de validar con Andrés (cascos GUD, artículo GUD, muestras, 921, etc.): ver `README.md`, que además **está desactualizado** (todavía nombra a CLIMAX y no describe lo nuevo).
