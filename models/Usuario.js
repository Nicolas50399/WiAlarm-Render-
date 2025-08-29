const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  clave: { type: String, required: true }, // luego se encripta con bcrypt
  expoToken: String,
  tipo: {
    type: String,
    enum: ["NORMAL", "PREMIUM", "ADHERENTE"],
    default: "NORMAL"
  },

  // Si es PREMIUM, puede tener adherentes
  adherentes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario"
    }
  ],

  // Si es ADHERENTE, referencia a su PREMIUM
  premiumRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario"
  },

  // Relación con pagos
  pagos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pago"
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Usuario', usuarioSchema);