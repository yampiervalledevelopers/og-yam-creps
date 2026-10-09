const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.share = onRequest(async (req, res) => {
  const productId = req.query.p;

  if (!productId) {
    res.redirect("https://ogyamcreps.com/");
    return;
  }

  try {
    const doc = await admin.firestore().collection("productos").doc(productId).get();
    
    if (!doc.exists) {
      res.redirect("https://ogyamcreps.com/");
      return;
    }

    const data = doc.data();
    
    // Format price to Colombian Pesos
    const formattedPrice = "$" + Number(data.precioVenta || 0).toLocaleString("es-CO");
    
    // Default image if not set; support photo index ?f=N
    const fotos = Array.isArray(data.fotos) && data.fotos.length ? data.fotos : (data.foto ? [data.foto] : []);
    const f = Math.max(0, parseInt(req.query.f || "0", 10) || 0);
    const imageUrl = fotos[f] || fotos[0] || "https://ogyamcreps.com/logo-opt.jpg";
    const title = `${data.nombre || 'Tenis'} - O'G YAM CREPS`;
    const description = `${data.marca || ''} - Precio: ${formattedPrice}. ¡Compra ahora en O'G YAM CREPS!`;
    const productUrl = `https://ogyamcreps.com/?p=${encodeURIComponent(productId)}${f > 0 ? `&f=${f}` : ''}`;

    // Return HTML with Open Graph tags and an immediate meta refresh redirect
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <!-- Open Graph tags for WhatsApp/Facebook -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:url" content="${productUrl}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="O'G YAM CREPS" />

    <!-- Twitter Card tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">

    <!-- Redirect to the actual page -->
    <meta http-equiv="refresh" content="0;url=${productUrl}" />
    
    <script>
      // Fallback redirect via JS
      window.location.href = "${productUrl}";
    </script>
</head>
<body style="background-color: #0a0a0a; color: white; font-family: sans-serif; text-align: center; padding-top: 50px;">
    <h2>Redirigiendo a O'G YAM CREPS...</h2>
    <p>Si no eres redirigido automáticamente, <a href="${productUrl}" style="color: #00ff88;">haz clic aquí</a>.</p>
</body>
</html>`;

    res.status(200).send(html);

  } catch (error) {
    console.error("Error fetching product:", error);
    res.redirect(`https://ogyamcreps.com/?p=${productId}`);
  }
});
