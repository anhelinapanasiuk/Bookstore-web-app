const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = 3000;

/* =====================================================
   НАЛАШТУВАННЯ СЕРВЕРА
===================================================== */

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* =====================================================
   ПІДКЛЮЧЕННЯ ДО MYSQL
   ЗМІНИ ТІЛЬКИ host/password, якщо в тебе інші
===================================================== */

const db = mysql.createPool({
    host: '192.168.32.131',
    user: 'root',
    password: 'Nika4321!',
    database: 'bookstore',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testDatabaseConnection() {
    try {
        const connection = await db.getConnection();
        console.log('Успішне підключення до MySQL bookstore!');
        connection.release();
    } catch (error) {
        console.error('Помилка підключення до MySQL:', error.message);
    }
}

testDatabaseConnection();

/* =====================================================
   ДОПОМІЖНІ ФУНКЦІЇ
===================================================== */

function cleanText(value) {
    return String(value || '').trim();
}

function cleanEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function toNumber(value) {
    const number = Number(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(number) ? number : 0;
}

function calculateDelivery(subtotal) {
    return Number(subtotal) >= 1000 ? 0 : 100;
}

function buildUserResponse(user) {
    return {
        id: user.user_id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        name: [user.first_name, user.last_name].filter(Boolean).join(' '),
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'customer'
    };
}

/* =====================================================
   ГОЛОВНА СТОРІНКА
===================================================== */

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

/* =====================================================
   ТЕСТ БАЗИ
===================================================== */

app.get('/api/test-db', async (req, res) => {
    try {
        const [tables] = await db.query('SHOW TABLES');

        res.json({
            success: true,
            message: 'Підключення до бази працює.',
            tables
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Помилка підключення до бази.',
            error: error.message
        });
    }
});

/* =====================================================
   КНИГИ ДЛЯ САЙТУ
===================================================== */

app.get('/api/books', async (req, res) => {
    try {
        const [books] = await db.query(`
            SELECT 
                b.book_id,
                b.title,
                b.author_id,
                b.category_id,
                b.price,
                b.stock_quantity,
                b.description,
                b.image_url,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), 'Невідомий автор') AS author,
                COALESCE(c.category_name, 'Без категорії') AS category
            FROM books b
            LEFT JOIN authors a 
                ON a.author_id = b.author_id
            LEFT JOIN categories c 
                ON c.category_id = b.category_id
            ORDER BY b.book_id ASC
        `);

        res.json({
            success: true,
            books: books.map(book => ({
                id: book.book_id,
                bookId: book.book_id,
                title: book.title,
                authorId: book.author_id,
                categoryId: book.category_id,
                author: book.author,
                category: book.category,
                price: Number(book.price || 0),
                stockQuantity: Number(book.stock_quantity || 0),
                description: book.description || '',
                imageUrl: book.image_url || ''
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати книги.',
            error: error.message
        });
    }
});

app.get('/api/books/featured', async (req, res) => {
    try {
        const [books] = await db.query(`
            SELECT 
                b.book_id,
                b.title,
                b.author_id,
                b.category_id,
                b.price,
                b.stock_quantity,
                b.description,
                b.image_url,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), 'Невідомий автор') AS author,
                COALESCE(c.category_name, 'Без категорії') AS category
            FROM books b
            LEFT JOIN authors a 
                ON a.author_id = b.author_id
            LEFT JOIN categories c 
                ON c.category_id = b.category_id
            WHERE b.book_id IN (3, 2, 8, 7)
            ORDER BY FIELD(b.book_id, 3, 2, 8, 7)
        `);

        res.json({
            success: true,
            books: books.map(book => ({
                id: book.book_id,
                bookId: book.book_id,
                title: book.title,
                authorId: book.author_id,
                categoryId: book.category_id,
                author: book.author,
                category: book.category,
                price: Number(book.price || 0),
                stockQuantity: Number(book.stock_quantity || 0),
                description: book.description || '',
                imageUrl: book.image_url || ''
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати популярні книги.',
            error: error.message
        });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const bookId = Number(req.params.id);

        if (!bookId) {
            return res.status(400).json({
                success: false,
                message: 'Некоректний номер книги.'
            });
        }

        const [books] = await db.execute(`
            SELECT 
                b.book_id,
                b.title,
                b.author_id,
                b.category_id,
                b.price,
                b.stock_quantity,
                b.description,
                b.image_url,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), 'Невідомий автор') AS author,
                COALESCE(c.category_name, 'Без категорії') AS category
            FROM books b
            LEFT JOIN authors a 
                ON a.author_id = b.author_id
            LEFT JOIN categories c 
                ON c.category_id = b.category_id
            WHERE b.book_id = ?
            LIMIT 1
        `, [bookId]);

        if (books.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Книгу не знайдено.'
            });
        }

        const book = books[0];

        res.json({
            success: true,
            book: {
                book_id: book.book_id,
                id: book.book_id,
                title: book.title,
                authorId: book.author_id,
                categoryId: book.category_id,
                author: book.author,
                category: book.category,
                price: Number(book.price || 0),
                stock_quantity: Number(book.stock_quantity || 0),
                stockQuantity: Number(book.stock_quantity || 0),
                description: book.description || '',
                image_url: book.image_url || '',
                imageUrl: book.image_url || ''
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати книгу.',
            error: error.message
        });
    }
});

/* =====================================================
   РЕЄСТРАЦІЯ
===================================================== */

app.post('/api/register', async (req, res) => {
    try {
        const firstName = cleanText(req.body.firstName);
        const lastName = cleanText(req.body.lastName);
        const email = cleanEmail(req.body.email);
        const phone = cleanText(req.body.phone);
        const password = cleanText(req.body.password);

        if (!firstName || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: 'Заповніть усі обов’язкові поля.'
            });
        }

        const [existingUsers] = await db.execute(`
            SELECT user_id
            FROM users
            WHERE email = ?
            LIMIT 1
        `, [email]);

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Користувач із таким email уже зареєстрований.'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO users (
                first_name,
                last_name,
                email,
                password,
                phone,
                created_at,
                role
            )
            VALUES (?, ?, ?, ?, ?, NOW(), 'customer')
        `, [
            firstName,
            lastName || null,
            email,
            password,
            phone
        ]);

        const user = {
            user_id: result.insertId,
            first_name: firstName,
            last_name: lastName || '',
            email,
            phone,
            role: 'customer'
        };

        res.status(201).json({
            success: true,
            message: 'Реєстрацію успішно завершено.',
            user: buildUserResponse(user)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося зареєструвати користувача.',
            error: error.message
        });
    }
});

/* =====================================================
   ВХІД
===================================================== */

app.post('/api/login', async (req, res) => {
    try {
        let login = cleanEmail(req.body.login);
        const password = cleanText(req.body.password);

        if (!login || !password) {
            return res.status(400).json({
                success: false,
                message: 'Введіть логін та пароль.'
            });
        }

        if (login === 'admin') {
            login = 'admin@bookstore.com';
        }

        const [users] = await db.execute(`
            SELECT 
                user_id,
                first_name,
                last_name,
                email,
                phone,
                role
            FROM users
            WHERE email = ?
              AND password = ?
            LIMIT 1
        `, [login, password]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Неправильний логін або пароль.'
            });
        }

        res.json({
            success: true,
            message: 'Вхід виконано успішно.',
            user: buildUserResponse(users[0])
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Помилка під час входу.',
            error: error.message
        });
    }
});

/* =====================================================
   КОНТАКТНІ ПОВІДОМЛЕННЯ
===================================================== */

app.post('/api/contact-messages', async (req, res) => {
    try {
        const name = cleanText(req.body.name);
        const email = cleanEmail(req.body.email);
        const text = cleanText(req.body.text);

        if (!name || !email || !text) {
            return res.status(400).json({
                success: false,
                message: 'Заповніть усі обов’язкові поля.'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO contact_messages (
                sender_name,
                sender_email,
                message_text,
                status,
                created_at
            )
            VALUES (?, ?, ?, 'Нове', NOW())
        `, [name, email, text]);

        res.status(201).json({
            success: true,
            message: 'Повідомлення успішно надіслано.',
            messageId: result.insertId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося надіслати повідомлення.',
            error: error.message
        });
    }
});

app.get('/api/admin/messages', async (req, res) => {
    try {
        const [messages] = await db.query(`
            SELECT 
                message_id,
                sender_name,
                sender_email,
                message_text,
                status,
                created_at
            FROM contact_messages
            ORDER BY message_id DESC
        `);

        res.json({
            success: true,
            messages: messages.map(message => ({
                id: message.message_id,
                name: message.sender_name,
                email: message.sender_email,
                text: message.message_text,
                status: message.status,
                createdAt: message.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати повідомлення.',
            error: error.message
        });
    }
});

app.patch('/api/admin/messages/:id', async (req, res) => {
    try {
        const messageId = Number(req.params.id);
        const text = cleanText(req.body.text);
        const status = cleanText(req.body.status);

        if (!messageId || !text || !status) {
            return res.status(400).json({
                success: false,
                message: 'Некоректні дані повідомлення.'
            });
        }

        const [result] = await db.execute(`
            UPDATE contact_messages
            SET 
                message_text = ?,
                status = ?
            WHERE message_id = ?
        `, [text, status, messageId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Повідомлення не знайдено.'
            });
        }

        res.json({
            success: true,
            message: 'Повідомлення оновлено.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося оновити повідомлення.',
            error: error.message
        });
    }
});

app.delete('/api/admin/messages/:id', async (req, res) => {
    try {
        const messageId = Number(req.params.id);

        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: 'Некоректний ID повідомлення.'
            });
        }

        const [result] = await db.execute(`
            DELETE FROM contact_messages
            WHERE message_id = ?
        `, [messageId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Повідомлення не знайдено.'
            });
        }

        res.json({
            success: true,
            message: 'Повідомлення видалено.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося видалити повідомлення.',
            error: error.message
        });
    }
});

/* =====================================================
   СТВОРЕННЯ ЗАМОВЛЕННЯ
===================================================== */

app.post('/api/orders', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const userId = Number(req.body.userId);
        const firstName = cleanText(req.body.firstName);
        const lastName = cleanText(req.body.lastName);
        const phone = cleanText(req.body.phone);
        const email = cleanEmail(req.body.email);
        const city = cleanText(req.body.city);
        const branch = cleanText(req.body.branch);
        const paymentMethod = cleanText(req.body.paymentMethod);
        const cart = Array.isArray(req.body.cart) ? req.body.cart : [];

        if (
            !userId ||
            !firstName ||
            !lastName ||
            !phone ||
            !city ||
            !branch ||
            !paymentMethod ||
            cart.length === 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'Перевірте дані замовлення.'
            });
        }

        let subtotal = 0;

        cart.forEach(item => {
            const quantity = Number(item.quantity) || 1;
            const price = toNumber(item.price);
            subtotal += price * quantity;
        });

        const delivery = calculateDelivery(subtotal);
        const totalAmount = subtotal + delivery;

        const orderStatus =
            paymentMethod === 'Оплата карткою онлайн'
                ? 'Очікує оплату'
                : 'В обробці';

        const [orderResult] = await connection.execute(`
            INSERT INTO orders (
                user_id,
                order_date,
                total_amount,
                status,
                customer_first_name,
                customer_last_name,
                customer_phone,
                customer_email,
                delivery_city,
                delivery_branch,
                subtotal_amount,
                delivery_amount
            )
            VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            totalAmount,
            orderStatus,
            firstName,
            lastName,
            phone,
            email || null,
            city,
            branch,
            subtotal,
            delivery
        ]);

        const orderId = orderResult.insertId;

        for (const item of cart) {
            const title = cleanText(item.title);
            const quantity = Number(item.quantity) || 1;
            const price = toNumber(item.price);

            const [books] = await connection.execute(`
                SELECT book_id
                FROM books
                WHERE title = ?
                LIMIT 1
            `, [title]);

            const bookId = books.length ? books[0].book_id : null;

            await connection.execute(`
                INSERT INTO order_items (
                    order_id,
                    book_id,
                    quantity,
                    price
                )
                VALUES (?, ?, ?, ?)
            `, [
                orderId,
                bookId,
                quantity,
                price
            ]);
        }

        const paymentStatus =
            paymentMethod === 'Оплата карткою онлайн'
                ? 'Очікує оплату'
                : 'Оплата при отриманні';

        await connection.execute(`
            INSERT INTO payments (
                order_id,
                payment_date,
                amount,
                payment_method,
                payment_status
            )
            VALUES (?, NULL, ?, ?, ?)
        `, [
            orderId,
            totalAmount,
            paymentMethod,
            paymentStatus
        ]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Замовлення успішно оформлено.',
            orderId,
            totalAmount,
            redirectToPayment: paymentMethod === 'Оплата карткою онлайн'
        });
    } catch (error) {
        await connection.rollback();

        res.status(500).json({
            success: false,
            message: 'Не вдалося створити замовлення.',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

/* =====================================================
   ОПЛАТА
===================================================== */

app.post('/api/payments/:orderId/confirm', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const orderId = Number(req.params.orderId);

        if (!orderId) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'Некоректний номер замовлення.'
            });
        }

        const [payments] = await connection.execute(`
            SELECT payment_id
            FROM payments
            WHERE order_id = ?
            LIMIT 1
        `, [orderId]);

        if (payments.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Платіж не знайдено.'
            });
        }

        await connection.execute(`
            UPDATE payments
            SET 
                payment_date = NOW(),
                payment_status = 'Оплачено'
            WHERE order_id = ?
        `, [orderId]);

        await connection.execute(`
            UPDATE orders
            SET status = 'Оплачено'
            WHERE order_id = ?
        `, [orderId]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Оплату успішно підтверджено.'
        });
    } catch (error) {
        await connection.rollback();

        res.status(500).json({
            success: false,
            message: 'Не вдалося підтвердити оплату.',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

/* =====================================================
   МОЇ ЗАМОВЛЕННЯ
===================================================== */

app.get('/api/my-orders/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Некоректний користувач.'
            });
        }

        const [orders] = await db.execute(`
            SELECT
                o.order_id,
                o.order_date,
                o.total_amount,
                o.status,
                o.delivery_city,
                o.delivery_branch,
                o.subtotal_amount,
                o.delivery_amount,
                p.payment_method,
                p.payment_status,
                GROUP_CONCAT(
                    CONCAT(
                        COALESCE(b.title, 'Книга'),
                        ' — ',
                        oi.price,
                        ' грн × ',
                        oi.quantity,
                        ' шт.'
                    )
                    SEPARATOR '||'
                ) AS books_text
            FROM orders o
            LEFT JOIN payments p 
                ON p.order_id = o.order_id
            LEFT JOIN order_items oi 
                ON oi.order_id = o.order_id
            LEFT JOIN books b 
                ON b.book_id = oi.book_id
            WHERE o.user_id = ?
            GROUP BY 
                o.order_id,
                o.order_date,
                o.total_amount,
                o.status,
                o.delivery_city,
                o.delivery_branch,
                o.subtotal_amount,
                o.delivery_amount,
                p.payment_method,
                p.payment_status
            ORDER BY o.order_id DESC
        `, [userId]);

        res.json({
            success: true,
            orders: orders.map(order => ({
                id: order.order_id,
                orderDate: order.order_date,
                totalAmount: Number(order.total_amount || 0),
                subtotalAmount: Number(order.subtotal_amount || 0),
                deliveryAmount: Number(order.delivery_amount || 0),
                status: order.status,
                city: order.delivery_city,
                branch: order.delivery_branch,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                books: order.books_text ? order.books_text.split('||') : []
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати замовлення.',
            error: error.message
        });
    }
});

/* =====================================================
   АДМІНКА: КОРИСТУВАЧІ
===================================================== */

app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT 
                user_id,
                first_name,
                last_name,
                email,
                phone,
                role,
                created_at
            FROM users
            ORDER BY user_id DESC
        `);

        res.json({
            success: true,
            users: users.map(user => ({
                id: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                fullName: [user.first_name, user.last_name].filter(Boolean).join(' '),
                email: user.email,
                phone: user.phone,
                role: user.role,
                createdAt: user.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати користувачів.',
            error: error.message
        });
    }
});

/* =====================================================
   АДМІНКА: ЗАМОВЛЕННЯ
===================================================== */

app.get('/api/admin/orders', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT
                o.order_id,
                o.user_id,
                o.order_date,
                o.total_amount,
                o.status,
                o.customer_first_name,
                o.customer_last_name,
                o.customer_phone,
                o.customer_email,
                o.delivery_city,
                o.delivery_branch,
                o.subtotal_amount,
                o.delivery_amount,
                p.payment_method,
                p.payment_status,
                GROUP_CONCAT(
                    CONCAT(
                        COALESCE(b.title, 'Книга'),
                        ' — ',
                        oi.price,
                        ' грн × ',
                        oi.quantity,
                        ' шт.'
                    )
                    SEPARATOR ', '
                ) AS books_text
            FROM orders o
            LEFT JOIN payments p 
                ON p.order_id = o.order_id
            LEFT JOIN order_items oi 
                ON oi.order_id = o.order_id
            LEFT JOIN books b 
                ON b.book_id = oi.book_id
            GROUP BY 
                o.order_id,
                o.user_id,
                o.order_date,
                o.total_amount,
                o.status,
                o.customer_first_name,
                o.customer_last_name,
                o.customer_phone,
                o.customer_email,
                o.delivery_city,
                o.delivery_branch,
                o.subtotal_amount,
                o.delivery_amount,
                p.payment_method,
                p.payment_status
            ORDER BY o.order_id DESC
        `);

        res.json({
            success: true,
            orders: orders.map(order => ({
                id: order.order_id,
                userId: order.user_id,
                orderDate: order.order_date,
                totalAmount: Number(order.total_amount || 0),
                subtotalAmount: Number(order.subtotal_amount || 0),
                deliveryAmount: Number(order.delivery_amount || 0),
                status: order.status,
                firstName: order.customer_first_name,
                lastName: order.customer_last_name,
                customer: [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' '),
                phone: order.customer_phone,
                email: order.customer_email,
                city: order.delivery_city,
                branch: order.delivery_branch,
                address: [order.delivery_city, order.delivery_branch].filter(Boolean).join(', '),
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                books: order.books_text || ''
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати замовлення.',
            error: error.message
        });
    }
});

app.patch('/api/admin/orders/:id', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const orderId = Number(req.params.id);

        const firstName = cleanText(req.body.firstName);
        const lastName = cleanText(req.body.lastName);
        const phone = cleanText(req.body.phone);
        const email = cleanEmail(req.body.email);
        const city = cleanText(req.body.city);
        const branch = cleanText(req.body.branch);
        const subtotalAmount = toNumber(req.body.subtotalAmount);
        const deliveryAmount = toNumber(req.body.deliveryAmount);
        const totalAmount = toNumber(req.body.totalAmount);
        const status = cleanText(req.body.status);
        const paymentMethod = cleanText(req.body.paymentMethod);
        const paymentStatus = cleanText(req.body.paymentStatus);

        if (!orderId) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'Некоректний ID замовлення.'
            });
        }

        const [orderResult] = await connection.execute(`
            UPDATE orders
            SET 
                customer_first_name = ?,
                customer_last_name = ?,
                customer_phone = ?,
                customer_email = ?,
                delivery_city = ?,
                delivery_branch = ?,
                subtotal_amount = ?,
                delivery_amount = ?,
                total_amount = ?,
                status = ?
            WHERE order_id = ?
        `, [
            firstName,
            lastName,
            phone,
            email || null,
            city,
            branch,
            subtotalAmount,
            deliveryAmount,
            totalAmount,
            status,
            orderId
        ]);

        if (orderResult.affectedRows === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Замовлення не знайдено.'
            });
        }

        await connection.execute(`
            UPDATE payments
            SET 
                amount = ?,
                payment_method = ?,
                payment_status = ?
            WHERE order_id = ?
        `, [
            totalAmount,
            paymentMethod,
            paymentStatus,
            orderId
        ]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Замовлення оновлено.'
        });
    } catch (error) {
        await connection.rollback();

        res.status(500).json({
            success: false,
            message: 'Не вдалося оновити замовлення.',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const orderId = Number(req.params.id);

        if (!orderId) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: 'Некоректний ID замовлення.'
            });
        }

        await connection.execute(`
            DELETE FROM payments
            WHERE order_id = ?
        `, [orderId]);

        await connection.execute(`
            DELETE FROM order_items
            WHERE order_id = ?
        `, [orderId]);

        const [result] = await connection.execute(`
            DELETE FROM orders
            WHERE order_id = ?
        `, [orderId]);

        if (result.affectedRows === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: 'Замовлення не знайдено.'
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Замовлення видалено.'
        });
    } catch (error) {
        await connection.rollback();

        res.status(500).json({
            success: false,
            message: 'Не вдалося видалити замовлення.',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

/* =====================================================
   АДМІНКА: АВТОРИ І КАТЕГОРІЇ
===================================================== */

app.get('/api/admin/book-options', async (req, res) => {
    try {
        const [authors] = await db.query(`
            SELECT 
                author_id,
                CONCAT(first_name, ' ', last_name) AS name
            FROM authors
            ORDER BY name ASC
        `);

        const [categories] = await db.query(`
            SELECT 
                category_id,
                category_name
            FROM categories
            ORDER BY category_name ASC
        `);

        res.json({
            success: true,
            authors: authors.map(author => ({
                id: author.author_id,
                name: author.name
            })),
            categories: categories.map(category => ({
                id: category.category_id,
                name: category.category_name
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати авторів і категорії.',
            error: error.message
        });
    }
});

/* =====================================================
   АДМІНКА: КНИГИ
===================================================== */

app.get('/api/admin/books', async (req, res) => {
    try {
        const [books] = await db.query(`
            SELECT 
                b.book_id,
                b.title,
                b.author_id,
                b.category_id,
                b.price,
                b.stock_quantity,
                b.description,
                b.image_url,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), 'Невідомий автор') AS author_name,
                COALESCE(c.category_name, 'Без категорії') AS category_name
            FROM books b
            LEFT JOIN authors a 
                ON a.author_id = b.author_id
            LEFT JOIN categories c 
                ON c.category_id = b.category_id
            ORDER BY b.book_id ASC
        `);

        res.json({
            success: true,
            books: books.map(book => ({
                id: book.book_id,
                bookId: book.book_id,
                title: book.title,
                authorId: book.author_id,
                categoryId: book.category_id,
                authorName: book.author_name,
                categoryName: book.category_name,
                price: Number(book.price || 0),
                stockQuantity: Number(book.stock_quantity || 0),
                description: book.description || '',
                imageUrl: book.image_url || ''
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося отримати книги.',
            error: error.message
        });
    }
});

app.post('/api/admin/books', async (req, res) => {
    try {
        const title = cleanText(req.body.title) || 'Нова книга';
        const authorId = Number(req.body.authorId);
        const categoryId = Number(req.body.categoryId);
        const price = toNumber(req.body.price);
        const stockQuantity = Number(req.body.stockQuantity) || 1;
        const description = cleanText(req.body.description) || 'Опис книги буде додано пізніше.';
        const imageUrl = cleanText(req.body.imageUrl) || 'images/library.jpg';

        if (!authorId || !categoryId) {
            return res.status(400).json({
                success: false,
                message: 'Оберіть автора та категорію.'
            });
        }

        const [result] = await db.execute(`
            INSERT INTO books (
                title,
                author_id,
                category_id,
                price,
                stock_quantity,
                description,
                image_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            title,
            authorId,
            categoryId,
            price,
            stockQuantity,
            description,
            imageUrl
        ]);

        res.status(201).json({
            success: true,
            message: 'Книгу додано.',
            bookId: result.insertId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося додати книгу.',
            error: error.message
        });
    }
});

