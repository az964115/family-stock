// sw.js - 背景監聽推播
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : { title: '豬豬e網', body: '今日損益已更新！' };
  
  const options = {
    body: data.body,
    icon: 'icon.png', // 您的豬豬圖示
    badge: 'icon.png',
    vibrate: [100, 50, 100],
    data: { url: './' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 點擊通知時打開網頁
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});