// src/server.ts
import app from './app.js';
import { ENV } from './config/env.js';
// Vercel detects this default export for Express deployments.
export default app;
// Local / traditional Node hosting
if (!process.env.VERCEL) {
    const port = Number(ENV.PORT) || 4000;
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}
