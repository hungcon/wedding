'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var crypto = require('crypto');

var ROOT = __dirname;
var PUBLIC_DIR = path.join(ROOT, 'public');
var DATA_DIR = path.join(ROOT, 'data');
var UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
var CONFIG_PATH = path.join(DATA_DIR, 'config.json');
var WISHES_PATH = path.join(DATA_DIR, 'wishes.json');
var PORT = Number(process.env.PORT || 4173);
var MAX_JSON_BYTES = 1024 * 1024;
var MAX_UPLOAD_BYTES = 70 * 1024 * 1024;
var MAX_WISHES = 200;

var VALID_BLOCKS = {
  hero: true,
  story: true,
  ceremony: true,
  gallery: true
};

var MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon'
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

ensureDataFiles();

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = decodeURIComponent(parsed.pathname || '/');

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, readConfig());
  }

  if (pathname === '/api/config' && req.method === 'PUT') {
    return handleSaveConfig(req, res);
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    return handleUpload(req, res, parsed.query);
  }

  if (pathname === '/api/image' && req.method === 'DELETE') {
    return handleDeleteImage(req, res);
  }

  if (pathname === '/api/wishes' && req.method === 'GET') {
    return sendJson(res, 200, readWishes());
  }

  if (pathname === '/api/wishes' && req.method === 'POST') {
    return handleAddWish(req, res);
  }

  if (pathname === '/api/wishes' && req.method === 'DELETE') {
    return handleDeleteWish(req, res);
  }

  if (pathname.indexOf('/uploads/') === 0) {
    return serveUpload(pathname, res);
  }

  if (pathname === '/' || pathname === '') {
    return servePublicFile('index.html', res);
  }

  if (pathname === '/admin') {
    return servePublicFile('admin.html', res);
  }

  return servePublicFile(pathname.replace(/^\/+/, ''), res);
});

server.listen(PORT, function () {
  console.log('Wedding app is running at http://localhost:' + PORT);
  console.log('Admin page: http://localhost:' + PORT + '/admin');
});

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    writeConfig(DEFAULT_CONFIG);
  }
  if (!fs.existsSync(WISHES_PATH)) {
    writeWishes([]);
  }
}

function readConfig() {
  try {
    var raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return normalizeConfig(JSON.parse(raw));
  } catch (error) {
    return normalizeConfig(DEFAULT_CONFIG);
  }
}

function writeConfig(config) {
  var normalized = normalizeConfig(config);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 2));
  return normalized;
}

function readWishes() {
  try {
    var raw = fs.readFileSync(WISHES_PATH, 'utf8');
    var wishes = JSON.parse(raw);
    return Array.isArray(wishes) ? wishes.filter(isValidWish).map(normalizeWish) : [];
  } catch (error) {
    return [];
  }
}

function writeWishes(wishes) {
  var normalized = Array.isArray(wishes) ? wishes.filter(isValidWish).map(normalizeWish) : [];
  fs.writeFileSync(WISHES_PATH, JSON.stringify(normalized.slice(0, MAX_WISHES), null, 2));
  return normalized.slice(0, MAX_WISHES);
}

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

