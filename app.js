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
  const modal = document.getElementById('modal');
  const modalGallery = document.getElementById('modal-gallery');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalSections = document.getElementById('modal-sections');
  const dismissButtons = modal.querySelectorAll('[data-dismiss="modal"]');

  const state = {
    recipes: [],
    filtered: [],
    activeCategory: 'principales',
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
      renderCards([]);
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

    const categoryMap = extractCategoriesFromIndex(body);
    const pendingImages = [];
    const pages = splitDocumentIntoPages(body);

    const recipes = pages
      .map((segments) => buildRecipeFromSegments(segments))
      .filter(Boolean)
      .filter(isValidRecipe);

    await Promise.all(pendingImages);

    return recipes;

    function buildRecipeFromSegments(segments) {
      let recipe = null;
      let currentSection = null;
      let readingMetadata = false;
      const deferredImages = [];

      segments.forEach((segment) => {
        const text = normalizeText(segment.text);
        const hasText = Boolean(text);
        const imageRefs = segment.imageRefs;

        if (!recipe) {
          if (imageRefs.length) {
            deferredImages.push(...imageRefs);
          }

          if (!hasText) {
            return;
          }

          const lines = text.split('\n');
          const titleCandidate = lines.shift() || '';
          const normalizedCandidate = normalizeTitle(titleCandidate);

          if (!normalizedCandidate || shouldSkipTitle(titleCandidate)) {
            return;
          }

          const title = titleCandidate.trim() || 'Receta sin título';
          const category = categoryMap.get(normalizedCandidate) || 'principales';

          recipe = {
            title,
            metadata: [],
            sections: [],
            images: [],
            category,
          };

          const leftover = lines.join('\n').trim();
          if (leftover) {
            recipe.metadata.push(leftover);
          }

          if (deferredImages.length) {
            queueImages(recipe, deferredImages);
            deferredImages.length = 0;
          }

          if (imageRefs.length) {
            queueImages(recipe, imageRefs);
          }

          readingMetadata = true;
          currentSection = null;
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

      return recipe;
    }

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

  function extractCategoriesFromIndex(body) {
    const map = new Map();
    let currentCategory = null;

    const paragraphs = Array.from(body.getElementsByTagNameNS(WORD_NS, 'p'));

    for (const paragraph of paragraphs) {
      const raw = extractParagraphText(paragraph);
      const text = normalizeText(raw);
      if (!text) {
        continue;
      }

      const normalized = text.toLowerCase();

      if (normalized === 'platos principales') {
        currentCategory = 'principales';
        continue;
      }

      if (normalized === 'postres') {
        currentCategory = 'postres';
        continue;
      }

      if (normalized.startsWith('tiempo de preparación') || normalized.startsWith('tiempo de preparacion')) {
        break;
      }

      if (!currentCategory) {
        continue;
      }

      if (shouldSkipTitle(text)) {
        continue;
      }

      const normalizedTitle = normalizeTitle(text);
      if (!normalizedTitle) {
        continue;
      }

      if (map.has(normalizedTitle)) {
        break;
      }

      map.set(normalizedTitle, currentCategory);
    }

    return map;
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

  function extractParagraphText(paragraph) {
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
            const type = child.getAttributeNS(WORD_NS, 'type') || child.getAttribute('w:type') || '';
            if (type.toLowerCase() !== 'page') {
              parts.push('\n');
            }
          }
        });
      } else if (node.namespaceURI === WORD_NS && node.localName === 'br') {
        parts.push('\n');
      }
    });

    return parts.join('');
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

  function isValidRecipe(recipe) {
    if (!recipe || !recipe.title) {
      return false;
    }
    const hasSections = recipe.sections.some((section) => section.content.length > 0);
    return hasSections;
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
