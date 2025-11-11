(() => {
  const loader = document.getElementById('loader');
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
  const dismissButtons = modal.querySelectorAll('[data-dismiss="modal"]');

  const state = {
    recipes: [],
    filtered: [],
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
    } finally {
      loader.hidden = true;
    }

    searchInput.addEventListener('input', handleSearch);
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
    if (!response.ok) {
      throw new Error(`No se pudo obtener el archivo: ${response.status}`);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.recipes)
      ? payload.recipes
      : [];

    return entries.map(normalizeRecipe);
  }

  function normalizeRecipe(entry) {
    const rawTitle = typeof entry.titulo === 'string' ? entry.titulo.trim() : '';
    const type = typeof entry.tipo === 'string' ? entry.tipo.trim() : '';

    const ingredients = Array.isArray(entry.ingredientes)
      ? entry.ingredientes.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const steps = Array.isArray(entry.pasos)
      ? entry.pasos.map((value) => String(value).trim()).filter(Boolean)
      : [];

    let tips = [];
    if (Array.isArray(entry.consejos)) {
      tips = entry.consejos.map((value) => String(value).trim()).filter(Boolean);
    } else if (typeof entry.consejos === 'string') {
      const tip = entry.consejos.trim();
      if (tip) {
        tips = [tip];
      }
    }

    const imagePath = typeof entry.ruta_imagen === 'string' ? entry.ruta_imagen.trim() : '';
    const imageName = typeof entry.foto === 'string' ? entry.foto.trim() : '';

    let image = '';
    if (imagePath) {
      image = imagePath;
    } else if (imageName) {
      image = imageName.includes('/') ? imageName : `images/${imageName}`;
    }

    const searchParts = [rawTitle, type, ...ingredients, ...steps, ...tips]
      .map((value) => normalizeText(value))
      .filter(Boolean);

    return {
      title: rawTitle || 'Receta sin título',
      type,
      ingredients,
      steps,
      tips,
      image,
      searchText: searchParts.join(' '),
    };
  }

  function normalizeText(value) {
    return String(value || '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  function handleSearch() {
    applyFilters();
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
      return;
    }

    const query = searchInput.value.trim();
    const normalizedQuery = normalizeText(query);

    let filtered = state.recipes;
    if (normalizedQuery) {
      filtered = filtered.filter((recipe) => recipe.searchText.includes(normalizedQuery));
    }

    state.filtered = filtered;
    renderCards(filtered);
    if (!filtered.length) {
      const message = query
        ? `No hay recetas que coincidan con “${query}”.`
        : 'No hay recetas registradas en este momento.';
      setEmptyState({
        visible: true,
        title: 'Sin resultados',
        message,
      });
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

    if (!recipes.length) {
      return;
    }

    const fragment = document.createDocumentFragment();

    recipes.forEach((recipe) => {
      const card = createRecipeCard(recipe);
      fragment.appendChild(card);
    });

    cardsContainer.appendChild(fragment);
  }

  function createRecipeCard(recipe) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'recipe-card';
    card.dataset.hasImage = recipe.image ? 'true' : 'false';
    if (recipe.type) {
      card.setAttribute('data-type', recipe.type);
    }
    card.setAttribute('aria-label', `Ver detalles de ${recipe.title}`);

    const image = document.createElement('div');
    image.className = 'recipe-card__image';

    if (recipe.type) {
      const badge = document.createElement('span');
      badge.className = 'recipe-card__badge';
      badge.textContent = recipe.type;
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
    if (closeButton instanceof HTMLElement) {
      closeButton.focus();
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  function populateModal(recipe) {
    modalTitle.textContent = recipe.title;

    if (modalType) {
      if (recipe.type) {
        modalType.textContent = recipe.type;
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
    if (recipe.ingredients.length) {
      sections.push(createListSection('Ingredientes', recipe.ingredients));
    }
    if (recipe.steps.length) {
      sections.push(createListSection('Pasos', recipe.steps));
    }
    if (recipe.tips.length) {
      sections.push(createParagraphSection('Consejos', recipe.tips));
    }

    if (sections.length) {
      sections.forEach((section) => modalSections.appendChild(section));
    } else {
      const empty = document.createElement('p');
      empty.className = 'modal__empty';
      empty.textContent = 'No hay información disponible para esta receta.';
      modalSections.appendChild(empty);
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
