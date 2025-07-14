const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const { authorize } = require('./auth');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CREDENTIALS_PATH = 'oauth-credentials.json';

async function uploadToDriveAndAddQR(localPath, contractNumber) {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

    return new Promise((resolve, reject) => {
      authorize(credentials, SCOPES, async (auth) => {
        const drive = google.drive({ version: 'v3', auth });

        const pdfBytes = fs.readFileSync(localPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Загружаем файл
        const tmpDriveRes = await drive.files.create({
          requestBody: {
            name: `shartnoma_${contractNumber}.pdf`,
            mimeType: 'application/pdf'
          },
          media: {
            mimeType: 'application/pdf',
            body: fs.createReadStream(localPath)
          }
        });

        const fileId = tmpDriveRes.data.id;

        // Делаем файл публичным
        await drive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone'
          }
        });

        const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

        // Генерируем QR по URL
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

        // Перезаписываем файл
        const updatedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(localPath, updatedPdfBytes);

        // Обновляем файл на диске
        await drive.files.update({
          fileId,
          media: {
            mimeType: 'application/pdf',
            body: fs.createReadStream(localPath)
          }
        });

        console.log('✅ Загружено с QR:', driveUrl);
        resolve(driveUrl);
      });
    });

  } catch (err) {
    console.error('❌ Drive yoki QR xatolik:', err.message);
    return null;
  }
}

module.exports = { uploadToDriveAndAddQR };
