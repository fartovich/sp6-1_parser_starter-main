/* ---------- Соответствия ---------- */

// Символы валют их кодам
const CURRENCY_CODES = {
    '$': 'USD',
    '€': 'EUR',
    '₽': 'RUB'
};
 
// Цвет тега типу данных в ответе
const TAG_TYPES = {
    green: 'category',
    blue: 'label',
    red: 'discount'
};
 
/* ---------- Убираем пробелы и лишнее из заголовка, разделяем строку цены и кода валюты, убираем атрибуты из разметки ---------- */
 
// Текст элемента без пробелов по краям (пустая строка, если элемента нет)
function getText(element) {
    return element ? element.textContent.trim() : '';
}
 
// Значение атрибута без пробелов по краям (пустая строка, если элемента или атрибута нет)
function getAttr(element, name) {
    return element ? (element.getAttribute(name) || '').trim() : '';
}
 
// Убирает из заголовка название сайта: «About Vite — Modern Development Tool» → «About Vite»
function cleanTitle(title) {
    return title.split('—')[0].trim();
}
 
// Разделяем строку цены вида «₽50» на код валюты и число
function parsePrice(text) {
    const value = text.trim();
    const symbol = value.charAt(0);
 
    return {
        currency: CURRENCY_CODES[symbol] || symbol,
        value: value.slice(1).trim()
    };
}
 
// Возвращает копию HTML-разметки элемента без атрибутов у всех вложенных тегов
function getCleanHTML(element) {
    if (!element) {
        return '';
    }
 
    const clone = element.cloneNode(true);
 
    clone.querySelectorAll('*').forEach(child => {
        // Копируем список имён, т.к. коллекция attributes «живая» и меняется при удалении
        Array.from(child.attributes).forEach(attr => child.removeAttribute(attr.name));
    });
 
    return clone.innerHTML.trim();
}
 
/* ---------- Мета-информация ---------- */
 
function parseMeta() {
    const keywords = getAttr(document.querySelector('meta[name="keywords"]'), 'content');
 
    // Все мета-теги вида og:* превращаем в объект без префикса og:
    const opengraph = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
        const key = getAttr(meta, 'property').replace('og:', '');
        const value = getAttr(meta, 'content');
        opengraph[key] = key === 'title' ? cleanTitle(value) : value;
    });
 
    return {
        title: cleanTitle(getText(document.querySelector('title'))),
        description: getAttr(document.querySelector('meta[name="description"]'), 'content'),
        keywords: keywords ? keywords.split(',').map(word => word.trim()) : [],
        language: getAttr(document.documentElement, 'lang'),
        opengraph
    };
}
 
/* ---------- Карточка товара ---------- */
 
// Изображения из миниатюр
// Выбранное по умолчанию (совпадает с основным изображением) ставим первым, остальные — в исходном порядке без дублей
function parseProductImages(section) {
    const mainSrc = getAttr(section.querySelector('.preview figure img'), 'src');
 
    const images = Array.from(section.querySelectorAll('.preview nav img')).map(img => ({
        preview: getAttr(img, 'src'),
        full: getAttr(img, 'data-src'),
        alt: getAttr(img, 'alt')
    }));
 
    const mainIndex = images.findIndex(image => image.full === mainSrc);
    if (mainIndex > 0) {
        images.unshift(images.splice(mainIndex, 1)[0]);
    }
 
    return images;
}
 
// Теги, распределённые по типам в зависимости от цвета
function parseProductTags(section) {
    const tags = { category: [], discount: [], label: [] };
 
    section.querySelectorAll('.tags span').forEach(tag => {
        const color = Object.keys(TAG_TYPES).find(name => tag.classList.contains(name));
        if (color) {
            tags[TAG_TYPES[color]].push(getText(tag));
        }
    });
 
    return tags;
}
 
// Цены, скидка и валюта
// В блоке .price первый текстовый узел — актуальная цена, а <span> — зачёркнутая старая
function parseProductPrice(section) {
    const priceBlock = section.querySelector('.price');
    if (!priceBlock) {
        return { price: 0, oldPrice: 0, discount: 0, discountPercent: '0%', currency: '' };
    }
 
    const current = parsePrice(priceBlock.firstChild ? priceBlock.firstChild.textContent : '');
    const old = parsePrice(getText(priceBlock.querySelector('span')));
 
    const price = parseFloat(current.value) || 0;
    const oldPrice = parseFloat(old.value) || 0;
    const hasDiscount = oldPrice > price;
 
    return {
        price,
        oldPrice,
        discount: hasDiscount ? oldPrice - price : 0,
        discountPercent: hasDiscount
            ? `${(100 - (price / oldPrice) * 100).toFixed(2)}%`
            : '0%',
        currency: current.currency
    };
}
 
// Свойства: слева ключ, справа значение
function parseProductProperties(section) {
    const properties = {};
 
    section.querySelectorAll('.properties li').forEach(row => {
        const [key, value] = row.querySelectorAll('span');
        if (key) {
            properties[getText(key)] = getText(value);
        }
    });
 
    return properties;
}
 
function parseProduct() {
    const section = document.querySelector('.product');
    if (!section) {
        return {};
    }
 
    return {
        id: section.dataset.id || '',
        name: getText(section.querySelector('h1')),
        isLiked: Boolean(section.querySelector('.like')?.classList.contains('active')),
        tags: parseProductTags(section),
        ...parseProductPrice(section),
        properties: parseProductProperties(section),
        description: getCleanHTML(section.querySelector('.description')),
        images: parseProductImages(section)
    };
}
 
/* ---------- Предложенные товары ---------- */
 
function parseSuggested() {
    return Array.from(document.querySelectorAll('.suggested article')).map(card => {
        const { currency, value } = parsePrice(getText(card.querySelector('b')));
 
        return {
            name: getText(card.querySelector('h3')),
            description: getText(card.querySelector('p')),
            image: getAttr(card.querySelector('img'), 'src'),
            price: value,
            currency
        };
    });
}
 
/* ---------- Обзоры ---------- */
 
// Дата «15/09/2024» → «15.09.2024»
function formatDate(text) {
    return text.replace(/\//g, '.');
}
 
function parseReviews() {
    return Array.from(document.querySelectorAll('.reviews article')).map(card => ({
        rating: card.querySelectorAll('.rating .filled').length,
        author: {
            avatar: getAttr(card.querySelector('.author img'), 'src'),
            name: getText(card.querySelector('.author span'))
        },
        title: getText(card.querySelector('.title')),
        description: getText(card.querySelector('.title + p, p')),
        date: formatDate(getText(card.querySelector('.author i')))
    }));
}

function parsePage() {
    return {
        meta: parseMeta(),
        product: parseProduct(),
        suggested: parseSuggested(),
        reviews: parseReviews()
    };
}

window.parsePage = parsePage;