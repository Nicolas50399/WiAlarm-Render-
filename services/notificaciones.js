const { Expo } = require('expo-server-sdk');

// Crear un cliente de Expo
let expo = new Expo();

// Función para enviar notificaciones
async function enviarNotificacion(tokens, mensaje) {
  let mensajes = [];

  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Token inválido: ${pushToken}`);
      continue;
    }

    mensajes.push({
      to: pushToken,
      sound: 'default',
      title: mensaje.titulo,
      body: mensaje.cuerpo,
      data: mensaje.data || {}
    });
  }

  let chunks = expo.chunkPushNotifications(mensajes);

  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log(ticketChunk);
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = { enviarNotificacion };