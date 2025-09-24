const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config();

const DocumentProcessorServiceClient = require('@google-cloud/documentai').DocumentProcessorServiceClient;
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const app = express();
const port = process.env.PORT || 8080;
const upload = multer({ storage: multer.memoryStorage() });
const docClient = new DocumentProcessorServiceClient();

const projectId = process.env.PROJECT_ID;
const location = process.env.LOCATION;
const processorId = process.env.PROCESSOR_ID;

app.post('/parse', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

        const request = {
            name,
            rawDocument: {
                content: req.file.buffer,
                mimeType: req.file.mimetype,
            },
            fieldMask: [
                "document.entities.total_amount",
                "document.entities.net_amount",
                "document.entities.supplier_name",
                "document.entities.receipt_date"
            ],
        };

        const [result] = await docClient.processDocument(request);
        const { document } = result;

        const cleanDoc = {};
        document.entities.forEach(entity => {
            switch(entity.type) {
                case 'supplier_name':
                    cleanDoc.merchant = entity.normalizedValue?.text || entity.mentionText;
                    break;
                case 'total_amount':
                    if (entity.normalizedValue?.moneyValue) {
                        const { units, nanos } = entity.normalizedValue.moneyValue;
                        cleanDoc.total = Number(units) + Number(nanos || 0) / 1e9;
                    } else {
                        cleanDoc.total = entity.mentionText;
                    }
                case 'receipt_date':
                    cleanDoc.date = entity.normalizedValue?.dateValue 
                        ? `${entity.normalizedValue.dateValue.year}-${entity.normalizedValue.dateValue.month}-${entity.normalizedValue.dateValue.day}`
                        : entity.mentionText;
                    break;
            }
        });
        res.json(cleanDoc);
    }
    catch (error) {
        console.error('Error processing document:', error);
        res.status(500).send('Error processing document.');
    }
})

app.get('/', (req, res) => {
  res.send('Hello World! with docker2')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
