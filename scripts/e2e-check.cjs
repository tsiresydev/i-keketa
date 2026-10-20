/**
 * Vérification fonctionnelle bout-en-bout contre un serveur réellement démarré.
 * Usage : node scripts/e2e-check.cjs <url-api>
 */
const { io } = require('socket.io-client');

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3100';

const call = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
};

const waitFor = (socket, event, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout sur ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });

const main = async () => {
  const results = [];
  const check = (label, condition, detail = '') => {
    results.push({ label, ok: Boolean(condition), detail });
    console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  const health = await call('/health');
  check(
    'GET /health',
    health.status === 200 && health.body?.status === 'ok',
    JSON.stringify(health.body),
  );

  const stamp = Date.now();
  const registration = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `Rakoto${stamp}@example.mg`, password: 'MotDePasse1' }),
  });
  check(
    'POST /api/auth/register',
    registration.status === 201 && typeof registration.body?.token === 'string',
    `statut ${registration.status}`,
  );

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `rakoto${stamp}@example.mg`, password: 'MotDePasse1' }),
  });
  check(
    'POST /api/auth/login',
    login.status === 200 && typeof login.body?.token === 'string',
    `statut ${login.status}`,
  );

  const badLogin = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: `rakoto${stamp}@example.mg`, password: 'MauvaisMotDePasse1' }),
  });
  check(
    'POST /api/auth/login (mot de passe erroné)',
    badLogin.status === 401,
    `statut ${badLogin.status}`,
  );

  const me = await call('/api/users/me', {
    headers: { Authorization: `Bearer ${registration.body.token}` },
  });
  check(
    'GET /api/users/me',
    me.status === 200 && me.body?.user?.email === `rakoto${stamp}@example.mg`,
    `statut ${me.status}`,
  );

  const noAuth = await call('/api/users/me');
  check('GET /api/users/me (sans jeton)', noAuth.status === 401, `statut ${noAuth.status}`);

  // Deux utilisateurs distincts pour déclencher la mise en relation.
  const second = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `Fara${stamp}@example.mg`, password: 'MotDePasse1' }),
  });
  const alice = await connect(registration.body.token);
  const bob = await connect(second.body.token);

  const aliceMatch = waitFor(alice, 'match:found');
  const bobMatch = waitFor(bob, 'match:found');
  alice.emit('queue:join');
  bob.emit('queue:join');

  const [aliceEvent, bobEvent] = await Promise.all([aliceMatch, bobMatch]);
  check(
    'Mise en relation aléatoire',
    aliceEvent.matchId === bobEvent.matchId,
    `match ${aliceEvent.matchId}`,
  );
  check(
    'Chaque partenaire voit le pseudonyme de l’autre',
    aliceEvent.partner.pseudonym === second.body.user.pseudonym &&
      bobEvent.partner.pseudonym === registration.body.user.pseudonym,
    `${aliceEvent.partner.pseudonym} / ${bobEvent.partner.pseudonym}`,
  );
  check(
    'Pseudonymes anonymes croisés',
    aliceEvent.partner.pseudonym !== bobEvent.partner.pseudonym,
    `${aliceEvent.partner.pseudonym} / ${bobEvent.partner.pseudonym}`,
  );

  const bobReceives = waitFor(bob, 'chat:message');
  const aliceReceives = waitFor(alice, 'chat:message');
  alice.emit('chat:message', { matchId: aliceEvent.matchId, content: 'Salut, ça va ?' });

  const [bobMessage, aliceMessage] = await Promise.all([bobReceives, aliceReceives]);
  check(
    'Message temps réel livré au partenaire',
    bobMessage.message.content === 'Salut, ça va ?' &&
      aliceMessage.message.content === 'Salut, ça va ?',
    bobMessage.message.content,
  );

  const history = await call(`/api/chat/matches/${aliceEvent.matchId}/messages`, {
    headers: { Authorization: `Bearer ${registration.body.token}` },
  });
  check(
    'GET /api/chat/matches/:id/messages',
    history.status === 200 && history.body?.messages?.length === 1,
    `statut ${history.status}, ${history.body?.messages?.length ?? 0} message(s)`,
  );

  const third = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: `Tiana${stamp}@example.mg`, password: 'MotDePasse1' }),
  });
  const outsider = await call(`/api/chat/matches/${aliceEvent.matchId}/messages`, {
    headers: { Authorization: `Bearer ${third.body.token}` },
  });
  check('Historique inaccessible à un tiers', outsider.status === 403, `statut ${outsider.status}`);

  const emptyMessage = waitFor(alice, 'chat:error');
  alice.emit('chat:message', { matchId: aliceEvent.matchId, content: '   ' });
  const errorPayload = await emptyMessage;
  check('Message vide refusé', errorPayload.code === 'INVALID_MESSAGE', errorPayload.code);

  alice.disconnect();
  bob.disconnect();

  const failures = results.filter((entry) => !entry.ok);
  console.log(`\n${results.length - failures.length}/${results.length} vérifications réussies.`);
  process.exit(failures.length === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error('ÉCHEC :', error.message);
  process.exit(1);
});
