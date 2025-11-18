// Elementos básicos
const cardsContainer = document.getElementById("cards");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-state-title");
const emptyMessage = document.getElementById("empty-state-message");

const searchInput = document.getElementById("search");

const filtersToggle = document.getElementById("filters-toggle");
const filtersPanel = document.getElementById("filters-panel");
const filtersContainer = document.getElementById("filters-container");
const filtersSummary = document.getElementById("filters-summary");

// Modal
const modal = document.getElementById("modal");
const modalGallery = document.getElementById("modal-gallery");
const modalTitle = document.getElementById("modal-title");
const modalType = document.getElementById("modal-type");
const modalSections = document.getElementById("modal-sections");
const modalActions = document.getElementById("modal-actions");

// Estado
let allRecipes = [];
let activeTypes = new Set();
let searchTerm = "";

let typeStats = new Map(); // tipo -> recuento

// Utils
function normaliseTypes(tipo) {
  if (Array.isArray(tipo)) return tipo.filter(Boolean).map((t) => t.toLowerCase());
  if (typeof tipo === "string" && tipo.trim() !== "") {
    return [tipo.trim().toLowerCase()];
  }
  return [];
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function hasActiveFilters() {
  return activeTypes.size > 0;
}

// Carga de datos
async function loadRecipes() {
  const res = await fetch("recipes.json");
  const data = await res.json();
  allRecipes = data;

  // Calcular estadísticas de tipos
  typeStats = new Map();
  allRecipes.forEach((recipe) => {
    const tipos = normaliseTypes(recipe.tipo);
    tipos.forEach((t) => {
      typeStats.set(t, (typeStats.get(t) || 0) + 1);
    });
  });

  buildFilterButtons();
  applyFilters();
}

// Construir filtros dinámicos
function buildFilterButtons() {
  const allTypesSet = new Set();

  allRecipes.forEach((recipe) => {
    normaliseTypes(recipe.tipo).forEach((t) => allTypesSet.add(t));
  });

  const allTypes = Array.from(allTypesSet);

  const primary = [];
  const others = [];

  allTypes.forEach((t) => {
    if (t === "principal" || t === "postre") {
      primary.push(t);
    } else {
      others.push(t);
    }
  });

  others.sort((a, b) => a.localeCompare(b, "es"));

  const ordered = [...primary, ...others];

  filtersContainer.innerHTML = "";

  ordered.forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-button filter-button--sm";
    btn.dataset.filterType = type;

    const label = type === "principal" ? "Principal" :
                  type === "postre" ? "Postre" :
                  capitalize(type);

    const count = typeStats.get(type) || 0;

    btn.innerHTML = `
      <span class="filter-button__label">${label}</span>
      <span class="filter-button__count" data-filter-count>${count}</span>
    `;

    filtersContainer.appendChild(btn);
  });
}

// Aplicar búsqueda + filtros
function recipeMatches(recipe) {
  const tipos = normaliseTypes(recipe.tipo);

  // Filtro por tipos
  if (activeTypes.size > 0) {
    const match = tipos.some((t) => activeTypes.has(t));
    if (!match) return false;
  }

  // Filtro por búsqueda
  if (searchTerm.trim() !== "") {
    const term = searchTerm.toLowerCase();
    const haystack = [
      recipe.titulo || "",
      ...(recipe.ingredientes || []),
      ...(recipe.consejos || [])
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(term)) return false;
  }

  return true;
}

function applyFilters() {
  const visible = allRecipes.filter(recipeMatches);
  renderCards(visible);
  updateEmptyState(visible.length);
  updateFiltersSummary();
}

// Render tarjetas
function renderCards(recipes) {
  cardsContainer.innerHTML = "";

  recipes.forEach((recipe, index) => {
    const card = document.createElement("article");
    card.className = "card";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card__inner";
    btn.dataset.index = index; // índice relativo al filtrado? mejor guardar id
    // Usaremos dataset.id con título único
    btn.dataset.title = recipe.titulo;

    const imageWrap = document.createElement("div");
    imageWrap.className = "card__image-wrap";

    const img = document.createElement("img");
    img.className = "card__image";
    img.alt = recipe.titulo || "Receta";

    if (recipe.ruta_imagen) {
      img.src = recipe.ruta_imagen;
    } else {
      img.classList.add("card__image--placeholder");
    }

    imageWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("h3");
    title.className = "card__title";
    title.textContent = recipe.titulo || "Receta";

    const tipos = normaliseTypes(recipe.tipo);
    const meta = document.createElement("p");
    meta.className = "card__meta";

    if (tipos.length > 0) {
      const label = tipos
        .map((t) => (t === "principal" ? "Principal" : t === "postre" ? "Postre" : capitalize(t)))
        .join(" · ");
      meta.textContent = label;
    } else {
      meta.textContent = "Sin categoría";
    }

    body.appendChild(title);
    body.appendChild(meta);

    btn.appendChild(imageWrap);
    btn.appendChild(body);
    card.appendChild(btn);

    cardsContainer.appendChild(card);

    // Click abre modal
    btn.addEventListener("click", () => openModal(recipe));
  });
}

