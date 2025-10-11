const express = require('express');
const cors = require('cors');
const Usuario = require('./models/Usuario');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors({
  origin: ["http://192.168.0.4:3000", "https://wialarm-render.onrender.com"], // tus frontends
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10; // podés usar entre 10 y 12 para buena seguridad

const session = require('express-session');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // true si usás HTTPS
}));

const JWT_SECRET = process.env.JWT_SECRET; // guardalo en .env

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client("TU_WEB_CLIENT_ID.apps.googleusercontent.com");

app.get("/", (req, res) => res.send("Servidor activo 🚀"));

//======================================== USUARIOS ========================================

app.post('/api/registro', async (req, res) => {
  const { nombre, apellido, email, clave, expoToken } = req.body;

  try {
    // Verificamos si el usuario ya existe
    const existe = await Usuario.findOne({ email });
    if (existe) {
      return res.status(409).json({ ok: false, msg: 'El email ya está registrado' });
    }

    // Encriptamos la clave
    const claveHasheada = await bcrypt.hash(clave, saltRounds);

    // Guardamos el usuario
    const nuevoUsuario = new Usuario({
      nombre,
      apellido,
      email,
      clave: claveHasheada,
      expoToken
    });

    await nuevoUsuario.save();

    res.status(201).json({ ok: true, msg: 'Usuario registrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al registrar usuario' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, clave } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(clave, usuario.clave);
    if (!coincide) {
      return res.status(401).json({ ok: false, msg: 'Contraseña incorrecta' });
    }

    const payload = {
      id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
    };

    req.session.idUsuario = usuario._id;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      ok: true,
      msg: 'Login exitoso',
      token,
      usuario: payload, // opcional si querés mostrar datos del usuario
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al iniciar sesión' });
  }
});

app.post('/api/logingoogle', async (req, res) => {
  try {
    const { id_token } = req.body;

    // Verificar el token con Google
    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, given_name, family_name } = payload;

    // Buscar si el usuario ya existe
    let usuario = await Usuario.findOne({ email });

    if (!usuario) {
      // Crear uno nuevo con clave vacía (porque es login social)
      usuario = new Usuario({
        nombre: given_name || '',
        apellido: family_name || '',
        email,
        clave: await bcrypt.hash(Math.random().toString(36).slice(-8), 10),
      });
      await usuario.save();
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: usuario._id, email: usuario.email, nombre: usuario.nombre },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      ok: true,
      msg: 'Login Google exitoso',
      token,
      usuario: { nombre: usuario.nombre, email: usuario.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al autenticar con Google' });
  }
});

app.get('/api/usuario', async (req, res) => {
  try {
    if (!req.session.idUsuario) {
      return res.status(401).json({ ok: false, msg: 'No hay sesión activa' });
    }

    // Busco el usuario y si es PREMIUM, le hago populate de adherentes
    const usuario = await Usuario.findById(req.session.idUsuario)
      .select('-clave') // no enviamos la clave
      .populate({
        path: 'adherentes',
        select: 'nombre apellido email tipo', // los campos que querés mostrar
      })
      .populate({
        path: 'premiumRef',
        select: 'nombre apellido email', // si es adherente, podés mostrar su premium
      });

    if (!usuario) {
      return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });
    }

    res.status(200).json({
      ok: true,
      usuario,
    });
  } catch (err) {
    console.error('Error en /api/usuario:', err);
    res.status(500).json({ ok: false, msg: 'Error al obtener usuario' });
  }
});


//SUSCRIPCION A PREMIUM
app.put('/api/usuario/premium', async (req, res) => {
  const idUsuario = req.session.idUsuario; // usuario logueado
  const { meses, monto } = req.body; // por ahora opcional, solo para info

  if (!idUsuario) return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });

  try {
    // Actualizamos tipo a PREMIUM
    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      idUsuario,
      { tipo: 'PREMIUM' },
      { new: true }
    );

    res.json({ ok: true, msg: 'Usuario actualizado a PREMIUM', usuario: usuarioActualizado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar usuario' });
  }
});

