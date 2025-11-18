// app.js

// ---------- Utilidades ----------
function normalizarTipos(recipe) {
  const t = recipe.tipo;
  if (Array.isArray(t)) {
    return t
      .map((x) => String(x).trim())
      .filter((x) => x.length > 0);
  }
  if (typeof t === "string" && t.trim() !== "") {
    return [t.trim()];
  }
  return [];
}

function formatearEtiqueta(tipo) {
  const lower = tipo.toLowerCase();
  if (lower === "principal") return "Principal";
  if (lower === "postre") return "Postre";
  // el resto, capitalizado normal
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

// ---------- Estado ----------
let todasLasRecetas = [];
let recetasFiltradas = [];
let filtroActivo = null; // null = todas
let terminoBusqueda = "";

// ---------- Referencias DOM ----------
const cardsContainer = document.getElementById("cards");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-state-title");
const emptyMessage = document.getElementById("empty-state-message");
const searchInput = document.getElementById("search");
const filterGroup = document.getElementById("filter-group");

const modal = document.getElementById("modal");
const modalBackdrop = modal.querySelector(".modal__backdrop");
const modalClose = modal.querySelector(".modal__close");
const modalTitle = document.getElementById("modal-title");
const modalType = document.getElementById("modal-type");
const modalSections = document.getElementById("modal-sections");
const modalGallery = document.getElementById("modal-gallery");
const modalActions = document.getElementById("modal-actions");

// ---------- Carga inicial ----------
document.addEventListener("DOMContentLoaded", () => {
  fetch("recipes.json") // ajusta la ruta si tu JSON se llama distinto
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar recipes.json");
      return res.json();
    })
    .then((data) => {
      todasLasRecetas = Array.isArray(data) ? data : [];
      recetasFiltradas = [...todasLasRecetas];

      inicializarFiltros(todasLasRecetas);
      configurarBuscador();
      renderizarRecetas(recetasFiltradas);
    })
    .catch((err) => {
      console.error(err);
      mostrarEstadoVacio(
        "No se han podido cargar las recetas",
        "Comprueba que el archivo recipes.json está en la ruta correcta."
      );
    });

  configurarModal();
});

// ---------- Filtros dinámicos ----------
function inicializarFiltros(recetas) {
  const conteoTipos = new Map();

  recetas.forEach((receta) => {
    const tipos = normalizarTipos(receta);
    tipos.forEach((tipo) => {
      conteoTipos.set(tipo, (conteoTipos.get(tipo) || 0) + 1);
    });
  });

  // Limpiar contenedor
  filterGroup.innerHTML = "";

  // Botón "Todas"
  const btnTodas = document.createElement("button");
  btnTodas.type = "button";
  btnTodas.className = "filter-button filter-button--sm is-active";
  btnTodas.dataset.filterType = "";
  btnTodas.setAttribute("aria-pressed", "true");
  btnTodas.innerHTML = `
    <span class="filter-button__label">Todas</span>
    <span class="filter-button__count" data-filter-count>${todasLasRecetas.length}</span>
  `;
  filterGroup.appendChild(btnTodas);

  // Resto de botones basados en los tipos del JSON
  const tiposOrdenados = Array.from(conteoTipos.entries()).sort(([a], [b]) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  tiposOrdenados.forEach(([tipo, count]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-button filter-button--sm";
    btn.dataset.filterType = tipo;
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `
      <span class="filter-button__label">${formatearEtiqueta(tipo)}</span>
      <span class="filter-button__count" data-filter-count>${count}</span>
    `;
    filterGroup.appendChild(btn);
  });

  // Delegación de eventos para todos los botones de filtro
  filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter-type]");
    if (!button) return;

    const type = button.dataset.filterType;
    filtroActivo = type && type.length > 0 ? type : null;

    // Actualizar estado visual de los botones
    filterGroup.querySelectorAll("button[data-filter-type]").forEach((btn) => {
      const isActive = btn === button;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    aplicarFiltros();
  });
}

// ---------- Buscador ----------
function configurarBuscador() {
  searchInput.addEventListener("input", () => {
    terminoBusqueda = searchInput.value.trim().toLowerCase();
    aplicarFiltros();
  });
}

// ---------- Aplicar filtros ----------
function aplicarFiltros() {
  recetasFiltradas = todasLasRecetas.filter((receta) => {
    const titulo = (receta.titulo || "").toLowerCase();
    const coincideBusqueda =
      terminoBusqueda === "" || titulo.includes(terminoBusqueda);

    const tipos = normalizarTipos(receta);
    const coincideTipo = !filtroActivo || tipos.includes(filtroActivo);

    return coincideBusqueda && coincideTipo;
  });

  renderizarRecetas(recetasFiltradas);
}