function updateEmptyState(count) {
  if (count === 0) {
    emptyState.hidden = false;
    emptyTitle.textContent = "Sin resultados";
    if (hasActiveFilters() || searchTerm.trim() !== "") {
      emptyMessage.textContent =
        "Prueba a quitar filtros o a buscar otro nombre / ingrediente.";
    } else {
      emptyMessage.textContent =
        "Añade recetas a tu JSON para verlas aquí.";
    }
  } else {
    emptyState.hidden = true;
  }
}

function updateFiltersSummary() {
  if (!hasActiveFilters()) {
    filtersSummary.textContent = "Sin filtros";
    return;
  }

  const names = Array.from(activeTypes).map((t) =>
    t === "principal" ? "Principal" : t === "postre" ? "Postre" : capitalize(t)
  );

  if (names.length <= 2) {
    filtersSummary.textContent = names.join(" · ");
  } else {
    filtersSummary.textContent = `${names[0]}, ${names[1]} +${names.length - 2}`;
  }
}

// Modal
function openModal(recipe) {
  modalGallery.innerHTML = "";
  modalSections.innerHTML = "";
  modalActions.innerHTML = "";
  modalActions.hidden = true;

  modalTitle.textContent = recipe.titulo || "Receta";

  const tipos = normaliseTypes(recipe.tipo);
  if (tipos.length > 0) {
    modalType.hidden = false;
    modalType.textContent = tipos
      .map((t) => (t === "principal" ? "Principal" : t === "postre" ? "Postre" : capitalize(t)))
      .join(" · ");
  } else {
    modalType.hidden = true;
  }

  // Imagen
  if (recipe.ruta_imagen) {
    const img = document.createElement("img");
    img.className = "modal__image";
    img.src = recipe.ruta_imagen;
    img.alt = recipe.titulo || "Receta";
    modalGallery.appendChild(img);
  }

  // Ingredientes
  if (recipe.ingredientes && recipe.ingredientes.length > 0) {
    const section = document.createElement("section");
    section.className = "section";

    section.innerHTML = `
      <h3 class="section__title">Ingredientes</h3>
      <ul class="section__list">
        ${recipe.ingredientes.map((i) => `<li>${i}</li>`).join("")}
      </ul>
    `;
    modalSections.appendChild(section);
  }

  // Pasos
  if (recipe.pasos && recipe.pasos.length > 0) {
    const section = document.createElement("section");
    section.className = "section";

    section.innerHTML = `
      <h3 class="section__title">Pasos</h3>
      <ol class="section__list section__list--numbered">
        ${recipe.pasos.map((p) => `<li>${p}</li>`).join("")}
      </ol>
    `;
    modalSections.appendChild(section);
  }

  // Consejos
  if (recipe.consejos && recipe.consejos.length > 0) {
    const section = document.createElement("section");
    section.className = "section";

    section.innerHTML = `
      <h3 class="section__title">Consejos</h3>
      <ul class="section__list">
        ${recipe.consejos.map((c) => `<li>${c}</li>`).join("")}
      </ul>
    `;
    modalSections.appendChild(section);
  }

  // Botón de link si existe
  if (recipe.link && recipe.link.trim() !== "") {
    modalActions.hidden = false;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button button--primary";
    btn.textContent = "Abrir enlace";
    btn.addEventListener("click", () => {
      window.open(recipe.link, "_blank", "noopener,noreferrer");
    });
    modalActions.appendChild(btn);
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

// Eventos
searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value || "";
  applyFilters();
});

filtersToggle.addEventListener("click", () => {
  const isHidden = filtersPanel.hasAttribute("hidden");
  if (isHidden) {
    filtersPanel.removeAttribute("hidden");
  } else {
    filtersPanel.setAttribute("hidden", "");
  }
});

// Delegación de eventos para filtros
filtersContainer.addEventListener("click", (event) => {
  const btn = event.target.closest(".filter-button");
  if (!btn) return;

  const type = btn.dataset.filterType;
  if (!type) return;

  if (activeTypes.has(type)) {
    activeTypes.delete(type);
    btn.classList.remove("is-active");
  } else {
    activeTypes.add(type);
    btn.classList.add("is-active");
  }

  applyFilters();
});

// Cerrar modal
modal.addEventListener("click", (event) => {
  if (event.target.dataset.dismiss === "modal" || event.target.closest("[data-dismiss='modal']")) {
    closeModal();
  }
});

// Escape
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeModal();
  }
});

// Arranque
loadRecipes().catch((err) => {
  console.error("Error cargando recetas:", err);
});
// Evitar zoom con doble-tap en iOS
let lastTouchTime = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = window.performance.now();
    if (now - lastTouchTime <= 300) {
      e.preventDefault();
    }
    lastTouchTime = now;
  },
  false
);
