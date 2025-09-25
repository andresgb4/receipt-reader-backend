const pool = require('./db');

const insertReceipt = async (merchant, total, purchase_date) => {
    const query = `
        INSERT INTO receipts (merchant, total, purchase_date)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const values = [merchant, total, purchase_date];
    const { rows } = await pool.query(query, values);
    return rows[0];
}

const getReceipts = async () => {
    const query = `SELECT * FROM receipts ORDER BY id DESC;`;
    const { rows } = await pool.query(query);
    return rows;
}

const getReceiptsbyMonth = async (month, year) => {
    const query = `
        SELECT * FROM receipts 
        WHERE EXTRACT(MONTH FROM purchase_date) = $1 
        AND EXTRACT(YEAR FROM purchase_date) = $2
        ORDER BY id DESC;
    `;
    const values = [month, year];
    const { rows } = await pool.query(query, values);
    return rows;
}

const deleteReceipt = async (id) => {
    const query = `DELETE FROM receipts WHERE id = $1 RETURNING *;`;
    const values = [id];
    const { rows } = await pool.query(query, values);
    return rows[0];
}

const updateReceipt = async (id, merchant, total, purchase_date) => {
    const fields = [];
    const values = [];
    let index = 1;

    if (merchant !== undefined) {
        fields.push(`merchant = $${index++}`);
        values.push(merchant);
    }
    if (total !== undefined) {
        fields.push(`total = $${index++}`);
        values.push(total);
    }
    if (purchase_date !== undefined) {
        fields.push(`purchase_date = $${index++}`);
        values.push(purchase_date);
    }
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    const idIndex = index;
    values.push(id);


    const query = `
        UPDATE receipts 
        SET ${fields.join(', ')}
        WHERE id = $${idIndex}
        RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return rows[0];
}

module.exports = {
    insertReceipt,
    getReceipts,
    getReceiptsbyMonth,
    deleteReceipt,
    updateReceipt
};
