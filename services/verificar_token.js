function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // formato "Bearer token"

  if (!token) return res.status(401).json({ ok: false, msg: 'Token no enviado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ ok: false, msg: 'Token inválido o expirado' });

    req.user = user; // lo guardamos en la request
    next();
  });
}

module.exports = { verificarToken };