function normalizeWish(wish) {
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

function createId() {
  return Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function handleSaveConfig(req, res) {
  collectBody(req, MAX_JSON_BYTES, function (error, body) {
    if (error) {
      return sendJson(res, 413, { error: error.message });
    }

    try {
      var incoming = JSON.parse(body.toString('utf8'));
      incoming.updatedAt = new Date().toISOString();
      var saved = writeConfig(incoming);
      return sendJson(res, 200, saved);
    } catch (parseError) {
      return sendJson(res, 400, { error: 'Dữ liệu cấu hình không hợp lệ.' });
    }
  });
}

function handleUpload(req, res, query) {
  var block = query.block;
  if (!VALID_BLOCKS[block]) {
    return sendJson(res, 400, { error: 'Khối ảnh không hợp lệ.' });
  }

  var contentType = req.headers['content-type'] || '';
  var boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return sendJson(res, 400, { error: 'Thiếu multipart boundary.' });
  }

  collectBody(req, MAX_UPLOAD_BYTES, function (error, body) {
    if (error) {
      return sendJson(res, 413, { error: error.message });
    }

    try {
      var boundary = boundaryMatch[1] || boundaryMatch[2];
      var parts = parseMultipart(body, boundary);
      var savedImages = [];

      parts.forEach(function (part) {
        if (!part.filename || !part.data || part.data.length === 0) {
          return;
        }

        if (!isSupportedImage(part)) {
          return;
        }

        var file = saveImageFile(part);
        savedImages.push({
          url: '/uploads/' + file.name,
          alt: humanizeFilename(part.filename),
          source: 'upload',
          name: part.filename,
          uploadedAt: new Date().toISOString()
        });
      });

      if (savedImages.length === 0) {
        return sendJson(res, 400, { error: 'Không tìm thấy ảnh hợp lệ.' });
      }

      var config = readConfig();
      config.images[block] = config.images[block].concat(savedImages);
      config.updatedAt = new Date().toISOString();
      var saved = writeConfig(config);

      return sendJson(res, 200, { block: block, images: savedImages, config: saved });
    } catch (uploadError) {
      return sendJson(res, 500, { error: 'Không thể lưu ảnh upload.' });
    }
  });
}

function handleDeleteImage(req, res) {
  collectBody(req, MAX_JSON_BYTES, function (error, body) {
    if (error) {
      return sendJson(res, 413, { error: error.message });
    }

    try {
      var payload = JSON.parse(body.toString('utf8'));
      var block = payload.block;
      var imageUrl = payload.url;

      if (!VALID_BLOCKS[block] || typeof imageUrl !== 'string') {
        return sendJson(res, 400, { error: 'Yêu cầu xóa ảnh không hợp lệ.' });
      }

      var config = readConfig();
      config.images[block] = config.images[block].filter(function (image) {
        return image.url !== imageUrl;
      });
      config.updatedAt = new Date().toISOString();

      if (imageUrl.indexOf('/uploads/') === 0) {
        removeUploadFile(imageUrl);
      }

      return sendJson(res, 200, writeConfig(config));
    } catch (deleteError) {
      return sendJson(res, 400, { error: 'Không thể xóa ảnh.' });
    }
  });
}

function handleAddWish(req, res) {
  collectBody(req, MAX_JSON_BYTES, function (error, body) {
    if (error) {
      return sendJson(res, 413, { error: error.message });
    }

    try {
      var payload = JSON.parse(body.toString('utf8'));
      var name = cleanText(payload.name, 80);
      var message = cleanText(payload.message, 600);

      if (name.length < 2) {
        return sendJson(res, 400, { error: 'Vui lòng nhập tên của bạn.' });
      }

      if (message.length < 5) {
        return sendJson(res, 400, { error: 'Vui lòng nhập lời chúc.' });
      }

      var wishes = readWishes();
      var wish = normalizeWish({
        id: createId(),
        name: name,
        message: message,
        createdAt: new Date().toISOString()
      });

      wishes.unshift(wish);
      return sendJson(res, 201, { wish: wish, wishes: writeWishes(wishes) });
    } catch (wishError) {
      return sendJson(res, 400, { error: 'Không thể lưu lời chúc.' });
    }
  });
}

function handleDeleteWish(req, res) {
  collectBody(req, MAX_JSON_BYTES, function (error, body) {
    if (error) {
      return sendJson(res, 413, { error: error.message });
    }

    try {
      var payload = JSON.parse(body.toString('utf8'));
      var wishId = typeof payload.id === 'string' ? payload.id : '';
      var wishes = readWishes().filter(function (wish) {
        return wish.id !== wishId;
      });

      return sendJson(res, 200, writeWishes(wishes));
    } catch (deleteError) {
      return sendJson(res, 400, { error: 'Không thể xóa lời chúc.' });
    }
  });
}

function collectBody(req, limit, callback) {
  var chunks = [];
  var size = 0;

  req.on('data', function (chunk) {
    size += chunk.length;
    if (size > limit) {
      callback(new Error('Dữ liệu gửi lên quá lớn.'));
      req.connection.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', function () {
    callback(null, Buffer.concat(chunks));
  });

  req.on('error', function (error) {
    callback(error);
  });
}

function parseMultipart(buffer, boundary) {
  var body = buffer.toString('binary');
  var delimiter = '--' + boundary;
  var segments = body.split(delimiter);
  var parts = [];

  segments.forEach(function (segment) {
    if (!segment || segment === '--' || segment === '--\r\n') {
      return;
    }

    if (segment.indexOf('\r\n') === 0) {
      segment = segment.slice(2);
    }
    if (segment.lastIndexOf('\r\n') === segment.length - 2) {
      segment = segment.slice(0, -2);
    }
    if (segment.lastIndexOf('--') === segment.length - 2) {
      segment = segment.slice(0, -2);
    }

    var separatorIndex = segment.indexOf('\r\n\r\n');
    if (separatorIndex < 0) {
      return;
    }

    var rawHeaders = segment.slice(0, separatorIndex);
    var rawData = segment.slice(separatorIndex + 4);
    var headers = parsePartHeaders(rawHeaders);
    var disposition = headers['content-disposition'] || '';
    var filenameMatch = disposition.match(/filename="([^"]*)"/i);
    var nameMatch = disposition.match(/name="([^"]*)"/i);

    parts.push({
      fieldName: nameMatch ? nameMatch[1] : '',
      filename: filenameMatch ? path.basename(filenameMatch[1]) : '',
      contentType: headers['content-type'] || '',
      data: Buffer.from(rawData, 'binary')
    });
  });

  return parts;
}

