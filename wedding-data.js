'use strict';

var MAX_JSON_BYTES = 1024 * 1024;
var MAX_UPLOAD_BYTES = 70 * 1024 * 1024;
var MAX_WISHES = 200;

var VALID_BLOCKS = {
  hero: true,
  story: true,
  ceremony: true,
  gallery: true
};

var DEFAULT_CONFIG = {
  theme: 'ivory',
  page: 'classic',
  galleryLayout: 'editorial',
  heroLayout: 'full',
  storyLayout: 'duo',
  ceremonyLayout: 'card',
  content: {
    brideName: 'Minh Anh',
    groomName: 'Thiên Nam',
    date: '2026-12-12',
    time: '17:30',
    venueName: 'Nhà hàng Riverside Palace',
    venueAddress: '360D Bến Vân Đồn, Quận 4, TP. Hồ Chí Minh',
    brideFamilyName: 'Tư gia nhà gái',
    brideFamilyAddress: 'Quận 3, TP. Hồ Chí Minh',
    groomFamilyName: 'Tư gia nhà trai',
    groomFamilyAddress: 'Quận 7, TP. Hồ Chí Minh',
    invitation: 'Trân trọng kính mời gia đình và bạn bè đến chung vui cùng chúng mình trong ngày thành hôn.',
    storyTitle: 'Từ một lời chào bình dị',
    storyText: 'Chúng mình gặp nhau trong một chiều mưa nhẹ, đi qua nhiều mùa nắng gió và chọn cùng nhau bắt đầu một gia đình nhỏ.',
    ceremonyTitle: 'Lễ thành hôn',
    ceremonyNote: 'Tiệc cưới được chuẩn bị thân mật, ấm cúng và bắt đầu đón khách từ 17:00.'
  },
  images: {
    hero: [
      {
        url: '/assets/default-hero.jpg',
        alt: 'Cô dâu chú rể trong ngày cưới',
        source: 'sample'
      }
    ],
    story: [
      {
        url: '/assets/default-story.jpg',
        alt: 'Khoảnh khắc chụp ảnh cưới',
        source: 'sample'
      }
    ],
    ceremony: [
      {
        url: '/assets/default-ceremony.jpg',
        alt: 'Không gian tiệc cưới',
        source: 'sample'
      }
    ],
    gallery: [
      {
        url: '/assets/default-gallery-1.jpg',
        alt: 'Bàn tiệc cưới',
        source: 'sample'
      },
      {
        url: '/assets/default-gallery-2.jpg',
        alt: 'Hoa cưới',
        source: 'sample'
      },
      {
        url: '/assets/default-gallery-3.jpg',
        alt: 'Nhẫn cưới',
        source: 'sample'
      },
      {
        url: '/assets/default-gallery-4.jpg',
        alt: 'Khoảnh khắc cô dâu chú rể',
        source: 'sample'
      }
    ]
  },
  updatedAt: null
};

function normalizeConfig(input) {
  var base = clone(DEFAULT_CONFIG);
  var config = input && typeof input === 'object' ? input : {};
  base.theme = normalizeChoice(config.theme, ['ivory', 'sage', 'lotus'], base.theme);
  base.page = normalizeChoice(config.page, ['classic', 'editorial', 'minimal'], base.page);
  base.galleryLayout = normalizeChoice(config.galleryLayout, ['editorial', 'grid', 'masonry'], base.galleryLayout);
  base.heroLayout = normalizeChoice(config.heroLayout, ['full', 'split'], base.heroLayout);
  base.storyLayout = normalizeChoice(config.storyLayout, ['duo', 'strip'], base.storyLayout);
  base.ceremonyLayout = normalizeChoice(config.ceremonyLayout, ['card', 'wide'], base.ceremonyLayout);
  base.content = mergeObject(base.content, config.content);
  base.images = mergeImages(base.images, config.images);
  base.updatedAt = config.updatedAt || null;
  return base;
}

function normalizeChoice(value, choices, fallback) {
  return choices.indexOf(value) >= 0 ? value : fallback;
}

function mergeObject(base, extra) {
  if (!extra || typeof extra !== 'object') {
    return base;
  }
  Object.keys(base).forEach(function (key) {
    if (typeof extra[key] === 'string') {
      base[key] = extra[key];
    }
  });
  return base;
}

function mergeImages(base, extra) {
  Object.keys(VALID_BLOCKS).forEach(function (block) {
    if (extra && Array.isArray(extra[block])) {
      base[block] = extra[block].filter(isValidImage).map(function (image) {
        return {
          url: String(image.url),
          alt: typeof image.alt === 'string' ? image.alt : '',
          source: typeof image.source === 'string' ? image.source : 'upload',
          name: typeof image.name === 'string' ? image.name : '',
          uploadedAt: typeof image.uploadedAt === 'string' ? image.uploadedAt : ''
        };
      });
    }
  });
  return base;
}

function isValidImage(image) {
  return image && typeof image.url === 'string' && image.url.length > 0;
}

function isValidWish(wish) {
  return wish && typeof wish.name === 'string' && typeof wish.message === 'string';
}

function normalizeWish(wish, createId) {
  return {
    id: typeof wish.id === 'string' && wish.id ? wish.id : createId(),
    name: cleanText(wish.name, 80),
    message: cleanText(wish.message, 600),
    createdAt: typeof wish.createdAt === 'string' && wish.createdAt ? wish.createdAt : new Date().toISOString()
  };
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  MAX_JSON_BYTES: MAX_JSON_BYTES,
  MAX_UPLOAD_BYTES: MAX_UPLOAD_BYTES,
  MAX_WISHES: MAX_WISHES,
  VALID_BLOCKS: VALID_BLOCKS,
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  normalizeConfig: normalizeConfig,
  isValidWish: isValidWish,
  normalizeWish: normalizeWish,
  cleanText: cleanText
};
