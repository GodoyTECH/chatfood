# chatfood
Saude
# WhatsApp FoodBot (Render) - README

Este projeto cria um bot para WhatsApp que:
- Recebe foto de prato via WhatsApp Cloud API
- Classifica alimentos com modelo Food-101 (rodando no backend)
- Consulta USDA FoodData Central para estimativas nutricionais
- Retorna estimativa de calorias e macronutrientes por item

## Arquivos principais
- `index.js` — servidor Express + webhook + integração WhatsApp
- `classifyFood.js` — carrega modelo via @xenova/transformers e classifica imagem
- `nutrition.js` — consulta USDA e extrai macros
- `.env` — variáveis de ambiente (NÃO comitar chaves)

## Variáveis de ambiente (configure no Render ou em .env local)
- `WHATSAPP_TOKEN` = token de acesso (Meta/WhatsApp Cloud API)
- `WHATSAPP_NUMBER_ID` = phone number ID da sua app WhatsApp
- `VERIFY_TOKEN` = token para validar webhook no painel do Facebook
- `USDA_API_KEY` = sua chave da USDA FoodData Central
- `PORT` = opcional (padrão 3000)

## Como obter as chaves
1. **WhatsApp Cloud API (Meta):**
   - https://developers.facebook.com/
   - Crie app > WhatsApp > configure um número de teste > pegue `WHATSAPP_TOKEN` e `PHONE_NUMBER_ID`.
   - Em Webhooks: configure a URL `https://<seu-servico>.onrender.com/webhook` e o `VERIFY_TOKEN` (use o mesmo do .env).

2. **USDA FoodData Central (gratuito):**
   - https://fdc.nal.usda.gov/api-key-signup.html
   - Solicite API Key (gratuita) e coloque em `USDA_API_KEY`.

## Deploy no Render (grátis)
1. Suba seu repo no GitHub.
2. No Render: New → Web Service → Connect a repository
3. Build command: (deixe em branco)
4. Start command: `node index.js`
5. Em Environment: adicione as variáveis `WHATSAPP_TOKEN`, `WHATSAPP_NUMBER_ID`, `VERIFY_TOKEN`, `USDA_API_KEY`.
6. Deploy.

## Observações & troubleshooting
- O primeiro carregamento do modelo pode demorar. Tenha paciência.
- Se houver erro de WASM/Transformers no Render, verifique Node version (>=18) e logs.
- Para melhorar precisão: filtrar/limpar labels, usar segmentação (SAM) para detectar porções, pedir ao usuário confirmar porções.

