const mongoose = require('mongoose');

const CamaraSchema = new mongoose.Schema({
  streamUrl: { type: String, required: false },
  activo: { type: Boolean, required: true },
  dispositivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispositivo', required: true },
  tipo: { 
    type: String, 
    enum: ['retransmision', 'grabacion'], 
    default: 'grabacion' 
  }
});

module.exports = mongoose.model('Camara', CamaraSchema);