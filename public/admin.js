(function () {
  'use strict';

  var config = null;
  var wishes = [];
  var dirty = false;
  var busy = false;
  var statusNode = document.getElementById('save-status');
  var saveButton = document.getElementById('save-config');
  var uploadBlocks = document.getElementById('upload-blocks');
  var adminWishList = document.getElementById('admin-wish-list');
  var blocks = ['hero', 'story', 'ceremony', 'gallery'];
  var blockDescriptions = {
    hero: 'Bức ảnh mở đầu, chào đón những người thân yêu.',
    story: 'Những khoảnh khắc kể lại hành trình của hai bạn.',
    ceremony: 'Hình ảnh đi cùng thông tin về ngày chung đôi.',
    gallery: 'Một bộ sưu tập những kỷ niệm đáng nhớ.'
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindStaticControls();
    loadConfig();
  });

  function loadConfig() {
    setBusy(true);
    setStatus('Đang tải', 'muted');
    Promise.all([WeddingApp.fetchConfig(), WeddingApp.fetchWishes()])
      .then(function (result) {
        config = result[0];
        wishes = result[1];
        dirty = false;
        hydrateForm();
        renderUploadBlocks();
        renderAdminWishes();
        setBusy(false);
        setStatus('Đã đồng bộ', 'ok');
      })
      .catch(function (error) {
        uploadBlocks.innerHTML = '<p class="admin-loading">Không thể tải dữ liệu. Vui lòng tải lại trang để thử lại.</p>';
        adminWishList.innerHTML = '<p class="admin-loading">Không thể tải lời chúc.</p>';
        setBusy(false);
        setStatus(error.message, 'error');
      });
  }

  function bindStaticControls() {
    saveButton.addEventListener('click', function () {
      if (busy) return;
      saveCurrentConfig().catch(function () {
        // The error is already displayed in the live status region.
      });
    });

    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-content]'), function (input) {
      input.addEventListener('input', function () {
        if (!config || busy) return;
        config.content[input.getAttribute('data-content')] = input.value;
        updateOverview();
        markDirty();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-config]'), function (control) {
      control.addEventListener('change', function () {
        if (!config || busy) return;
        config[control.getAttribute('data-config')] = control.value;
        applyBodyTheme();
        markDirty();
      });
    });
  }

  function hydrateForm() {
    applyBodyTheme();

    Array.prototype.forEach.call(document.querySelectorAll('[data-content]'), function (input) {
      input.value = config.content[input.getAttribute('data-content')] || '';
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-config]'), function (control) {
      control.value = config[control.getAttribute('data-config')] || control.value;
    });

    updateOverview();
    saveButton.disabled = busy;
  }

  function renderUploadBlocks() {
    uploadBlocks.innerHTML = blocks.map(function (block, index) {
      var images = WeddingApp.imageList(config, block);
      var preview = images.map(function (image) {
        return (
          '<figure class="thumb">' +
            '<img src="' + esc(image.url) + '" alt="' + esc(image.alt || WeddingApp.blockAlt(block)) + '" loading="lazy" decoding="async">' +
            '<figcaption>' + esc(image.alt || image.name || WeddingApp.blockAlt(block)) + '</figcaption>' +
            '<button type="button" class="thumb-remove" aria-label="Xóa ảnh ' + esc(image.alt || image.name || WeddingApp.blockAlt(block)) + '" data-remove-block="' + block + '" data-remove-url="' + esc(image.url) + '">Xóa</button>' +
          '</figure>'
        );
      }).join('');

      return (
        '<article class="upload-card" data-block="' + block + '">' +
          '<div class="upload-card-head">' +
            '<div class="upload-card-heading">' +
              '<span class="upload-card-number" aria-hidden="true">0' + (index + 1) + '</span>' +
              '<div><h3>' + esc(WeddingApp.blockLabels[block]) + '</h3>' +
              '<p>' + images.length + ' ảnh đã thêm</p></div>' +
            '</div>' +
            '<label class="button button-secondary file-button">' +
              '<span><span aria-hidden="true">+</span> Thêm ảnh</span>' +
              '<input type="file" accept="image/*" multiple aria-label="Thêm ảnh vào ' + esc(WeddingApp.blockLabels[block]) + '" data-upload="' + block + '">' +
            '</label>' +
          '</div>' +
          '<div class="thumb-grid">' + (preview || '<div class="upload-empty"><span aria-hidden="true">✧</span><p>Chọn những bức ảnh yêu thích cho phần này.</p></div>') + '</div>' +
          '<p class="upload-description">' + esc(blockDescriptions[block]) + '</p>' +
        '</article>'
      );
    }).join('');

    bindUploadControls();
    updateOverview();
  }

  function bindUploadControls() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-upload]'), function (input) {
      input.addEventListener('change', function () {
        var block = input.getAttribute('data-upload');
        if (busy || !input.files || !input.files.length) {
          return;
        }

        setBusy(true);
        setStatus('Đang tải ảnh…', 'muted');
        saveIfDirty()
          .then(function () {
            setBusy(true);
            return WeddingApp.uploadImages(block, input.files);
          })
          .then(function (result) {
            config = result.config;
            dirty = false;
            hydrateForm();
            renderUploadBlocks();
            setStatus('Đã tải ảnh vào ' + WeddingApp.blockLabels[block], 'ok');
          })
          .catch(function (error) {
            setStatus(error.message, 'error');
          })
          .then(function () {
            input.value = '';
            setBusy(false);
          });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-remove-url]'), function (button) {
      button.addEventListener('click', function () {
        if (busy) return;
        var block = button.getAttribute('data-remove-block');
        var imageUrl = button.getAttribute('data-remove-url');
        setBusy(true);
        setStatus('Đang xóa ảnh', 'muted');

        saveIfDirty()
          .then(function () {
            setBusy(true);
            return WeddingApp.deleteImage(block, imageUrl);
          })
          .then(function (data) {
            config = data;
            dirty = false;
            hydrateForm();
            renderUploadBlocks();
            renderAdminWishes();
            setStatus('Đã xóa ảnh', 'ok');
            setBusy(false);
          })
          .catch(function (error) {
            setBusy(false);
            setStatus(error.message, 'error');
          });
      });
    });
  }

  function renderAdminWishes() {
    if (!adminWishList) {
      return;
    }

    if (!wishes.length) {
      adminWishList.innerHTML = '<div class="empty-admin-wishes"><span aria-hidden="true">♡</span><h3>Những lời thương đang đến</h3><p>Khi khách gửi lời chúc trên tấm thiệp, những lời nhắn thân thương sẽ xuất hiện ở đây.</p></div>';
      updateOverview();
      return;
    }

    adminWishList.innerHTML = wishes.map(function (wish) {
      return (
        '<article class="admin-wish-card">' +
          '<div>' +
            '<p>' + esc(wish.message) + '</p>' +
            '<footer>' +
              '<strong>' + esc(wish.name) + '</strong>' +
              '<span>' + esc(WeddingApp.formatWishDate(wish.createdAt)) + '</span>' +
            '</footer>' +
          '</div>' +
          '<button type="button" class="button button-secondary" aria-label="Xóa lời chúc của ' + esc(wish.name) + '" data-delete-wish="' + esc(wish.id) + '">Xóa</button>' +
        '</article>'
      );
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('[data-delete-wish]'), function (button) {
      button.addEventListener('click', function () {
        if (busy) return;
        setBusy(true);
        setStatus('Đang xóa lời chúc', 'muted');
        WeddingApp.deleteWish(button.getAttribute('data-delete-wish'))
          .then(function (data) {
            wishes = data;
            renderAdminWishes();
            setBusy(false);
            setStatus(dirty ? 'Đã xóa lời chúc · Chưa lưu nội dung' : 'Đã xóa lời chúc', dirty ? 'dirty' : 'ok');
          })
          .catch(function (error) {
            setBusy(false);
            setStatus(error.message, 'error');
          });
      });
    });
    updateOverview();
  }

  function saveIfDirty() {
    if (!dirty) {
      return Promise.resolve(config);
    }
    return saveCurrentConfig(true);
  }

  function saveCurrentConfig(keepBusy) {
    if (!config) {
      return Promise.reject(new Error('Chưa có dữ liệu cấu hình.'));
    }

    setBusy(true);
    setStatus('Đang lưu', 'muted');

    return WeddingApp.saveConfig(config)
      .then(function (saved) {
        config = saved;
        dirty = false;
        hydrateForm();
        renderUploadBlocks();
        renderAdminWishes();
        setStatus('Đã lưu thay đổi', 'ok');
        return saved;
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
        throw error;
      })
      .then(function (saved) {
        if (!keepBusy) setBusy(false);
        return saved;
      }, function (error) {
        setBusy(false);
        throw error;
      });
  }

  function markDirty() {
    dirty = true;
    setStatus('Chưa lưu thay đổi', 'dirty');
  }

  function setStatus(message, state) {
    statusNode.textContent = message;
    statusNode.setAttribute('data-state', state || 'muted');
  }

  function setBusy(value) {
    busy = value;
    saveButton.disabled = value || !config;
    Array.prototype.forEach.call(document.querySelectorAll('[data-content], [data-config], [data-upload], [data-remove-url], [data-delete-wish]'), function (control) {
      control.disabled = value || !config;
    });
    uploadBlocks.setAttribute('aria-busy', String(value));
    adminWishList.setAttribute('aria-busy', String(value));
  }

  function updateOverview() {
    if (!config) return;
    var couple = document.getElementById('admin-preview-couple');
    var date = document.getElementById('admin-preview-date');
    var imageCount = document.getElementById('admin-image-count');
    var wishCount = document.getElementById('admin-wish-count');
    var names = [config.content.brideName, config.content.groomName].filter(function (name) { return name; });
    if (couple) couple.textContent = names.length ? names.join(' & ') : 'Ngày chung đôi';
    if (date) date.textContent = WeddingApp.formatShortDate(config.content.date) || 'Cùng viết nên một khởi đầu đẹp';
    if (imageCount) imageCount.textContent = blocks.reduce(function (total, block) { return total + WeddingApp.imageList(config, block).length; }, 0);
    if (wishCount) wishCount.textContent = wishes.length;
  }

  function applyBodyTheme() {
    document.body.setAttribute('data-theme', config.theme || 'ivory');
  }

  function esc(value) {
    return WeddingApp.escapeHtml(value);
  }
})();
