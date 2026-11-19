import { DurableObject } from 'cloudflare:workers';
import initialConfig from '../data/config.json';
import initialWishes from '../data/wishes.json';
import weddingData from '../wedding-data.js';

const {
  MAX_JSON_BYTES, MAX_UPLOAD_BYTES, MAX_WISHES, VALID_BLOCKS,
  normalizeConfig, isValidWish, normalizeWish, cleanText
} = weddingData;

const imageTypes = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif'
};

export class WeddingData extends DurableObject {
  getConfig() {
    return this.ctx.storage.kv.get('config') ?? normalizeConfig(initialConfig);
  }

  saveConfig(input) {
    const current = this.getConfig();
    if (Object.hasOwn(input, 'updatedAt') && input.updatedAt !== current.updatedAt) {
      return null;
    }
    return this.#writeConfig(normalizeConfig(input));
  }

  addImages(block, images) {
    const config = this.getConfig();
    config.images[block].push(...images);
    return this.#writeConfig(config);
  }

  removeImage(block, url) {
    const config = this.getConfig();
    config.images[block] = config.images[block].filter(image => image.url !== url);
    const used = Object.values(config.images).some(images => images.some(image => image.url === url));
    return { config: this.#writeConfig(config), used };
  }

  getWishes() {
    const stored = this.ctx.storage.kv.get('wishes');
    if (stored) return stored;

    const wishes = Array.isArray(initialWishes) ? initialWishes.filter(isValidWish)
      .slice(0, MAX_WISHES).map(wish => normalizeWish(wish, () => crypto.randomUUID())) : [];
    this.ctx.storage.kv.put('wishes', wishes);
    return wishes;
  }

  addWish(name, message) {
    const wish = normalizeWish({ name, message }, () => crypto.randomUUID());
    const wishes = [wish, ...this.getWishes()].slice(0, MAX_WISHES);
    this.ctx.storage.kv.put('wishes', wishes);
    return { wish, wishes };
  }

  removeWish(id) {
    const wishes = this.getWishes().filter(wish => wish.id !== id);
    this.ctx.storage.kv.put('wishes', wishes);
    return wishes;
  }

  #writeConfig(config) {
    const previous = Date.parse(this.getConfig().updatedAt);
    config.updatedAt = new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString();
    this.ctx.storage.kv.put('config', config);
    return config;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const { method } = request;
    const adminPage = ['/admin', '/admin/', '/admin.html'].includes(pathname);
    const adminAction = (pathname === '/api/config' && method === 'PUT') ||
      (pathname === '/api/upload' && method === 'POST') ||
      (pathname === '/api/image' && method === 'DELETE') ||
      (pathname === '/api/wishes' && method === 'DELETE');

    try {
      if (adminPage || adminAction) {
        const response = await authorizeAdmin(request, env, url.origin);
        if (response) return response;
      }

      if (pathname.startsWith('/api/')) {
        return await handleApi(request, env, url);
      }
      if (pathname.startsWith('/uploads/')) {
        return await serveUpload(request, env.WEDDING_UPLOADS, pathname);
      }
      const response = await env.ASSETS.fetch(request);
      if (!adminPage) return response;

      const privateResponse = new Response(response.body, response);
      privateResponse.headers.set('Cache-Control', 'no-store');
      return privateResponse;
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Wedding Worker request failed', error);
      return json({ error: 'Không thể xử lý yêu cầu.' }, 500);
    }
  }
};

async function handleApi(request, env, url) {
  const data = env.WEDDING_DATA.getByName('wedding');

  switch (`${request.method} ${url.pathname}`) {
    case 'GET /api/config':
      return json(await data.getConfig());
    case 'PUT /api/config': {
      const saved = await data.saveConfig(await readJson(request));
      return saved ? json(saved) : json({ error: 'Cấu hình đã thay đổi. Vui lòng tải lại trang.' }, 409);
    }
    case 'GET /api/wishes':
      return json(await data.getWishes());
    case 'POST /api/wishes': {
      const payload = await readJson(request);
      const name = cleanText(payload.name, 80);
      const message = cleanText(payload.message, 600);
      if (name.length < 2) throw new HttpError(400, 'Vui lòng nhập tên của bạn.');
      if (message.length < 5) throw new HttpError(400, 'Vui lòng nhập lời chúc.');
      return json(await data.addWish(name, message), 201);
    }
    case 'DELETE /api/wishes': {
      const { id } = await readJson(request);
      return json(await data.removeWish(typeof id === 'string' ? id : ''));
    }
    case 'POST /api/upload':
      return await uploadImages(request, env.WEDDING_UPLOADS, data, url.searchParams.get('block'));
    case 'DELETE /api/image': {
      const { block, url: imageUrl } = await readJson(request);
      if (!Object.hasOwn(VALID_BLOCKS, block) || typeof imageUrl !== 'string') {
        throw new HttpError(400, 'Yêu cầu xóa ảnh không hợp lệ.');
      }
      const { config, used } = await data.removeImage(block, imageUrl);
      const key = uploadKey(imageUrl);
      if (key && !used) await env.WEDDING_UPLOADS.delete(key);
      return json(config);
    }
    default:
      return json({ error: 'Không tìm thấy API.' }, 404);
  }
}