// ---------- Renderizado de tarjetas ----------
function renderizarRecetas(recetas) {
  cardsContainer.innerHTML = "";

  if (!recetas || recetas.length === 0) {
    mostrarEstadoVacio(
      "No hay resultados",
      "Prueba a quitar algún filtro o a buscar otro nombre."
    );
    return;
  }

  ocultarEstadoVacio();

  const fragment = document.createDocumentFragment();

  recetas.forEach((receta, index) => {
    const card = crearTarjeta(receta, index);
    fragment.appendChild(card);
  });

  cardsContainer.appendChild(fragment);
}

function crearTarjeta(receta, index) {
  const tipos = normalizarTipos(receta);
  const tiposTexto =
    tipos.length > 0 ? tipos.map(formatearEtiqueta).join(" · ") : "";

  const imgSrc = receta.ruta_imagen || receta.foto || "";
  const titulo = receta.titulo || "Receta sin título";

  const article = document.createElement("article");
  article.className = "card";
  article.dataset.index = String(index);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "card__inner";

  button.innerHTML = `
    <div class="card__image-wrap">
      ${
        imgSrc
          ? `<img src="${imgSrc}" alt="${titulo}" class="card__image" loading="lazy" />`
          : `<div class="card__image card__image--placeholder"></div>`
      }
    </div>
    <div class="card__body">
      <h2 class="card__title">${titulo}</h2>
      ${
        tiposTexto
          ? `<p class="card__meta">${tiposTexto}</p>`
          : `<p class="card__meta card__meta--muted">Sin categoría</p>`
      }
    </div>
  `;

  button.addEventListener("click", () => {
    abrirModal(receta);
  });

  article.appendChild(button);
  return article;
}

// ---------- Estado vacío ----------
function mostrarEstadoVacio(titulo, mensaje) {
  emptyTitle.textContent = titulo;
  emptyMessage.textContent = mensaje;
  emptyState.hidden = false;
}

function ocultarEstadoVacio() {
  emptyState.hidden = true;
}

// ---------- Modal ----------
function configurarModal() {
  modalBackdrop.addEventListener("click", cerrarModal);
  modalClose.addEventListener("click", cerrarModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cerrarModal();
  });
}

function abrirModal(receta) {
  const tipos = normalizarTipos(receta);
  const tiposTexto =
    tipos.length > 0 ? tipos.map(formatearEtiqueta).join(" · ") : "";

  modalTitle.textContent = receta.titulo || "Receta";
  if (tiposTexto) {
    modalType.textContent = tiposTexto;
    modalType.hidden = false;
  } else {
    modalType.hidden = true;
  }

  // Imagen
  modalGallery.innerHTML = "";
  const imgSrc = receta.ruta_imagen || receta.foto || "";
  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = receta.titulo || "";
    img.className = "modal__image";
    modalGallery.appendChild(img);
  }

  // Secciones texto
  modalSections.innerHTML = "";

  if (receta.ingredientes && receta.ingredientes.length > 0) {
    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `
      <h3 class="section__title">Ingredientes</h3>
      <ul class="section__list">
        ${receta.ingredientes.map((i) => `<li>${i}</li>`).join("")}
      </ul>
    `;
    modalSections.appendChild(section);
  }

  if (receta.pasos && receta.pasos.length > 0) {
    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `
      <h3 class="section__title">Pasos</h3>
      <ol class="section__list section__list--numbered">
        ${receta.pasos.map((p) => `<li>${p}</li>`).join("")}
      </ol>
    `;
    modalSections.appendChild(section);
  }

  if (receta.consejos && receta.consejos.length > 0) {
    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `
      <h3 class="section__title">Consejos</h3>
      <ul class="section__list">
        ${receta.consejos.map((c) => `<li>${c}</li>`).join("")}
      </ul>
    `;
    modalSections.appendChild(section);
  }

  // Botón de link (solo dentro del modal)
  modalActions.innerHTML = "";
  const tieneLink = receta.link && String(receta.link).trim() !== "";
  if (tieneLink) {
    const btnLink = document.createElement("button");
    btnLink.type = "button";
    btnLink.className = "button button--primary";
    btnLink.textContent = "Ver receta / vídeo";
    btnLink.addEventListener("click", () => {
      window.open(receta.link, "_blank");
    });
    modalActions.appendChild(btnLink);
    modalActions.hidden = false;
  } else {
    modalActions.hidden = true;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function cerrarModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}
