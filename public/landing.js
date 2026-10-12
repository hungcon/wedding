(function () {
  'use strict';

  var app = document.getElementById('landing-app');
  var countdownTimer = null;
  var navigationObserver = null;
  var currentConfig = null;
  var currentWishes = [];
  var configKey = '';
  var wishesKey = '';
  var refreshing = false;
  var submitting = false;
  var wishRevision = 0;
  var galleryIndex = 0;
  var galleryTrigger = null;
  var templates = {
    classic: ['story', 'ceremony', 'locations', 'gallery', 'wishes', 'rsvp'],
    editorial: ['gallery', 'story', 'ceremony', 'locations', 'wishes', 'rsvp'],
    minimal: ['ceremony', 'locations', 'story', 'gallery', 'wishes', 'rsvp']
  };
  var arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ornament = '<svg class="floral-mark" viewBox="0 0 100 64" fill="none" aria-hidden="true"><path d="M10 54C36 54 48 36 52 8M52 8c-16 3-21 12-17 21C46 27 52 19 52 8Zm-8 32c-17-6-26-3-29 7 13 5 23 3 29-7Zm3-8c15 2 26-4 28-16-15-2-25 4-28 16Zm-12 18c15 8 29 5 34-5-14-7-26-5-34 5Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';

  document.addEventListener('DOMContentLoaded', function () {
    refresh();
    window.addEventListener('focus', refresh);
    window.setInterval(function () { if (!document.hidden) refresh(); }, 7000);
  });

  function refresh() {
    if (refreshing || submitting) return;
    refreshing = true;
    var requestedRevision = wishRevision;
    Promise.all([WeddingApp.fetchConfig(), WeddingApp.fetchWishes()])
      .then(function (result) {
        if (submitting || requestedRevision !== wishRevision) return;
        var nextConfigKey = JSON.stringify(result[0]);
        var nextWishesKey = JSON.stringify(result[1]);
        var initial = !currentConfig;
        currentWishes = Array.isArray(result[1]) ? result[1] : [];
        var dialog = document.getElementById('gallery-dialog');
        if (configKey !== nextConfigKey && (!dialog || !dialog.open)) {
          currentConfig = result[0];
          configKey = nextConfigKey;
          render(initial);
        } else if (wishesKey !== nextWishesKey) {
          updateWishList();
        }
        wishesKey = nextWishesKey;
      })
      .catch(function (error) {
        if (!currentConfig) {
          app.className = 'error-state';
          app.innerHTML = '<main><p class="eyebrow">Thiệp cưới</p><h1>Chưa thể mở thiệp</h1><p>' + esc(error.message) + '</p><button class="button button-primary" id="retry-load" type="button">Thử lại</button></main>';
          document.getElementById('retry-load').addEventListener('click', refresh);
        }
      })
      .then(function () { refreshing = false; });
  }

  function render(initial) {
    var config = currentConfig;
    var content = config.content || {};
    var draft = captureDraft();
    document.title = coupleNames(content) + ' — Thiệp cưới';
    document.body.setAttribute('data-theme', config.theme);
    document.body.setAttribute('data-page', config.page);
    var sections = (templates[config.page] || templates.classic).map(function (section) {
      if (section === 'story') return renderStory(config);
      if (section === 'ceremony') return renderCeremony(config);
      if (section === 'gallery') return renderGallery(config);
      if (section === 'locations') return renderLocations(config);
      if (section === 'wishes') return renderWishes();
      return renderRsvp(config);
    }).join('');
    app.className = 'landing-shell page-' + config.page;
    app.innerHTML = renderNavigation(content) + '<main id="main-content" tabindex="-1">' + renderHero(config) + renderSaveDate(config) + sections + '</main>' + renderFooter(content) + renderGalleryDialog();
    startCountdown(config);
    bindWishForm();
    bindGallery();
    observeNavigation();
    restoreDraft(draft);
    if (initial) scrollToHash();
  }

  function renderNavigation(content) {
    var links = '<a href="#story">Chuyện chúng mình</a><a href="#ceremony">Lễ cưới</a>';
    if (content.brideFamilyAddress || content.groomFamilyAddress) links += '<a href="#locations">Địa điểm</a>';
    links += '<a href="#gallery">Album ảnh</a><a href="#wishes">Lời chúc</a>';
    return '<a class="skip-link" href="#main-content">Đến nội dung thiệp</a><nav class="landing-nav" aria-label="Điều hướng thiệp cưới"><a class="wedding-brand" href="#home" aria-label="Về đầu thiệp">' + monogram(content) + '</a><div class="nav-links">' + links + '</div><a class="nav-invitation" href="#rsvp">Thiệp mời ' + arrow + '</a></nav>';
  }

  function renderHero(config) {
    var content = config.content || {};
    var image = WeddingApp.lastImage(config, 'hero');
    var names = [content.brideName, content.groomName].filter(function (name) { return name && name.trim(); });
    var heading = names.length ? names.map(function (name) { return '<span class="couple-name">' + esc(name) + '</span>'; }).join('<span class="hero-ampersand">&amp;</span>') : '<span class="couple-name">Ngày chung đôi</span>';
    return '<header class="hero hero-' + config.heroLayout + (!image ? ' hero-no-image' : '') + '" id="home"><div class="hero-media">' + (image ? imageTag(image, 'Ảnh cưới', true) : '') + '</div><div class="hero-overlay" aria-hidden="true"></div><div class="hero-frame" aria-hidden="true"></div>' +
      '<div class="hero-content"><p class="eyebrow">Together is a beautiful place to be</p><p class="hero-intro">Chúng mình sắp kết hôn</p><h1>' + heading + '</h1><div class="hero-date">' + dottedDate(content.date) + '</div><p class="hero-invitation">' + esc(content.invitation) + '</p><a class="hero-button" href="#ceremony">Khám phá ngày vui ' + arrow + '</a></div>' +
      '<div class="hero-meta"><span>' + esc(content.time) + ' <i aria-hidden="true">·</i> ' + esc(content.venueName) + '</span><a href="#save-date">Cuộn để xem thiệp <span aria-hidden="true">↓</span></a></div></header>';
  }

  function renderSaveDate(config) {
    return '<section class="save-date-section" id="save-date" aria-labelledby="save-date-title"><div class="save-date-copy"><p class="eyebrow">Save the date</p><h2 id="save-date-title">Đếm ngược đến ngày chung đôi</h2><p>' + esc(WeddingApp.formatDate(config.content.date)) + '</p></div><div class="countdown" data-countdown role="timer" aria-label="Thời gian còn lại đến lễ cưới" aria-live="off">' + countdownItem('Ngày', 'days') + countdownItem('Giờ', 'hours') + countdownItem('Phút', 'minutes') + countdownItem('Giây', 'seconds') + '</div></section>';
  }

  function countdownItem(label, key) {
    return '<div class="countdown-item"><strong data-countdown-value="' + key + '">00</strong><span>' + label + '</span></div>';
  }

  function renderStory(config) {
    var content = config.content || {};
    var images = WeddingApp.imageList(config, 'story').slice(-3);
    return '<section class="section story-section story-' + config.storyLayout + (!images.length ? ' is-text-only' : '') + '" id="story" aria-labelledby="story-title"><div class="section-copy">' + ornament + '<p class="eyebrow">01 / Chuyện chúng mình</p><h2 id="story-title">' + esc(content.storyTitle || 'Chuyện chúng mình') + '</h2><div class="small-rule" aria-hidden="true"></div><p class="story-text">' + esc(content.storyText) + '</p><p class="story-signature">' + esc(coupleNames(content)) + '</p></div>' +
      (images.length ? '<div class="story-images">' + images.map(function (image) { return imageTag(image, WeddingApp.blockAlt('story')); }).join('') + '<span class="photo-note">Một hành trình, hai trái tim.</span></div>' : '') + '</section>';
  }

  function renderCeremony(config) {
    var content = config.content || {};
    var image = WeddingApp.lastImage(config, 'ceremony');
    return '<section class="section ceremony-section ceremony-layout-' + config.ceremonyLayout + (!image ? ' is-text-only' : '') + '" id="ceremony" aria-labelledby="ceremony-title">' + (image ? '<div class="ceremony-media">' + imageTag(image, WeddingApp.blockAlt('ceremony')) + '<span class="photo-note">Nơi ngày vui bắt đầu</span></div>' : '') +
      '<div class="ceremony-card"><p class="eyebrow">02 / ' + esc(content.ceremonyTitle || 'Lễ cưới') + '</p>' + ornament + '<h2 id="ceremony-title">' + esc(content.venueName || content.ceremonyTitle || 'Ngày chung đôi') + '</h2><div class="ceremony-date">' + dottedDate(content.date) + '</div><dl><div><dt>Thời gian đón khách</dt><dd>' + esc(content.time) + ' <span>— ' + esc(WeddingApp.formatDate(content.date)) + '</span></dd></div><div><dt>Địa điểm tổ chức</dt><dd>' + esc(content.venueAddress) + '</dd></div></dl><p class="ceremony-note">' + esc(content.ceremonyNote) + '</p>' + (content.venueAddress ? '<a class="button button-primary" href="' + esc(googleMapOpen(content.venueAddress)) + '" target="_blank" rel="noopener noreferrer">Chỉ đường đến lễ cưới ' + arrow + '</a>' : '') + '</div></section>';
  }

  function renderGallery(config) {
    var images = WeddingApp.imageList(config, 'gallery');
    var items = images.map(function (image, index) {
      return '<figure class="' + (index % 5 === 0 ? 'is-large' : '') + '"><button type="button" class="gallery-photo" data-gallery-index="' + index + '" aria-label="Xem ảnh ' + (index + 1) + ': ' + esc(image.alt || WeddingApp.blockAlt('gallery')) + '">' + imageTag(image, WeddingApp.blockAlt('gallery')) + '<span class="gallery-photo-hint" aria-hidden="true">Xem khoảnh khắc ' + arrow + '</span></button></figure>';
    }).join('');
    return '<section class="section gallery-section" id="gallery" aria-labelledby="gallery-title"><div class="section-heading"><div><p class="eyebrow">03 / Album ảnh</p><h2 id="gallery-title">Những khoảnh khắc<br>thành kỷ niệm</h2></div><p>Một chút yêu thương, một chút bình yên.<br>Và thật nhiều những ngày có nhau.</p></div>' + (images.length ? '<div class="gallery gallery-' + config.galleryLayout + '">' + items + '</div><p class="gallery-note">Chạm vào ảnh để xem trọn khoảnh khắc <span aria-hidden="true">↗</span></p>' : '<div class="gallery-empty">' + ornament + '<p>Những khoảnh khắc của chúng mình sẽ sớm được chia sẻ tại đây.</p></div>') + '</section>';
  }

  function renderLocations(config) {
    var content = config.content || {};
    var locations = [{ label: 'Nhà gái', title: content.brideFamilyName, address: content.brideFamilyAddress }, { label: 'Nhà trai', title: content.groomFamilyName, address: content.groomFamilyAddress }];
    var cards = locations.filter(function (location) { return location.address; }).map(function (location) {
      return '<article class="map-card"><div class="map-copy"><p class="eyebrow">' + esc(location.label) + '</p><h3>' + esc(location.title || location.label) + '</h3><p>' + esc(location.address) + '</p><a class="map-link" href="' + esc(googleMapOpen(location.address)) + '" target="_blank" rel="noopener noreferrer">Xem chỉ đường ' + arrow + '</a></div><iframe title="Bản đồ ' + esc(location.title || location.label) + '" src="https://maps.google.com/maps?q=' + encodeURIComponent(location.address) + '&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></article>';
    }).join('');
    if (!cards) return '';
    return '<section class="section locations-section" id="locations" aria-labelledby="locations-title"><div class="section-heading"><div><p class="eyebrow">04 / Địa điểm</p><h2 id="locations-title">Cùng tìm đường<br>đến ngày vui</h2></div><p>Hai gia đình, một niềm hạnh phúc.<br>Rất mong được đón tiếp bạn.</p></div><div class="map-grid">' + cards + '</div></section>';
  }

  function wishItems() {
    var list = currentWishes.slice(0, 12).map(function (wish) {
      return '<article class="wish-card"><span class="wish-quote" aria-hidden="true">“</span><p>' + esc(wish.message) + '</p><footer><strong>' + esc(wish.name) + '</strong><time datetime="' + esc(wish.createdAt) + '">' + esc(WeddingApp.formatWishDate(wish.createdAt)) + '</time></footer></article>';
    }).join('');
    return list || '<div class="empty-wishes">' + ornament + '<h3>Một lời chúc, ngàn yêu thương</h3><p>Hãy là người đầu tiên gửi lời chúc đến chúng mình nhé.</p></div>';
  }

  function renderWishes() {
    return '<section class="section wishes-section" id="wishes" aria-labelledby="wishes-title"><div class="wish-form-panel"><p class="eyebrow">05 / Sổ lưu bút</p><h2 id="wishes-title">Gửi một chút<br>yêu thương</h2><p>Những lời chúc của bạn là món quà ý nghĩa trong ngày vui của chúng mình.</p><form class="wish-form" id="wish-form"><label><span>Tên của bạn</span><input type="text" name="name" placeholder="Để chúng mình biết bạn là ai" autocomplete="name" maxlength="80" required></label><label><span>Lời chúc của bạn</span><textarea name="message" placeholder="Viết đôi lời yêu thương…" rows="4" maxlength="600" required></textarea></label><div class="wish-form-actions"><button class="button button-primary" type="submit">Gửi lời chúc ' + arrow + '</button><span id="wish-status" class="wish-status" role="status" aria-live="polite"></span></div></form></div><div class="wish-list" id="wish-list">' + wishItems() + '</div></section>';
  }

  function renderRsvp(config) {
    var content = config.content || {};
    return '<section class="rsvp-section" id="rsvp" aria-labelledby="rsvp-title"><div class="rsvp-inner">' + ornament + '<p class="eyebrow">Trân trọng kính mời</p><h2 id="rsvp-title">Ngày vui sẽ trọn vẹn hơn<br>khi có bạn</h2><p>' + esc(content.invitation) + '</p><div class="rsvp-line"><span>' + esc(coupleNames(content)) + '</span><span>' + dottedDate(content.date) + '</span></div><a class="rsvp-link" href="#ceremony">Hẹn gặp bạn tại lễ cưới ' + arrow + '</a></div></section>';
  }

  function renderFooter(content) {
    return '<footer class="wedding-footer"><a class="wedding-brand" href="#home" aria-label="Về đầu thiệp">' + monogram(content) + '</a><p>With love, ' + esc(coupleNames(content)) + '</p><a href="#home">Về đầu trang <span aria-hidden="true">↑</span></a></footer>';
  }

  function renderGalleryDialog() {
    return '<dialog class="gallery-dialog" id="gallery-dialog" aria-labelledby="gallery-caption"><button class="gallery-close" id="gallery-close" type="button" aria-label="Đóng ảnh">×</button><button class="gallery-prev" id="gallery-prev" type="button" aria-label="Ảnh trước">‹</button><figure><img id="gallery-full-image" alt=""><figcaption id="gallery-caption" aria-live="polite"></figcaption></figure><button class="gallery-next" id="gallery-next" type="button" aria-label="Ảnh tiếp theo">›</button></dialog>';
  }

  function bindGallery() {
    var dialog = document.getElementById('gallery-dialog');
    Array.prototype.forEach.call(document.querySelectorAll('[data-gallery-index]'), function (button) {
      button.addEventListener('click', function () {
        galleryIndex = Number(button.getAttribute('data-gallery-index'));
        galleryTrigger = button;
        updateGalleryImage();
        dialog.showModal();
        document.body.classList.add('gallery-is-open');
        document.getElementById('gallery-close').focus();
      });
    });
    document.getElementById('gallery-close').addEventListener('click', function () { dialog.close(); });
    document.getElementById('gallery-prev').addEventListener('click', function () { moveGallery(-1); });
    document.getElementById('gallery-next').addEventListener('click', function () { moveGallery(1); });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveGallery(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
      document.body.classList.remove('gallery-is-open');
      if (galleryTrigger && document.contains(galleryTrigger)) galleryTrigger.focus({ preventScroll: true });
    });
  }

  function moveGallery(direction) {
    var count = WeddingApp.imageList(currentConfig, 'gallery').length;
    if (!count) return;
    galleryIndex = (galleryIndex + direction + count) % count;
    updateGalleryImage();
  }

  function updateGalleryImage() {
    var images = WeddingApp.imageList(currentConfig, 'gallery');
    var image = images[galleryIndex];
    if (!image) return;
    var node = document.getElementById('gallery-full-image');
    node.src = image.url;
    node.alt = image.alt || WeddingApp.blockAlt('gallery');
    document.getElementById('gallery-caption').textContent = (galleryIndex + 1) + ' / ' + images.length + ' — ' + node.alt;
    document.getElementById('gallery-prev').hidden = images.length < 2;
    document.getElementById('gallery-next').hidden = images.length < 2;
  }

  function observeNavigation() {
    if (navigationObserver) navigationObserver.disconnect();
    if (!window.IntersectionObserver) return;
    navigationObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(document.querySelectorAll('.nav-links a'), function (link) {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    Array.prototype.forEach.call(document.querySelectorAll('main section[id]'), function (section) { navigationObserver.observe(section); });
  }

  function startCountdown(config) {
    var target = WeddingApp.formatDateTime(config.content.date, config.content.time);
    if (countdownTimer) window.clearInterval(countdownTimer);
    updateCountdown(target);
    if (target && target.getTime() > Date.now()) countdownTimer = window.setInterval(function () { updateCountdown(target); }, 1000);
  }

  function updateCountdown(target) {
    var countdown = document.querySelector('[data-countdown]');
    if (!countdown) return;
    var diff = target ? target.getTime() - Date.now() : 0;
    if (!target || diff <= 0) {
      countdown.className = 'countdown countdown-done';
      countdown.innerHTML = '<div class="countdown-message">' + (target ? 'Ngày hạnh phúc đã đến' : 'Hẹn bạn trong ngày vui') + '</div>';
      if (countdownTimer) window.clearInterval(countdownTimer);
      return;
    }
    var total = Math.floor(diff / 1000);
    setCountdownValue('days', Math.floor(total / 86400));
    setCountdownValue('hours', Math.floor((total % 86400) / 3600));
    setCountdownValue('minutes', Math.floor((total % 3600) / 60));
    setCountdownValue('seconds', total % 60);
  }

  function setCountdownValue(key, value) {
    var node = document.querySelector('[data-countdown-value="' + key + '"]');
    if (node) node.textContent = value < 10 ? '0' + value : String(value);
  }

  function bindWishForm() {
    var form = document.getElementById('wish-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submitting) return;
      submitting = true;
      wishRevision += 1;
      var status = document.getElementById('wish-status');
      var button = form.querySelector('button[type="submit"]');
      status.textContent = 'Đang gửi lời chúc…';
      status.setAttribute('data-state', 'muted');
      form.setAttribute('aria-busy', 'true');
      button.disabled = true;
      form.elements.name.disabled = true;
      form.elements.message.disabled = true;
      WeddingApp.submitWish(form.elements.name.value, form.elements.message.value)
        .then(function (result) {
          currentWishes = result.wishes;
          wishesKey = JSON.stringify(currentWishes);
          updateWishList();
          status.textContent = 'Cảm ơn bạn! Lời chúc đã được gửi.';
          status.setAttribute('data-state', 'ok');
          form.reset();
        })
        .catch(function (error) {
          status.textContent = error.message;
          status.setAttribute('data-state', 'error');
        })
        .then(function () {
          submitting = false;
          form.removeAttribute('aria-busy');
          button.disabled = false;
          form.elements.name.disabled = false;
          form.elements.message.disabled = false;
        });
    });
  }

  function updateWishList() {
    var list = document.getElementById('wish-list');
    if (list) list.innerHTML = wishItems();
  }

  function captureDraft() {
    var form = document.getElementById('wish-form');
    if (!form) return null;
    var active = document.activeElement;
    var status = document.getElementById('wish-status');
    return { name: form.elements.name.value, message: form.elements.message.value, field: form.contains(active) ? active.name : '', submitFocused: form.contains(active) && active.type === 'submit', focusId: active.id, focusHref: active.getAttribute('href'), focusImage: active.getAttribute('data-gallery-index'), start: active.selectionStart, end: active.selectionEnd, scroll: window.scrollY, status: status.textContent, state: status.getAttribute('data-state') };
  }

  function restoreDraft(draft) {
    if (!draft) return;
    var form = document.getElementById('wish-form');
    form.elements.name.value = draft.name;
    form.elements.message.value = draft.message;
    var status = document.getElementById('wish-status');
    status.textContent = draft.status;
    if (draft.state) status.setAttribute('data-state', draft.state);
    if (draft.field && form.elements[draft.field]) {
      form.elements[draft.field].focus({ preventScroll: true });
      form.elements[draft.field].setSelectionRange(draft.start, draft.end);
    } else {
      var focusTarget = draft.submitFocused ? form.querySelector('button[type="submit"]') : document.getElementById(draft.focusId);
      if (!focusTarget && draft.focusHref) {
        focusTarget = Array.prototype.filter.call(document.querySelectorAll('a[href]'), function (link) { return link.getAttribute('href') === draft.focusHref; })[0];
      }
      if (!focusTarget && draft.focusImage !== null) {
        focusTarget = document.querySelector('[data-gallery-index="' + Number(draft.focusImage) + '"]');
      }
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
    window.scrollTo({ top: draft.scroll, behavior: 'instant' });
  }

  function imageTag(image, fallback, eager) {
    return '<img src="' + esc(image.url) + '" alt="' + esc(image.alt || fallback) + '" decoding="async"' + (eager ? ' fetchpriority="high"' : ' loading="lazy"') + '>';
  }

  function monogram(content) {
    return esc((content.brideName || '').trim().charAt(0)) + '<span>&amp;</span>' + esc((content.groomName || '').trim().charAt(0));
  }

  function coupleNames(content) {
    return [content.brideName, content.groomName].filter(function (name) { return name && name.trim(); }).join(' & ') || 'Ngày chung đôi';
  }

  function dottedDate(value) { return esc(WeddingApp.formatShortDate(value).replace(/\//g, ' . ')); }
  function googleMapOpen(address) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address); }
  function scrollToHash() {
    if (!window.location.hash) return;
    window.setTimeout(function () {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }, 50);
  }
  function esc(value) { return WeddingApp.escapeHtml(value); }
})();
