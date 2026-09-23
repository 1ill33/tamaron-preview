const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

// Exercise the real Express middleware without depending on a running preview.
process.env.RESIDENT_PASSWORD = 'access-control-test-password';
process.env.SESSION_SECRET = require('node:crypto').randomBytes(32).toString('hex');
const hosted = process.env.NODE_ENV === 'production';
const app = require('../server');
const server = app.listen(0, '127.0.0.1', async () => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = (url, options = {}) => fetch(origin + url, {
        redirect: 'manual', ...options,
        headers: { ...(hosted ? { 'X-Forwarded-Proto': 'https' } : {}), ...options.headers }
    });
    const rawRequest = (url) => new Promise((resolve, reject) => {
        http.get(origin + url, (response) => {
            response.resume();
            response.on('end', () => resolve(response.statusCode));
        }).on('error', reject);
    });
    function filesUnder(directory) {
        return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            const file = path.join(directory, entry.name);
            return entry.isDirectory() ? filesUnder(file) : [file];
        });
    }
    try {
        for (const url of ['/', '/index.html', '/style.css', '/script.js', '/banner.jpeg', '/wood.jpg', '/grass2.jpg',
            '/downloads/bylaws.pdf', '/downloads/rules.pdf', '/downloads/calendar.pdf']) {
            assert.equal((await request(url, { method: 'HEAD' })).status, 200, url);
        }
        const protectedUrls = ['resident', 'resident-bulletin', 'resident-minutes', 'resident-clubhouse']
            .flatMap(page => ['/' + page, '/' + page + '.html']);
        const publicRoot = path.join(__dirname, '..', 'public');
        const publicPdfs = new Set(['bylaws.pdf', 'rules.pdf', 'calendar.pdf']);
        for (const file of filesUnder(path.join(publicRoot, 'downloads'))) {
            if (publicPdfs.has(path.relative(path.join(publicRoot, 'downloads'), file))) continue;
            protectedUrls.push('/' + path.relative(publicRoot, file).split(path.sep).map(encodeURIComponent).join('/'));
        }
        // Future documents are protected even before a corresponding file exists.
        protectedUrls.push('/downloads/future-document.pdf');
        for (const url of protectedUrls) {
            for (const method of ['GET', 'HEAD']) {
                const response = await request(url, { method, headers: { Range: 'bytes=0-31' } });
                assert.equal(response.status, 302, `${method} ${url}`);
                assert.equal(response.headers.get('location'), '/');
                assert.match(response.headers.get('cache-control'), /no-store/);
                assert.ok(!response.headers.get('content-type')?.includes('application/pdf'));
                await response.arrayBuffer();
            }
        }
        // Alternate spellings and encoded paths must not bypass the boundary.
        for (const url of ['/RESIDENT.HTML', '/%72esident.html', '/resident.html/',
            '/downloads/%42oard2026.pdf', '/downloads%2fBoard2026.pdf',
            '/downloads/../resident.html', '/downloads/%2e%2e/server.js',
            '/downloads/bylaws.pdf/../Board2026.pdf', '/server.js', '/docs/chat-history/website-with-login-tab.md']) {
            assert.ok([302, 400, 403, 404].includes(await rawRequest(url)), url);
        }
        const wrong = await request('/resident-login', {
            method: 'POST', body: new URLSearchParams({ password: 'wrong' })
        });
        assert.equal(wrong.status, 401);
        const login = await request('/resident-login', {
            method: 'POST', body: new URLSearchParams({ password: process.env.RESIDENT_PASSWORD })
        });
        assert.equal(login.status, 302);
        assert.equal(login.headers.get('location'), '/resident');
        const cookieHeader = login.headers.get('set-cookie');
        assert.match(cookieHeader, /HttpOnly/);
        assert.match(cookieHeader, /SameSite=Lax/);
        assert.equal(/; Secure/i.test(cookieHeader), hosted);
        const cookie = cookieHeader.split(';')[0];
        for (const url of protectedUrls.slice(0, -1)) {
            const response = await request(url, { method: 'HEAD', headers: { Cookie: cookie } });
            assert.equal(response.status, 200, url);
            assert.match(response.headers.get('cache-control'), /no-store/);
        }
        const pdf = await request('/downloads/Board2026.pdf', {
            headers: { Cookie: cookie, Range: 'bytes=0-31' }
        });
        assert.equal(pdf.status, 206);
        assert.match(pdf.headers.get('content-type'), /application\/pdf/);
        assert.match(pdf.headers.get('cache-control'), /no-store/);
        await pdf.arrayBuffer();
        const secondLogin = await request('/resident-login', {
            method: 'POST', headers: { Cookie: cookie },
            body: new URLSearchParams({ password: process.env.RESIDENT_PASSWORD })
        });
        const newCookie = secondLogin.headers.get('set-cookie').split(';')[0];
        assert.notEqual(cookie, newCookie);
        assert.equal((await request('/resident', { headers: { Cookie: cookie } })).status, 302);
        const logout = await request('/logout', { headers: { Cookie: newCookie } });
        assert.equal(logout.status, 302);
        assert.match(logout.headers.get('set-cookie'), /connect\.sid=;/);
        for (const url of ['/resident.html', '/downloads/Board2026.pdf']) {
            assert.equal((await request(url, { headers: { Cookie: newCookie } })).status, 302);
        }
        let limited;
        for (let attempt = 0; attempt < 11; attempt++) {
            limited = await request('/resident-login', {
                method: 'POST', body: new URLSearchParams({ password: 'wrong' })
            });
            await limited.text();
        }
        assert.equal(limited.status, 429);
        console.log(`Access checks passed: public assets, ${protectedUrls.length} protected URLs, encoded paths, login, session rotation, PDF ranges, and logout.`);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    } finally {
        server.close();
        server.closeAllConnections();
    }
});
