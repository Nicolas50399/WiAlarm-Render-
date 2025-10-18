const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  direccion: { type: String, required: true },
  ciudad: { type: String, required: true },
  userId: { type: String, required: true },
  modoDeteccion: {
    type: String,
    enum: ["ALARMA", "CUIDADO"],
    default: "ALARMA"
  },
});

module.exports = mongoose.model('Region', RegionSchema);