"use strict";
// INTERFAZ
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const el = (tag, clase, texto) => {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
};
const dd = n => `${n} ${n === 1 ? "día" : "días"}`;
const CAMPOS = ["titulo", "autor", "anio", "genero", "comentario", "coleccion"];

const porDefecto = () => ({
  tema: matchMedia("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro",
  usuario: "", campo: "titulo", dir: "asc"
});
let est = Logica.cargar();
let aj = Logica.cargarAjustes(porDefecto());
const filtros = { texto: "", estado: "todos", genero: "" };
let editandoId = null, vista = "catalogo", modal = null, abridor = null;

const libro = id => est.libros.find(l => l.id === id);
const guardarAj = () => Logica.guardarAjustes(aj);
function aviso(texto, tipo = "ok") {
  const a = $("#aviso");
  a.textContent = texto;
  a.className = "aviso " + (texto ? tipo : "");
}
function cambio() { Logica.guardar(est); renderTodo(); } // guarda y redibuja desde los datos

// Render 
function boton(texto, accion, id, clase, deshabilitado) {
  const b = el("button", clase, texto);
  b.type = "button"; b.dataset.accion = accion; b.dataset.id = id;
  b.disabled = !!deshabilitado;
  return b;
}
function tarjeta(l) {
  const e = Logica.estadoLibro(est, l), p = Logica.prestamoActivo(est, l.id);
  const c = el("article", "tarjeta " + e);
  c.append(el("h3", "", l.titulo), el("p", "", `Autor: ${l.autor}`), el("p", "", `Año: ${l.anio} · Género: ${l.genero}`));
  const et = el("p", "");
  et.append(el("span", "badge " + e, { disponible: "Disponible", prestado: "Prestado", coleccion: "De colección" }[e]));
  if (p && Logica.esVencido(p)) et.append(" ", el("span", "badge vencido", "Vencido"));
  c.append(et);
  if (p) c.append(el("p", "", `Prestado a ${p.persona}`), el("p", "", `Devolver antes del ${Logica.fmt(p.fechaLimite)}`));
  const ac = el("div", "acciones");
  ac.append(p ? boton("Devolver", "devolver", l.id, "btn") : boton("Prestar", "prestar", l.id, "btn", l.coleccion),
    boton("Editar", "editar", l.id), boton("Eliminar", "eliminar", l.id));
  c.append(ac);
  return c;
}
function renderCatalogo() {
  const lista = Logica.ordenar(Logica.filtrar(est, filtros), aj.campo, aj.dir);
  $("#tarjetas").replaceChildren(...lista.map(tarjeta));
  if (!lista.length) $("#tarjetas").append(el("p", "", "Ningún libro coincide con los filtros."));
  $("#contador").textContent = `Mostrando ${lista.length} de ${est.libros.length} libros`;
}
function renderFiltroGenero() {
  const gs = [...new Set(est.libros.map(l => l.genero))].sort((a, b) => a.localeCompare(b, "es"));
  if (!gs.includes(filtros.genero)) filtros.genero = "";
  const op = (v, t) => { const o = el("option", "", t); o.value = v; return o; };
  $("#filtro-genero").replaceChildren(op("", "Todos los géneros"), ...gs.map(g => op(g, g)));
  $("#filtro-genero").value = filtros.genero;
}
function itemPrestamo(p, historial) {
  const l = libro(p.idLibro), li = el("li", "item");
  const datos = el("div", "");
  datos.append(el("strong", "", l ? l.titulo : "(libro eliminado)"), el("p", "", `Persona: ${p.persona}`));
  if (!historial) {
    datos.append(el("p", "", `Fecha límite: ${Logica.fmt(p.fechaLimite)}`));
    li.append(datos);
    if (Logica.esVencido(p)) {
      li.classList.add("vencido");
      li.append(el("span", "badge vencido", `Vencido · ${dd(Logica.retraso(p))} de retraso`));
    }
    li.append(boton("Devolver", "devolver", p.idLibro, "btn"));
  } else {
    const r = Logica.retraso(p);
    datos.append(el("p", "", `Prestado: ${Logica.fmt(p.fechaPrestamo)} · Devuelto: ${Logica.fmt(p.fechaDevolucion)}`));
    li.append(datos, el("span", "badge " + (r ? "vencido" : "disponible"), r ? `Con ${dd(r)} de retraso` : "A tiempo"));
  }
  return li;
}
function renderPrestamos() {
  const act = Logica.activos(est).sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite));
  const his = est.prestamos.filter(p => p.fechaDevolucion)
    .sort((a, b) => b.fechaDevolucion.localeCompare(a.fechaDevolucion) || b.id - a.id);
  $("#sin-activos").hidden = act.length > 0;
  $("#sin-historial").hidden = his.length > 0;
  $("#activos").replaceChildren(...act.map(p => itemPrestamo(p, false)));
  $("#historial").replaceChildren(...his.map(p => itemPrestamo(p, true)));
}
function renderResumen() {
  const r = Logica.resumen(est);
  const fila = (k, v) => { const li = el("li", "item"); li.append(el("span", "", k), el("strong", "", v)); return li; };
  $("#resumen").replaceChildren(fila("Total de libros", r.total), fila("Disponibles", r.disponibles),
    fila("Prestados", r.prestados), fila("Vencidos", r.vencidos));
  $("#por-genero").replaceChildren(...Object.entries(r.porGenero)
    .sort((a, b) => a[0].localeCompare(b[0], "es")).map(([g, n]) => fila(g, n)));
}
function renderMenu() {
  $("#nav-prestamos").textContent = `Mis préstamos (${Logica.activos(est).length})`;
  $("#saludo").textContent = aj.usuario ? `Hola, ${aj.usuario}` : "";
}
function renderTodo() {
  renderFiltroGenero(); renderCatalogo(); renderPrestamos(); renderResumen(); renderMenu();
}

