const mongoose = require('mongoose');

const CamaraSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  streamUrl: { type: String, required: true },
  activo: { type: Boolean, required: true },
  dispositivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispositivo', required: true },
  tipo: { 
    type: String, 
    enum: ['integrada', 'externa', 'ip'], 
    default: 'integrada' // si siempre va a usar esp32 con cam, esto evita tener que mandarlo
  }
});

module.exports = mongoose.model('Camara', CamaraSchema);