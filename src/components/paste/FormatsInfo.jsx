import { InfoPopup } from '../ui/InfoPopup'

/**
 * Ícono (i) en la esquina de "Pegar solicitud": formatos de solicitud que se
 * interpretan y reglas que se aplican.
 */
export function FormatsInfo() {
  return (
    <InfoPopup label="Formatos y reglas soportadas">
      <p className="muted small">
        Todo se interpreta con reglas, sin IA y sin enviar nada. Podés pegar cualquiera de estos formatos, o combinarlos.
        Siempre revisás lo interpretado antes de cargarlo.
      </p>

      <h3 className="modal__subtitle">1 · Filas de Excel</h3>
      <ul>
        <li>
          Columnas separadas por tabulación, con encabezado: <strong>MARCA, FAMILIA, TIPOLOGIA, MODELO, MODELO VARIANTE,
          DESCRIPCION, BARRAS, SKU, EAN, TALLE</strong>. Se reconocen mayúsculas, acentos y abreviaturas (“Cód. de barras”, “Marc”).
        </li>
        <li>Si la columna SKU coincide con un código genérico, se usa como genérico; si no, se toma como código del proveedor.</li>
        <li>La tabla tiene prioridad: el texto del mail solo completa lo que falte.</li>
      </ul>

      <h3 className="modal__subtitle">2 · Mail con talles, barras y EAN</h3>
      <pre className="modal__example">{`Necesitamos dar de alta el FF806 FUSION TECK LIGHT GRAY RED GLOSS, talles S a 2X.
S: barras 9806002025011 / EAN 6937449162997
M: barras 9806002025010 / EAN 6937449163000`}</pre>
      <ul>
        <li>
          <strong>Modelo:</strong> código tipo FF806 o MX701 (1 a 3 letras y 2 a 4 dígitos).
        </li>
        <li>
          <strong>Descripción:</strong> desde el modelo hasta la primera coma, punto o la palabra “talle”.
        </li>
        <li>
          <strong>Rango de talles:</strong> “S a 2X”, “S al 2X”, “S-XL” o “S hasta 2X”.
        </li>
        <li>
          <strong>Línea por talle:</strong> el talle al principio seguido de “:” o “-” (“S: …”, “XXL - …”).
        </li>
        <li>
          <strong>Números de 13 dígitos:</strong> se clasifican por la palabra que los precede (“barras”, “cod”, “EAN”). Sin
          palabras, decide el dígito verificador GS1 (válido = EAN). Si no se puede decidir, elegís vos.
        </li>
      </ul>

      <h3 className="modal__subtitle">3 · Lista de códigos con guiones bajos</h3>
      <pre className="modal__example">{`FF313_AVA_ARCANO_GLOSS_BLACK_PINK
FF313_AVA_ARCANO_GLOSS_BLACK_GRADIENT_RED_YELLOW`}</pre>
      <ul>
        <li>
          Una variante por línea, con el formato <strong>MODELO_NOMBRE_…_COLOR</strong>. Cada línea debe empezar con el modelo
          seguido de “_”.
        </li>
        <li>Los guiones bajos se leen como espacios: la descripción queda “FF313 AVA ARCANO GLOSS BLACK PINK”.</li>
        <li>
          Con varias variantes se carga <strong>una por vez</strong>: elegís cuál con «Usar», cargás, generás los SKU y repetís
          con la siguiente.
        </li>
        <li>Este formato no trae talles, barras ni EAN: se agregan a mano en la revisión.</li>
        <li>Se asume un solo modelo por solicitud.</li>
      </ul>

      <h3 className="modal__subtitle">Reglas que se aplican siempre</h3>
      <ul>
        <li>
          <strong>No se inventan datos.</strong> Cada dato queda marcado como <em>Detectado</em> (figura en el texto),{' '}
          <em>Deducido</em> (sale de los genéricos o del dígito verificador) o <em>Completar</em> (falta).
        </li>
        <li>
          <strong>Marca y familia</strong> se toman de la tabla o del texto; si faltan, se deducen cuando el modelo corresponde a
          una sola marca y familia en los genéricos.
        </li>
        <li>
          <strong>Con más de un candidato no se elige solo:</strong> si un modelo tiene varios genéricos (por ejemplo sólido y
          gráfica), se muestran las opciones y elegís.
        </li>
        <li>
          <strong>Talles:</strong> se normalizan al orden oficial (XXL pasa a 2X) y se informa qué se recibió.
        </li>
        <li>Si no se reconoce ningún dato, no se carga nada y se avisa.</li>
      </ul>

      <h3 className="modal__subtitle">Descripción y composición del SKU (cascos)</h3>
      <ul>
        <li>
          La descripción se descompone contra las tablas: <strong>tipología, calota (modelo), gráfica y color</strong>. Por ejemplo,
          «FF313 AVA ARCANO GLOSS BLACK BLUE» en URBAX → tipología 10, calota AVA = 313, gráfica ARCANO = 22, color BLACK BLUE GLOSS.
        </li>
        <li>
          El orden de los colores importa (BLACK RED no es RED BLACK); el acabado (GLOSS, MATT) puede venir primero o último.
        </li>
        <li>
          Cada parte queda <em>Existe</em>, <em>Deducido</em>, <em>Elegir</em> (hay varias) o <em>No existe</em>. Lo que no existe se da de
          alta con «Crear», sin salir de la revisión, o desde «Altas de referencia».
        </li>
        <li>
          Las altas nuevas quedan <strong>pendientes de aceptar</strong>: los SKU que las usan se bloquean hasta aceptar su creación
          (Aceptar / Cancelar). Se exportan a un Excel aparte, sin modificar CODIFICACION 2023.
        </li>
        <li>LS2 no usa estas tablas: su SKU sale del código de barras (7 dígitos) más 2 dígitos libres.</li>
      </ul>
    </InfoPopup>
  )
}