// Navegación y tema
function mostrar(nombre) {
  vista = nombre;
  $$(".vista").forEach(s => { s.hidden = s.id !== "vista-" + nombre; });
  $$("nav a").forEach(a => {
    const act = a.dataset.vista === nombre;
    a.classList.toggle("activo", act);
    if (act) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  aviso("");
}
function aplicarTema() {
  document.documentElement.dataset.tema = aj.tema;
  $("#tema").textContent = aj.tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  $("#tema").setAttribute("aria-pressed", String(aj.tema === "oscuro"));
}

// Modal propio 
function abrirModal(cfg) {
  modal = cfg; abridor = document.activeElement;
  $("#modal-titulo").textContent = cfg.titulo;
  $("#modal-texto").textContent = cfg.texto;
  $("#modal-campo").hidden = !cfg.campo;
  $("#modal-input").value = cfg.valor || "";
  $("#modal-error").textContent = "";
  $("#modal-ok").textContent = cfg.ok;
  $("#modal-fondo").hidden = false;
  (cfg.campo ? $("#modal-input") : $("#modal-ok")).focus();
}
function cerrarModal() {
  $("#modal-fondo").hidden = true; modal = null;
  if (abridor && abridor.isConnected) abridor.focus();
}
$("#modal-cancelar").addEventListener("click", cerrarModal);
$("#modal-form").addEventListener("submit", e => {
  e.preventDefault();
  const error = modal.onOk($("#modal-input").value);
  if (error) $("#modal-error").textContent = error; 
  else cerrarModal();
});

// Acciones del catálogo y de préstamos 
const acciones = {
  prestar(id) {
    if (Logica.activos(est).length >= Logica.MAX)
      return aviso("No puedes tener más de 3 préstamos activos. Devuelve un libro antes de prestar otro.", "error");
    const l = libro(id);
    abrirModal({ titulo: "Prestar libro", texto: `¿A quién se presta «${l.titulo}»?`, campo: true,
      valor: aj.usuario, ok: "Prestar",
      onOk(nombre) {
        const r = Logica.prestar(est, id, nombre);
        if (!r.ok) return r.error;
        cambio(); aviso(`«${l.titulo}» prestado a ${nombre.trim()}.`);
        return "";
      } });
  },
  devolver(id) {
    const l = libro(id), r = Logica.devolver(est, id);
    if (!r.ok) return aviso(r.error, "error");
    cambio();
    aviso(r.retraso ? `«${l.titulo}» devuelto con ${dd(r.retraso)} de retraso.` : `«${l.titulo}» devuelto a tiempo.`);
  },
  editar(id) { cargarEdicion(libro(id)); mostrar("formulario"); },
  eliminar(id) {
    const l = libro(id);
    if (Logica.prestamoActivo(est, id))
      return aviso(`No se puede eliminar «${l.titulo}» porque tiene un préstamo activo.`, "error");
    abrirModal({ titulo: "Eliminar libro", texto: `¿Eliminar «${l.titulo}»?`, ok: "Eliminar",
      onOk() {
        const r = Logica.eliminar(est, id);
        if (!r.ok) return r.error;
        if (editandoId === id) modoAgregar();
        cambio(); aviso(`«${l.titulo}» eliminado junto con su historial.`);
        return "";
      } });
  }
};
function clickAccion(e) {
  const b = e.target.closest("button[data-accion]");
  if (b && !b.disabled) acciones[b.dataset.accion](Number(b.dataset.id));
}
$("#tarjetas").addEventListener("click", clickAccion); // delegación de eventos
$("#activos").addEventListener("click", clickAccion);

// Filtros y orden
$("#buscar").addEventListener("input", e => { filtros.texto = e.target.value; renderCatalogo(); });
$("#filtro-genero").addEventListener("change", e => { filtros.genero = e.target.value; renderCatalogo(); });
$$(".estados button").forEach(b => b.addEventListener("click", () => {
  filtros.estado = b.dataset.estado;
  $$(".estados button").forEach(x => {
    const act = x === b;
    x.classList.toggle("activo", act); x.setAttribute("aria-pressed", String(act));
  });
  renderCatalogo();
}));
$("#orden-campo").addEventListener("change", e => { aj.campo = e.target.value; guardarAj(); renderCatalogo(); });
$("#orden-dir").addEventListener("change", e => { aj.dir = e.target.value; guardarAj(); renderCatalogo(); });

// Formulario agregar / editar 
const contarComentario = () => {
  $("#restantes").textContent = `${120 - $("#f-comentario").value.length} caracteres restantes`;
};
function mostrarErrores(er) {
  CAMPOS.forEach(k => {
    $("#err-" + k).textContent = er[k] || "";
    $("#f-" + k).setAttribute("aria-invalid", er[k] ? "true" : "false");
  });
}
function modoAgregar() {
  editandoId = null;
  $("#form-libro").reset(); mostrarErrores({}); contarComentario();
  $("#form-titulo").textContent = "Agregar libro";
  $("#f-enviar").textContent = "Agregar libro";
  $("#f-cancelar").hidden = true;
}
function cargarEdicion(l) {
  modoAgregar(); editandoId = l.id;
  $("#f-titulo").value = l.titulo; $("#f-autor").value = l.autor; $("#f-anio").value = l.anio;
  $("#f-genero").value = l.genero; $("#f-comentario").value = l.comentario || "";
  $("#f-coleccion").checked = l.coleccion; contarComentario();
  $("#form-titulo").textContent = "Editar libro";
  $("#f-enviar").textContent = "Guardar cambios";
  $("#f-cancelar").hidden = false;
}
$("#f-comentario").addEventListener("input", contarComentario);
$("#f-cancelar").addEventListener("click", () => { modoAgregar(); aviso(""); });
$("#form-libro").addEventListener("submit", e => {
  e.preventDefault(); // sin recargar la página
  const d = { titulo: $("#f-titulo").value, autor: $("#f-autor").value, anio: $("#f-anio").value,
    genero: $("#f-genero").value, comentario: $("#f-comentario").value, coleccion: $("#f-coleccion").checked };
  const r = Logica.guardarLibro(est, d, editandoId);
  mostrarErrores(r.errores || {});
  if (!r.ok) { $("#f-" + CAMPOS.find(k => r.errores[k])).focus(); return; }
  const edicion = editandoId !== null;
  cambio(); modoAgregar();
  aviso(edicion ? "Cambios guardados." : "Libro agregado al catálogo.");
});

// Escape
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (modal) { cerrarModal(); return; }
  if (vista === "formulario") { modoAgregar(); aviso(""); }
});

