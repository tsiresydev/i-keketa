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

/** Requête multipart (envoi d'une photo de profil). */
const upload = async (path, token, fileName, contentType, bytes) => {
  const formData = new FormData();
  formData.append('photo', new Blob([bytes], { type: contentType }), fileName);

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
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

  // Utilisateur tiers : vérifie l'accès réservé aux participants, puis sert
  // de cible à la discussion directe.
  const third = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `Tiana${stamp}@example.mg`,
      password: 'MotDePasse1',
      displayName: 'Tiana',
    }),
  });

  if (third.status !== 201) {
    console.error(
      `ÉCHEC : inscription impossible (statut ${third.status}). ` +
        `Limite d'authentification atteinte ? Attendez la fin de la fenêtre de rate limiting ` +
        `ou augmentez AUTH_RATE_LIMIT_MAX.`,
    );
    process.exit(1);
  }

  const outsider = await call(`/api/chat/matches/${aliceEvent.matchId}/messages`, {
    headers: { Authorization: `Bearer ${third.body.token}` },
  });
  check('Historique inaccessible à un tiers', outsider.status === 403, `statut ${outsider.status}`);

  const emptyMessage = waitFor(alice, 'chat:error');
  alice.emit('chat:message', { matchId: aliceEvent.matchId, content: '   ' });
  const errorPayload = await emptyMessage;
  check('Message vide refusé', errorPayload.code === 'INVALID_MESSAGE', errorPayload.code);

  /* ---------- Sprint 2 : profil, photo, annuaire, discussion directe ---------- */

  const token = registration.body.token;

  const profileUpdate = await call('/api/users/me', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      displayName: 'Miora',
      interests: ['musique', 'voyage'],
      location: 'Antananarivo',
    }),
  });
  check(
    'PUT /api/users/me',
    profileUpdate.status === 200 &&
      profileUpdate.body?.user?.displayName === 'Miora' &&
      profileUpdate.body?.user?.interests?.length === 2,
    `statut ${profileUpdate.status}`,
  );

  const invalidProfile = await call('/api/users/me', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ displayName: 'x' }),
  });
  check(
    'PUT /api/users/me (données invalides)',
    invalidProfile.status === 400,
    `statut ${invalidProfile.status}`,
  );

  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
  ]);

  const photo = await upload('/api/users/me/photo', token, 'profil.png', 'image/png', pngBytes);
  check(
    'POST /api/users/me/photo',
    photo.status === 200 && typeof photo.body?.user?.photoUrl === 'string',
    `statut ${photo.status}`,
  );

  const servedPhoto = await fetch(`${baseUrl}${photo.body.user.photoUrl}`);
  check(
    'GET /uploads/photos/:fichier',
    servedPhoto.status === 200 &&
      (servedPhoto.headers.get('content-type') ?? '').includes('image/png'),
    `statut ${servedPhoto.status}`,
  );

  const fakeImage = await upload(
    '/api/users/me/photo',
    token,
    'faux.png',
    'image/png',
    new Uint8Array([0x41, 0x42, 0x43, 0x44]),
  );
  check(
    'Photo dont le contenu ne correspond pas refusée',
    fakeImage.status === 400,
    `statut ${fakeImage.status}`,
  );

  const badType = await upload(
    '/api/users/me/photo',
    token,
    'script.txt',
    'text/plain',
    new Uint8Array([0x41, 0x42]),
  );
  check('Photo de type non autorisé refusée', badType.status === 400, `statut ${badType.status}`);

  const photoDeletion = await call('/api/users/me/photo', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  check(
    'DELETE /api/users/me/photo',
    photoDeletion.status === 200 && photoDeletion.body?.user?.photoUrl === undefined,
    `statut ${photoDeletion.status}`,
  );

  const directory = await call('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(
    'GET /api/users',
    directory.status === 200 && Array.isArray(directory.body?.users),
    `statut ${directory.status}, ${directory.body?.total ?? 0} résultat(s)`,
  );

  const filtered = await call('/api/users?interests=musique', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const filteredUsers = filtered.body?.users ?? [];
  const allMatchInterest = filteredUsers.every((user) =>
    (user.interests ?? []).some((interest) => interest.toLowerCase() === 'musique'),
  );
  check(
    'GET /api/users (filtre par intérêt)',
    filtered.status === 200 && allMatchInterest,
    `statut ${filtered.status}, ${filtered.body?.total ?? 0} résultat(s)`,
  );

  const selfExclusion = await call('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const includesSelf = (selfExclusion.body?.users ?? []).some(
    (user) => user.id === registration.body.user.id,
  );
  check('L’utilisateur courant est exclu de l’annuaire', !includesSelf, `${includesSelf}`);

  const unavailable = waitFor(alice, 'chat:error');
  alice.emit('chat:start', { userId: '507f1f77bcf86cd799439011' });
  const unavailableError = await unavailable;
  check(
    'chat:start vers un utilisateur indisponible',
    unavailableError.code === 'USER_UNAVAILABLE',
    unavailableError.code,
  );

  const tianaSocket = await connect(third.body.token);

  const directMatch = waitFor(alice, 'match:found');
  const tianaMatch = waitFor(tianaSocket, 'match:found');
  alice.emit('chat:start', { userId: third.body.user.id });

  const [directEvent, tianaEvent] = await Promise.all([directMatch, tianaMatch]);
  check(
    'Discussion directe (chat:start)',
    directEvent.matchId === tianaEvent.matchId,
    `match ${directEvent.matchId}`,
  );
  check(
    'Le nom affiché est transmis au partenaire',
    directEvent.partner.displayName === 'Tiana',
    directEvent.partner.displayName,
  );
  check(
    'Un profil modifié après la connexion est pris en compte',
    tianaEvent.partner.displayName === 'Miora',
    tianaEvent.partner.displayName,
  );

  const directMessage = waitFor(tianaSocket, 'chat:message');
  alice.emit('chat:message', { matchId: directEvent.matchId, content: 'Bonjour Tiana' });
  const directPayload = await directMessage;
  check(
    'Message dans une discussion directe',
    directPayload.message.content === 'Bonjour Tiana',
    directPayload.message.content,
  );

  /* ---------- Sprint 3 : signalisation audiovisuelle et signalements ---------- */

  const callRequest = waitFor(tianaSocket, 'media:request');
  alice.emit('media:request', { matchId: directEvent.matchId, audio: true, video: true });
  const callRequestPayload = await callRequest;
  check(
    'Demande d’appel reliée au partenaire',
    callRequestPayload.matchId === directEvent.matchId && callRequestPayload.audio === true,
    `match ${callRequestPayload.matchId}`,
  );

  const callAccepted = waitFor(alice, 'media:accepted');
  tianaSocket.emit('media:accept', { matchId: directEvent.matchId });
  const acceptedPayload = await callAccepted;
  check(
    'Acceptation d’appel reliée à l’appelant',
    acceptedPayload.matchId === directEvent.matchId,
    `match ${acceptedPayload.matchId}`,
  );

  const offerReceived = waitFor(tianaSocket, 'media:offer');
  alice.emit('media:offer', {
    matchId: directEvent.matchId,
    description: JSON.stringify({ type: 'offer', sdp: 'v=0' }),
  });
  const offerPayload = await offerReceived;
  check(
    'Offre SDP reliée au partenaire',
    offerPayload.description.includes('offer'),
    offerPayload.description.slice(0, 24),
  );

  const answerReceived = waitFor(alice, 'media:answer');
  tianaSocket.emit('media:answer', {
    matchId: directEvent.matchId,
    description: JSON.stringify({ type: 'answer', sdp: 'v=0' }),
  });
  const answerPayload = await answerReceived;
  check(
    'Réponse SDP reliée à l’appelant',
    answerPayload.description.includes('answer'),
    answerPayload.description.slice(0, 24),
  );

  const candidateReceived = waitFor(tianaSocket, 'media:candidate');
  alice.emit('media:candidate', {
    matchId: directEvent.matchId,
    candidate: JSON.stringify({ candidate: 'candidate:1 1 udp', sdpMid: '0' }),
  });
  const candidatePayload = await candidateReceived;
  check(
    'Candidat ICE relié au partenaire',
    candidatePayload.candidate.includes('candidate'),
    candidatePayload.candidate.slice(0, 24),
  );

  const stateReceived = waitFor(tianaSocket, 'media:state');
  alice.emit('media:state', { matchId: directEvent.matchId, audio: false, video: true });
  const statePayload = await stateReceived;
  check(
    'État micro/caméra relié au partenaire',
    statePayload.audio === false && statePayload.video === true,
    `audio ${statePayload.audio}, video ${statePayload.video}`,
  );

  const callEnded = waitFor(tianaSocket, 'media:ended');
  alice.emit('media:end', { matchId: directEvent.matchId });
  const endedPayload = await callEnded;
  check(
    'Fin d’appel reliée au partenaire',
    endedPayload.matchId === directEvent.matchId && endedPayload.reason === 'hangup',
    `raison ${endedPayload.reason}`,
  );

  const report = await call('/api/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      matchId: directEvent.matchId,
      reason: 'harassment',
      details: 'Insistances déplacées.',
    }),
  });
  check(
    'POST /api/reports',
    report.status === 201 &&
      report.body?.report?.status === 'pending' &&
      report.body?.report?.reportedPseudonym === third.body.user.pseudonym,
    `statut ${report.status}`,
  );

  const duplicateReport = await call('/api/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ matchId: directEvent.matchId, reason: 'harassment' }),
  });
  check(
    'POST /api/reports (doublon refusé)',
    duplicateReport.status === 409,
    `statut ${duplicateReport.status}`,
  );

  const outsiderReport = await call('/api/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${second.body.token}` },
    body: JSON.stringify({ matchId: directEvent.matchId, reason: 'spam' }),
  });
  check(
    'POST /api/reports (tiers refusé)',
    outsiderReport.status === 404,
    `statut ${outsiderReport.status}`,
  );

  const ownReports = await call('/api/reports/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(
    'GET /api/reports/me',
    ownReports.status === 200 && ownReports.body?.reports?.length === 1,
    `statut ${ownReports.status}, ${ownReports.body?.reports?.length ?? 0} signalement(s)`,
  );

  tianaSocket.disconnect();
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
