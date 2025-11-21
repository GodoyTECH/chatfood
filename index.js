/*Função principal */


require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { detectFood } = require('./classifyFood');
const { getNutritionByQuery } = require('./nutrition');

const app = express();
app.use(express.json({ limit: '50mb' }));

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_NUMBER_ID = process.env.WHATSAPP_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Health check
app.get('/', (req, res) => res.send('WhatsApp FoodBot (Render)'));

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// Webhook receiver (POST)
app.post('/webhook', async (req, res) => {
  try {
    // Basic safety
    if (!req.body.entry) return res.sendStatus(200);

    const entry = req.body.entry[0];
    const changes = entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;
    if (!messages || !messages[0]) return res.sendStatus(200);

    const message = messages[0];
    const from = message.from; // user phone
    const messageType = message.type;

    console.log('Mensagem recebida de', from, 'tipo', messageType);

    // Default reply for non image
    if (messageType !== 'image') {
      await sendTextMessage(from, 'Olá! Envie uma foto do prato que eu analiso calorias e nutrientes para você 🍽️');
      return res.sendStatus(200);
    }

    // If it's image: get media id and then download
    const mediaId = message.image.id;
    // 1) Get media URL (Graph API)
    const mediaInfoResp = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
      params: { access_token: WHATSAPP_TOKEN }
    });

    const mediaUrl = mediaInfoResp.data.url;
    if (!mediaUrl) {
      console.error('Media URL não encontrada');
      await sendTextMessage(from, 'Não consegui baixar a imagem. Tente novamente.');
      return res.sendStatus(200);
    }

    // 2) Download image (authorized)
    const imageResp = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });

    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const imagePath = path.join(tmpDir, `${Date.now()}.jpg`);
    fs.writeFileSync(imagePath, imageResp.data);

    // 3) Detect food items (returns array of labels)
    await sendTextMessage(from, 'Recebi a imagem — analisando agora 🔎');
    const labels = await detectFood(imagePath); // ex: ['fried rice','grilled chicken']

    if (!labels || labels.length === 0) {
      await sendTextMessage(from, 'Não consegui identificar alimentos nessa imagem. Tente uma foto mais nítida ou com o prato inteiro visível.');
      fs.unlinkSync(imagePath);
      return res.sendStatus(200);
    }

    // 4) Para cada label: buscar nutrição (por 100g default) e compor resposta
    let total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    let parts = [];

    // Limit top 3 labels to keep resposta enxuta
    const topLabels = labels.slice(0, 3);
    for (const label of topLabels) {
      const nut = await getNutritionByQuery(label, 100, process.env.USDA_API_KEY);
      if (!nut) continue;
      parts.push({ label: label, nutrition: nut });
      total.calories += nut.calories;
      total.protein += nut.protein;
      total.carbs += nut.carbs;
      total.fat += nut.fat;
    }

    // Format response
    let responseText = `🍽 *Análise do prato*\n\n`;
    for (const p of parts) {
      responseText += `• ${capFirst(p.label)} (100 g)\n  - 🔥 ${p.nutrition.calories} kcal\n  - 💪 ${p.nutrition.protein} g proteína\n  - 🍞 ${p.nutrition.carbs} g carboidrato\n  - 🥑 ${p.nutrition.fat} g gordura\n\n`;
    }
    responseText += `*Total aproximado (somatório das partes listadas):*\n🔥 ${Math.round(total.calories)} kcal | 💪 ${Math.round(total.protein)} g | 🍞 ${Math.round(total.carbs)} g | 🥑 ${Math.round(total.fat)} g\n\n`;
    responseText += `_Estimativas baseadas em 100g por item. Ajuste as porções conforme necessário._`;

    // 5) Send reply
    await sendTextMessage(from, responseText);

    // 6) Cleanup
    fs.unlinkSync(imagePath);

    res.sendStatus(200);
  } catch (err) {
    console.error('Erro no webhook:', err?.response?.data || err.message || err);
    res.sendStatus(500);
  }
});

// Helper: send text via WhatsApp Graph API
async function sendTextMessage(to, body) {
  try {
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_NUMBER_ID}/messages`;
    await axios.post(url, {
      messaging_product: 'whatsapp',
      to,
      text: { body }
    }, { params: { access_token: WHATSAPP_TOKEN } });
  } catch (err) {
    console.error('Erro enviando texto:', err?.response?.data || err.message || err);
  }
}

function capFirst(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
