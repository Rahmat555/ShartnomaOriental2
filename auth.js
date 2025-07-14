// auth.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

const TOKEN_PATH = 'oauth-token.json';

/**
 * Авторизация с помощью OAuth2.
 * @param {Object} credentials - OAuth2 client credentials
 * @param {Array} scopes - Права доступа
 * @param {function} callback - Callback с авторизованным клиентом
 */
function authorize(credentials, scopes, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Проверяем, есть ли сохранённый токен
  if (fs.existsSync(TOKEN_PATH)) {
    const token = fs.readFileSync(TOKEN_PATH, 'utf8');
    oAuth2Client.setCredentials(JSON.parse(token));
    return callback(oAuth2Client);
  }

  // Генерируем ссылку для авторизации
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  console.log('👉 Авторизуйтесь по ссылке:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Получаем код от пользователя
  rl.question('👉 Введите код авторизации сюда: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('❌ Не удалось получить токен:', err);
      oAuth2Client.setCredentials(token);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('✅ Токен сохранён в', TOKEN_PATH);
      callback(oAuth2Client);
    });
  });
}

module.exports = { authorize };