// CANCELAR SUSCRIPCIÓN
app.put('/api/usuario/normal', async (req, res) => {
  const idUsuario = req.session.idUsuario;

  if (!idUsuario) return res.status(401).json({ ok: false, msg: 'Usuario no autenticado' });

  try {
    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      idUsuario,
      { tipo: 'NORMAL' },
      { new: true }
    );

    res.json({ ok: true, msg: 'Usuario actualizado a NORMAL', usuario: usuarioActualizado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al actualizar usuario' });
  }
});

app.post('/api/adherente', async (req, res) => {
  try {
    const { nombre, apellido, email, clave } = req.body;

    console.log("USUARIO PREMIUM? " + req.session.idUsuario)

    // Buscamos el usuario autenticado (el premium)
    const usuario = await Usuario.findById(req.session.idUsuario);

    if (!usuario || usuario.tipo !== 'PREMIUM') {
      return res.status(403).json({ ok: false, error: 'Solo usuarios PREMIUM pueden crear adherentes' });
    }

    // Validar límite de adherentes
    const maxAdherentes = parseInt(process.env.MAXIMO_ADHERENTES || 3);
    if (usuario.adherentes.length >= maxAdherentes) {
      return res.status(400).json({ ok: false, error: 'Has alcanzado el máximo de adherentes' });
    }

    // Verificar si el email ya existe
    const existente = await Usuario.findOne({ email });
    if (existente) {
      return res.status(400).json({ ok: false, error: 'El email ya está registrado' });
    }

    const claveHasheada = await bcrypt.hash(clave, saltRounds);

    // Crear el adherente
    const adherente = new Usuario({
      nombre,
      apellido,
      email,
      clave: claveHasheada,
      tipo: 'ADHERENTE',
      premiumRef: usuario._id // vínculo con el premium
    });

    await adherente.save();

    // Agregar adherente a la lista del premium
    usuario.adherentes.push(adherente._id);
    await usuario.save();

    res.json({ ok: true, adherente });
  } catch (err) {
    console.error("Error al crear adherente:", err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});


app.put('/api/usuario/:id', async (req, res) => {
  try {
    const { nombre, apellido, email } = req.body;

    // Verificar si el usuario de sesión coincide con el que intenta modificar
    if (!req.session.idUsuario) {
      return res.status(401).json({ ok: false, msg: 'No autorizado' });
    }

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado' });

    // Actualizar datos personales si están presentes
    if (nombre) usuario.nombre = nombre;
    if (apellido) usuario.apellido = apellido;
    if (email) usuario.email = email;

    await usuario.save();

    res.json({
      ok: true,
      msg: 'Usuario actualizado correctamente',
      usuario: {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
      },
    });
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    res.status(500).json({ ok: false, msg: 'Error interno del servidor' });
  }
});

app.delete('/api/adherente/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.session.idUsuario); // usar session

    if (!usuario || usuario.tipo !== 'PREMIUM') 
      return res.status(403).json({ ok: false, error: 'Solo usuarios PREMIUM pueden eliminar adherentes' });

    if (!usuario.adherentes.includes(req.params.id))
      return res.status(403).json({ ok: false, error: 'Adherente no pertenece a tu cuenta' });

    // Eliminar el usuario adherente de la colección
    await Usuario.findByIdAndDelete(req.params.id);

    // Sacarlo del array de adherentes
    usuario.adherentes = usuario.adherentes.filter(a => a.toString() !== req.params.id);
    await usuario.save();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});




//======================================== REGION ========================================

app.get('/api/regiones', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) return res.status(401).json({ message: 'Usuario no autenticado' });

  const regiones = await Region.find({ userId: idUsuario }); // o WHERE id_usuario = ? si usás SQL

  res.json(regiones);
});

