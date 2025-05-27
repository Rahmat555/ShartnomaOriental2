const express = require('express');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const bodyParser = require('body-parser');
const cors = require('cors');
const { appendToGoogleSheet } = require('./google-sheets'); // ⬅️ Подключение внешнего модуля

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/api/generate-pdf', async (req, res) => {
  const {
    username, name, jshshir, birthdate,
    educationType, direction, address,
    passport, phone, previewOnly
  } = req.body;

  try {
    // 1. Считаем номер контракта
    const numberFile = path.join(__dirname, 'contract_number.txt');
    let contractNumber = 1;
    if (fs.existsSync(numberFile)) {
      contractNumber = parseInt(fs.readFileSync(numberFile, 'utf8')) + 1;
    }
    fs.writeFileSync(numberFile, String(contractNumber));

    // 2. Проверка на дубликат
    const dbPath = path.join(__dirname, 'students.json');
    let students = [];
    if (fs.existsSync(dbPath)) {
      students = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    const exists = students.find(
      e => e.jshshir === jshshir && e.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ error: 'Bu foydalanuvchi avval roʻyxatdan oʻtgan.' });
    }
    students.push({ name, jshshir, birthdate });
    fs.writeFileSync(dbPath, JSON.stringify(students, null, 2));

    // 3. Получаем текущую дату
    const today = new Date();
    const formattedDate = today.toLocaleDateString('uz-UZ');

    // 4. Генерация PDF
    const templatePath = path.join(__dirname, 'public', 'bakalavr.pdf');
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const [page1, page2] = pdfDoc.getPages();

    page1.drawText(`Sh: ${contractNumber}`, { x: 253, y: 787, size: 10, font });
    page1.drawText(name, { x: 100, y: 718, size: 10, font });
    page1.drawText(jshshir, { x: 240, y: 762, size: 10, font });
    page1.drawText(educationType, { x: 175, y: 555, size: 10, font });
    page1.drawText(direction, { x: 195, y: 538, size: 10, font });
    page2.drawText(address, { x: 363, y: 234, size: 10, font });
    page2.drawText(passport, { x: 427, y: 214, size: 10, font });
    page2.drawText(jshshir, { x: 375, y: 180, size: 10, font });
    page2.drawText(phone, { x: 345, y: 170, size: 9, font });
    page2.drawText(`Sana: ${formattedDate}`, { x: 321, y: 141, size: 10, font });

    const pdfBytes = await pdfDoc.save();
    const filename = `shartnoma_${contractNumber}.pdf`;
    const outputPath = path.join(__dirname, 'public', filename);
    fs.writeFileSync(outputPath, pdfBytes);

    const fileUrl = `http://localhost:${PORT}/${filename}`;


    // 5. Отправляем ответ клиенту СРАЗУ
    if (previewOnly) {
      res.status(200).json({ previewUrl: fileUrl, contractNumber });
    } else {
      res.status(200).json({ downloadUrl: fileUrl, contractNumber });
    }

    // 6. Google Sheets'ga yozishni fonda boshlaymiz
    appendToGoogleSheet({
      contractNumber,
      username,
      name,
      jshshir,
      birthdate,
      educationType,
      direction,
      address,
      passport,
      phone,
      date: formattedDate
    });

  } catch (err) {
    console.error('PDF yaratishda xatolik:', err);
    res.status(500).json({ error: 'PDF yaratib boʻlmadi.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server ishlamoqda: http://localhost:${PORT}`);
});