function parsePartHeaders(rawHeaders) {
  var headers = {};
  rawHeaders.split('\r\n').forEach(function (line) {
    var index = line.indexOf(':');
    if (index > -1) {
      headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
    }
  });
  return headers;
}

function isSupportedImage(part) {
  var type = String(part.contentType || '').toLowerCase();
  var ext = path.extname(part.filename || '').toLowerCase();
  return type.indexOf('image/') === 0 || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].indexOf(ext) >= 0;
}

function saveImageFile(part) {
  var ext = path.extname(part.filename || '').toLowerCase();
  if (!ext) {
    ext = extensionFromType(part.contentType);
  }

  var safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].indexOf(ext) >= 0 ? ext : '.jpg';
  var id = Date.now() + '-' + crypto.randomBytes(5).toString('hex');
  var name = id + safeExt;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), part.data);
  return { name: name };
}

function extensionFromType(type) {
  var lower = String(type || '').toLowerCase();
  if (lower.indexOf('png') >= 0) return '.png';
  if (lower.indexOf('webp') >= 0) return '.webp';
  if (lower.indexOf('gif') >= 0) return '.gif';
  return '.jpg';
}

function humanizeFilename(filename) {
  return path.basename(filename || 'Ảnh cưới').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
}

function removeUploadFile(imageUrl) {
  var name = path.basename(imageUrl);
  var filePath = path.join(UPLOAD_DIR, name);
  if (filePath.indexOf(UPLOAD_DIR) !== 0) {
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    return;
  }
}

function servePublicFile(relativePath, res) {
  var safePath = path.normalize(relativePath || '').replace(/^(\.\.[\/\\])+/, '');
  var filePath = path.join(PUBLIC_DIR, safePath);

  if (filePath.indexOf(PUBLIC_DIR) !== 0) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.stat(filePath, function (error, stat) {
    if (error || !stat.isFile()) {
      return sendText(res, 404, 'Not found');
    }
    streamFile(filePath, res);
  });
}

function serveUpload(pathname, res) {
  var name = path.basename(pathname);
  var filePath = path.join(UPLOAD_DIR, name);

  if (filePath.indexOf(UPLOAD_DIR) !== 0) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.stat(filePath, function (error, stat) {
    if (error || !stat.isFile()) {
      return sendText(res, 404, 'Not found');
    }
    streamFile(filePath, res);
  });
}

function streamFile(filePath, res) {
  var ext = path.extname(filePath).toLowerCase();
  var cacheControl = ['.html', '.css', '.js', '.json'].indexOf(ext) >= 0
    ? 'no-store'
    : 'public, max-age=3600';

  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
