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
  const modal = document.getElementById('modal');
  const modalGallery = document.getElementById('modal-gallery');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalSections = document.getElementById('modal-sections');
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
      state.filtered = recipes;
      renderCards(recipes);
      if (!recipes.length) {
        setEmptyState({
          visible: true,
          title: 'No se encontraron recetas',
          message:
            'Añade contenido al archivo recetario.docx y vuelve a publicar la página para ver las recetas aquí.',
        });
      }
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

  function handleSearch(event) {
    const query = event.target.value.trim().toLowerCase();
    if (!state.recipes.length) {
      return;
    }

    const filtered = !query
      ? state.recipes.slice()
      : state.recipes.filter((recipe) => recipe.title.toLowerCase().includes(query));

    state.filtered = filtered;
    renderCards(filtered);

    if (!filtered.length) {
      setEmptyState({
        visible: true,
        title: 'Sin resultados',
        message: `No hay recetas que coincidan con “${query}”.`,
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

    const recipes = [];
    let currentRecipe = null;
    let currentSection = null;
    let readingMetadata = false;
    const pendingImages = [];

    const children = Array.from(body.childNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE);

    for (const node of children) {
      if (node.namespaceURI !== WORD_NS) {
        continue;
      }

      if (node.localName === 'p') {
        processParagraph(node);
      } else if (node.localName === 'tbl') {
        const paragraphs = Array.from(node.getElementsByTagNameNS(WORD_NS, 'p'));
        paragraphs.forEach((paragraph) => processParagraph(paragraph));
      }
    }

    await Promise.all(pendingImages);

    return recipes.filter(isValidRecipe);

    function processParagraph(paragraph) {
      const rawText = extractParagraphText(paragraph);
      const text = normalizeText(rawText);
      const style = getParagraphStyle(paragraph);
      const imageRefs = extractImageIds(paragraph);
      const hasText = Boolean(text);

      if (style === 'Title' && hasText) {
        if (shouldSkipTitle(text)) {
          currentRecipe = null;
          currentSection = null;
          readingMetadata = false;
          return;
        }
        const recipe = {
          title: text,
          metadata: [],
          sections: [],
          images: [],
        };
        recipes.push(recipe);
        currentRecipe = recipe;
        currentSection = null;
        readingMetadata = true;
        queueImages(recipe, imageRefs);
        return;
      }

      if (!currentRecipe) {
        return;
      }

      if (imageRefs.length) {
        queueImages(currentRecipe, imageRefs);
      }

      if (!hasText) {
        return;
      }

      if (style && style.startsWith('Heading')) {
        currentSection = {
          title: text,
          content: [],
        };
        currentRecipe.sections.push(currentSection);
        readingMetadata = false;
        return;
      }

      if (readingMetadata) {
        currentRecipe.metadata.push(text);
        return;
      }

      if (!currentSection) {
        currentSection = {
          title: '',
          content: [],
        };
        currentRecipe.sections.push(currentSection);
      }

      if (hasNumbering(paragraph)) {
        const last = currentSection.content[currentSection.content.length - 1];
        if (last && last.type === 'list') {
          last.items.push(text);
        } else {
          currentSection.content.push({ type: 'list', items: [text] });
        }
      } else {
        currentSection.content.push({ type: 'paragraph', text });
      }
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
        parts.push(extractRunText(node));
      } else if (node.namespaceURI === WORD_NS && node.localName === 'pPr') {
        // ignore paragraph properties
      } else if (node.namespaceURI === WORD_NS && node.localName === 'br') {
        parts.push('\n');
      }
    });

    const text = parts.join('');
    return text || paragraph.textContent || '';
  }

  function extractRunText(run) {
    const segments = [];
    run.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      if (child.namespaceURI === WORD_NS && child.localName === 't') {
        segments.push(child.textContent || '');
      } else if (child.namespaceURI === WORD_NS && child.localName === 'tab') {
        segments.push('\t');
      } else if (child.namespaceURI === WORD_NS && child.localName === 'br') {
        segments.push('\n');
      }
    });
    return segments.join('');
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

  function extractImageIds(paragraph) {
    const ids = [];
    const blips = paragraph.getElementsByTagNameNS(DRAWING_NS, 'blip');
    Array.from(blips).forEach((blip) => {
      const embed = blip.getAttributeNS(RELS_NS, 'embed') || blip.getAttribute('r:embed');
      if (embed) {
        ids.push(embed);
      }
    });
    return ids;
  }

  function hasNumbering(paragraph) {
    const props = paragraph.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
    if (!props) {
      return false;
    }
    return props.getElementsByTagNameNS(WORD_NS, 'numPr').length > 0;
  }

  function isValidRecipe(recipe) {
    if (!recipe.title) {
      return false;
    }
    const hasMetadata = recipe.metadata.some(Boolean);
    const hasSections = recipe.sections.some((section) => section.content.length > 0);
    return hasMetadata || hasSections;
  }

  function shouldSkipTitle(title) {
    const normalized = title.trim().toLowerCase();
    return normalized === 'índice' || normalized.startsWith('pestaña');
  }
})();
