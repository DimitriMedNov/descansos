# Descansos

Extensión de GNOME que, tras un rato de uso seguido (50 minutos de fábrica), te avisa que te
pares, estires o descanses la vista.

## Qué hace
- **Cuenta solo el uso real.** Si dejas la computadora 5 minutos sin tocar teclado ni ratón, o la
  bloqueas, cuenta como descanso y el conteo vuelve a empezar.
- **No interrumpe la pantalla completa.** Si estás viendo una película, presentando o en una
  videollamada a pantalla completa, espera a que salgas para avisarte.
- **El aviso** trae un consejo corto (estirar, mirar lejos 20 segundos, tomar agua…) y dos
  botones: **Ya descansé** y **En 10 min**. Si lo ignoras, vuelve a avisar a los 10 minutos.

## Dónde se controla
En los **Ajustes rápidos** (el menú de arriba a la derecha, el del wifi y la batería) aparece
**Descansos** con cuánto falta para el próximo:
- El botón prende o apaga los avisos.
- La flechita abre el menú: **Ya descansé: empezar de nuevo** y cada cuánto avisar (25, 45, 50,
  60 o 90 minutos).

## Instalar
```bash
git clone https://github.com/DimitriMedNov/descansos.git
cd descansos
./install.sh
```
Cierra sesión y vuelve a entrar. Funciona en GNOME 48 a 51. `./install.sh --quitar` la quita.

Los minutos sin uso que cuentan como descanso (5 de fábrica) se cambian con:
```bash
gsettings --schemadir ~/.local/share/gnome-shell/extensions/descansos@dimitrimednov.github.io/schemas \
  set org.gnome.shell.extensions.descansos descanso 3
```

## Cómo funciona
| Archivo | Qué hace |
|---|---|
| `extension.js` | Botón de Ajustes rápidos, revisión cada 30 s y el aviso |
| `contador.js` | La cuenta: uso seguido, descanso por inactividad o bloqueo, espera en pantalla completa. No depende de GNOME y se prueba con `gjs -m` |

## Licencia
MIT.