async function authorizeAdmin(request, env, origin) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: 'Trang quản trị chưa được cấu hình.' }, 503);
  }
  if (request.headers.has('Origin') && request.headers.get('Origin') !== origin) {
    return json({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }

  const credentials = request.headers.get('Authorization')?.match(/^Basic ([a-z0-9+/=]+)$/i)?.[1];
  if (credentials) {
    const encoder = new TextEncoder();
    const expected = encoder.encode(`admin:${env.ADMIN_PASSWORD}`);
    let supplied;
    try {
      supplied = Uint8Array.from(atob(credentials), character => character.charCodeAt(0));
    } catch {
      supplied = new Uint8Array();
    }
    const [expectedHash, suppliedHash] = await Promise.all([
      crypto.subtle.digest('SHA-256', expected),
      crypto.subtle.digest('SHA-256', supplied)
    ]);
    if (crypto.subtle.timingSafeEqual(expectedHash, suppliedHash)) return null;
  }
  return json({ error: 'Vui lòng đăng nhập trang quản trị.' }, 401, {
    'WWW-Authenticate': 'Basic realm="Wedding Admin", charset="UTF-8"'
  });
}

function limitedBody(request, limit) {
  const error = new HttpError(413, 'Dữ liệu gửi lên quá lớn.');
  if (Number(request.headers.get('Content-Length')) > limit) throw error;

  let size = 0;
  return request.body?.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > limit) throw error;
      controller.enqueue(chunk);
    }
  }));
}

async function readJson(request) {
  try {
    const value = await new Response(limitedBody(request, MAX_JSON_BYTES)).json();
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
  }
  throw new HttpError(400, 'Dữ liệu JSON không hợp lệ.');
}

async function uploadImages(request, bucket, data, block) {
  if (!Object.hasOwn(VALID_BLOCKS, block)) throw new HttpError(400, 'Khối ảnh không hợp lệ.');

  let form;
  try {
    form = await new Response(limitedBody(request, MAX_UPLOAD_BYTES), {
      headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' }
    }).formData();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Dữ liệu tải ảnh không hợp lệ.');
  }

  const images = [];
  const keys = [];
  try {
    for (const file of form.getAll('images')) {
      if (typeof file === 'string' || !file.size) continue;

      const filenameExtension = file.name.match(/\.([a-z]+)$/i)?.[1].toLowerCase();
      const extension = Object.hasOwn(imageTypes, filenameExtension) ? filenameExtension :
        Object.keys(imageTypes).find(ext => imageTypes[ext] === file.type.toLowerCase());
      if (!extension) continue;

      const key = `${crypto.randomUUID()}.${extension}`;
      await bucket.put(key, file, { httpMetadata: { contentType: imageTypes[extension] } });
      keys.push(key);
      images.push({
        url: `/uploads/${key}`,
        alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        source: 'upload',
        name: file.name,
        uploadedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    if (keys.length) await bucket.delete(keys);
    throw error;
  }

  if (!images.length) throw new HttpError(400, 'Không tìm thấy ảnh hợp lệ.');
  return json({ block, images, config: await data.addImages(block, images) });
}

async function serveUpload(request, bucket, pathname) {
  const key = uploadKey(pathname);
  if (!key) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const object = request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const extension = key.split('.').pop().toLowerCase();
  return new Response(object.body ?? null, { headers: {
    'Content-Type': imageTypes[extension],
    'Content-Length': String(object.size),
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    ETag: object.httpEtag
  } });
}

function uploadKey(pathname) {
  return /^\/uploads\/([a-z0-9._-]+\.(?:jpe?g|png|webp|gif))$/i.exec(pathname)?.[1];
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
