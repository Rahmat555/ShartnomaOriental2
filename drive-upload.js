require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');

// ✅ Настройка Google Drive API для Shared Drive
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

/**
 * Загружает PDF на Google Drive, добавляет QR-код и возвращает публичную ссылку.
 */
async function uploadToDriveAndAddQR(localPath, contractNumber) {
  try {
    const pdfBytes = fs.readFileSync(localPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 🧪 Временная загрузка файла
    const tmpDriveRes = await drive.files.create({
      requestBody: {
        name: `shartnoma_${contractNumber}.pdf`,
        mimeType: 'application/pdf',
        parents: [process.env.DRIVE_FOLDER_ID] // ✅ Shared Drive папка
      },
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(localPath)
      },
      supportsAllDrives: true // ✅ Важно для shared drive
    });

    const fileId = tmpDriveRes.data.id;

    // 🔓 Делаем публичным
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true
    });

    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

    // 🧾 Генерация QR
    const qrDataUrl = await QRCode.toDataURL(driveUrl);
    const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrDims = qrImage.scale(0.5);
    const lastPage = pdfDoc.getPages().at(-1);

    lastPage.drawImage(qrImage, {
      x: 410,
      y: 56,
      width: qrDims.width,
      height: qrDims.height
    });

    const updatedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(localPath, updatedPdfBytes);

    // 🔁 Перезапись в Drive
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(localPath)
      },
      supportsAllDrives: true
    });

    console.log('✅ Загружено с QR:', driveUrl);
    return driveUrl;

  } catch (err) {
    console.error('❌ Drive yoki QR xatolik:', err.message);
    return null;
  }
}

module.exports = { uploadToDriveAndAddQR };