app.patch('/api/admin/books/:id', async (req, res) => {
    try {
        const bookId = Number(req.params.id);

        const title = cleanText(req.body.title);
        const authorId = Number(req.body.authorId);
        const categoryId = Number(req.body.categoryId);
        const price = toNumber(req.body.price);
        const stockQuantity = Number(req.body.stockQuantity) || 0;
        const description = cleanText(req.body.description);
        const imageUrl = cleanText(req.body.imageUrl);

        if (!bookId || !title || !authorId || !categoryId) {
            return res.status(400).json({
                success: false,
                message: 'Некоректні дані книги.'
            });
        }

        const [result] = await db.execute(`
            UPDATE books
            SET 
                title = ?,
                author_id = ?,
                category_id = ?,
                price = ?,
                stock_quantity = ?,
                description = ?,
                image_url = ?
            WHERE book_id = ?
        `, [
            title,
            authorId,
            categoryId,
            price,
            stockQuantity,
            description || '',
            imageUrl || '',
            bookId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Книгу не знайдено.'
            });
        }

        res.json({
            success: true,
            message: 'Книгу оновлено.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося оновити книгу.',
            error: error.message
        });
    }
});

app.delete('/api/admin/books/:id', async (req, res) => {
    try {
        const bookId = Number(req.params.id);

        if (!bookId) {
            return res.status(400).json({
                success: false,
                message: 'Некоректний ID книги.'
            });
        }

        const [usedInOrders] = await db.execute(`
            SELECT order_item_id
            FROM order_items
            WHERE book_id = ?
            LIMIT 1
        `, [bookId]);

        if (usedInOrders.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Книгу не можна видалити, бо вона вже є в замовленнях.'
            });
        }

        const [result] = await db.execute(`
            DELETE FROM books
            WHERE book_id = ?
        `, [bookId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Книгу не знайдено.'
            });
        }

        res.json({
            success: true,
            message: 'Книгу видалено.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Не вдалося видалити книгу.',
            error: error.message
        });
    }
});

/* =====================================================
   ЗАПУСК СЕРВЕРА
===================================================== */

app.listen(PORT, () => {
    console.log(`Сервер запущено: http://localhost:${PORT}`);
});