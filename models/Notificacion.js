// models/Notificacion.js
const mongoose = require('mongoose');

const NotificacionSchema = new mongoose.Schema({
  dispositivos: [{
    nombre: { type: String, required: true },
    url: { type: String, default: null }
  }],
  tipoEvento: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  criticidad: {
    type: String,
    enum: ['baja', 'media', 'alta'],
    required: true
  },
  fechaHora: {
    type: Date,
    default: Date.now
  },
  regionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Region', 
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', 
    required: true
  }
});

module.exports = mongoose.model('Notificacion', NotificacionSchema);