# Koditos Arcade

Proyecto para crear juegos sencillos estilo arcade/Atari. La idea es tener una
pequena plataforma de juegos independientes que puedan abrirse directamente en
el navegador.

## Arquitectura

Koditos Arcade es un proyecto web estatico hecho con HTML, CSS y JavaScript.
No usa framework, backend, base de datos ni proceso de build. Cada juego corre
directamente en el navegador usando `canvas` para renderizar la accion.

La raiz del proyecto funciona como menu principal:

- `index.html`: pantalla inicial de IXMAIA Arcade.
- `README.md`: documentacion del proyecto.
- `games/`: carpeta donde vive cada juego como modulo independiente.

Cada juego tiene su propia carpeta y mantiene separadas sus tres capas
principales:

- `index.html`: estructura de la pantalla, HUD, botones, paneles y canvas.
- `src/styles.css`: apariencia visual, layout responsive y estilo arcade.
- `src/game.js`: estado del juego, controles, fisicas, colisiones, dibujo y loop.

## Capa de configuracion

RoboChip y Padel Arcade ya incluyen una primera capa de configuracion en sus
archivos `game.js` mediante el objeto `GAME_CONFIG`.

Esta capa concentra valores que un asistente podria modificar con menos riesgo:

- Titulo del juego.
- Vidas iniciales.
- Posicion inicial del jugador.
- Drones, colores y puntos de dispersion.
- Niveles de dificultad.
- Escenarios y mapas.
- Modos de juego.
- Marcador objetivo.
- Velocidades, tamanos y reglas de power-ups.
- Colores principales del canvas.
- Mensajes de estado y textos del overlay.

La idea es separar dos responsabilidades:

- Configuracion: valores editables para personalizar el juego.
- Motor: movimiento, colisiones, audio, render, controles y reglas base.

Esto permite que un asistente pueda tomar un juego base y aplicar cambios del
usuario tocando primero `GAME_CONFIG`. Solo deberia tocar el motor cuando el
usuario pida una mecanica nueva que no exista en la plantilla.

## Estructura

```text
koditos/
  index.html
  README.md
  games/
    RoboChip/
      index.html
      src/
        game.js
        styles.css
    Pong/
      index.html
      src/
        game.js
        styles.css
```

## Flujo del proyecto

1. El usuario abre `index.html` en la raiz.
2. El menu principal muestra los juegos disponibles.
3. Al seleccionar un juego, el navegador abre su propio `index.html`.
4. Ese archivo carga su `styles.css` y su `game.js`.
5. El juego inicia su estado interno y arranca el loop con
   `requestAnimationFrame`.

## Juegos actuales

### RoboChip

Juego tipo laberinto arcade. Su logica vive en `games/RoboChip/src/game.js`.

Incluye:

- Mapas por escenario.
- Puntos, vidas y estado de partida.
- Drones enemigos.
- Dificultades.
- Escenarios seleccionables.
- Power pellets.
- Colisiones.
- Sonidos generados con Web Audio.
- Controles de teclado y tactiles.

### Padel Arcade

Juego inspirado en Pong/Padel. Su logica vive en `games/Pong/src/game.js`.

Incluye:

- Marcador.
- Modo de 1 jugador contra la maquina.
- Modo de 2 jugadores.
- Dificultades para la IA.
- Golpe fuerte.
- Power-up de cambio de direccion.
- Colisiones con paletas y paredes.
- Controles de teclado, botones y tactiles.

## Como funciona cada juego

Los juegos siguen una estructura parecida:

- Capturan elementos del DOM con `document.querySelector`.
- Definen constantes como tamanos, velocidades, colores y puntajes.
- Guardan el estado de la partida en variables y objetos.
- Tienen funciones para iniciar, pausar, reiniciar y actualizar el HUD.
- Leen controles de teclado, botones y eventos tactiles.
- Actualizan la simulacion en una funcion `update(deltaTime)`.
- Dibujan el frame actual en una funcion `draw()`.
- Repiten el ciclo con `requestAnimationFrame(gameLoop)`.

Esta organizacion permite que cada juego sea autonomo, facil de modificar y
facil de eliminar o mover sin afectar a los demas.

## Agregar un nuevo juego

Para agregar otro juego, crea una carpeta nueva dentro de `games/` siguiendo el
mismo patron:

```text
games/NuevoJuego/
  index.html
  src/
    game.js
    styles.css
```

Despues agrega un enlace al nuevo juego en el `index.html` principal.

## Como jugar

Abre `index.html` en tu navegador para ver el menu principal.

Cada juego vive en su propia carpeta dentro de `games/`.
