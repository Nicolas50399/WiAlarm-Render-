const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  direccion: { type: String, required: true },
  ciudad: { type: String, required: true },
  userId: { type: String, required: true } // Si estás relacionando con un usuario
});

module.exports = mongoose.model('Region', RegionSchema);