// Navegación y ajustes
$$("nav a").forEach(a => a.addEventListener("click", e => { e.preventDefault(); mostrar(a.dataset.vista); }));
$("#tema").addEventListener("click", () => {
  aj.tema = aj.tema === "oscuro" ? "claro" : "oscuro"; guardarAj(); aplicarTema();
});
$("#nombre").addEventListener("input", e => { aj.usuario = e.target.value.trim(); guardarAj(); renderMenu(); });
$("#restablecer").addEventListener("click", () => abrirModal({
  titulo: "Restablecer biblioteca", texto: "Se borrarán los datos guardados y volverán los libros y préstamos iniciales.",
  ok: "Restablecer",
  onOk() {
    est = Logica.restablecer(); aj = porDefecto();
    Object.assign(filtros, { texto: "", estado: "todos", genero: "" });
    $("#buscar").value = ""; $("#orden-campo").value = aj.campo; $("#orden-dir").value = aj.dir;
    $("#nombre").value = ""; $$(".estados button").forEach(x => {
      const act = x.dataset.estado === "todos";
      x.classList.toggle("activo", act); x.setAttribute("aria-pressed", String(act));
    });
    aplicarTema(); modoAgregar(); renderTodo(); aviso("Biblioteca restablecida.");
    return "";
  } }));

// Arranque
(function iniciar() {
  const op = (v, t) => { const o = el("option", "", t); o.value = v; return o; };
  $("#f-genero").replaceChildren(op("", "Selecciona un género"), ...Logica.GENEROS.map(g => op(g, g)));
  $("#orden-campo").value = aj.campo; $("#orden-dir").value = aj.dir; $("#nombre").value = aj.usuario;
  aplicarTema(); modoAgregar(); renderTodo(); mostrar("catalogo");
})();