app.post('/api/regiones/add', async (req, res) => {
  try {
    const userId = req.session.idUsuario;
    const { nombre, direccion, ciudad } = req.body;

    if (!nombre || !direccion || !ciudad) {
      return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    const nuevaRegion = new Region({
      nombre,
      direccion,
      ciudad,
      userId
    });

    const savedRegion = await nuevaRegion.save();
    res.status(201).json(savedRegion);

  } catch (error) {
    console.error('Error al agregar región:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

app.put('/api/regiones/:id_reg', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) return res.status(401).json({ message: 'Usuario no autenticado' });

  const { id_reg } = req.params;
  const { nombre, direccion, ciudad } = req.body;

  try {
    // Buscar la región y verificar que pertenece al usuario
    const region = await Region.findOne({ _id: id_reg, userId: idUsuario });
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }

    // Actualizar campos si fueron enviados
    if (nombre !== undefined) region.nombre = nombre;
    if (direccion !== undefined) region.direccion = direccion;
    if (ciudad !== undefined) region.ciudad = ciudad;

    // Guardar cambios
    await region.save();

    res.json({ message: 'Región actualizada', region });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar la región' });
  }
});

app.delete('/api/regiones/:id_reg', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) return res.status(401).json({ message: 'Usuario no autenticado' });

  const { id_reg } = req.params;

  try {
    // Buscar la región del usuario
    const region = await Region.findOne({ _id: id_reg, userId: idUsuario });
    if (!region) return res.status(404).json({ message: 'Región no encontrada' });

    // Buscar todos los dispositivos de la región
    const dispositivos = await Dispositivo.find({ regionId: id_reg });

    // Eliminar cámaras de cada dispositivo
    for (const disp of dispositivos) {
      await Camara.deleteMany({ dispositivoId: disp._id });
    }

    // Eliminar dispositivos
    await Dispositivo.deleteMany({ regionId: id_reg });

    // Finalmente, eliminar la región
    await Region.deleteOne({ _id: id_reg });

    res.json({ message: 'Región y todos sus dispositivos/cámaras eliminados' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar la región' });
  }
});

//======================================== DISPOSITIVO ESP32 ========================================

app.get('/api/usuario/verificar-dispositivos', async (req, res) => {
  try {
    console.log("VERIFICANDO")
    const usuario = await Usuario.findById(req.session.idUsuario);
    if (!usuario) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

    // Obtenemos todas las regiones del usuario
    const regiones = await Region.find({ userId: usuario._id });

    // Contamos todos los dispositivos de todas las regiones del usuario
    const regionIds = regiones.map(r => r._id.toString());
    const cantidadDispositivos = await Dispositivo.countDocuments({ regionId: { $in: regionIds } });
    const maxDispositivos = process.env.MAXIMO_DISPOSITIVOS_CUENTA_NORMAL;
    const puedeAgregar = !(usuario.tipo === 'NORMAL' && cantidadDispositivos >= maxDispositivos);
    console.log(puedeAgregar);
    res.json({
      ok: true,
      tipo: usuario.tipo,
      cantidadDispositivos,
      puedeAgregar,
      maxDispositivos,
    });

  } catch (err) {
    console.error("Error en verificar dispositivos:", err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

app.get('/api/regiones/:id/dispositivos', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  const { id } = req.params; // id de la región
  const dispositivos = await Dispositivo.find({ regionId: id });

  res.json(dispositivos);
});

app.post('/api/regiones/:id/dispositivos/add', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    if (!idUsuario) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { id } = req.params; // id de la región

    const { nombre, mac } = req.body;
    

    if (!nombre || !mac) {
      return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    const nuevoDispositivo = new Dispositivo({
      nombre: nombre,
      macAddress: mac,
      regionId: id,
      activo: true
    });

    const savedDispositivo = await nuevoDispositivo.save();
    res.status(201).json(savedDispositivo);

  } catch (error) {
    console.error('Error al agregar dispositivo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

app.put('/api/regiones/:id_reg/dispositivos/:id_disp', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  const { id_reg, id_disp } = req.params;
  const { nombre, mac, activo } = req.body;

  try {
    // validar que la región pertenece al usuario
    const region = await Region.findOne({ _id: id_reg, userId: idUsuario });
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }

    // actualizar el dispositivo
    const dispositivo = await Dispositivo.findOneAndUpdate(
      { _id: id_disp, regionId: id_reg },
      { $set: { nombre, mac, activo } },
      { new: true } // devuelve el documento actualizado
    );

    if (!dispositivo) {
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    }

    res.json({ message: 'Dispositivo actualizado', dispositivo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar el dispositivo' });
  }
});

app.delete('/api/regiones/:id_reg/dispositivos/:id_disp', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  const { id_reg, id_disp } = req.params;

  try {
    // validar que la región pertenece al usuario
    const region = await Region.findOne({ _id: id_reg, userId: idUsuario });
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }

    // buscar el dispositivo
    const dispositivo = await Dispositivo.findOne({ _id: id_disp, regionId: id_reg });
    if (!dispositivo) {
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    }

    // eliminar cámara asociada (si existe)
    await Camara.deleteOne({ dispositivoId: id_disp });

    // eliminar dispositivo
    await dispositivo.deleteOne();

    res.json({ message: 'Dispositivo y su cámara (si tenía) eliminados' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al eliminar el dispositivo' });
  }
});

//======================================== CAMARA ========================================

app.get('/api/camaras/:id', async (req, res) => {
  try {
    const camara = await Camara.findById(req.params.id);
    if (!camara) return res.status(404).json({ message: 'Cámara no encontrada' });
    res.json(camara);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la cámara' });
  }
});


app.get('/api/regiones/:id_reg/dispositivos/:id_disp/camara', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    const { id_reg, id_disp } = req.params;
    console.log("region: " + id_reg);
    console.log("dispositivo: " + id_disp);

    const regionIdObj = new mongoose.Types.ObjectId(id_reg);
    const dispositivoIdObj = new mongoose.Types.ObjectId(id_disp);

    // Usar el campo correcto: userId
    const region = await Region.findOne({ 
      _id: regionIdObj, 
      userId: idUsuario
    });
    if (!region){
      return res.status(404).json({ message: 'Región no encontrada' });
    } 

    const dispositivo = await Dispositivo.findOne({ 
      _id: dispositivoIdObj, 
      regionId: regionIdObj 
    });
    if (!dispositivo){
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    } 

    const camara = await Camara.findOne({ dispositivoId: dispositivoIdObj });
    return res.json({ camara });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la cámara' });
  }
});

app.delete('/api/camaras/:id_cam', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    if (!idUsuario) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { id_cam } = req.params;

    // Verifico que la cámara existe
    const camara = await Camara.findById(id_cam);
    if (!camara) {
      return res.status(404).json({ message: 'Cámara no encontrada' });
    }

    // Busco el dispositivo asociado
    const dispositivo = await Dispositivo.findById(camara.dispositivoId);
    if (!dispositivo) {
      return res.status(404).json({ message: 'Dispositivo asociado no encontrado' });
    }

    // Verifico que el dispositivo pertenece a una región del usuario
    const region = await Region.findOne({ _id: dispositivo.regionId, userId: idUsuario });
    if (!region) {
      return res.status(403).json({ message: 'No autorizado a eliminar esta cámara' });
    }

    // 1️⃣ Borro la cámara
    await Camara.findByIdAndDelete(id_cam);

    // 2️⃣ Limpio el camaraId en el dispositivo
    dispositivo.camaraId = null;
    await dispositivo.save();

    res.json({
      message: 'Cámara eliminada correctamente y relación con el dispositivo eliminada',
      dispositivoActualizado: dispositivo,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la cámara', error: error.message });
  }
});

app.post('/api/regiones/:id_reg/dispositivos/:id_disp/addcam', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    if (!idUsuario) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { id_reg, id_disp } = req.params;
    const { tipo, activo, streamUrl } = req.body;

    // Verifico que la región existe y pertenece al usuario
    const region = await Region.findOne({ _id: id_reg, userId: idUsuario });
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }

    // Verifico que el dispositivo existe y pertenece a la región
    const dispositivo = await Dispositivo.findOne({ _id: id_disp, regionId: id_reg });
    if (!dispositivo) {
      return res.status(404).json({ message: 'Dispositivo no encontrado en esta región' });
    }

    // Creo la cámara asociada al dispositivo
    const nuevaCamara = new Camara({
      streamUrl,
      activo,
      dispositivoId: id_disp,
      tipo,
    });
    await nuevaCamara.save();

    // Actualizo el dispositivo con el ID de la nueva cámara (relación 1 a 1)
    dispositivo.camaraId = nuevaCamara._id;
    await dispositivo.save();

    res.status(201).json({
      message: 'Cámara agregada y asociada correctamente al dispositivo',
      camara: nuevaCamara,
      dispositivo,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al agregar la cámara', error: error.message });
  }
});

app.put('/api/camaras/:id_cam', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    if (!idUsuario) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const { id_cam } = req.params;
    const { nombre, streamUrl, tipo } = req.body;

    // Buscar la cámara
    const camara = await Camara.findById(id_cam);
    if (!camara) {
      return res.status(404).json({ message: 'Cámara no encontrada' });
    }

    // Buscar el dispositivo al que pertenece
    const dispositivo = await Dispositivo.findById(camara.dispositivoId);
    if (!dispositivo) {
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    }

    // Buscar la región a la que pertenece el dispositivo
    const region = await Region.findById(dispositivo.regionId);
    if (!region || String(region.userId) !== String(idUsuario)) {
      return res.status(403).json({ message: 'No autorizado para editar esta cámara' });
    }

    // Actualizar datos de la cámara
    camara.nombre = nombre ?? camara.nombre;
    camara.streamUrl = streamUrl ?? camara.streamUrl;
    camara.tipo = tipo ?? camara.tipo;

    await camara.save();

    res.json({ message: 'Cámara actualizada correctamente', camara });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al editar la cámara' });
  }
});


//!-----CONEXION A LA BASE DE DATOS
const mongoose = require('mongoose');
const Region = require('./models/Region');
const Dispositivo = require('./models/Dispositivo');
const Camara = require('./models/Camara');
const Notificacion = require('./models/Notificacion');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('🟢 Conectado a MongoDB'))
.catch(err => console.error('🔴 Error al conectar', err));

// --- SOCKET.IO ---
const server = require('http').createServer(app);
const { Server } = require('socket.io');
const { enviarNotificacion } = require('./services/notificaciones');
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get('/api/notificacionesmenu', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  try {
    const notificaciones = await Notificacion.find({ userId: idUsuario })
      .sort({ fechaHora: -1 })
      .limit(3)
      .populate('regionId', 'nombre');

    res.status(200).json({ ok: true, notificaciones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al buscar notificaciones' });
  }
});

app.get('/api/notificaciones', async (req, res) => {
  const idUsuario = req.session.idUsuario;
  if (!idUsuario) {
    return res.status(401).json({ message: 'Usuario no autenticado' });
  }

  try {
    const notificaciones = await Notificacion.find({ userId: idUsuario })
      .sort({ fechaHora: -1 })
      .populate('regionId', 'nombre');

    res.status(200).json({ ok: true, notificaciones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: 'Error al buscar notificaciones' });
  }
});

app.get('/detalle/:id', async (req, res) => {
  try {
    const notificacion = await Notificacion.findById(req.params.id).populate('regionId');
    if (!notificacion) return res.status(404).json({ message: 'Notificación no encontrada' });

    // Traer dispositivos de esa región
    const dispositivos = await Dispositivo.find({ regionId: notificacion.regionId._id });

    // Buscar cámaras activas de esos dispositivos
    const camaras = await Camara.find({ 
      dispositivoId: { $in: dispositivos.map(d => d._id) },
      activo: true
    });

    res.json({
      notificacion,
      region: notificacion.regionId,
      camaras
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener detalle', error });
  }
});

app.post('/api/notificaciones/add', async (req, res) => {
  try {
    const { dispositivos, tipoEvento, descripcion, criticidad } = req.body;

    const notificacion = new Notificacion({
      dispositivos,
      tipoEvento,
      descripcion,
      criticidad
    });

    await notificacion.save();

    // Emitir a los clientes conectados
    io.emit('nuevaNotificacion', notificacion);
    
    res.status(201).json({
      message: 'Notificación creada con éxito',
      notificacion
    });

  } catch (error) {
    console.error('Error al agregar notificación:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

app.post('/api/notificaciones/enviar', async (req, res) => {
  const { dispositivos: macs, tipoEvento, descripcion, criticidad } = req.body;

  if (!macs || macs.length === 0) {
    return res.status(400).json({ error: 'No se enviaron dispositivos' });
  }

  try {
    // 1) Buscar todos los dispositivos por MAC
    const dispositivosDB = await Dispositivo.find({ macAddress: { $in: macs } });
    if (dispositivosDB.length === 0) {
      return res.status(404).json({ error: 'No se encontró ninguno de los dispositivos' });
    }

    // 2) Obtener región (tomamos la del primer dispositivo)
    const region = await Region.findById(dispositivosDB[0].regionId);
    if (!region) {
      return res.status(404).json({ error: 'No se encontró región para los dispositivos' });
    }

    // 3) Usuario dueño de la región
    const usuario = await Usuario.findById(region.userId);
    if (!usuario || !usuario.expoToken || usuario.expoToken.length === 0) {
      return res.status(404).json({ error: 'Usuario sin tokens registrados' });
    }

    // 4) Buscar cámaras vinculadas a los dispositivos
    const dispositivosConCamara = await Promise.all(
      dispositivosDB.map(async (disp) => {
        const camara = await Camara.findOne({ dispositivoId: disp._id, activo: true });
        return {
          nombre: disp.nombre,
          url: camara ? camara.streamUrl : null // null si no tiene cámara
        };
      })
    );

    // 5) Construir mensaje para notificación push
    const mensaje = {
      titulo: `Alerta ${criticidad.toUpperCase()}: ${tipoEvento}`,
      cuerpo: `${descripcion} en ${region.nombre}`,
      data: {
        regionId: region._id,
        tipoEvento,
        criticidad,
        dispositivos: dispositivosConCamara
      }
    };

    // 6) Guardar notificación en DB
    const notificacion = new Notificacion({
      dispositivos: dispositivosConCamara,
      tipoEvento,
      descripcion,
      criticidad,
      regionId: region._id,
      userId: usuario._id
    });

    await notificacion.save();

    // 7) Enviar push
    await enviarNotificacion([usuario.expoToken], mensaje);

    res.json({ success: true, notificacion });
  } catch (error) {
    console.error("Error al procesar notificación:", error);
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/notificaciones/:id', async (req, res) => {
  try {
    const idUsuario = req.session.idUsuario;
    if (!idUsuario) return res.status(401).json({ message: 'Usuario no autenticado' });

    const { id } = req.params;

    const notificacion = await Notificacion.findById(id);
    if (!notificacion) return res.status(404).json({ message: 'Notificación no encontrada' });

    await Notificacion.findByIdAndDelete(id);
    res.json({ message: 'Notificación eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la notificación' });
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});