(() => {
  const cardsContainer = document.getElementById('cards');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-state-title');
  const emptyMessage = document.getElementById('empty-state-message');
  const searchInput = document.getElementById('search');
  const modal = document.getElementById('modal');
  const modalGallery = document.getElementById('modal-gallery');
  const modalTitle = document.getElementById('modal-title');
  const modalSections = document.getElementById('modal-sections');
  const modalType = document.getElementById('modal-type');
  const modalActions = document.getElementById('modal-actions');

  const dismissButtons = modal.querySelectorAll('[data-dismiss="modal"]');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter-type]'));

  const state = {
    recipes: [],
    filtered: [],
    activeTypes: new Set(),
  };

  let lastFocusedElement = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const recipes = await loadRecipes();
      state.recipes = recipes;
      applyFilters();
    } catch (error) {
      console.error('No se pudieron cargar las recetas', error);
      state.recipes = [];
      state.filtered = [];
      renderCards([]);
      setEmptyState({
        visible: true,
        title: 'No se pudieron cargar las recetas',
        message:
          'Revisa que el archivo recipes.json esté en la raíz del repositorio y tenga el formato correcto.',
      });
      updateFilterCounts([]);
    }

    searchInput.addEventListener('input', handleSearch);
    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const { filterType } = button.dataset;
        if (!filterType) return;
        toggleTypeFilter(filterType);
      });
    });

    dismissButtons.forEach((button) => button.addEventListener('click', closeModal));
    modal.addEventListener('click', (event) => {
      if (event.target instanceof HTMLElement && event.target.dataset.dismiss === 'modal') {
        closeModal();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  async function loadRecipes() {
    const response = await fetch('recipes.json');
    if (!response.ok) throw new Error(`No se pudo obtener el archivo: ${response.status}`);

    const payload = await response.json();
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.recipes)
      ? payload.recipes
      : [];

    return entries
      .map(normalizeRecipe)
      .sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
  }

  function normalizeRecipe(entry) {
    const rawTitle = typeof entry.titulo === 'string' ? entry.titulo.trim() : '';
    const type = typeof entry.tipo === 'string' ? entry.tipo.trim() : '';
    const typeKey = getTypeKey(type);
    const typeLabel = formatRecipeType(type);

    const ingredients = Array.isArray(entry.ingredientes)
      ? entry.ingredientes.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const steps = Array.isArray(entry.pasos)
      ? entry.pasos.map((v) => String(v).trim()).filter(Boolean)
      : [];

    let tips = [];
    if (Array.isArray(entry.consejos)) tips = entry.consejos.map((v) => String(v).trim()).filter(Boolean);
    else if (typeof entry.consejos === 'string') {
      const t = entry.consejos.trim();
      if (t) tips = [t];
    }

    const imagePath = typeof entry.ruta_imagen === 'string' ? entry.ruta_imagen.trim() : '';
    const imageName = typeof entry.foto === 'string' ? entry.foto.trim() : '';
    let image = imagePath || (imageName ? (imageName.includes('/') ? imageName : `images/${imageName}`) : '');

    const link = typeof entry.link === 'string' ? entry.link.trim() : '';

    const searchParts = [rawTitle, type, typeLabel, ...ingredients, ...steps, ...tips]
      .map((v) => normalizeText(v))
      .filter(Boolean);

    return {
      title: rawTitle || 'Receta sin título',
      type,
      typeKey,
      typeLabel,
      ingredients,
      steps,
      tips,
      image,
      link,
      searchText: searchParts.join(' '),
    };
  }

  const normalizeText = (value) =>
    String(value || '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const getTypeKey = (v) => normalizeText(v).replace(/\s+/g, '');

  function formatRecipeType(value) {
    const key = getTypeKey(value);
    if (!key) return '';
    if (key === 'principal') return 'Plato principal';
    if (key === 'postre') return 'Postre';
    if (key === 'desconocido') return 'Desconocido';
    return value.charAt(0).toLocaleUpperCase('es') + value.slice(1);
  }

  function handleSearch() { applyFilters(); }

  function toggleTypeFilter(type) {
    const key = getTypeKey(type);
    if (!key) return;
    if (state.activeTypes.has(key)) state.activeTypes.delete(key);
    else state.activeTypes.add(key);
    updateFilterButtons();
    applyFilters();
  }

  function updateFilterButtons() {
    filterButtons.forEach((button) => {
      const key = getTypeKey(button.dataset.filterType || '');
      const isActive = key ? state.activeTypes.has(key) : false;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function updateFilterCounts(recipes) {
    const counts = {};
    filterButtons.forEach((b) => {
      const key = getTypeKey(b.dataset.filterType || '');
      if (key) counts[key] = 0;
    });
    (recipes || []).forEach((r) => {
      if (r.typeKey && Object.prototype.hasOwnProperty.call(counts, r.typeKey)) counts[r.typeKey] += 1;
    });
    filterButtons.forEach((b) => {
      const countEl = b.querySelector('[data-filter-count]');
      const key = getTypeKey(b.dataset.filterType || '');
      if (!countEl || !key) return;
      countEl.textContent = String(counts[key] ?? 0);
    });
  }

  function applyFilters() {
    if (!state.recipes.length) {
      state.filtered = [];
      renderCards([]);
      setEmptyState({
        visible: true,
        title: 'No hay recetas disponibles',
        message: 'Añade tus recetas dentro de recipes.json para verlas aquí.',
      });
      updateFilterCounts([]);
      return;
    }

    const query = searchInput.value.trim();
    const normalizedQuery = normalizeText(query);

    let filtered = state.recipes;
    if (normalizedQuery) {
      filtered = filtered.filter((r) => r.searchText.includes(normalizedQuery));
    }

    updateFilterCounts(filtered);

    if (state.activeTypes.size) {
      filtered = filtered.filter((r) => state.activeTypes.has(r.typeKey));
    }

    state.filtered = filtered;
    renderCards(filtered);

    if (!filtered.length) {
      const message = query
        ? `No hay recetas que coincidan con “${query}”.`
        : 'No hay recetas registradas en este momento.';
      setEmptyState({ visible: true, title: 'Sin resultados', message });
    } else {
      setEmptyState({ visible: false });
    }
  }

  function setEmptyState({ visible, title = '', message = '' }) {
    if (visible) {
      emptyTitle.textContent = title;
      emptyMessage.textContent = message;
      emptyState.hidden = false;
    } else {
      emptyTitle.textContent = '';
      emptyMessage.textContent = '';
      emptyState.hidden = true;
    }
  }

  function renderCards(recipes) {
    cardsContainer.innerHTML = '';
    if (!recipes.length) return;

    const fragment = document.createDocumentFragment();
    recipes.forEach((recipe) => fragment.appendChild(createRecipeCard(recipe)));
    cardsContainer.appendChild(fragment);
  }

  function createRecipeCard(recipe) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'recipe-card';
    card.dataset.hasImage = recipe.image ? 'true' : 'false';
    if (recipe.typeKey) card.setAttribute('data-type', recipe.typeKey);
    card.setAttribute('aria-label', `Ver detalles de ${recipe.title}`);

    const image = document.createElement('div');
    image.className = 'recipe-card__image';

    if (recipe.typeLabel) {
      const badge = document.createElement('span');
      badge.className = 'recipe-card__badge';
      badge.textContent = recipe.typeLabel;
      image.appendChild(badge);
    }

    if (recipe.image) {
      image.style.setProperty('--image-url', `url("${recipe.image}")`);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'recipe-card__placeholder';
      placeholder.textContent = recipe.title.charAt(0).toUpperCase();
      image.appendChild(placeholder);
    }

    const title = document.createElement('span');
    title.className = 'recipe-card__title';
    title.textContent = recipe.title;
    image.appendChild(title);

    card.appendChild(image);

    card.addEventListener('click', () => openRecipe(recipe));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRecipe(recipe);
      }
    });

    return card;
  }

  function openRecipe(recipe) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    populateModal(recipe);
    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    const closeButton = modal.querySelector('.modal__close');
    if (closeButton instanceof HTMLElement) closeButton.focus();
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function populateModal(recipe) {
    modalTitle.textContent = recipe.title;

    if (modalType) {
      if (recipe.typeLabel) {
        modalType.textContent = recipe.typeLabel;
        modalType.hidden = false;
      } else {
        modalType.textContent = '';
        modalType.hidden = true;
      }
    }

    modalGallery.innerHTML = '';
    if (recipe.image) {
      const image = document.createElement('img');
      image.src = recipe.image;
      image.loading = 'lazy';
      image.alt = `Fotografía de ${recipe.title}`;
      modalGallery.appendChild(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'modal__placeholder';
      placeholder.textContent = 'Esta receta no tiene fotografía.';
      modalGallery.appendChild(placeholder);
    }

    modalSections.innerHTML = '';
    const sections = [];
    if (recipe.ingredients.length) sections.push(createListSection('Ingredientes', recipe.ingredients));
    if (recipe.steps.length) sections.push(createListSection('Pasos', recipe.steps));
    if (recipe.tips.length) sections.push(createParagraphSection('Consejos', recipe.tips));

    if (sections.length) sections.forEach((s) => modalSections.appendChild(s));
    else {
      const empty = document.createElement('p');
      empty.className = 'modal__empty';
      empty.textContent = 'No hay información disponible para esta receta.';
      modalSections.appendChild(empty);
    }

    // Acciones (botón a link si existe)
    modalActions.innerHTML = '';
    if (recipe.link) {
      const linkBtn = document.createElement('a');
      linkBtn.href = recipe.link;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener noreferrer';
      linkBtn.className = 'button button--primary';
      linkBtn.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z" fill="currentColor"></path>
        </svg>
        <span>Ver receta online</span>
      `;
      modalActions.appendChild(linkBtn);
      modalActions.hidden = false;
    } else {
      modalActions.hidden = true;
    }
  }

  function createListSection(title, items) {
    const sectionElement = document.createElement('section');
    sectionElement.className = 'recipe-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    sectionElement.appendChild(heading);

    const list = document.createElement('ul');
    items.forEach((item) => {
      const entry = document.createElement('li');
      entry.textContent = item;
      list.appendChild(entry);
    });

    sectionElement.appendChild(list);
    return sectionElement;
  }

  function createParagraphSection(title, paragraphs) {
    const sectionElement = document.createElement('section');
    sectionElement.className = 'recipe-section';

    const heading = document.createElement('h3');
    heading.textContent = title;
    sectionElement.appendChild(heading);

    paragraphs.forEach((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      sectionElement.appendChild(paragraph);
    });

    return sectionElement;
  }
})();
