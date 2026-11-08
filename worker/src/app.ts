import { Hono } from 'hono';
import { devices_router } from './controllers/devices';
import { login_router } from './controllers/login';
import { parishes_router } from './controllers/parishes';
import { sync_router } from './controllers/sync';
import { users_router } from './controllers/users';
import { authenticate, cors, error_handler, not_found, type AppEnv } from './utils/middleware';

const app = new Hono<AppEnv>();

app.use('*', cors);


app.use('/api/reference', authenticate);
app.use('/api/sync/*', authenticate);
app.use('/api/users/*', authenticate);
app.use('/api/devices/:id/key', authenticate);

app.route('/api/auth', login_router);
app.route('/api/parishes', parishes_router);
app.route('/api/users', users_router);
app.route('/api/devices', devices_router);
app.route('/api', sync_router);

app.notFound(not_found);
app.onError(error_handler);

export default app;