(() => {
  const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  const loader = document.getElementById('loader');
  const cardsContainer = document.getElementById('cards');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-state-title');
  const emptyMessage = document.getElementById('empty-state-message');
  const searchInput = document.getElementById('search');
  const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
  const countBadges = {
    principales: document.querySelector('[data-count="principales"]'),
    postres: document.querySelector('[data-count="postres"]'),
  };
  const categoryHeading = document.getElementById('category-heading');
  const modal = document.getElementById('modal');
  const modalGallery = document.getElementById('modal-gallery');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalSections = document.getElementById('modal-sections');
  const dismissButtons = modal.querySelectorAll('[data-dismiss="modal"]');

  const CATEGORY_MARKERS = {
    'plato principal': 'principales',
    'platos principales': 'principales',
    postre: 'postres',
    postres: 'postres',
  };

  const state = {
    recipes: [],
    filtered: [],
    activeCategory: 'principales',
    counts: {
      principales: 0,
      postres: 0,
    },
  };

  let lastFocusedElement = null;
  let pendingCategoryMarker = null;
  let markerCountForCurrentRecipe = 0;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const recipes = await loadRecipes();
      state.recipes = recipes;
      updateCounts();
      applyFilters();
    } catch (error) {
      console.error('No se pudieron cargar las recetas', error);
      setEmptyState({
        visible: true,
        title: 'No se pudieron cargar las recetas',
        message:
          'Revisa que el archivo recetario.docx esté en la raíz del repositorio y vuelve a intentarlo.',
      });
    } finally {
      loader.hidden = true;
    }

    updateFilterButtons();
    searchInput.addEventListener('input', handleSearch);
    filterButtons.forEach((button) => button.addEventListener('click', handleCategoryChange));
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

  function handleSearch() {
    if (!state.recipes.length) {
      return;
    }
    applyFilters();
  }

  function handleCategoryChange(event) {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const category = button.dataset.filter;
    if (!category || category === state.activeCategory) {
      return;
    }

    state.activeCategory = category;
    updateFilterButtons();
    applyFilters();
  }

  function updateFilterButtons() {
    filterButtons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.classList.toggle('is-active', button.dataset.filter === state.activeCategory);
      }
    });
  }

  function applyFilters() {
    if (!state.recipes.length) {
      state.filtered = [];
      renderCards([]);
      updateCategoryHeading();
      setEmptyState({
        visible: true,
        title: 'No se encontraron recetas',
        message:
          'Añade contenido al archivo recetario.docx y vuelve a publicar la página para ver los resultados aquí.',
      });
      return;
    }

    const query = searchInput.value.trim();
    const normalizedQuery = normalizeTitle(query);

    let filtered = state.recipes.filter((recipe) => recipe.category === state.activeCategory);

    if (normalizedQuery) {
      filtered = filtered.filter((recipe) => normalizeTitle(recipe.title).includes(normalizedQuery));
    }

    state.filtered = filtered;
    renderCards(filtered);
    updateCategoryHeading();

    if (!filtered.length) {
      const categoryLabel = state.activeCategory === 'postres' ? 'postres' : 'platos principales';
      const message = query
        ? `No hay recetas de ${categoryLabel} que coincidan con “${query}”.`
        : `No hay recetas registradas dentro de ${categoryLabel}.`;
      setEmptyState({
        visible: true,
        title: 'Sin resultados',
        message,
      });
    } else {
      setEmptyState({ visible: false });
    }
  }

  function updateCounts() {
    const totals = {
      principales: 0,
      postres: 0,
    };

    state.recipes.forEach((recipe) => {
      if (recipe.category === 'postres') {
        totals.postres += 1;
      } else {
        totals.principales += 1;
      }
    });

    state.counts = totals;

    Object.entries(countBadges).forEach(([category, element]) => {
      if (element instanceof HTMLElement) {
        element.textContent = String(totals[category] ?? 0);
      }
    });
  }

  function updateCategoryHeading() {
    if (!(categoryHeading instanceof HTMLElement)) {
      return;
    }

    const label = state.activeCategory === 'postres' ? 'Postres' : 'Platos principales';
    const total = state.counts[state.activeCategory] ?? 0;
    const filteredCount = state.filtered.length;
    const hasSearch = Boolean(searchInput.value.trim());

    if (!state.recipes.length) {
      categoryHeading.textContent = `${label} · 0 recetas`;
      return;
    }

    if (hasSearch && filteredCount !== total) {
      const filteredLabel = filteredCount === 1 ? '1 receta' : `${filteredCount} recetas`;
      const totalLabel = total === 1 ? '1 receta en total' : `${total} recetas en total`;
      categoryHeading.textContent = `${label} · ${filteredLabel} (${totalLabel})`;
      return;
    }

    const recipeLabel = total === 1 ? '1 receta' : `${total} recetas`;
    categoryHeading.textContent = `${label} · ${recipeLabel}`;
  }

  async function loadRecipes() {
    const response = await fetch('recetario.docx');
    if (!response.ok) {
      throw new Error(`No se pudo obtener el archivo: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return parseRecipes(arrayBuffer);
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
    card.dataset.hasImage = recipe.images.length ? 'true' : 'false';
    card.dataset.category = recipe.category;
    card.setAttribute('aria-label', `Ver detalles de ${recipe.title}`);

    const image = document.createElement('div');
    image.className = 'recipe-card__image';

    if (recipe.images.length) {
      image.style.setProperty('--image-url', `url("${recipe.images[0]}")`);
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

    modalMeta.innerHTML = '';
    if (recipe.metadata.length) {
      modalMeta.hidden = false;
      recipe.metadata.forEach((entry) => {
        const item = document.createElement('li');
        item.textContent = entry;
        modalMeta.appendChild(item);
      });
    } else {
      modalMeta.hidden = true;
    }

    modalGallery.innerHTML = '';
    if (recipe.images.length) {
      recipe.images.forEach((src, index) => {
        const image = document.createElement('img');
        image.src = src;
        image.loading = 'lazy';
        image.alt = index === 0 ? `Fotografía de ${recipe.title}` : `${recipe.title} - imagen ${index + 1}`;
        modalGallery.appendChild(image);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'modal__placeholder';
      placeholder.textContent = 'Esta receta no tiene fotografía en el documento.';
      modalGallery.appendChild(placeholder);
    }

    modalSections.innerHTML = '';
    if (recipe.sections.length) {
      recipe.sections.forEach((section) => {
        if (!section.title && !section.content.length) {
          return;
        }

        const sectionElement = document.createElement('section');
        sectionElement.className = 'recipe-section';

        if (section.title) {
          const heading = document.createElement('h3');
          heading.textContent = section.title;
          sectionElement.appendChild(heading);
        }

        section.content.forEach((item) => {
          if (item.type === 'list') {
            const list = document.createElement('ul');
            item.items.forEach((text) => {
              const entry = document.createElement('li');
              entry.textContent = text;
              list.appendChild(entry);
            });
            sectionElement.appendChild(list);
          } else {
            const paragraph = document.createElement('p');
            paragraph.textContent = item.text;
            sectionElement.appendChild(paragraph);
          }
        });

        modalSections.appendChild(sectionElement);
      });
    } else {
      const empty = document.createElement('p');
      empty.className = 'modal__empty';
      empty.textContent = 'No hay pasos ni ingredientes disponibles para esta receta.';
      modalSections.appendChild(empty);
    }
  }

  async function parseRecipes(buffer) {
    const zip = await window.JSZip.loadAsync(buffer);
    const documentFile = zip.file('word/document.xml');
    const relsFile = zip.file('word/_rels/document.xml.rels');

    if (!documentFile || !relsFile) {
      throw new Error('El documento no tiene la estructura esperada.');
    }

    const [documentXml, relsXml] = await Promise.all([
      documentFile.async('string'),
      relsFile.async('string'),
    ]);

    const parser = new DOMParser();
    const documentDom = parser.parseFromString(documentXml, 'application/xml');
    const relsDom = parser.parseFromString(relsXml, 'application/xml');

    const relationships = buildRelationshipsMap(relsDom);
    const body = documentDom.getElementsByTagNameNS(WORD_NS, 'body')[0];

    if (!body) {
      return [];
    }

    const indexCatalog = extractIndexCatalog(body);

    const pendingImages = [];
    const segments = splitDocumentIntoPages(body).flat();

    const recipes = [];
    let recipe = null;
    let currentSection = null;
    let readingMetadata = false;
    let deferredImages = [];
    let pendingTitleParts = [];
    let pendingTitleImages = [];
    let lastResolvedCategory = null;

    segments.forEach((segment) => {
      const text = normalizeText(segment.text);
      const hasText = Boolean(text);
      const imageRefs = segment.imageRefs;

      if (!recipe && imageRefs.length) {
        deferredImages.push(...imageRefs);
      }

      if (!recipe && pendingTitleParts.length && segment.style !== 'Title' && (hasText || imageRefs.length)) {
        startRecipeFromPending();
      }

      if (segment.style === 'Title' && hasText) {
        const lines = text.split('\n');
        const titleCandidate = lines.shift() || '';
        const trimmedTitle = titleCandidate.trim();

        if (!trimmedTitle) {
          return;
        }

        const combinedParts = [...pendingTitleParts, trimmedTitle];
        const match = resolveCategory(combinedParts) || resolveCategory([trimmedTitle]);

        if (match && !shouldSkipTitle(match.title)) {
          finalizeCurrentRecipe();

          const leftover = lines.join('\n').trim();
          const category =
            pendingCategoryMarker || match.category || lastResolvedCategory || 'principales';
          recipe = {
            title: match.title || 'Receta sin título',
            metadata: [],
            sections: [],
            images: [],
            category,
          };
          lastResolvedCategory = category;
          markerCountForCurrentRecipe = pendingCategoryMarker ? 1 : 0;
          pendingCategoryMarker = null;
          currentSection = null;
          readingMetadata = true;

          if (leftover) {
            recipe.metadata.push(leftover);
          }

          const combinedImages = [...deferredImages, ...pendingTitleImages];
          if (combinedImages.length) {
            queueImages(recipe, combinedImages);
          }

          deferredImages = [];
          pendingTitleParts = [];
          pendingTitleImages = [];

          if (imageRefs.length) {
            queueImages(recipe, imageRefs);
          }

          return;
        }

        if (recipe) {
          finalizeCurrentRecipe();
        }

        pendingTitleParts = combinedParts.filter(Boolean);
        if (imageRefs.length) {
          pendingTitleImages.push(...imageRefs);
        }
        deferredImages = [];
        return;
      }

      if (!recipe && pendingTitleParts.length && (hasText || imageRefs.length)) {
        startRecipeFromPending();
      }

      const markerCategory = hasText ? detectCategoryMarker(text) : null;
      if (markerCategory) {
        lastResolvedCategory = markerCategory;
        if (recipe) {
          if (markerCountForCurrentRecipe > 0 && hasRecipeContent(recipe)) {
            finalizeCurrentRecipe();
            pendingCategoryMarker = markerCategory;
            markerCountForCurrentRecipe = 0;
            return;
          }
          recipe.category = markerCategory;
          markerCountForCurrentRecipe += 1;
          return;
        }
        pendingCategoryMarker = markerCategory;
        markerCountForCurrentRecipe = 0;
        return;
      }

      if (!recipe) {
        return;
      }

      if (imageRefs.length) {
        queueImages(recipe, imageRefs);
      }

      if (!hasText) {
        return;
      }

      if (segment.style && segment.style.startsWith('Heading')) {
        currentSection = {
          title: text,
          content: [],
        };
        recipe.sections.push(currentSection);
        readingMetadata = false;
        return;
      }

      if (readingMetadata) {
        const metadataMarker = detectCategoryMarker(text);
        if (metadataMarker) {
          lastResolvedCategory = metadataMarker;
          recipe.category = metadataMarker;
          return;
        }
        recipe.metadata.push(text);
        return;
      }

      if (!currentSection) {
        currentSection = {
          title: '',
          content: [],
        };
        recipe.sections.push(currentSection);
      }

      if (segment.numbered) {
        const last = currentSection.content[currentSection.content.length - 1];
        if (last && last.type === 'list') {
          last.items.push(text);
        } else {
          currentSection.content.push({ type: 'list', items: [text] });
        }
      } else {
        currentSection.content.push({ type: 'paragraph', text });
      }
    });

    if (!recipe && pendingTitleParts.length) {
      startRecipeFromPending();
    }

    finalizeCurrentRecipe();

    await Promise.all(pendingImages);

    return recipes;

    function queueImages(recipe, references) {
      const uniqueRefs = Array.from(new Set(references));
      uniqueRefs.forEach((ref) => {
        const promise = loadImageFromRelationship(zip, relationships, ref).then((src) => {
          if (src && !recipe.images.includes(src)) {
            recipe.images.push(src);
          }
        });
        pendingImages.push(promise);
      });
    }

    function finalizeCurrentRecipe() {
      if (recipe && hasRecipeContent(recipe)) {
        recipes.push(recipe);
      }
      recipe = null;
      currentSection = null;
      readingMetadata = false;
      deferredImages = [];
      pendingTitleImages = [];
      markerCountForCurrentRecipe = 0;
    }

    function startRecipeFromPending() {
      if (!pendingTitleParts.length) {
        return;
      }
      const combinedTitle = pendingTitleParts.join(' ').trim();
      if (!combinedTitle) {
        pendingTitleParts = [];
        pendingTitleImages = [];
        return;
      }

      const match = resolveCategory(pendingTitleParts);
      const category =
        pendingCategoryMarker || (match ? match.category : lastResolvedCategory) || 'principales';
      const title = match && match.title ? match.title : combinedTitle;

      recipe = {
        title: title || 'Receta sin título',
        metadata: [],
        sections: [],
        images: [],
        category,
      };

      lastResolvedCategory = category;
      markerCountForCurrentRecipe = pendingCategoryMarker ? 1 : 0;
      pendingCategoryMarker = null;

      currentSection = null;
      readingMetadata = true;

      const combinedImages = [...deferredImages, ...pendingTitleImages];
      if (combinedImages.length) {
        queueImages(recipe, combinedImages);
      }

      deferredImages = [];
      pendingTitleParts = [];
      pendingTitleImages = [];
    }

    function resolveCategory(parts) {
      const title = parts.join(' ').trim();
      if (!title) {
        return null;
      }
      const normalized = normalizeTitle(title);
      if (!normalized) {
        return null;
      }

      if (indexCatalog.has(normalized)) {
        return { category: indexCatalog.get(normalized), title };
      }

      let candidate = null;
      let ambiguous = false;
      indexCatalog.forEach((category, key) => {
        if (key.startsWith(normalized) || normalized.startsWith(key)) {
          if (candidate && candidate.category !== category) {
            ambiguous = true;
          }
          if (!candidate) {
            candidate = { category, title };
          }
        }
      });

      if (ambiguous) {
        return null;
      }

      return candidate;
    }
  }

  function splitDocumentIntoPages(body) {
    const pages = [[]];
    let pendingPageBreak = false;
    const children = Array.from(body.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE);

    children.forEach((node) => {
      if (node.namespaceURI !== WORD_NS) {
        return;
      }

      if (node.localName === 'p') {
        const segments = splitParagraphIntoSegments(node);
        segments.forEach((segment) => {
          if (pendingPageBreak || segment.pageBreakBefore) {
            if (pages[pages.length - 1].length) {
              pages.push([]);
            }
            pendingPageBreak = false;
          }

          const currentPage = pages[pages.length - 1];
          currentPage.push(segment);

          if (segment.pageBreakAfter) {
            pendingPageBreak = true;
          }
        });
      } else if (node.localName === 'tbl') {
        const paragraphs = Array.from(node.getElementsByTagNameNS(WORD_NS, 'p'));
        paragraphs.forEach((paragraph) => {
          const segments = splitParagraphIntoSegments(paragraph);
          segments.forEach((segment) => {
            if (pendingPageBreak || segment.pageBreakBefore) {
              if (pages[pages.length - 1].length) {
                pages.push([]);
              }
              pendingPageBreak = false;
            }
            pages[pages.length - 1].push(segment);
            if (segment.pageBreakAfter) {
              pendingPageBreak = true;
            }
          });
        });
      }
    });

    return pages.filter((page) => page.length);
  }

  function extractIndexCatalog(body) {
    const catalog = new Map();
    const paragraphs = Array.from(body.getElementsByTagNameNS(WORD_NS, 'p'));
    let inIndex = false;
    let currentCategory = null;

    for (const paragraph of paragraphs) {
      const text = normalizeText(getParagraphText(paragraph));
      if (!text) {
        continue;
      }

      const style = getParagraphStyle(paragraph);
      const normalized = normalizeTitle(text);

      if (!inIndex) {
        if (normalized === 'indice') {
          inIndex = true;
        }
        continue;
      }

      if (style === 'Title' && normalized && normalized !== 'indice') {
        break;
      }

      if (normalized === 'platos principales') {
        currentCategory = 'principales';
        continue;
      }

      if (normalized === 'postres') {
        currentCategory = 'postres';
        continue;
      }

      if (!currentCategory || !normalized || shouldSkipTitle(text)) {
        continue;
      }

      if (!catalog.has(normalized)) {
        catalog.set(normalized, currentCategory);
      }
    }

    return catalog;
  }

  function getParagraphText(paragraph) {
    const parts = [];
    paragraph.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.namespaceURI === WORD_NS && node.localName === 'r') {
        node.childNodes.forEach((child) => {
          if (child.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          if (child.namespaceURI === WORD_NS && child.localName === 't') {
            parts.push(child.textContent || '');
          } else if (child.namespaceURI === WORD_NS && child.localName === 'tab') {
            parts.push('\t');
          } else if (child.namespaceURI === WORD_NS && child.localName === 'br') {
            parts.push('\n');
          }
        });
      }
    });

    return parts.join('');
  }

  function splitParagraphIntoSegments(paragraph) {
    const style = getParagraphStyle(paragraph);
    const numbered = hasNumbering(paragraph);
    const segments = [];

    let currentSegment = createSegment(false);

    function createSegment(pageBreakBefore) {
      return {
        text: '',
        parts: [],
        imageRefs: [],
        style,
        numbered,
        pageBreakBefore,
        pageBreakAfter: false,
      };
    }

    function pushSegment() {
      if (!currentSegment) {
        return;
      }
      const text = currentSegment.parts.join('');
      if (
        text ||
        currentSegment.imageRefs.length ||
        currentSegment.pageBreakBefore ||
        currentSegment.pageBreakAfter
      ) {
        segments.push({
          text,
          imageRefs: Array.from(new Set(currentSegment.imageRefs)),
          style: currentSegment.style,
          numbered: currentSegment.numbered,
          pageBreakBefore: currentSegment.pageBreakBefore,
          pageBreakAfter: currentSegment.pageBreakAfter,
        });
      }
    }

    function startNewSegment() {
      if (currentSegment) {
        currentSegment.pageBreakAfter = true;
      }
      pushSegment();
      currentSegment = createSegment(true);
    }

    paragraph.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.namespaceURI === WORD_NS && node.localName === 'pPr') {
        return;
      }

      if (node.namespaceURI === WORD_NS && node.localName === 'r') {
        const runImages = extractImageIdsFromRun(node);
        if (runImages.length) {
          currentSegment.imageRefs.push(...runImages);
        }

        node.childNodes.forEach((child) => {
          if (child.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          if (child.namespaceURI === WORD_NS && child.localName === 't') {
            currentSegment.parts.push(child.textContent || '');
          } else if (child.namespaceURI === WORD_NS && child.localName === 'tab') {
            currentSegment.parts.push('\t');
          } else if (child.namespaceURI === WORD_NS && child.localName === 'br') {
            const type = child.getAttributeNS(WORD_NS, 'type') || child.getAttribute('w:type') || '';
            if (type.toLowerCase() === 'page') {
              startNewSegment();
            } else {
              currentSegment.parts.push('\n');
            }
          } else if (child.namespaceURI === WORD_NS && child.localName === 'lastRenderedPageBreak') {
            startNewSegment();
          }
        });
      } else if (node.namespaceURI === WORD_NS && node.localName === 'lastRenderedPageBreak') {
        startNewSegment();
      }
    });

    pushSegment();

    return segments;
  }

  function buildRelationshipsMap(relsDom) {
    const map = new Map();
    const relationships = Array.from(relsDom.getElementsByTagName('Relationship'));
    relationships.forEach((rel) => {
      const id = rel.getAttribute('Id');
      const targetMode = rel.getAttribute('TargetMode');
      if (!id || targetMode === 'External') {
        return;
      }
      const target = rel.getAttribute('Target');
      if (target) {
        map.set(id, target);
      }
    });
    return map;
  }

  async function loadImageFromRelationship(zip, relationships, relationshipId) {
    const target = relationships.get(relationshipId);
    if (!target) {
      return null;
    }

    const normalizedPath = normalizeTargetPath(target);
    const file = zip.file(normalizedPath);

    if (!file) {
      return null;
    }

    const cache = loadImageFromRelationship.cache || (loadImageFromRelationship.cache = new Map());
    if (cache.has(normalizedPath)) {
      return cache.get(normalizedPath);
    }

    const base64 = await file.async('base64');
    const extension = normalizedPath.split('.').pop()?.toLowerCase();
    const mime = getMimeType(extension);
    const dataUrl = `data:${mime};base64,${base64}`;
    cache.set(normalizedPath, dataUrl);
    return dataUrl;
  }

  function normalizeTargetPath(target) {
    let path = target.replace(/^\.\//, '');
    while (path.startsWith('../')) {
      path = path.slice(3);
    }
    if (!path.startsWith('word/')) {
      path = `word/${path}`;
    }
    return path;
  }

  function getMimeType(extension) {
    switch (extension) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      default:
        return 'image/png';
    }
  }

  function extractImageIdsFromRun(run) {
    const ids = [];
    const blips = run.getElementsByTagNameNS(DRAWING_NS, 'blip');
    Array.from(blips).forEach((blip) => {
      const embed = blip.getAttributeNS(RELS_NS, 'embed') || blip.getAttribute('r:embed');
      if (embed) {
        ids.push(embed);
      }
    });
    return ids;
  }

  function normalizeText(text) {
    if (!text) {
      return '';
    }
    return text
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');
  }

  function detectCategoryMarker(text) {
    const normalized = normalizeTitle(text);
    if (!normalized) {
      return null;
    }
    for (const [keyword, category] of Object.entries(CATEGORY_MARKERS)) {
      if (
        normalized === keyword ||
        normalized.startsWith(`${keyword} `) ||
        normalized.endsWith(` ${keyword}`) ||
        normalized.includes(` ${keyword} `)
      ) {
        return category;
      }
    }
    return null;
  }

  function getParagraphStyle(paragraph) {
    const props = paragraph.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
    if (!props) {
      return null;
    }
    const style = props.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
    if (!style) {
      return null;
    }
    return style.getAttributeNS(WORD_NS, 'val') || style.getAttribute('w:val') || null;
  }

  function hasNumbering(paragraph) {
    const props = paragraph.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
    if (!props) {
      return false;
    }
    return props.getElementsByTagNameNS(WORD_NS, 'numPr').length > 0;
  }

  function hasRecipeContent(recipe) {
    if (!recipe || !recipe.title) {
      return false;
    }
    const hasSections = recipe.sections.some((section) => section.content.length > 0);
    const hasMetadata = recipe.metadata.some((entry) => entry && entry.trim().length > 0);
    return hasSections || hasMetadata || recipe.images.length > 0;
  }

  function shouldSkipTitle(title) {
    const normalized = title.trim().toLowerCase();
    return (
      normalized === 'índice' ||
      normalized.startsWith('pestaña') ||
      normalized === 'platos principales' ||
      normalized === 'postres'
    );
  }

  function normalizeTitle(title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
})();
