const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, 'public');
const hosted = process.env.NODE_ENV === 'production';
if (hosted && (!process.env.RESIDENT_PASSWORD || !process.env.SESSION_SECRET)) {
    throw new Error('Set RESIDENT_PASSWORD and SESSION_SECRET in the hosting environment.');
}
const residentPassword = process.env.RESIDENT_PASSWORD || 'NewJersey';
// Render terminates HTTPS at its reverse proxy.
if (hosted) app.set('trust proxy', 1);

// =======================
// BASIC MIDDLEWARE
// =======================
app.use(bodyParser.urlencoded({ extended: true }));
app.disable('x-powered-by');
if (process.env.PREVIEW_MODE === 'true') {
    app.use((req, res, next) => {
        res.set('X-Robots-Tag', 'noindex, nofollow');
        next();
    });
}

// =======================
// SESSION SETUP
// =======================
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: hosted,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// =======================
// AUTH MIDDLEWARE
// =======================
function requireAuth(req, res, next) {
    // Never cache resident pages, documents, or login redirects.
    res.set('Cache-Control', 'private, no-store');
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/');
}

// =======================
// PUBLIC ROUTES
// =======================
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDirectory, 'index.html'));
});

// Only these files are public. Do not expose the entire public directory:
// resident HTML and PDFs live there too.
const publicFiles = [
    'index.html', 'style.css', 'script.js',
    'banner.jpeg', 'wood.jpg', 'grass2.jpg',
    'downloads/governing-documents.pdf', 'downloads/rules.pdf', 'downloads/calendar.pdf',
    'downloads/October 2026.pdf'
];
for (const file of publicFiles) {
    app.get(encodeURI('/' + file), (req, res) => {
        res.sendFile(path.join(publicDirectory, file));
    });
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: 'Too many login attempts. Please try again in 15 minutes.'
});

app.post('/resident-login', loginLimiter, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const { password } = req.body;

    if (password === residentPassword) {
        // Replace any pre-login session so its ID cannot be reused.
        return req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.isAuthenticated = true;
            req.session.save((error) => {
                if (error) return next(error);
                res.redirect('/resident');
            });
        });
    }

    res.status(401).send(`
        <h2>Incorrect password</h2>
        <p><a href="/">Go back</a></p>
    `);
});

// =======================
// RESIDENT ROUTES
// =======================
for (const page of ['resident', 'resident-bulletin', 'resident-minutes', 'resident-clubhouse']) {
    app.get(['/' + page, '/' + page + '.html'], requireAuth, (req, res) => {
        res.sendFile(path.join(publicDirectory, page + '.html'));
    });
}

// The public PDFs above are exceptions. Everything else in downloads,
// including future uploads, is resident-only. Keep PDF range requests working.
app.use('/downloads', requireAuth, express.static(path.join(publicDirectory, 'downloads'), {
    index: false,
    dotfiles: 'deny',
    setHeaders(res) {
        res.set('Cache-Control', 'private, no-store');
    }
}));

app.get('/logout', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: hosted });
        res.redirect('/');
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
