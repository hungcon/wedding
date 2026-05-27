(function () {
  'use strict';

  var app = document.getElementById('landing-app');
  var currentStateKey = '';
  var currentConfig = null;
  var currentWishes = [];
  var countdownTimer = null;
  var templates = {
    classic: ['story', 'ceremony', 'locations', 'gallery', 'wishes', 'rsvp'],
    editorial: ['gallery', 'story', 'ceremony', 'locations', 'wishes', 'rsvp'],
    minimal: ['ceremony', 'locations', 'story', 'gallery', 'wishes', 'rsvp']
  };

  document.addEventListener('DOMContentLoaded', function () {
    refresh(true);
    window.addEventListener('focus', function () {
      refresh(false);
    });
    window.setInterval(function () {
      if (!document.hidden) {
        refresh(false);
      }
    }, 7000);
  });

  function refresh(force) {
    Promise.all([WeddingApp.fetchConfig(), WeddingApp.fetchWishes()])
      .then(function (result) {
        var config = result[0];
        var wishes = result[1];
        var stateKey = [
          config.updatedAt || '',
          wishes.length,
          wishes.length ? wishes[0].id : ''
        ].join(':');

        if (!force && currentStateKey === stateKey) {
          return;
        }
        currentStateKey = stateKey;
        render(config, wishes);
      })
      .catch(function (error) {
        app.innerHTML = '<main class="error-state"><p>' + WeddingApp.escapeHtml(error.message) + '</p></main>';
      });
  }

  function render(config, wishes) {
    var content = config.content || {};
    currentConfig = config;
    currentWishes = Array.isArray(wishes) ? wishes : [];
    document.title = content.brideName + ' & ' + content.groomName + ' - Thiệp cưới';
    document.body.setAttribute('data-theme', config.theme);
    document.body.setAttribute('data-page', config.page);
    document.body.setAttribute('data-gallery-layout', config.galleryLayout);

    var order = templates[config.page] || templates.classic;
    var sections = order.map(function (section) {
      if (section === 'story') return renderStory(config);
      if (section === 'ceremony') return renderCeremony(config);
      if (section === 'gallery') return renderGallery(config);
      if (section === 'locations') return renderLocations(config);
      if (section === 'wishes') return renderWishes(currentWishes);
      return renderRsvp(config);
    }).join('');

    app.className = 'landing-shell page-' + config.page;
    app.innerHTML =
      renderHero(config) +
      '<nav class="landing-nav" aria-label="Điều hướng">' +
      '<a href="#story">Câu chuyện</a>' +
      '<a href="#ceremony">Lễ cưới</a>' +
      '<a href="#locations">Địa chỉ</a>' +
      '<a href="#gallery">Ảnh</a>' +
      '<a href="#wishes">Lời chúc</a>' +
      '<a href="#rsvp">Lời mời</a>' +
      '</nav>' +
      sections;

    startCountdown(config);
    bindWishForm();
    scrollToHash();
  }

  function renderHero(config) {
    var content = config.content || {};
    var heroImage = WeddingApp.lastImage(config, 'hero');
    var heroClass = 'hero hero-' + config.heroLayout;
    var imageMarkup = heroImage
      ? '<img src="' + escAttr(heroImage.url) + '" alt="' + escAttr(heroImage.alt || 'Ảnh cưới') + '">'
      : '';

    return (
      '<header class="' + heroClass + '">' +
        '<div class="hero-media">' + imageMarkup + '</div>' +
        '<div class="hero-overlay" aria-hidden="true"></div>' +
        '<div class="hero-content">' +
          '<p class="eyebrow">Save the date</p>' +
          '<h1>' + WeddingApp.escapeHtml(content.brideName) + '<span>&</span>' + WeddingApp.escapeHtml(content.groomName) + '</h1>' +
          '<div class="hero-date">' + WeddingApp.escapeHtml(WeddingApp.formatDate(content.date)) + '</div>' +
          '<p>' + WeddingApp.escapeHtml(content.invitation) + '</p>' +
          renderCountdown() +
        '</div>' +
        '<div class="hero-meta">' +
          '<span>' + WeddingApp.escapeHtml(content.time || '') + '</span>' +
          '<span>' + WeddingApp.escapeHtml(content.venueName || '') + '</span>' +
        '</div>' +
      '</header>'
    );
  }

  function renderCountdown() {
    return (
      '<div class="countdown" data-countdown aria-live="polite">' +
        countdownItem('Ngày', 'days') +
        countdownItem('Giờ', 'hours') +
        countdownItem('Phút', 'minutes') +
        countdownItem('Giây', 'seconds') +
      '</div>'
    );
  }

  function countdownItem(label, key) {
    return (
      '<div class="countdown-item">' +
        '<strong data-countdown-value="' + key + '">00</strong>' +
        '<span>' + label + '</span>' +
      '</div>'
    );
  }

  function renderStory(config) {
    var content = config.content || {};
    var images = WeddingApp.imageList(config, 'story');
    var imageMarkup = images.slice(-3).map(function (image) {
      return '<img src="' + escAttr(image.url) + '" alt="' + escAttr(image.alt || WeddingApp.blockAlt('story')) + '">';
    }).join('');

    return (
      '<section class="section story-section story-' + config.storyLayout + '" id="story">' +
        '<div class="section-copy">' +
          '<p class="eyebrow">Câu chuyện</p>' +
          '<h2>' + WeddingApp.escapeHtml(content.storyTitle) + '</h2>' +
          '<p>' + WeddingApp.escapeHtml(content.storyText) + '</p>' +
        '</div>' +
        '<div class="story-images">' + imageMarkup + '</div>' +
      '</section>'
    );
  }

  function renderCeremony(config) {
    var content = config.content || {};
    var image = WeddingApp.lastImage(config, 'ceremony');
    var imageMarkup = image
      ? '<img src="' + escAttr(image.url) + '" alt="' + escAttr(image.alt || WeddingApp.blockAlt('ceremony')) + '">'
      : '';

    return (
      '<section class="section ceremony-section ceremony-' + config.ceremonyLayout + '" id="ceremony">' +
        '<div class="ceremony-media">' + imageMarkup + '</div>' +
        '<div class="ceremony-card">' +
          '<p class="eyebrow">' + WeddingApp.escapeHtml(content.ceremonyTitle) + '</p>' +
          '<h2>' + WeddingApp.escapeHtml(content.venueName) + '</h2>' +
          '<dl>' +
            '<div><dt>Thời gian</dt><dd>' + WeddingApp.escapeHtml(content.time) + ', ' + WeddingApp.escapeHtml(WeddingApp.formatShortDate(content.date)) + '</dd></div>' +
            '<div><dt>Địa điểm</dt><dd>' + WeddingApp.escapeHtml(content.venueAddress) + '</dd></div>' +
          '</dl>' +
          '<p>' + WeddingApp.escapeHtml(content.ceremonyNote) + '</p>' +
        '</div>' +
      '</section>'
    );
  }

  function renderGallery(config) {
    var images = WeddingApp.imageList(config, 'gallery');
    var items = images.map(function (image, index) {
      var sizeClass = index % 5 === 0 ? 'is-large' : '';
      return (
        '<figure class="' + sizeClass + '">' +
          '<img src="' + escAttr(image.url) + '" alt="' + escAttr(image.alt || WeddingApp.blockAlt('gallery')) + '">' +
        '</figure>'
      );
    }).join('');

    return (
      '<section class="section gallery-section" id="gallery">' +
        '<div class="section-heading">' +
          '<p class="eyebrow">Khoảnh khắc</p>' +
          '<h2>Những hình ảnh được lưu&nbsp;giữ</h2>' +
        '</div>' +
        '<div class="gallery gallery-' + config.galleryLayout + '">' + items + '</div>' +
      '</section>'
    );
  }

  function renderLocations(config) {
    var content = config.content || {};
    var locations = [
      {
        eyebrow: 'Nhà gái',
        title: content.brideFamilyName,
        address: content.brideFamilyAddress
      },
      {
        eyebrow: 'Nhà trai',
        title: content.groomFamilyName,
        address: content.groomFamilyAddress
      }
    ];

    var cards = locations.map(function (location) {
      if (!location.address) {
        return '';
      }

      var mapUrl = googleMapEmbed(location.address);
      var openUrl = googleMapOpen(location.address);
      return (
        '<article class="map-card">' +
          '<div class="map-copy">' +
            '<p class="eyebrow">' + WeddingApp.escapeHtml(location.eyebrow) + '</p>' +
            '<h3>' + WeddingApp.escapeHtml(location.title || location.eyebrow) + '</h3>' +
            '<p>' + WeddingApp.escapeHtml(location.address) + '</p>' +
            '<a class="map-link" href="' + escAttr(openUrl) + '" target="_blank" rel="noreferrer">Mở Google Maps</a>' +
          '</div>' +
          '<iframe title="' + escAttr(location.title || location.eyebrow) + '" src="' + escAttr(mapUrl) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' +
        '</article>'
      );
    }).join('');

    return (
      '<section class="section locations-section" id="locations">' +
        '<div class="section-heading">' +
          '<p class="eyebrow">Địa chỉ hai bên</p>' +
          '<h2>Google Map nhà trai và nhà&nbsp;gái</h2>' +
        '</div>' +
        '<div class="map-grid">' + cards + '</div>' +
      '</section>'
    );
  }

  function renderWishes(wishes) {
    var list = wishes.slice(0, 12).map(function (wish) {
      return (
        '<article class="wish-card">' +
          '<p>' + WeddingApp.escapeHtml(wish.message) + '</p>' +
          '<footer>' +
            '<strong>' + WeddingApp.escapeHtml(wish.name) + '</strong>' +
            '<span>' + WeddingApp.escapeHtml(WeddingApp.formatWishDate(wish.createdAt)) + '</span>' +
          '</footer>' +
        '</article>'
      );
    }).join('');

    if (!list) {
      list = '<p class="empty-wishes">Hãy là người đầu tiên gửi lời chúc đến cô dâu chú rể.</p>';
    }

    return (
      '<section class="section wishes-section" id="wishes">' +
        '<div class="wish-form-panel">' +
          '<div>' +
            '<p class="eyebrow">Lời chúc</p>' +
            '<h2>Gửi lời chúc đến cô dâu chú rể</h2>' +
          '</div>' +
          '<form class="wish-form" id="wish-form">' +
            '<label><span>Tên của bạn</span><input type="text" name="name" maxlength="80" required></label>' +
            '<label><span>Lời chúc</span><textarea name="message" rows="4" maxlength="600" required></textarea></label>' +
            '<div class="wish-form-actions">' +
              '<span id="wish-status" class="wish-status"></span>' +
              '<button class="button button-primary" type="submit">Gửi lời chúc</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div class="wish-list" id="wish-list">' + list + '</div>' +
      '</section>'
    );
  }

  function renderRsvp(config) {
    var content = config.content || {};
    return (
      '<section class="section rsvp-section" id="rsvp">' +
        '<p class="eyebrow">Trân trọng kính mời</p>' +
        '<h2>Hẹn gặp bạn trong ngày vui của chúng mình</h2>' +
        '<p>' + WeddingApp.escapeHtml(content.invitation) + '</p>' +
        '<div class="rsvp-line">' +
          '<span>' + WeddingApp.escapeHtml(content.brideName) + ' & ' + WeddingApp.escapeHtml(content.groomName) + '</span>' +
          '<span>' + WeddingApp.escapeHtml(WeddingApp.formatShortDate(content.date)) + '</span>' +
        '</div>' +
      '</section>'
    );
  }

  function startCountdown(config) {
    var target = WeddingApp.formatDateTime(config.content.date, config.content.time);
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
    }

    updateCountdown(target);
    countdownTimer = window.setInterval(function () {
      updateCountdown(target);
    }, 1000);
  }

  function updateCountdown(target) {
    var countdown = document.querySelector('[data-countdown]');
    if (!countdown || !target) {
      return;
    }

    var diff = target.getTime() - Date.now();
    if (diff <= 0) {
      countdown.className = 'countdown countdown-done';
      countdown.innerHTML = '<div class="countdown-message">Đã đến ngày vui</div>';
      return;
    }

    var totalSeconds = Math.floor(diff / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    setCountdownValue('days', days);
    setCountdownValue('hours', hours);
    setCountdownValue('minutes', minutes);
    setCountdownValue('seconds', seconds);
  }

  function setCountdownValue(key, value) {
    var node = document.querySelector('[data-countdown-value="' + key + '"]');
    if (!node) {
      return;
    }
    var next = pad(value);
    if (node.textContent !== next) {
      node.textContent = next;
      node.classList.remove('is-ticking');
      void node.offsetWidth;
      node.classList.add('is-ticking');
    }
  }

  function bindWishForm() {
    var form = document.getElementById('wish-form');
    if (!form) {
      return;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = document.getElementById('wish-status');
      var button = form.querySelector('button[type="submit"]');
      var name = form.elements.name.value;
      var message = form.elements.message.value;

      status.textContent = 'Đang gửi';
      status.setAttribute('data-state', 'muted');
      button.disabled = true;

      WeddingApp.submitWish(name, message)
        .then(function (result) {
          currentWishes = result.wishes;
          status.textContent = 'Đã gửi lời chúc';
          status.setAttribute('data-state', 'ok');
          form.reset();
          render(currentConfig, currentWishes);
        })
        .catch(function (error) {
          status.textContent = error.message;
          status.setAttribute('data-state', 'error');
        })
        .then(function () {
          button.disabled = false;
        });
    });
  }

  function googleMapEmbed(address) {
    return 'https://maps.google.com/maps?q=' + encodeURIComponent(address) + '&output=embed';
  }

  function googleMapOpen(address) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function scrollToHash() {
    if (!window.location.hash) {
      return;
    }

    window.setTimeout(function () {
      var target = null;
      try {
        target = document.querySelector(window.location.hash);
      } catch (error) {
        target = null;
      }
      if (target) {
        target.scrollIntoView({ block: 'start' });
      }
    }, 50);
  }

  function escAttr(value) {
    return WeddingApp.escapeHtml(value);
  }
})();
