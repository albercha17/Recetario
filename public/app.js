const results = document.getElementById('results');
const template = document.getElementById('recipe-template');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const loadingIndicator = document.getElementById('loading');
const searchInput = document.getElementById('search-input');

let allRecipes = [];

const normalise = (value) =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

function matchesQuery(recipe, query) {
  if (!query) {
    return true;
  }

  const target = normalise(query);
  const haystack = [];
  haystack.push(recipe.title || '');
  (recipe.meta || []).forEach((entry) => {
    haystack.push(entry.label || '');
    haystack.push(entry.value || '');
  });
  (recipe.sections || []).forEach((section) => {
    haystack.push(section.title || '');
    (section.items || []).forEach((item) => haystack.push(item));
  });
  (recipe.notes || []).forEach((note) => haystack.push(note));

  return haystack.some((text) => normalise(String(text)).includes(target));
}

function renderRecipes(recipes) {
  results.innerHTML = '';

  if (!recipes.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => {
    fragment.appendChild(createRecipeCard(recipe));
  });
  results.appendChild(fragment);
}

function createRecipeCard(recipe) {
  const node = template.content.cloneNode(true);
  const titleEl = node.querySelector('[data-title]');
  const metaEl = node.querySelector('[data-meta]');
  const sectionsEl = node.querySelector('[data-sections]');
  const notesEl = node.querySelector('[data-notes]');
  const imageEl = node.querySelector('[data-image]');

  titleEl.textContent = recipe.title;

  const firstImage = (recipe.images || []).find((img) => Boolean(img?.dataUri));
  if (firstImage) {
    imageEl.style.backgroundImage = `url(${firstImage.dataUri})`;
    imageEl.setAttribute('role', 'img');
    imageEl.setAttribute('aria-label', `Imagen de ${recipe.title}`);
  } else {
    imageEl.dataset.empty = 'true';
  }

  const metaItems = recipe.meta || [];
  if (metaItems.length) {
    metaItems.forEach((entry) => {
      const item = document.createElement('li');
      item.textContent = `${entry.label}: ${entry.value}`;
      metaEl.appendChild(item);
    });
  } else {
    metaEl.remove();
  }

  const sections = recipe.sections || [];
  if (sections.length) {
    sections.forEach((section) => {
      if (!section.items || !section.items.length) {
        return;
      }
      const sectionWrapper = document.createElement('section');
      const header = document.createElement('h3');
      header.textContent = section.title;
      const list = document.createElement('ul');
      section.items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      sectionWrapper.append(header, list);
      sectionsEl.appendChild(sectionWrapper);
    });
  } else {
    sectionsEl.remove();
  }

  const notes = recipe.notes || [];
  if (notes.length) {
    notesEl.innerHTML = notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('');
  } else {
    notesEl.remove();
  }

  return node;
}

const htmlEscapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

async function loadRecipes() {
  try {
    const response = await fetch('/api/recipes');
    if (!response.ok) {
      throw new Error(`Respuesta inesperada: ${response.status}`);
    }
    const data = await response.json();
    allRecipes = Array.isArray(data.recipes) ? data.recipes : [];
    errorState.hidden = true;
    renderRecipes(allRecipes);
  } catch (error) {
    console.error('No se pudieron cargar las recetas', error);
    errorState.hidden = false;
  } finally {
    loadingIndicator.hidden = true;
  }
}

function handleSearch(event) {
  const query = event.target.value.trim();
  const filtered = allRecipes.filter((recipe) => matchesQuery(recipe, query));
  renderRecipes(filtered);
}

loadingIndicator.hidden = false;
loadRecipes();
searchInput.addEventListener('input', handleSearch);
