const express = require('express');
const multer = require('multer');
const dbOperations = require('./db/dbOperations');
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

app.post('/readReceipt', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        const results = [];

        //Reading each file with Document AI
        for (const file of req.files) {
            const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

            const request = {
                name,
                rawDocument: {
                    content: file.buffer,
                    mimeType: file.mimetype,
                },
                fieldMask: [
                    "document.entities.total_amount",
                    "document.entities.net_amount",
                    "document.entities.supplier_name",
                    "document.entities.receipt_date"
                ],
            };

            const [result] = await docClient.processDocument(request);
            if (result.document) {
                results.push(result.document);
            }
        }

        //Cleaning up the results from the Document AI
        const cleanDocs = [];

        for (const doc of results) {
            if (!doc.entities) continue;

            const cleanDoc = {};

            doc.entities.forEach(entity => {
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

            // Save to DB
            const savedReceipt = await dbOperations.insertReceipt(
                cleanDoc.merchant || 'Unknown Merchant', 
                cleanDoc.total || 0, 
                cleanDoc.date || new Date().toISOString().split('T')[0]
            );
            cleanDocs.push(savedReceipt);
        }
        res.json(cleanDocs);
    }
    catch (error) {
        console.error('Error processing document:', error);
        res.status(500).send('Error processing document.');
    }
})

app.get('/receipts', async (req, res) => {
    try {
        const receipts = await dbOperations.getReceipts();
        res.json(receipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).send('Error fetching receipts.');
    }
})

app.get('/receipts/:month/:year', async (req, res) => {
    const { month, year } = req.params;
    try {
        const receipts = await dbOperations.getReceiptsbyMonth(month, year);
        res.json(receipts);
    } catch (error) {
        console.error('Error fetching receipts by month:', error);
        res.status(500).send('Error fetching receipts by month.');
    }
})

app.delete('/receipt/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deletedReceipt = await dbOperations.deleteReceipt(id);
        if (deletedReceipt) {
            res.json(deletedReceipt);
        } else {
            res.status(404).send('Receipt not found.');
        }
    } catch (error) {
        console.error('Error deleting receipt:', error);
        res.status(500).send('Error deleting receipt.');
    }
})

app.put('/receipt/:id', express.json(), async (req, res) => {
    const { id } = req.params;
    const { merchant, total, purchase_date } = req.body;
    try {
        const updatedReceipt = await dbOperations.updateReceipt(id, merchant, total, purchase_date);
        if (updatedReceipt) {
            res.json(updatedReceipt);
        } else {
            res.status(404).send('Receipt not found.');
        }
    } catch (error) {
        console.error('Error updating receipt:', error);
        res.status(500).send('Error updating receipt.');
    }
})

app.get('/', (req, res) => {
  res.send('Online')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
