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

Flujo de 4 pasos (`Wizard`): **1 Datos · 2 Propuesta · 3 Validar y confirmar · 4 Imágenes**. Se navega con Anterior / Siguiente o clic en el número. Todos los pasos quedan montados; el inactivo solo se oculta (`hidden`), así no se pierde lo cargado.

1. **Datos:** «Pegar solicitud» (mail y/o filas de Excel) → «Interpretar» → revisión editable → **«Cargar en la pantalla»**. Si hay algo interpretado sin cargar, «Siguiente» (y los números 2/3) se frena con un aviso que explica que la carga es requerida (`stepGuard`, `Wizard.guard`). Volver atrás nunca se frena. Cambiar lo interpretado obliga a recargar.
2. **Propuesta:** composición del SKU y tabla «SKUs a generar»; con 2+ variantes se agrupan (`CollapsibleGroups`): la primera expandida y las demás plegadas.
3. **Validar y confirmar:** validaciones con «Resultado por SKU» (lista **todos** los SKU: los que tienen errores o advertencias y los que pasaron «Sin problemas»; con 2+ variantes se agrupa por variante, primero expandido), resumen **«Qué se va a crear»** (`CreationPreview`: SKU nuevos, genéricos nuevos o reutilizados, SKU ya existentes que se omiten y SKU con error que impiden confirmar), salida (LS2) y confirmación con resumen y .xlsx.

