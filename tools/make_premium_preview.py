from pathlib import Path
from html import escape
root=Path(__file__).resolve().parents[1]
items=[('math-quest','premium-island-math.png','🔢','01','Math Quest','Đảo Toán Học','Toán 3 · Phép tính vui'),('memory-match','premium-island-memory.png','🦉','02','Memory Match','Khu Rừng Trí Nhớ','Tiếng Anh · Gia đình'),('sentence-builder','premium-island-sentence.png','📘','03','Sentence Builder','Xưởng Ngôn Từ','Tiếng Anh · Ghép câu')]
cards=''
for id,art,icon,num,name,world,pack in items:
 cards+=f'''<article class="portal273-world tone-{'gold' if num=='01' else 'green' if num=='02' else 'pink'}">
 <div class="portal273-island-art"><img src="../public/art/{art}" alt=""></div>
 <div class="portal273-world-body"><div class="portal273-world-chip">{icon} VÙNG ĐẤT {num}</div>
 <span class="portal273-world-tag">PHIÊU LƯU HỌC TẬP</span><h2>{name}</h2><p>{world}</p>
 <label for="sel-{id}">Chọn thử thách</label><select id="sel-{id}"><option>{pack}</option></select>
 <button class="portal273-start" onclick="window.alert('Đây là bản kiểm tra bố cục; game hoạt động trong ứng dụng React.')">Bắt đầu <span>➜</span></button>
 </div></article>'''
html=f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bảo An Learning · Premium World Home 2.7.4</title>
<link rel="stylesheet" href="../src/styles/main.css"><link rel="stylesheet" href="../src/styles/game-world.css"><link rel="stylesheet" href="../src/styles/polish26.css"><link rel="stylesheet" href="../src/styles/stability27.css"><link rel="stylesheet" href="../src/styles/panorama271.css"><link rel="stylesheet" href="../src/styles/portal272.css">
</head><body><div class="app-shell"><header class="site-header"><div class="header-content"><a class="brand" href="#home"><div class="brand-mark"><span>✦</span></div><div class="brand-words"><strong>BẢO AN</strong><small>LEARNING <span>V3.0</span></small></div></a><nav class="top-navigation"><button class="nav-item active">🏠 Thế giới game</button><button class="nav-item">📊 Góc phụ huynh</button><button class="nav-item">📚 Xưởng học liệu</button></nav><div class="experience-controls"><button class="control-pill">🔇 <span class="control-label">Âm thanh</span></button><button class="control-pill">✨ <span class="control-label">Hiệu ứng</span></button></div></div></header>
<main class="site-main site-main-gameworld"><div class="portal273-home" id="home"><section class="portal273-hero"><div class="portal273-backdrop"></div><div class="portal273-sky-glow"></div><span class="portal273-star star-a">✦</span><span class="portal273-star star-b">✦</span><span class="portal273-star star-c">✧</span>
<aside class="portal273-mascot"><img src="../public/art/premium-fox.png" alt=""><div class="portal273-mascot-bubble"><strong>Chào bé An!</strong><span>Hôm nay chúng ta khám phá gì nhỉ?</span></div></aside>
<div class="portal273-heading"><div class="portal273-eyebrow">✦ BẢO AN GAME WORLD ✦</div><h1>Khám phá <span>Thế giới học tập</span></h1><p>Học qua trò chơi · Khám phá tri thức · Lớn lên mỗi ngày</p></div>
<aside class="portal273-progress-board"><h2>Hành trình của con</h2><div class="portal273-progress-line"><span style="width:66%"></span></div><div class="portal273-progress-stars"><span class="on">★</span><span class="on">★</span><span>★</span></div><small>⭐ 6 sao · 2 lượt hoàn thành</small></aside>
<div class="portal273-world-grid">{cards}</div>
<div class="portal273-bottom-actions"><button>🧩 Bảng cửu chương</button><a href="#portal273-journey">🏆 Thành tích của con</a></div></section>
<section id="portal273-journey" class="portal273-journey"><div class="portal273-journey-copy"><div class="portal273-journey-icon">🌟</div><div><h2>Hành trình của con</h2><p>Con được quyền thử lại và học từ mỗi lần chơi.</p></div></div><div class="portal273-journey-stats"><span>⭐ <strong>6</strong> sao</span><span>🎮 <strong>2</strong> lượt hoàn thành</span><span>🌈 <strong>3</strong> thế giới</span></div></section>
</div></main></div></body></html>'''
(root/'preview/premium274.html').write_text(html)
