'use strict';
/* 安全日报 PWA Service Worker
 * 缓存策略：
 *  - index.html：网络优先（保证始终拿到最新代码），离线时回退缓存
 *  - 图标/manifest：缓存优先（不变资源）
 *  - /api/* 云同步：始终走网络
 */
const CACHE_NAME = 'safety-report-v2';
const STATIC_ASSETS = [
  './',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

// 安装：预缓存固定资源（不含 index.html）
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 激活：清掉所有旧缓存，立即接管
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 请求拦截
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 云同步 API / 跨域：直接走网络
  if (url.pathname.startsWith('/api/') || e.request.mode === 'cors') {
    return;
  }
  // 主页 HTML：网络优先，保证永远拿到最新代码；离线时回退缓存
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  // 固定静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
