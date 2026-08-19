import app from './app.js';
const server = app.listen(4005, async () => {
    console.log('Test server running on port 4005');
    try {
        // 1. Test OPTIONS preflight from https://pm-project-frontend.vercel.app
        const resOptions = await fetch('http://localhost:4005/auth/register', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://pm-project-frontend.vercel.app',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
            },
        });
        console.log('--- OPTIONS Response ---');
        console.log('Status:', resOptions.status);
        console.log('Access-Control-Allow-Origin:', resOptions.headers.get('access-control-allow-origin'));
        console.log('Access-Control-Allow-Methods:', resOptions.headers.get('access-control-allow-methods'));
        console.log('Access-Control-Allow-Headers:', resOptions.headers.get('access-control-allow-headers'));
        // 2. Test OPTIONS preflight from http://localhost:5173
        const resOptionsLocal = await fetch('http://localhost:4005/auth/register', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type',
            },
        });
        console.log('--- OPTIONS Local Response ---');
        console.log('Status:', resOptionsLocal.status);
        console.log('Access-Control-Allow-Origin:', resOptionsLocal.headers.get('access-control-allow-origin'));
        // 3. Test POST request from https://pm-project-frontend.vercel.app
        const resPost = await fetch('http://localhost:4005/auth/register', {
            method: 'POST',
            headers: {
                'Origin': 'https://pm-project-frontend.vercel.app',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: 'Test User' }),
        });
        console.log('--- POST Response ---');
        console.log('Status:', resPost.status);
        console.log('Access-Control-Allow-Origin:', resPost.headers.get('access-control-allow-origin'));
    }
    catch (err) {
        console.error('Error during test:', err);
    }
    finally {
        server.close();
    }
});
