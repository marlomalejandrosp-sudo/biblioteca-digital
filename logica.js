"use strict";
// LÓGICA: reglas y datos
const Logica = (() => {
  const CLAVE = "biblioteca-datos", CLAVE_AJ = "biblioteca-ajustes";
  const MAX = 3, DIAS = 14;
  const GENEROS = ["novela", "ciencia", "historia", "poesía", "tecnología", "fantasía"];

  // Fechas
  const pad = n => String(n).padStart(2, "0");
  const aISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const hoyISO = () => aISO(new Date());
  const sumar = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return aISO(d); };
  const dias = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5);
  const fmt = s => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

  const no = error => ({ ok: false, error });
  const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const clave = (t, a) => norm(t.trim()) + "|" + norm(a.trim());
  const nuevoId = arr => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const buscar = (est, id) => est.libros.find(l => l.id === id);

  // Datos iniciales
  function datosIniciales() {
    const h = hoyISO();
    const L = (id, titulo, autor, anio, genero, coleccion = false) =>
      ({ id, titulo, autor, anio, genero, comentario: "", coleccion });
    const P = (id, idLibro, persona, ini, dev = null) => ({
      id, idLibro, persona, fechaPrestamo: sumar(h, ini), fechaLimite: sumar(h, ini + DIAS),
      fechaDevolucion: dev === null ? null : sumar(h, dev)
    });
    return {
      libros: [
        L(1, "Cien años de soledad", "Gabriel García Márquez", 1967, "novela"),
        L(2, "Don Quijote de la Mancha", "Miguel de Cervantes", 1605, "novela"),
        L(3, "Breve historia del tiempo", "Stephen Hawking", 1988, "ciencia"),
        L(4, "Sapiens", "Yuval Noah Harari", 2011, "historia"),
        L(5, "Cosmos", "Carl Sagan", 1980, "ciencia"),
        L(6, "Veinte poemas de amor", "Pablo Neruda", 1924, "poesía"),
        L(7, "Códice Florentino", "Bernardino de Sahagún", 1577, "historia", true),
        L(8, "Ficciones (primera edición)", "Jorge Luis Borges", 1944, "novela", true)
      ],
      prestamos: [
        P(1, 1, "Ana", -5),         
        P(2, 2, "Luis", -20),        
        P(3, 3, "Marta", -30, -20),  
        P(4, 4, "Pedro", -25, -5)    
      ]
    };
  }

  // Persistencia
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE));
      if (d && Array.isArray(d.libros) && Array.isArray(d.prestamos)) return d;
    } catch (e) { /* datos dañados: se usan los iniciales */ }
    return datosIniciales();
  }
  const guardar = est => localStorage.setItem(CLAVE, JSON.stringify(est));
  function cargarAjustes(def) {
    try { return { ...def, ...JSON.parse(localStorage.getItem(CLAVE_AJ)) }; } catch (e) { return def; }
  }
  const guardarAjustes = aj => localStorage.setItem(CLAVE_AJ, JSON.stringify(aj));
  function restablecer() {
    localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_AJ);
    return datosIniciales();
  }

  // Consultas 
  const prestamoActivo = (est, idLibro) =>
    est.prestamos.find(p => p.idLibro === idLibro && p.fechaDevolucion === null);
  const activos = est => est.prestamos.filter(p => p.fechaDevolucion === null);
  const esVencido = p => p.fechaDevolucion === null && p.fechaLimite < hoyISO();
  // Días de retraso: activo → hasta hoy; devuelto → hasta su devolución
  const retraso = p => Math.max(0, dias(p.fechaLimite, p.fechaDevolucion ?? hoyISO()));
  function estadoLibro(est, l) {
    if (l.coleccion) return "coleccion";
    return prestamoActivo(est, l.id) ? "prestado" : "disponible";
  }

  function filtrar(est, { texto, estado, genero }) {
    const t = norm(texto.trim());
    return est.libros.filter(l => {
      const e = estadoLibro(est, l);
      const okTexto = !t || norm(l.titulo).includes(t) || norm(l.autor).includes(t);
      const okEstado = estado === "todos" || (estado === "disponibles" && e === "disponible") ||
        (estado === "prestados" && e === "prestado");
      return okTexto && okEstado && (!genero || l.genero === genero);
    });
  }
  
  function ordenar(libros, campo, dir) {
    const f = dir === "desc" ? -1 : 1;
    return [...libros].sort((a, b) =>
      f * (campo === "anio" ? a.anio - b.anio : a[campo].localeCompare(b[campo], "es")));
  }
  function resumen(est) {
    const porGenero = {};
    est.libros.forEach(l => { porGenero[l.genero] = (porGenero[l.genero] || 0) + 1; });
    return {
      total: est.libros.length,
      disponibles: est.libros.filter(l => estadoLibro(est, l) === "disponible").length,
      prestados: activos(est).length,
      vencidos: activos(est).filter(esVencido).length,
      porGenero
    };
  }

  // Acciones
  const validarPersona = n =>
    n.length < 2 || n.length > 40 ? "El nombre debe tener entre 2 y 40 caracteres." : "";

  function prestar(est, idLibro, persona) {
    const l = buscar(est, idLibro);
    if (!l) return no("El libro no existe.");
    if (l.coleccion) return no("Los libros de colección no se prestan.");
    if (prestamoActivo(est, idLibro)) return no("Ese libro ya está prestado.");
    if (activos(est).length >= MAX) return no("Máximo de 3 préstamos activos alcanzado.");
    const nombre = persona.trim(), e = validarPersona(nombre);
    if (e) return no(e);
    const h = hoyISO();
    est.prestamos.push({ id: nuevoId(est.prestamos), idLibro, persona: nombre,
      fechaPrestamo: h, fechaLimite: sumar(h, DIAS), fechaDevolucion: null });
    return { ok: true };
  }
  function devolver(est, idLibro) {
    const p = prestamoActivo(est, idLibro);
    if (!p) return no("Ese libro no está prestado.");
    p.fechaDevolucion = hoyISO(); 
    return { ok: true, retraso: retraso(p) };
  }
  function eliminar(est, id) {
    if (prestamoActivo(est, id)) return no("Un libro con préstamo activo no se puede eliminar.");
    est.libros = est.libros.filter(l => l.id !== id);
    est.prestamos = est.prestamos.filter(p => p.idLibro !== id);
    return { ok: true };
  }

  function validarLibro(est, d, idEd) {
    const e = {}, t = d.titulo.trim(), a = d.autor.trim(), n = Number(d.anio);
    if (t.length < 3 || t.length > 60) e.titulo = "El título debe tener entre 3 y 60 caracteres.";
    if (!a) e.autor = "El autor es obligatorio.";
    if (String(d.anio).trim() === "" || !Number.isInteger(n) || n < 1000 || n > 2026)
      e.anio = "El año debe ser un número entre 1000 y 2026.";
    if (!GENEROS.includes(d.genero)) e.genero = "Elige un género de la lista.";
    if (d.comentario.length > 120) e.comentario = "El comentario admite máximo 120 caracteres.";
    if (!e.titulo && est.libros.some(l => l.id !== idEd && clave(l.titulo, l.autor) === clave(t, a)))
      e.titulo = "Ya existe un libro con ese título y autor.";
    if (idEd !== null && d.coleccion && prestamoActivo(est, idEd))
      e.coleccion = "Un libro con préstamo activo no puede ser de colección.";
    return e;
  }
  
  function guardarLibro(est, d, idEd) {
    const errores = validarLibro(est, d, idEd);
    if (Object.keys(errores).length) return { ok: false, errores };
    const datos = { titulo: d.titulo.trim(), autor: d.autor.trim(), anio: Number(d.anio),
      genero: d.genero, comentario: d.comentario.trim(), coleccion: !!d.coleccion };
    if (idEd === null) est.libros.push({ id: nuevoId(est.libros), ...datos });
    else Object.assign(buscar(est, idEd), datos);
    return { ok: true };
  }

  return { MAX, GENEROS, fmt, cargar, guardar, cargarAjustes, guardarAjustes, restablecer,
    prestamoActivo, activos, esVencido, retraso, estadoLibro, filtrar, ordenar, resumen,
    prestar, devolver, eliminar, guardarLibro, datosIniciales };
})();
if (typeof module !== "undefined") module.exports = Logica;