4. **Imágenes** (`components/images/ImageUploadStep`): tras confirmar, un grupo por variante (genérico + su curva) con arrastrar/elegir archivos, vista previa, imagen principal (la primera) y quitar. Límites: JPG/PNG/WEBP, 5 MB, 8 por variante. **Solo front: no se envían a ningún lado y se pierden al recargar** (no hay destino definido). Descripción y demás datos extra: sin definir.

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
- **Tablas compartidas vs. por marca (confirmado):** tal como está en `CODIFICACION 2023-.xlsx`, la lista de **colores** y la de **tipologías** de cascos son **una sola, compartida por MAC y URBAX** (las calotas y gráficas sí son por marca; GUD tiene todas las suyas en hojas aparte). En producto, la lista de colores también es una sola. Por eso en la vista «Códigos repetidos» un código repetido cuenta **en toda la tabla**, aunque lo usen marcas distintas. Una descripción del flujo de alta según la cual «cada marca tiene sus propios colores y los códigos pueden repetirse entre marcas» fue un **error al describirlo** (aclarado por el usuario): **no se implementó** la separación por marca ni se cambió la validación de altas. Ante una descripción así, contrastarla con el Excel antes de cambiar nada.
- **Marcas:** LS2, MAC, URBAX, NTO, GUD, 921. **CLIMAX y MTR se excluyeron** a pedido.
- **El código genérico NO se carga como alta de referencia** (decisión del usuario): se crea en la generación del SKU (es el mismo SKU sin talle; ver arriba). La tabla de genéricos de CODIFICACION GENERICOS se puede **consultar y exportar** en «Altas de referencia» (target `generico` con `readOnly: true`; «Agregar» deshabilitado con el motivo), pero `createAlta('generico', …)` se rechaza, el formulario no lo ofrece para ninguna marca y una alta de genérico guardada de antes se descarta al cargar.
- **Altas de referencia:** pueden crearlas los usuarios con acceso (login pendiente; hoy el creador figura como «Usuario»). Nacen *pendientes*: se pueden elegir, pero los SKU que las usan quedan **bloqueados** hasta que el usuario acepta con el popup **Aceptar / Cancelar** (`AcceptCreationDialog`, aviso `PendingAltasNotice` en el paso 3). **Formulario de carga** (`AltaForm`): se elige **Marca** (todas las del registro y «Marca nueva…») → **Qué querés crear** (solo los tipos que esa marca tiene: NTO y 921 no tienen calotas ni gráficas; LS2 solo colores de la descripción) → **Para** (si la marca tiene más de una tabla, ej. GUD: cascos o producto). `targetsOfBrand` / `kindsOfBrand` / `appliesTo` en `reference/targets.js` deciden qué corresponde. **Validación en vivo:** cada campo tiene borde **gris** (vacío o sin tocar), **verde** (se puede usar; los controlados contra lo existente —código, nombre— dicen «✓ Disponible») o **rojo** (no se puede usar: código con largo incorrecto, código o nombre que ya existe, obligatorio vacío una vez tocado); mientras haya algo inválido, «Guardar alta» está bloqueado y dice por qué. `validateAlta` controla cada campo por separado (un código repetido se marca aunque falten otros datos). **Buscar casos existentes** (`ExistingCases`, arriba de los campos): barra de búsqueda con los filtros elegidos a la vista (marca, tipo, tabla, familia), que sigue a lo que se elige en el formulario; los casos están plegados hasta «Ver todos (N)» o hasta escribir (filtra por código o nombre, `searchRecords`), y la fila que coincide con lo que se escribe en el formulario se marca en rojo. La tabla (`RecordsTable`) y la búsqueda son las mismas del explorador de «Altas de referencia». A la derecha de cada campo hay un **ejemplo real** de una fila existente (`exampleOf`, nunca una alta). **Código sugerido** (tablas de 2 caracteres, `suggestCode`): el primero libre a partir de la última fila de la tabla, en el orden `01–99, A1…Z0, 1A…0Z`; las calotas (3 caracteres) no sugieren nada. Las tablas de referencia tienen **códigos repetidos** (ver pendiente 6): la validación de altas rechaza un código ya usado. Se exportan a un Excel **aparte** (`Altas de referencia - AAAA-MM-DD.xlsx`; por tabla: `Tabla <tipo> - <ámbito> - AAAA-MM-DD.xlsx`) con las columnas de cada hoja de origen. **Nunca se modifica CODIFICACION 2023.**

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
1. Carga de imágenes / descripción / etc.: **diseño de imágenes hecho (paso 4, sin envío real)**; falta definir destino y qué más se carga (descripción, etc.).
2. ~~Mensaje en hover del desglose del SKU~~ (hecho: cada parte de la Composición del SKU explica su código, ej. `10 → Tipología: FF SV`; ver «Convenciones de interfaz»).
3. ~~Corregir duplicado de SKU's~~ (resuelto como: los SKU ya existentes se avisan y se omiten; ver reglas). Pendiente de confirmar con el usuario si era esto lo que quería.
4. ~~Corregir SKU genérico~~ (hecho: ver reglas).
5. ~~Composición de SKU: que cargue al pulsar Siguiente~~ → resuelto con el aviso que exige «Cargar en la pantalla».
6. Altas de referencia: ajustar la forma de carga — **parcial**. Hecho: el formulario es por marca (Marca → Qué crear → Para) con un ejemplo real al lado de cada campo (`exampleOf`), y el código sugerido sale del último de la tabla saltando lo usado (`suggestCode`). **Falta confirmar con Andrés** qué hacer con los códigos repetidos: en los colores de cascos la última fila dice `J4`, pero `I9, I0, J1…J4` figuran para dos colores distintos (filas 188–193 y 230–235) y `J5…K0` ya están usados, así que el primer libre real es `L1` (no `J5`, que el usuario esperaba). Hay 25 códigos repetidos en colores de cascos, ninguno en colores de producto (los 28 que aparecían eran tipos de indumentaria —MUSCULOSA, JERSEY, CALZA CORTA…— que la hoja trae debajo de los colores en las mismas columnas; `realData.js` los corta de `REGLA_PRODUCTO.colores`), el resto (16) en artículos por línea y tipologías GUD, 2 en gráficas de URBAX (`11` SOLID/RINO, `19` OTUS/BIXA) y 1 en calotas de MAC (`609`). `auditDuplicateCodes` los lista en el (i) de auditoría («Para revisar con Andrés»). Para verlos todos: en «Altas de referencia → Tablas de referencia» la pestaña **«Códigos repetidos (N)»** (`duplicateCases` en `reference/targets.js`) junta los de **todas las tablas** (colores de cascos y de producto, gráficas, calotas, artículos por línea y tipologías GUD; **no** los códigos genéricos, que se crean al generar el SKU), filtrable por marca, familia y texto, con una tabla angosta (chevron · código · nombres · tabla y ámbito · situación) donde el **chevron del inicio despliega debajo del caso** las filas reales de esa tabla que usan el código (se pueden abrir varios), y «Exportar repetidos» (`Codigos repetidos - AAAA-MM-DD.xlsx`); hoy son **44** (36 con nombres distintos —los que pueden dar dos SKU iguales— y 8 con el mismo nombre repetido). Dentro de una tabla, los códigos repetidos llevan la etiqueta «Código repetido» y hay un filtro «Mostrar solo los códigos repetidos de esta tabla».
7. ~~Altas: ejemplo al lado de cada campo~~ y ~~marcas faltantes en la carga~~ (hecho: ver «Altas de referencia»).

Decisiones abiertas:
- «Sinónimo»: hoy «pendiente de definición»; si es igual a los 7 dígitos del código de barras, definirlo así.
- La carga masiva de varias variantes solo cubre cascos (MAC, URBAX, marcas nuevas, LS2). GUD y producto, de a una.
- Un único «Código genérico» (clasificación) por lote: no se puede elegir uno distinto por variante (sólido vs. gráfica).
- Mejorar el aviso «Ya hay datos cargados… ¿Reemplazarlos?» para que diga qué hay cargado y qué se pierde.
- Pendientes de validar con Andrés (cascos GUD, artículo GUD, muestras, 921, etc.): ver `README.md`, que además **está desactualizado** (todavía nombra a CLIMAX y no describe lo nuevo).
