// Cuenta el tiempo que llevas usando la computadora sin descanso. No usa nada de GNOME Shell, así
// que se puede probar con `gjs -m`.
//  - Si dejas la computadora (sin teclado ni ratón) varios minutos, o se bloquea la pantalla,
//    cuenta como descanso y vuelve a empezar.
//  - Al llegar al intervalo pide avisar, salvo en pantalla completa (película, presentación,
//    videollamada a pantalla completa): ahí espera a que salgas.
//  - Si ignoras el aviso, vuelve a avisar cada REPETIR segundos.

export const REPETIR = 10 * 60;

export class Contador {
    constructor(intervaloMin = 50, descansoMin = 5) {
        this.intervalo = intervaloMin * 60; // s
        this.descanso = descansoMin * 60; // s
        this.activo = 0; // s seguidos de uso
        this._avisadoEn = null;
        this.esperando = false; // ya tocaba avisar, pero hay algo en pantalla completa
    }

    // segundos: tiempo desde la última llamada. Devuelve true si toca avisar ahora.
    paso(segundos, {inactivoMs = 0, bloqueado = false, pantallaCompleta = false} = {}) {
        if (bloqueado || inactivoMs >= this.descanso * 1000) {
            this.reiniciar();
            return false;
        }
        this.activo += segundos;
        if (this.activo < this.intervalo) {
            this.esperando = false;
            return false;
        }
        if (pantallaCompleta) {
            this.esperando = true;
            return false;
        }
        this.esperando = false;
        if (this._avisadoEn === null || this.activo - this._avisadoEn >= REPETIR) {
            this._avisadoEn = this.activo;
            return true;
        }
        return false;
    }

    reiniciar() {
        this.activo = 0;
        this._avisadoEn = null;
        this.esperando = false;
    }

    // "En 10 min": vuelve a avisar dentro de `minutos`.
    posponer(minutos) {
        this.activo = Math.max(0, this.intervalo - minutos * 60);
        this._avisadoEn = null;
    }

    get restante() {
        return Math.max(0, this.intervalo - this.activo);
    }

    get toca() {
        return this.activo >= this.intervalo;
    }
}

export function textoRestante(segundos) {
    const min = Math.ceil(segundos / 60);
    if (min >= 60)
        return `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim();
    return `${min} min`;
}
