// Descansos: cada cierto tiempo de uso seguido (50 min de fábrica) te avisa que te pares, estires o
// descanses la vista. Si dejas la computadora unos minutos o la bloqueas, cuenta como descanso.
// No avisa mientras algo está en pantalla completa (película, presentación, videollamada).
// Se controla desde los Ajustes rápidos (el menú del wifi y la batería).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Contador, textoRestante} from './contador.js';

const PASO = 30; // s entre revisiones
const INTERVALOS = [25, 45, 50, 60, 90];
const POSPONER = 10; // min
const CONSEJOS = [
    'Párate y estira la espalda y el cuello.',
    'Mira algo lejano, a unos 6 metros, durante 20 segundos.',
    'Toma agua.',
    'Camina un par de minutos.',
    'Cierra los ojos un momento y relaja los hombros.',
    'Estira las muñecas y los dedos.',
];

// Icono propio (taza de café). "-symbolic" en el nombre hace que GNOME lo pinte del color del tema.
let ICONO = null;

const azar = lista => lista[Math.floor(Math.random() * lista.length)];

function algoEnPantallaCompleta() {
    for (let i = 0; i < global.display.get_n_monitors(); i++) {
        if (global.display.get_monitor_in_fullscreen(i))
            return true;
    }
    return false;
}

const Interruptor = GObject.registerClass(
class Interruptor extends QuickMenuToggle {
    _init(ext) {
        super._init({title: 'Descansos', gicon: ICONO, toggleMode: true});
        this._ext = ext;
        this._settings = ext.getSettings();
        this._settings.bind('activo', this, 'checked', Gio.SettingsBindFlags.DEFAULT);
        this.menu.setHeader(ICONO, 'Descansos');

        this._ya = new PopupMenu.PopupImageMenuItem('Ya descansé: empezar de nuevo', 'view-refresh-symbolic');
        this._ya.connect('activate', () => ext.yaDescanse());
        this.menu.addMenuItem(this._ya);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Avisarme cada'));
        this._intervalos = INTERVALOS.map(min => {
            const item = new PopupMenu.PopupMenuItem(textoRestante(min * 60));
            item.connect('activate', () => this._settings.set_int('intervalo', min));
            this.menu.addMenuItem(item);
            return [min, item];
        });
        this._settings.connectObject('changed', () => this.actualizar(), this);
        this.actualizar();
    }

    actualizar() {
        const c = this._ext.contador;
        const activo = this._settings.get_boolean('activo');
        let estado;
        if (!activo)
            estado = 'Apagado';
        else if (c.esperando)
            estado = 'Después de la pantalla completa';
        else if (c.toca)
            estado = 'Toca descansar';
        else
            estado = `En ${textoRestante(c.restante)}`;
        this.subtitle = estado;
        this.menu.setHeader(ICONO, 'Descansos', activo
            ? `Próximo descanso: ${estado.charAt(0).toLowerCase()}${estado.slice(1)}`
            : 'No te voy a avisar');
        this._ya.setSensitive(activo);
        const intervalo = this._settings.get_int('intervalo');
        for (const [min, item] of this._intervalos)
            item.setOrnament(min === intervalo ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
    }
});

const Indicador = GObject.registerClass(
class Indicador extends SystemIndicator {
    _init(ext) {
        super._init();
        this.interruptor = new Interruptor(ext);
        this.quickSettingsItems.push(this.interruptor);
    }

    destroy() {
        this.quickSettingsItems.forEach(i => i.destroy());
        super.destroy();
    }
});

export default class Descansos extends Extension {
    enable() {
        ICONO = Gio.FileIcon.new(this.dir.get_child('icons').get_child('descansos-symbolic.svg'));
        this._settings = this.getSettings();
        this.contador = new Contador(this._settings.get_int('intervalo'), this._settings.get_int('descanso'));
        this._inactividad = global.backend.get_core_idle_monitor();
        this._fuente = null;
        this._aviso = null;
        this._indicador = new Indicador(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicador);

        this._settings.connectObject(
            'changed::intervalo', () => {
                this.contador.intervalo = this._settings.get_int('intervalo') * 60;
                this._indicador.interruptor.actualizar();
            },
            'changed::descanso', () => {
                this.contador.descanso = this._settings.get_int('descanso') * 60;
            },
            'changed::activo', () => this.yaDescanse(), this);

        this._reloj = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, PASO, () => {
            this._paso();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._reloj)
            GLib.source_remove(this._reloj);
        this._reloj = 0;
        this._settings.disconnectObject(this);
        this._aviso?.destroy();
        this._aviso = null;
        this._fuente?.destroy();
        this._fuente = null;
        this._indicador?.destroy();
        this._indicador = null;
        this._settings = null;
        this.contador = null;
        ICONO = null;
    }

    _paso() {
        if (!this._settings.get_boolean('activo'))
            return;
        const toca = this.contador.paso(PASO, {
            inactivoMs: this._inactividad.get_idletime(),
            bloqueado: Main.screenShield?.locked ?? false,
            pantallaCompleta: algoEnPantallaCompleta(),
        });
        if (this.contador.activo === 0)
            this._aviso?.destroy(); // ya descansaste: el aviso viejo sobra
        if (toca)
            this._avisar();
        this._indicador.interruptor.actualizar();
    }

    yaDescanse() {
        this.contador.reiniciar();
        this._aviso?.destroy();
        this._indicador?.interruptor.actualizar();
    }

    _avisar() {
        if (!this._fuente) {
            this._fuente = new MessageTray.Source({title: 'Descansos', icon: ICONO});
            this._fuente.connect('destroy', () => {
                this._fuente = null;
            });
            Main.messageTray.add(this._fuente);
        }
        this._aviso?.destroy();
        const minutos = Math.round(this.contador.activo / 60);
        const aviso = new MessageTray.Notification({
            source: this._fuente,
            title: `Llevas ${textoRestante(minutos * 60)} seguidos: toca descansar`,
            body: azar(CONSEJOS),
            urgency: MessageTray.Urgency.HIGH,
            sound: new MessageTray.Sound(null, 'complete'),
        });
        aviso.addAction('Ya descansé', () => this.yaDescanse());
        aviso.addAction(`En ${POSPONER} min`, () => {
            this.contador.posponer(POSPONER);
            this._indicador?.interruptor.actualizar();
        });
        aviso.connect('destroy', () => {
            if (this._aviso === aviso)
                this._aviso = null;
        });
        this._aviso = aviso;
        this._fuente.addNotification(aviso);
    }
}
