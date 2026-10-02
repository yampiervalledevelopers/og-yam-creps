const fs = require('fs');
let storeJs = fs.readFileSync('store.js', 'utf8');

const s1 = storeJs.indexOf("<h2 style=\"font-family:'Bebas Neue', sans-serif; font-size:2.5rem; color:var(--neon-green); text-align:center; letter-spacing:2px; text-shadow:0 0 10px rgba(0,255,136,0.3);\">🔥 PROMOCIONES EXCLUSIVAS 🔥</h2>");
if (s1 !== -1) {
    const elegantMarquee = "<div class=\"promo-marquee-container\" style=\"margin-top:0; box-shadow:none;\"><div class=\"promo-marquee-track\"><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span><span>🔥 PROMOCIONES EXCLUSIVAS 🔥</span><span>LLEVA TU ESTILO AL SIGUIENTE NIVEL 🚀</span></div></div>";
    storeJs = storeJs.substring(0, s1) + elegantMarquee + storeJs.substring(s1 + 215); // Length of the h2 tag is approx 215, let's just replace the exact match
    
    // Better way to replace:
    storeJs = fs.readFileSync('store.js', 'utf8'); // reload
    storeJs = storeJs.replace("<h2 style=\"font-family:'Bebas Neue', sans-serif; font-size:2.5rem; color:var(--neon-green); text-align:center; letter-spacing:2px; text-shadow:0 0 10px rgba(0,255,136,0.3);\">🔥 PROMOCIONES EXCLUSIVAS 🔥</h2>", elegantMarquee);
    
    fs.writeFileSync('store.js', storeJs);
    console.log('Subpage banner patched');
}
