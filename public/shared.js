(function (global) {
  'use strict';

  var blockLabels = {
    hero: 'Ảnh mở đầu',
    story: 'Câu chuyện',
    ceremony: 'Lễ cưới',
    gallery: 'Thư viện ảnh'
  };

  function requestJson(url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.text().then(function (text) {
        var payload = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(payload.error || 'Không thể xử lý yêu cầu.');
        }
        return payload;
      });
    });
  }

  function fetchConfig() {
    return requestJson('/api/config', {
      cache: 'no-store'
    });
  }

  function saveConfig(config) {
    return requestJson('/api/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
  }

  function uploadImages(block, files) {
    var form = new FormData();
    Array.prototype.forEach.call(files, function (file) {
      form.append('images', file);
    });

    return requestJson('/api/upload?block=' + encodeURIComponent(block), {
      method: 'POST',
      body: form
    });
  }

  function deleteImage(block, imageUrl) {
    return requestJson('/api/image', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        block: block,
        url: imageUrl
      })
    });
  }

  function fetchWishes() {
    return requestJson('/api/wishes', {
      cache: 'no-store'
    });
  }

  function submitWish(name, message) {
    return requestJson('/api/wishes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        message: message
      })
    });
  }

  function deleteWish(id) {
    return requestJson('/api/wishes', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: id
      })
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) {
      return '';
    }
    var date = new Date(value + 'T00:00:00');
    if (isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function formatShortDate(value) {
    if (!value) {
      return '';
    }
    var date = new Date(value + 'T00:00:00');
    if (isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDateTime(dateValue, timeValue) {
    if (!dateValue) {
      return null;
    }
    var time = timeValue || '00:00';
    var date = new Date(dateValue + 'T' + time + ':00');
    return isNaN(date.getTime()) ? null : date;
  }

  function formatWishDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function imageList(config, block) {
    if (!config || !config.images || !Array.isArray(config.images[block])) {
      return [];
    }
    return config.images[block].filter(function (image) {
      return image && image.url;
    });
  }

  function lastImage(config, block) {
    var images = imageList(config, block);
    return images.length ? images[images.length - 1] : null;
  }

  function blockAlt(block, fallback) {
    return fallback || blockLabels[block] || 'Ảnh cưới';
  }

  function readFilePreview(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error('Không thể đọc ảnh.'));
      };
      reader.readAsDataURL(file);
    });
  }

  global.WeddingApp = {
    blockLabels: blockLabels,
    fetchConfig: fetchConfig,
    saveConfig: saveConfig,
    uploadImages: uploadImages,
    deleteImage: deleteImage,
    fetchWishes: fetchWishes,
    submitWish: submitWish,
    deleteWish: deleteWish,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatShortDate: formatShortDate,
    formatDateTime: formatDateTime,
    formatWishDate: formatWishDate,
    imageList: imageList,
    lastImage: lastImage,
    blockAlt: blockAlt,
    readFilePreview: readFilePreview
  };
})(window);
