const pagoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true
  },
  subscriptionId: { type: String }, // ID de suscripción en MercadoPago
  status: { type: String, enum: ["ACTIVE", "CANCELLED", "PENDING"], default: "PENDING" },
  monto: { type: Number, required: true },
  moneda: { type: String, default: "ARS" },
  fechaPago: { type: Date, default: Date.now },
  nextPaymentDate: { type: Date },

  // info extendida que te da MercadoPago
  rawResponse: { type: Object } 
}, { timestamps: true });

module.exports = mongoose.model('Pago', pagoSchema);