require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');

// Настройка Google Drive API
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

/**
 * Загружает PDF на Google Drive, добавляет QR-код, и возвращает публичную ссылку.
 * @param {string} localPath - Путь к локальному PDF
 * @param {number|string} contractNumber
 * @returns {Promise<string>} - Ссылка на Google Drive файл
 */
async function uploadToDriveAndAddQR(localPath, contractNumber) {
  try {
    // 1. Сначала загружаем PDF в память
    const pdfBytes = fs.readFileSync(localPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 2. Генерация черновой ссылки (пока не знаем Drive URL, подождём)
    const tmpDriveRes = await drive.files.create({
      requestBody: {
        name: `shartnoma_${contractNumber}.pdf`,
        mimeType: 'application/pdf',
        parents: [process.env.DRIVE_FOLDER_ID]
      },
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(localPath)
      }
    });

    const fileId = tmpDriveRes.data.id;

    // 3. Делаем файл публичным
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

    // 4. Генерируем QR-код по driveUrl
    const qrDataUrl = await QRCode.toDataURL(driveUrl);
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrDims = qrImage.scale(0.5);

    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawImage(qrImage, {
      x: 410,
      y: 56,
      width: qrDims.width,
      height: qrDims.height
    });

    // 5. Сохраняем новый PDF с QR-кодом
    const updatedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(localPath, updatedPdfBytes);

    // 6. Перезагружаем изменённый файл в Drive
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(localPath)
      }
    });

    console.log('✅ Загружено с QR:', driveUrl);
    return driveUrl;

  } catch (err) {
    console.error('❌ Drive yoki QR xatolik:', err.message);
    return null;
  }
}

module.exports = { uploadToDriveAndAddQR };
