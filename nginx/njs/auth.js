var JWT_SECRET = process.env.JWT_SECRET || "i-hate-my-job-because-nginx-jwt-does-work";
var JWT_ALGORITHM = process.env.JWT_ALGORITHM || "HS256";



function base64urlDecode(str) {
    var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
        b64 += '=';
    }
    return Buffer.from(b64, 'base64');
}

function stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
}

function arrayBufferToBase64url(buffer) {
    return Buffer.from(buffer).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function getHmacAlgorithmConfig(alg) {
    if (alg === 'HS256') {
        return { name: 'HMAC', hash: 'SHA-256' };
    }
    if (alg === 'HS384') {
        return { name: 'HMAC', hash: 'SHA-384' };
    }
    if (alg === 'HS512') {
        return { name: 'HMAC', hash: 'SHA-512' };
    }
    return null;
}

async function verifyHmacSignature(secret, signingInput, signatureB64, alg) {
    var conf = getHmacAlgorithmConfig(alg);
    var key;
    var signature;
    var expectedB64;

    if (!conf) {
        return false;
    }

    key = await crypto.subtle.importKey(
        'raw',
        stringToArrayBuffer(secret),
        conf,
        false,
        ['sign']
    );

    signature = await crypto.subtle.sign(
        'HMAC',
        key,
        stringToArrayBuffer(signingInput)
    );

    expectedB64 = arrayBufferToBase64url(signature);
    return expectedB64 === signatureB64;
}

function parseRequestedUserId(r) {
    var m;
    if (r.variables && r.variables.url_user_id) {
        return String(r.variables.url_user_id).replace(/^\s+|\s+$/g, '');
    }
    m = r.uri.match(/^\/micro_images\/([^/]+)_images\.png$/);
    if (m) {
        return String(m[1]).replace(/^\s+|\s+$/g, '');
    }
    return null;
}

async function verifyJwt(r) {
    var token = null;
    var authHeader = r.headersIn['Authorization'] || '';
    var parts;
    var headerB64;
    var payloadB64;
    var signatureB64;
    var signingInput;
    var payload;
    var header;
    var urlUserId;
    var configuredAlg = JWT_ALGORITHM;
    var ok;
    var jwtUserId;

    if (authHeader.indexOf('Bearer ') === 0) {
        token = authHeader.substr(7).trim();
    } else if (r.args.token) {
        token = r.args.token;
    }

    if (!token) {
        r.warn('auth reject: missing token');
        r.return(401, '');
        return;
    }

    parts = token.split('.');
    if (parts.length !== 3) {
        r.warn('auth reject: malformed token');
        r.return(401, '');
        return;
    }

    headerB64 = parts[0];
    payloadB64 = parts[1];
    signatureB64 = parts[2];
    signingInput = headerB64 + '.' + payloadB64;

    try {
        header = JSON.parse(base64urlDecode(headerB64).toString('utf8'));
    } catch (e1) {
        r.warn('auth reject: invalid header json');
        r.return(401, '');
        return;
    }

    if (!header.alg || header.alg !== configuredAlg) {
        r.warn('auth reject: header alg=' + header.alg + ', configured alg=' + configuredAlg);
        r.return(401, '');
        return;
    }

    if (configuredAlg.indexOf('HS') === 0) {
        ok = await verifyHmacSignature(JWT_SECRET, signingInput, signatureB64, configuredAlg);
        if (!ok) {
            r.warn('auth reject: signature mismatch');
            r.return(401, '');
            return;
        }
    } else {
        r.warn('auth error: unsupported algorithm ' + configuredAlg);
        r.return(500, 'Unsupported JWT_ALGORITHM: ' + configuredAlg);
        return;
    }

    try {
        payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
    } catch (e2) {
        r.warn('auth reject: invalid payload json');
        r.return(401, '');
        return;
    }

    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        r.warn('auth reject: token expired, exp=' + payload.exp);
        r.return(401, '');
        return;
    }

    urlUserId = parseRequestedUserId(r);
    jwtUserId = (typeof payload.user_id === 'undefined' || payload.user_id === null)
        ? null
        : String(payload.user_id).replace(/^\s+|\s+$/g, '');

    r.warn('auth debug: jwt_user_id=' + jwtUserId + ', url_user_id=' + urlUserId + ', uri=' + r.uri);

    if (!urlUserId) {
        r.warn('auth reject: unable to parse url user id');
        r.return(403, '');
        return;
    }

    if (jwtUserId === null || jwtUserId !== urlUserId) {
        r.warn('auth reject: user mismatch');
        r.return(403, '');
        return;
    }

    r.warn('auth pass: user matched');
    r.return(200, '');
}

export default { verifyJwt: verifyJwt };