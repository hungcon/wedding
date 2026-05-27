(function () {
  'use strict';

  var config = null;
  var wishes = [];
  var dirty = false;
  var statusNode = document.getElementById('save-status');
  var saveButton = document.getElementById('save-config');
  var uploadBlocks = document.getElementById('upload-blocks');
  var adminWishList = document.getElementById('admin-wish-list');
  var blocks = ['hero', 'story', 'ceremony', 'gallery'];

  document.addEventListener('DOMContentLoaded', function () {
    bindStaticControls();
    loadConfig();
  });

  function loadConfig() {
    setStatus('Đang tải', 'muted');
    Promise.all([WeddingApp.fetchConfig(), WeddingApp.fetchWishes()])
      .then(function (result) {
        config = result[0];
        wishes = result[1];
        dirty = false;
        hydrateForm();
        renderUploadBlocks();
        renderAdminWishes();
        setStatus('Đã đồng bộ', 'ok');
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
      });
  }

  function bindStaticControls() {
    saveButton.addEventListener('click', function () {
      saveCurrentConfig();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-content]'), function (input) {
      input.addEventListener('input', function () {
        if (!config) return;
        config.content[input.getAttribute('data-content')] = input.value;
        markDirty();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-config]'), function (control) {
      control.addEventListener('change', function () {
        if (!config) return;
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

    saveButton.disabled = false;
  }

  function renderUploadBlocks() {
    uploadBlocks.innerHTML = blocks.map(function (block) {
      var images = WeddingApp.imageList(config, block);
      var preview = images.map(function (image) {
        return (
          '<figure class="thumb">' +
            '<img src="' + esc(image.url) + '" alt="' + esc(image.alt || WeddingApp.blockAlt(block)) + '">' +
            '<figcaption>' + esc(image.alt || image.name || WeddingApp.blockAlt(block)) + '</figcaption>' +
            '<button type="button" class="thumb-remove" data-remove-block="' + block + '" data-remove-url="' + esc(image.url) + '">Xóa</button>' +
          '</figure>'
        );
      }).join('');

      return (
        '<article class="upload-card" data-block="' + block + '">' +
          '<div class="upload-card-head">' +
            '<div>' +
              '<h3>' + esc(WeddingApp.blockLabels[block]) + '</h3>' +
              '<p>' + images.length + ' ảnh</p>' +
            '</div>' +
            '<label class="button button-secondary file-button">' +
              '<span>Tải ảnh</span>' +
              '<input type="file" accept="image/*" multiple data-upload="' + block + '">' +
            '</label>' +
          '</div>' +
          '<div class="thumb-grid">' + preview + '</div>' +
        '</article>'
      );
    }).join('');

    bindUploadControls();
  }

  function bindUploadControls() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-upload]'), function (input) {
      input.addEventListener('change', function () {
        var block = input.getAttribute('data-upload');
        if (!input.files || !input.files.length) {
          return;
        }

        setStatus('Đang tải ảnh', 'muted');
        saveIfDirty()
          .then(function () {
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
          });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-remove-url]'), function (button) {
      button.addEventListener('click', function () {
        var block = button.getAttribute('data-remove-block');
        var imageUrl = button.getAttribute('data-remove-url');
        button.disabled = true;
        setStatus('Đang xóa ảnh', 'muted');

        saveIfDirty()
          .then(function () {
            return WeddingApp.deleteImage(block, imageUrl);
          })
          .then(function (data) {
            config = data;
            dirty = false;
            hydrateForm();
            renderUploadBlocks();
            renderAdminWishes();
            setStatus('Đã xóa ảnh', 'ok');
          })
          .catch(function (error) {
            button.disabled = false;
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
      adminWishList.innerHTML = '<p class="empty-admin-wishes">Chưa có lời chúc nào.</p>';
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
          '<button type="button" class="button button-secondary" data-delete-wish="' + esc(wish.id) + '">Xóa</button>' +
        '</article>'
      );
    }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('[data-delete-wish]'), function (button) {
      button.addEventListener('click', function () {
        button.disabled = true;
        setStatus('Đang xóa lời chúc', 'muted');
        WeddingApp.deleteWish(button.getAttribute('data-delete-wish'))
          .then(function (data) {
            wishes = data;
            renderAdminWishes();
            setStatus('Đã xóa lời chúc', 'ok');
          })
          .catch(function (error) {
            button.disabled = false;
            setStatus(error.message, 'error');
          });
      });
    });
  }

  function saveIfDirty() {
    if (!dirty) {
      return Promise.resolve(config);
    }
    return saveCurrentConfig();
  }

  function saveCurrentConfig() {
    if (!config) {
      return Promise.reject(new Error('Chưa có dữ liệu cấu hình.'));
    }

    saveButton.disabled = true;
    setStatus('Đang lưu', 'muted');

    return WeddingApp.saveConfig(config)
      .then(function (saved) {
        config = saved;
        dirty = false;
        hydrateForm();
        renderUploadBlocks();
        renderAdminWishes();
        setStatus('Đã áp dụng', 'ok');
        return saved;
      })
      .catch(function (error) {
        setStatus(error.message, 'error');
        throw error;
      })
      .then(function (saved) {
        saveButton.disabled = false;
        return saved;
      }, function (error) {
        saveButton.disabled = false;
        throw error;
      });
  }

  function markDirty() {
    dirty = true;
    setStatus('Chưa áp dụng', 'dirty');
  }

  function setStatus(message, state) {
    statusNode.textContent = message;
    statusNode.setAttribute('data-state', state || 'muted');
  }

  function applyBodyTheme() {
    document.body.setAttribute('data-theme', config.theme || 'ivory');
  }

  function esc(value) {
    return WeddingApp.escapeHtml(value);
  }
})();
