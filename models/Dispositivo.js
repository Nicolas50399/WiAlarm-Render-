const mongoose = require('mongoose');

const DispositivoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  macAddress: { type: String, required: true },
  activo: { type: Boolean, required: true },
  regionId: { type: String, required: true }
});

module.exports = mongoose.model('Dispositivo', DispositivoSchema);