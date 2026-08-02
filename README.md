# Chess Puzzle

Un juego de puzzles de piezas de ajedrez sobre tableros rectangulares de cualquier tamaño.
100% frontend estático — sin build, sin dependencias, listo para **GitHub Pages**.

## Cómo se juega

1. Cada nivel es un tablero rectangular (cualquier tamaño, no solo 8×8).
2. Los caracteres del tablero:
   - **MAYÚSCULAS** = piezas blancas (`K Q R B N P`)
   - **minúsculas** = piezas negras (`k q r b n p`)
   - `.` = casilla vacía
   - `x` = muro (bloquea el paso y no se puede aterrizar)
   - `f` (o cualquier otra letra libre) = **casilla meta**
3. Bajo el tablero se declara el objetivo con: `f = k`
   → "hay que llevar el **caballo negro** hasta la casilla marcada con `f`".
4. **No hay turnos**: puedes mover blancas y negras en cualquier orden.
5. Las piezas se mueven como en ajedrez estándar (torre/alfil/reina deslizan, caballo salta, rey/peón un paso, peones capturan en diagonal — sin promoción ni doble paso).
6. Puedes capturar cualquier pieza (propia o enemiga) para despejar el camino.
7. La casilla meta se comporta como una casilla vacía normal (cualquier pieza puede pisarla).

## Archivos

```
index.html      La página
styles.css      Estilos
game.js         Motor del juego (JS puro)
levels.txt      Aquí defines los niveles ← edita este archivo
```

## Editar / añadir niveles

Abre `levels.txt` y sigue este formato:

```
=== Nombre del nivel ===
# descripción opcional (una o varias líneas empezando por #)
RRBR
KQQK
k.Pf
f = k

=== Otro nivel ===
K...
....
...f
f = K
```

Reglas del archivo:
- Cada nivel empieza con `=== nombre ===`.
- Las líneas que empiezan por `#` son descripción/pistas.
- El resto de líneas hasta la meta forman el **tablero** (todas las filas deben tener la misma longitud).
- La última línea del nivel es la meta: `letra_marcador = pieza`
  - `letra_marcador` debe aparecer **exactamente una vez** en el tablero.
  - `pieza` es la letra de la pieza que hay que llevar (mayúscula = blanca, minúscula = negra).

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `chess-puzzle`).
2. Sube los 4 archivos (`index.html`, `styles.css`, `game.js`, `levels.txt`) a la raíz del repo.
3. En el repo, ve a **Settings → Pages**.
4. En **Source**, elige la rama `main` (o `master`) y la carpeta `/ (root)`. Guarda.
5. Espera 1-2 minutos. Tu juego estará en `https://<tu-usuario>.github.io/chess-puzzle/`.

Para editar niveles después, simplemente modifica `levels.txt` y haz commit → Pages se actualiza solo.

## Probarlo en local

Como el juego carga `levels.txt` con `fetch()`, **no funciona abriendo `index.html` con doble clic** (el navegador bloquea `file://`). Sírvelo con un servidor HTTP simple:

```bash
# Python 3
python -m http.server 8000

# Node
npx serve .
```

Después abre <http://localhost:8000>.

## Atajos de teclado

- `←` / `→` — nivel anterior / siguiente
- `Ctrl/Cmd + Z` — deshacer
- `R` — reiniciar nivel
- `Esc` — deseleccionar

## Personalización rápida

- Colores: edita las variables CSS al inicio de `styles.css` (`--lilac`, `--amber`, `--bg`, etc.).
- Tamaño de casilla: `computeCellSize()` en `game.js` (rango 38–72 px por defecto).
- Reglas de movimiento: función `legalMoves()` en `game.js`.
